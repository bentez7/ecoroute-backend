'use strict';

const axios         = require('axios');
const polylineCodec = require('@mapbox/polyline');

const { MAPBOX_API_KEY } = require('@config');
const Logger        = require('@utils/Logger.util');

const MAPBOX_BASE = 'https://api.mapbox.com';

// Mapbox default search radius is 5m per point; small roads / campus edges
// easily fall outside that, which splits the trace into multiple matchings and
// truncates our returned polyline. 50m is the documented max.
const MATCH_RADIUS_METERS = 50;

/**
 * Enrich a route geometry with turn-by-turn instructions using Mapbox Map Matching.
 *
 * Returns the raw matching (polyline6 + steps + banner/voice instructions) for
 * later reuse by the iOS URLProtocol interceptor, plus a legacy polyline5
 * `geometry5` string for the route-select display path on mobile.
 *
 * @param {Array<{ lat: number, lng: number }>} coordinates  Pre-downsampled (≤100 points)
 * @returns {Promise<{ matching: object|null, geometry5: string|null, error: Error|null }>}
 */
async function matchRoute(coordinates) {
  try {
    // Map Matching expects semicolon-separated "lng,lat" pairs in the URL path
    const coordString = coordinates
      .map(c => `${c.lng},${c.lat}`)
      .join(';');

    const radiuses = coordinates.map(() => MATCH_RADIUS_METERS).join(';');

    const response = await axios.get(
      `${MAPBOX_BASE}/matching/v5/mapbox/driving/${encodeURIComponent(coordString)}`,
      {
        params: {
          geometries:          'polyline6',
          overview:            'full',
          steps:               true,
          banner_instructions: true,
          voice_instructions:  true,
          voice_units:         'metric',
          annotations:         'duration,distance,speed',
          radiuses,
          access_token:        MAPBOX_API_KEY,
        },
      },
    );

    const matchings = response.data.matchings ?? [];
    if (matchings.length === 0) {
      return { matching: null, geometry5: null, error: null };
    }

    // Mapbox returns multiple matchings whenever any input point falls outside
    // the search radius from a connectable road segment. Stitching them
    // produces visible loops at every seam (each matching is snapped
    // independently and re-enters the road from a different direction) AND
    // breaks the (legs+1 == waypoints) invariant the iOS Nav SDK's
    // RouteResponse decoder relies on. Drop the matching entirely in that
    // case — the caller will fall back to the unmatched RouteE polyline,
    // which has no per-step instructions but at least renders correctly and
    // doesn't crash the v2 decoder.
    if (matchings.length > 1) {
      Logger.warn(
        `[MapboxService] matchRoute returned ${matchings.length} matchings ` +
        `for ${coordinates.length} input points — falling back to unmatched geometry`,
      );
      return { matching: null, geometry5: null, error: null };
    }

    const matching = matchings[0];
    // Re-encode polyline6 geometry to polyline5 for the legacy mobile display field.
    const decoded = polylineCodec.decode(matching.geometry, 6);
    const geometry5 = polylineCodec.encode(decoded, 5);

    return { matching, geometry5, error: null };
  } catch (err) {
    return { matching: null, geometry5: null, error: err };
  }
}

/**
 * Fetch a navigable driving route from Mapbox Directions API using only
 * origin + destination. Used as a fallback when Map Matching can't snap our
 * RouteE Compass geometry (closed road, OSM-vs-Mapbox tile drift, etc.).
 *
 * Returns the same shape as `matchRoute` so the caller can substitute one
 * for the other without changing downstream code: `{ matching, geometry5,
 * error }`. The `matching` field is the first route from the Directions
 * response — same Mapbox-Directions-API-shape, so the existing
 * Route.dto.js wrap-and-collapse pipeline works on it unchanged.
 *
 * @param {number} originLat
 * @param {number} originLng
 * @param {number} destLat
 * @param {number} destLng
 * @returns {Promise<{ matching: object|null, geometry5: string|null, error: Error|null }>}
 */
async function directionsRoute(originLat, originLng, destLat, destLng) {
  try {
    const coordString = `${originLng},${originLat};${destLng},${destLat}`;

    const response = await axios.get(
      `${MAPBOX_BASE}/directions/v5/mapbox/driving/${encodeURIComponent(coordString)}`,
      {
        params: {
          geometries:          'polyline6',
          overview:            'full',
          steps:               true,
          banner_instructions: true,
          voice_instructions:  true,
          voice_units:         'metric',
          annotations:         'duration,distance,speed',
          access_token:        MAPBOX_API_KEY,
        },
      },
    );

    const routes = response.data?.routes ?? [];
    if (routes.length === 0) {
      return { matching: null, geometry5: null, error: null };
    }

    const matching = routes[0];
    // Re-encode polyline6 → polyline5 for the legacy mobile display field
    // (route.polyline). The injected `directions_json` keeps polyline6.
    const decoded   = polylineCodec.decode(matching.geometry, 6);
    const geometry5 = polylineCodec.encode(decoded, 5);

    return { matching, geometry5, error: null };
  } catch (err) {
    return { matching: null, geometry5: null, error: err };
  }
}

module.exports = { matchRoute, directionsRoute };
