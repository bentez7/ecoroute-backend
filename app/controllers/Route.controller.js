'use strict';

const { RouteComparisonService, TripService } = require('@services');
const { RouteDTO } = require('@dto');
const RoutingService = require('@helpers/RoutingService.helper');
const Response = require('@helpers/Response.helper');

async function searchRoutes(req, res) {
  const { origin_lat, origin_lng, dest_lat, dest_lng, model_name } = req.body;

  const { routes, error } = await RoutingService.searchRoutes({
    origin_lat, origin_lng, dest_lat, dest_lng, model_name,
  });
  if (error) return Response.error(res, 'Routing service unavailable', 503);

  return Response.success(res, RouteDTO.routeSearchResultDTO(routes));
}

async function getRouteComparisonsByTrip(req, res) {
  const { tripId } = req.params;
  const userId = req.user.id;

  // Ownership check
  const { data: trip, error: tripError } = await TripService.getById(tripId, userId);
  if (tripError || !trip) return Response.error(res, 'Trip not found', 404);

  const { data, error } = await RouteComparisonService.getByTripId(tripId);
  if (error) return Response.error(res, error.message, 400);

  return Response.success(res, data);
}

module.exports = { searchRoutes, getRouteComparisonsByTrip };
