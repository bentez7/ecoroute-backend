'use strict';

const axios  = require('axios');
const crypto = require('crypto');

const { MAPBOX_API_KEY } = require('@config');

const MAPBOX_BASE = 'https://api.mapbox.com';

/**
 * Destination autocomplete using Mapbox Search Box Suggest.
 *
 * @param {{ query: string, proximity_lat?: number, proximity_lng?: number }} params
 * @returns {Promise<{ suggestions: Array|null, error: Error|null }>}
 */
async function searchAutocomplete({ query, proximity_lat, proximity_lng }) {
  try {
    const params = {
      q:             query,
      session_token: crypto.randomUUID(),
      access_token:  MAPBOX_API_KEY,
    };

    if (proximity_lat != null && proximity_lng != null) {
      params.proximity = `${proximity_lng},${proximity_lat}`;
    }

    const response = await axios.get(`${MAPBOX_BASE}/search/searchbox/v1/suggest`, { params });
    return { suggestions: response.data.suggestions ?? [], error: null };
  } catch (err) {
    return { suggestions: null, error: err };
  }
}

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

module.exports = { searchAutocomplete, matchRoute };
