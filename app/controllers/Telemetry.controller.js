'use strict';

const { TelemetryService, TripService, SegmentService, FeedbackEventService } = require('@services');
const MlService = require('@helpers/MlService.helper');
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

  // Respond immediately — ML analysis runs async so it does not block the mobile app
  res.status(201).json({ success: true, data: { inserted: data.length } });

  // Fire ML segment analysis in background — ML service decides if 60s window is complete
  setImmediate(async () => {
    const result = await MlService.analyseSegment(trip_id, points);
    if (!result?.segment) return;

    const { data: segments, error: segError } = await SegmentService.bulkInsert(trip_id, [result.segment]);
    if (segError) return;

    await FeedbackEventService.bulkInsertFromSegments(trip_id, segments);
  });
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
