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

module.exports = { autocomplete, searchText };
