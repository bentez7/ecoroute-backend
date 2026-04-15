'use strict';

const axios = require('axios');

const { GOOGLE_MAPS_API_KEY } = require('@config');

const PLACES_BASE = 'https://places.googleapis.com/v1';

/**
 * Place autocomplete using Google Places API (New).
 *
 * Step 1: /places:autocomplete — returns ranked predictions with placeId but no coordinates.
 * Step 2: /places/{placeId} — fetches full details (including lat/lng) for each prediction.
 *
 * proximity_lat/lng biases ranking so results nearer to the user appear first,
 * but does NOT filter out distant results. includedRegionCodes does the filtering.
 *
 * @param {{ query: string, proximity_lat?: number, proximity_lng?: number }} params
 * @returns {Promise<{ suggestions: Array|null, error: Error|null }>}
 */
async function searchAutocomplete({ query, proximity_lat, proximity_lng }) {
  try {
    const body = {
      input:                query,
      includedRegionCodes: ['my'],
      languageCode:        'en',
    };

    if (proximity_lat != null && proximity_lng != null) {
      body.locationBias = {
        circle: {
          center: { latitude: proximity_lat, longitude: proximity_lng },
          radius: 50000.0,
        },
      };
    }

    const autocompleteRes = await axios.post(
      `${PLACES_BASE}/places:autocomplete`,
      body,
      { headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': GOOGLE_MAPS_API_KEY } },
    );

    const predictions = autocompleteRes.data.suggestions ?? [];

    if (predictions.length === 0) {
      return { suggestions: [], error: null };
    }

    // Fetch coordinates for each prediction via Place Details
    const results = await Promise.all(
      predictions.map(async (s) => {
        const prediction = s.placePrediction;
        if (!prediction?.placeId) return null;

        try {
          const detailRes = await axios.get(
            `${PLACES_BASE}/places/${prediction.placeId}`,
            {
              headers: {
                'X-Goog-Api-Key':   GOOGLE_MAPS_API_KEY,
                'X-Goog-FieldMask': 'displayName,formattedAddress,location',
              },
            },
          );

          const place = detailRes.data;
          if (!place.location) return null;

          return {
            place_id:     prediction.placeId,
            name:         prediction.structuredFormat?.mainText?.text ?? place.displayName?.text ?? '',
            full_address: place.formattedAddress ?? prediction.text?.text ?? '',
            lat:          place.location.latitude,
            lng:          place.location.longitude,
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
 * Full text search using Google Places API (New).
 *
 * Unlike autocomplete, text search returns coordinates directly — no second call needed.
 *
 * @param {{ query: string, proximity_lat?: number, proximity_lng?: number }} params
 * @returns {Promise<{ results: Array|null, error: Error|null }>}
 */
async function searchText({ query, proximity_lat, proximity_lng }) {
  try {
    const body = {
      textQuery:    query,
      languageCode: 'en',
    };

    if (proximity_lat != null && proximity_lng != null) {
      body.locationBias = {
        circle: {
          center: { latitude: proximity_lat, longitude: proximity_lng },
          radius: 50000.0,
        },
      };
    }

    const searchRes = await axios.post(
      `${PLACES_BASE}/places:searchText`,
      body,
      {
        headers: {
          'Content-Type':     'application/json',
          'X-Goog-Api-Key':   GOOGLE_MAPS_API_KEY,
          'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location',
        },
      },
    );

    const places = searchRes.data.places ?? [];

    const results = places.map((p) => ({
      place_id:     p.id,
      name:         p.displayName?.text ?? '',
      full_address: p.formattedAddress ?? '',
      lat:          p.location?.latitude,
      lng:          p.location?.longitude,
    }));

    return { results, error: null };
  } catch (err) {
    return { results: null, error: err };
  }
}

module.exports = { searchAutocomplete, searchText };
