'use strict';

const axios         = require('axios');
const MapboxService = require('@helpers/MapboxService.helper');

const BASE_URL = process.env.ROUTING_SERVICE_URL;

// Three route variants — energy-optimal, time-optimal, balanced
const OBJECTIVES = [
  { label: 'eco',      weights: { energy: 1.0, time: 0.1, distance: 0.0 } },
  { label: 'balanced', weights: { energy: 0.5, time: 0.5, distance: 0.0 } },
  { label: 'fastest',  weights: { energy: 0.1, time: 1.0, distance: 0.0 } },
];

/**
 * Reduce a coordinate array to at most `max` points using uniform nth-point sampling.
 *
 * @param {Array<{ lat: number, lng: number }>} coords
 * @param {number} max
 * @returns {Array<{ lat: number, lng: number }>}
 */
function _downsample(coords, max) {
  if (coords.length <= max) return coords;
  const step = Math.ceil(coords.length / max);
  return coords.filter((_, i) => i % step === 0);
}

/**
 * Call RouteE Compass for a single objective, then enrich with Mapbox Map Matching.
 *
 * @returns {Promise<object|null>}  Route object, or null if RouteE failed.
 */
async function _fetchRoute(origin, destination, objective) {
  let routeeData;
  try {
    const response = await axios.post(`${BASE_URL}/route`, {
      origin,
      destination,
      weights: objective.weights,
    });
    routeeData = response.data;
  } catch {
    return null;  // RouteE unavailable for this objective
  }

  const geometry   = routeeData.geometry ?? [];
  const downsampled = _downsample(geometry, 90);

  // Enrich with turn-by-turn steps — degrade gracefully if Map Matching fails
  const { matching } = await MapboxService.matchRoute(downsampled);

  const steps   = matching?.legs?.flatMap(leg => leg.steps ?? []) ?? [];
  const polyline = matching?.geometry ?? routeeData.polyline ?? null;

  return {
    label:        objective.label,
    distance_km:  routeeData.distance_km,
    duration_sec: routeeData.duration_sec,
    energy_kwh:   routeeData.energy_kwh ?? null,
    polyline,
    steps,
    warnings:     routeeData.warnings ?? [],
  };
}

/**
 * Search for route options between an origin and destination.
 * Calls RouteE Compass three times (eco / balanced / fastest) in parallel,
 * then enriches each result with Mapbox Map Matching turn-by-turn instructions.
 *
 * @param {{ origin_lat: number, origin_lng: number, dest_lat: number, dest_lng: number }} params
 * @returns {Promise<{ routes: Array|null, error: Error|null }>}
 */
async function searchRoutes({ origin_lat, origin_lng, dest_lat, dest_lng }) {
  const origin      = { lat: origin_lat, lng: origin_lng };
  const destination = { lat: dest_lat,   lng: dest_lng   };

  const results = await Promise.allSettled(
    OBJECTIVES.map(obj => _fetchRoute(origin, destination, obj)),
  );

  const routes = results
    .filter(r => r.status === 'fulfilled' && r.value !== null)
    .map(r => r.value);

  if (routes.length === 0) {
    return { routes: null, error: new Error('Routing service unavailable') };
  }

  return { routes, error: null };
}

module.exports = { searchRoutes };
