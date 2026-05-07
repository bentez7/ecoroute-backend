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
  const out = coords.filter((_, i) => i % step === 0);
  // Uniform sampling can drop the final coord (e.g. N=270, step=3 keeps up to
  // index 267). Mapbox Map Matching then terminates short of the true
  // destination, so always preserve the last point.
  if (out[out.length - 1] !== coords[coords.length - 1]) {
    out.push(coords[coords.length - 1]);
  }
  return out;
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
  const { matching, geometry5 } = await MapboxService.matchRoute(downsampled);
  // Legacy polyline5 for mobile display; fall back to the RouteE geometry
  const polyline = geometry5 ?? routeeRoute.geometry ?? null;

  return {
    label,
    distance_km:  (summary.trip_distance_miles ?? 0) * MILES_TO_KM,
    duration_sec: Math.round((summary.trip_time_minutes ?? 0) * MINUTES_TO_SEC),
    energy_kwh:   summary.trip_energy_liquid_gallons != null
      ? summary.trip_energy_liquid_gallons * GALLONS_TO_KWH
      : null,
    elevation_gain_km: (summary.trip_elevation_gain_miles ?? 0) * MILES_TO_KM,
    polyline,
    matching,
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

  // Map Matching can fail (matching === null) when the RouteE polyline
  // can't be snapped — typically because Mapbox's tile data and our OSM
  // graph have drifted (e.g. a closed road exists in our graph but not in
  // Mapbox's, or the route trace splits into multiple matchings that we
  // refuse to stitch). When EVERY alternative fails this way, the mobile
  // client would fall back to the synth path on every option and the user
  // gets a route line but no real turn-by-turn cues anywhere.
  //
  // In that case, fall back to a single Mapbox Directions API route. We
  // lose the eco/balanced/fastest comparison for this trip, but the user
  // gets working banner + voice navigation along a road network Mapbox
  // *can* match (because Directions API uses Mapbox's own router).
  const anyMatched = routes.some((r) => r.matching != null);
  if (!anyMatched) {
    Logger.warn(
      '[RoutingService] All RouteE routes failed Map Matching — ' +
      'falling back to Mapbox Directions API for a single route',
    );
    const { matching, geometry5, error: dirErr } =
      await MapboxService.directionsRoute(origin_lat, origin_lng, dest_lat, dest_lng);
    if (matching) {
      // Prefer the RouteE summary numbers from the closest-equivalent
      // alternative (the "fastest" / least_time RouteE route is the one
      // Mapbox Directions effectively replaces) so the energy estimate
      // isn't lost — RouteE still computed energy for *its* geometry,
      // which is a reasonable proxy for the Mapbox driving alternative.
      const fallbackEnergy = routes.find((r) => r.label === 'fastest')
                          ?? routes[0];
      return {
        routes: [
          {
            label:        'fastest',
            distance_km:  matching.distance != null ? matching.distance / 1000 : fallbackEnergy.distance_km,
            duration_sec: matching.duration != null ? Math.round(matching.duration) : fallbackEnergy.duration_sec,
            energy_kwh:   fallbackEnergy.energy_kwh,
            elevation_gain_km: fallbackEnergy.elevation_gain_km,
            polyline:     geometry5 ?? fallbackEnergy.polyline,
            matching,
            warnings: [
              'Eco-route unavailable for this trip — showing Mapbox driving directions because the routing graph and Mapbox tiles disagree on the road network.',
            ],
          },
        ],
        error: null,
      };
    }
    if (dirErr) {
      Logger.warn(`[RoutingService] Directions API fallback also failed: ${dirErr.message}`);
    }
    // Both Map Matching and Directions API failed; let the un-matched
    // RouteE routes through and the mobile synth path will do its best.
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
