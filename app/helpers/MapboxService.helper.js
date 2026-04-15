'use strict';

const axios = require('axios');

const { MAPBOX_API_KEY } = require('@config');

const MAPBOX_BASE = 'https://api.mapbox.com';

/**
 * Enrich a route geometry with turn-by-turn instructions using Mapbox Map Matching.
 *
 * @param {Array<{ lat: number, lng: number }>} coordinates  Pre-downsampled (≤100 points)
 * @returns {Promise<{ matching: object|null, error: Error|null }>}
 */
async function matchRoute(coordinates) {
  try {
    // Map Matching expects semicolon-separated "lng,lat" pairs in the URL path
    const coordString = coordinates
      .map(c => `${c.lng},${c.lat}`)
      .join(';');

    const response = await axios.get(
      `${MAPBOX_BASE}/matching/v5/mapbox/driving/${encodeURIComponent(coordString)}`,
      {
        params: {
          geometries:   'polyline',
          overview:     'full',
          access_token: MAPBOX_API_KEY,
        },
      },
    );

    const matching = response.data.matchings?.[0] ?? null;
    return { matching, error: null };
  } catch (err) {
    return { matching: null, error: err };
  }
}

module.exports = { matchRoute };
