'use strict';

const polylineCodec = require('@mapbox/polyline');
const Logger        = require('@utils/Logger.util');

/**
 * Wraps a raw Map Matching `matching` object as a Mapbox-Directions-shape
 * response so the iOS Nav SDK's RouteResponse decoder can build a
 * NavigationRoute from it verbatim.
 *
 * The matching is single-leg by construction: MapboxService.matchRoute sends
 * `waypoints=0;N-1` so only the first and last tracepoints separate legs.
 * That satisfies the decoder's `legs.length + 1 === waypoints.length`
 * invariant against our 2-waypoint (origin + destination) options on the
 * client, and the steps carry Mapbox-emitted banner / voice cues verbatim.
 */
function _directionsResponseFromMatching(matching) {
  if (!matching) return null;

  const coords = polylineCodec.decode(matching.geometry ?? '', 6);
  if (coords.length < 2) return null;

  const [firstLat, firstLng] = coords[0];
  const [lastLat,  lastLng]  = coords[coords.length - 1];

  Logger.info(
    `[Route.dto] matching wrapped: ` +
    `legs=${(matching.legs ?? []).length} ` +
    `distance=${matching.distance} ` +
    `duration=${matching.duration} ` +
    `steps=${matching.legs?.[0]?.steps?.length}`,
  );

  return {
    code:      'Ok',
    uuid:      `ecoroute-${Date.now()}`,
    routes:    [matching],
    waypoints: [
      { distance: 0, name: 'Origin',      location: [firstLng, firstLat] },
      { distance: 0, name: 'Destination', location: [lastLng,  lastLat]  },
    ],
  };
}

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
    directions_json:   _directionsResponseFromMatching(route.matching),
    warnings:          route.warnings ?? [],
  };
}

function routeSearchResultDTO(routes) {
  return routes.map(routeOptionDTO);
}

module.exports = { routeOptionDTO, routeSearchResultDTO };
