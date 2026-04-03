'use strict';

/**
 * Normalises a single enriched route option into the API response shape.
 * Routes come from RouteE Compass (energy data) + Mapbox Map Matching (steps).
 */
function routeOptionDTO(route) {
  return {
    label:        route.label,           // 'eco' | 'balanced' | 'fastest'
    distance_km:  route.distance_km,
    duration_sec: route.duration_sec,
    energy_kwh:        route.energy_kwh ?? null,
    elevation_gain_km: route.elevation_gain_km ?? null,
    polyline:          route.polyline,
    warnings:          route.warnings ?? [],
  };
}

function routeSearchResultDTO(routes) {
  return routes.map(routeOptionDTO);
}

module.exports = { routeOptionDTO, routeSearchResultDTO };
