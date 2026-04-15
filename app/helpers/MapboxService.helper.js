'use strict';

const axios  = require('axios');
const crypto = require('crypto');

const { MAPBOX_API_KEY } = require('@config');

const MAPBOX_BASE = 'https://api.mapbox.com';

/**
 * Destination autocomplete using Mapbox Search Box API (suggest → retrieve).
 *
 * Step 1: /suggest — returns ranked suggestions (POIs, addresses, places) but no coordinates.
 * Step 2: /retrieve — fetches full details (including lat/lng) for each suggestion.
 *
 * proximity_lat/lng biases ranking so results nearer to the user appear first,
 * but does NOT filter out distant results. The country param does the filtering.
 *
 * @param {{ query: string, proximity_lat?: number, proximity_lng?: number }} params
 * @returns {Promise<{ suggestions: Array|null, error: Error|null }>}
 */
async function searchAutocomplete({ query, proximity_lat, proximity_lng }) {
  try {
    const sessionToken = crypto.randomUUID();

    // --- Step 1: Suggest ---
    const suggestParams = {
      q:             query,
      session_token: sessionToken,
      access_token:  MAPBOX_API_KEY,
      limit:         5,
      language:      'en',
      country:       'MY',
      types:         'poi,address,place',
    };

    if (proximity_lat != null && proximity_lng != null) {
      suggestParams.proximity = `${proximity_lng},${proximity_lat}`;
    }

    const suggestRes = await axios.get(`${MAPBOX_BASE}/search/searchbox/v1/suggest`, { params: suggestParams });
    const rawSuggestions = suggestRes.data.suggestions ?? [];

    if (rawSuggestions.length === 0) {
      return { suggestions: [], error: null };
    }

    // --- Step 2: Retrieve coordinates for each suggestion ---
    const results = await Promise.all(
      rawSuggestions.map(async (s) => {
        try {
          const retrieveRes = await axios.get(
            `${MAPBOX_BASE}/search/searchbox/v1/retrieve/${s.mapbox_id}`,
            { params: { session_token: sessionToken, access_token: MAPBOX_API_KEY } },
          );
          const feature = retrieveRes.data.features?.[0];
          if (!feature) return null;

          return {
            name:         s.name,
            full_address: s.full_address ?? feature.properties?.full_address ?? '',
            lat:          feature.geometry.coordinates[1],
            lng:          feature.geometry.coordinates[0],
          };
        } catch {
          return null;
        }
      }),
    );

    return { suggestions: results.filter(Boolean), error: null };
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
