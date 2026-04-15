'use strict';

function placeSuggestionDTO(place) {
  return {
    place_id:     place.place_id,
    name:         place.name,
    full_address: place.full_address,
    lat:          place.lat,
    lng:          place.lng,
  };
}

function placeSuggestionListDTO(places) {
  return places.map(placeSuggestionDTO);
}

module.exports = { placeSuggestionDTO, placeSuggestionListDTO };
