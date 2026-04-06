'use strict';

const { SegmentService, TripService } = require('@services');
const Response = require('@helpers/Response.helper');

async function getSegmentsByTrip(req, res) {
  const { tripId } = req.params;
  const userId = req.user.id;

  const { data: trip, error: tripError } = await TripService.getById(tripId, userId);
  if (tripError || !trip) return Response.error(res, 'Trip not found', 404);

  const { data, error } = await SegmentService.getByTripId(tripId);
  if (error) return Response.error(res, error.message, 400);

  return Response.success(res, data);
}

async function getSegmentById(req, res) {
  const { id } = req.params;
  const userId = req.user.id;

  const { data: segment, error: segError } = await SegmentService.getById(id);
  if (segError || !segment) return Response.error(res, 'Segment not found', 404);

  // Verify the segment's trip belongs to this user
  const { data: trip, error: tripError } = await TripService.getById(segment.trip_id, userId);
  if (tripError || !trip) return Response.error(res, 'Segment not found', 404);

  return Response.success(res, segment);
}

module.exports = { getSegmentsByTrip, getSegmentById };
