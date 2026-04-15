'use strict';

const axios         = require('axios');
const polylineCodec = require('@mapbox/polyline');
const MapboxService = require('@helpers/MapboxService.helper');
const { calcCO2 }   = require('@helpers/Emission.helper');
const Logger        = require('@utils/Logger.util');

const { ROUTEE_API_KEY } = require('@config');

const BASE_URL = process.env.ROUTING_SERVICE_URL;

// RouteE Compass route name → our label
const ROUTE_LABEL_MAP = {
  least_energy: 'eco',
  balanced:     'balanced',
  least_time:   'fastest',
};

// 1 US gallon of gasoline ≡ 33.7 kWh (GGE)
const GALLONS_TO_KWH  = 33.7;
const MILES_TO_KM     = 1.609344;
const MINUTES_TO_SEC  = 60;

/**
 * Reduce a [lat, lng] coordinate array to at most `max` points via uniform sampling.
 */
function _downsample(coords, max) {
  if (coords.length <= max) return coords;
  const step = Math.ceil(coords.length / max);
  return coords.filter((_, i) => i % step === 0);
}

/**
 * Enrich a single RouteE route with Mapbox Map Matching turn-by-turn steps.
 * Degrades gracefully — if Map Matching fails the route is still returned without steps.
 *
 * @param {{ name: string, summary: object, geometry: string }} routeeRoute
 * @returns {Promise<object>}
 */
async function _enrichRoute(routeeRoute) {
  const label   = ROUTE_LABEL_MAP[routeeRoute.name] ?? routeeRoute.name;
  const summary = routeeRoute.summary ?? {};

  // Decode Google-encoded polyline → [[lat, lng], ...]
  const latLngPairs = polylineCodec.decode(routeeRoute.geometry ?? '');

  // Convert to { lat, lng } objects and downsample for Map Matching (max 100 pts)
  const coordObjects = latLngPairs.map(([lat, lng]) => ({ lat, lng }));
  const downsampled  = _downsample(coordObjects, 90);

  // Enrich with turn-by-turn steps; degrade gracefully if unavailable
  const { matching } = await MapboxService.matchRoute(downsampled);
  // Prefer the map-matched polyline (road-snapped); fall back to original
  const polyline = matching?.geometry ?? routeeRoute.geometry ?? null;

  return {
    label,
    distance_km:  (summary.trip_distance_miles ?? 0) * MILES_TO_KM,
    duration_sec: Math.round((summary.trip_time_minutes ?? 0) * MINUTES_TO_SEC),
    energy_kwh:   summary.trip_energy_liquid_gallons != null
      ? summary.trip_energy_liquid_gallons * GALLONS_TO_KWH
      : null,
    elevation_gain_km: (summary.trip_elevation_gain_miles ?? 0) * MILES_TO_KM,
    polyline,
    warnings: [],
  };
}

/**
 * Fetch all three route alternatives (least_energy / balanced / least_time) from
 * RouteE Compass in a single request, then enrich each with Mapbox Map Matching.
 *
 * @param {{
 *   origin_lat: number, origin_lng: number,
 *   dest_lat: number,   dest_lng: number,
 *   model_name?: string
 * }} params
 * @returns {Promise<{ routes: Array|null, error: Error|null }>}
 */
async function searchRoutes({ origin_lat, origin_lng, dest_lat, dest_lng, model_name }) {
  let compassResponse;
  try {
    // RouteE Compass uses x = longitude, y = latitude
    compassResponse = await axios.post(
      `${BASE_URL}/route`,
      {
        origin_x:      origin_lng,
        origin_y:      origin_lat,
        destination_x: dest_lng,
        destination_y: dest_lat,
        ...(model_name ? { model_name } : {}),
      },
      {
        headers: { 'X-API-Key': ROUTEE_API_KEY },
      },
    );
  } catch (err) {
    return { routes: null, error: new Error('Routing service unavailable') };
  }

  const compassRoutes = compassResponse.data?.routes;
  if (!Array.isArray(compassRoutes) || compassRoutes.length === 0) {
    return { routes: null, error: new Error('Routing service returned no routes') };
  }

  // Enrich all routes in parallel; drop any that fail
  const results = await Promise.allSettled(
    compassRoutes.map(r => _enrichRoute(r)),
  );

  const routes = results
    .filter(r => r.status === 'fulfilled')
    .map(r => r.value);

  if (routes.length === 0) {
    return { routes: null, error: new Error('Failed to process routes') };
  }

  return { routes, error: null };
}

/**
 * Compute post-trip route comparisons using RouteE Compass.
 * Called once after a trip ends to populate the route_comparisons table with
 * eco / balanced / fastest alternatives and their estimated energy / CO2.
 *
 * @param {{
 *   origin_lat: number, origin_lng: number,
 *   dest_lat:   number, dest_lng:   number,
 *   model_name?: string,
 *   fuel_type:  string
 * }} params
 * @returns {Promise<{ comparisons: Array|null, error: Error|null }>}
 */
async function computeRouteComparisons({ origin_lat, origin_lng, dest_lat, dest_lng, model_name, fuel_type }) {
  const { routes, error } = await searchRoutes({ origin_lat, origin_lng, dest_lat, dest_lng, model_name });
  if (error || !routes) {
    Logger.warn(`[RoutingService] computeRouteComparisons failed: ${error?.message}`);
    return { comparisons: null, error };
  }

  const comparisons = routes.map(route => ({
    route_label:          route.label,
    distance_km:          route.distance_km,
    estimated_energy_kwh: route.energy_kwh,
    estimated_co2_kg:     route.energy_kwh != null ? calcCO2(route.energy_kwh, fuel_type) : null,
    elevation_gain_m:     route.elevation_gain_km != null ? route.elevation_gain_km * 1000 : null,
    route_polyline:       route.polyline,
  }));

  return { comparisons, error: null };
}

module.exports = { searchRoutes, computeRouteComparisons };
