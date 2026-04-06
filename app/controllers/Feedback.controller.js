'use strict';

const { FeedbackEventService, TripService } = require('@services');
const Response = require('@helpers/Response.helper');

async function getFeedbackByTrip(req, res) {
  const { tripId } = req.params;
  const userId = req.user.id;

  const { data: trip, error: tripError } = await TripService.getById(tripId, userId);
  if (tripError || !trip) return Response.error(res, 'Trip not found', 404);

  const { data, error } = await FeedbackEventService.getByTripId(tripId);
  if (error) return Response.error(res, error.message, 400);

  return Response.success(res, data);
}

async function acknowledgeFeedback(req, res) {
  const { id } = req.params;
  const userId = req.user.id;

  // Look up the event to get its trip_id for ownership verification
  const { data: event, error: eventError } = await FeedbackEventService.getById(id);
  if (eventError || !event) return Response.error(res, 'Feedback event not found', 404);

  const { data: trip, error: tripError } = await TripService.getById(event.trip_id, userId);
  if (tripError || !trip) return Response.error(res, 'Feedback event not found', 404);

  const { data, error } = await FeedbackEventService.acknowledge(id);
  if (error) return Response.error(res, error.message, 400);

  return Response.success(res, data);
}

module.exports = { getFeedbackByTrip, acknowledgeFeedback };
