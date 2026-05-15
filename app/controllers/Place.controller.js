'use strict';

const { PlaceDTO } = require('@dto');
const GooglePlacesService = require('@helpers/GooglePlacesService.helper');
const Response = require('@helpers/Response.helper');

async function autocomplete(req, res) {
  const { query, proximity_lat, proximity_lng } = req.body;

  const { suggestions, error } = await GooglePlacesService.searchAutocomplete({
    query, proximity_lat, proximity_lng,
  });
  if (error) return Response.error(res, 'Place search service unavailable', 503);

  return Response.success(res, PlaceDTO.placeSuggestionListDTO(suggestions));
}

async function searchText(req, res) {
  const { query, proximity_lat, proximity_lng } = req.body;

  const { results, error } = await GooglePlacesService.searchText({
    query, proximity_lat, proximity_lng,
  });
  if (error) return Response.error(res, 'Place search service unavailable', 503);

  return Response.success(res, PlaceDTO.placeSuggestionListDTO(results));
}

async function reverseGeocode(req, res) {
  const lat = parseFloat(req.query.lat);
  const lng = parseFloat(req.query.lng);

  const { name, address, error } = await GooglePlacesService.reverseGeocode({ lat, lng });
  if (error) return Response.error(res, 'Reverse geocode service unavailable', 503);

  return Response.success(res, { name, address });
}

module.exports = { autocomplete, searchText, reverseGeocode };
