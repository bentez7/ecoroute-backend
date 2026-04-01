'use strict';

const { TelemetryService, TripService } = require('@services');
const Response = require('@helpers/Response.helper');

async function bulkInsertTelemetry(req, res) {
  const { trip_id, points } = req.body;
  const userId = req.user.id;

  // Ownership check — ensures the trip belongs to this user
  const { data: trip, error: tripError } = await TripService.getById(trip_id, userId);
  if (tripError || !trip) return Response.error(res, 'Trip not found', 404);

  // Only allow telemetry on active trips
  if (trip.status !== 'active') {
    return Response.error(res, 'Cannot insert telemetry for a trip that is not active', 409);
  }

  const { data, error } = await TelemetryService.bulkInsert(trip_id, points);
  if (error) return Response.error(res, error.message, 400);

  return Response.success(res, { inserted: data.length }, 201);
}

async function getTelemetryByTrip(req, res) {
  const { tripId } = req.params;
  const userId = req.user.id;

  // Ownership check
  const { data: trip, error: tripError } = await TripService.getById(tripId, userId);
  if (tripError || !trip) return Response.error(res, 'Trip not found', 404);

  const { data, error } = await TelemetryService.getByTripId(tripId);
  if (error) return Response.error(res, error.message, 400);

  return Response.success(res, data);
}

module.exports = { bulkInsertTelemetry, getTelemetryByTrip };
