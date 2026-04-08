'use strict';

const { TelemetryService, TripService, SegmentService, FeedbackEventService } = require('@services');
const MlService = require('@helpers/MlService.helper');
const Response = require('@helpers/Response.helper');
const Logger   = require('@utils/Logger.util');

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

  // Fire ML segment analysis in background.
  // The ML service accumulates a rolling buffer per trip_id and returns one or
  // more complete windows when enough data has arrived.
  setImmediate(async () => {
    try {
      const result = await MlService.analyseSegment(trip_id, points);
      if (!result?.segments?.length) return;

      // Build alert lookup keyed by segment_index — kept separate from the DB
      // row so unknown columns don't break the Supabase insert.
      const alertsByIndex = {};
      for (const s of result.segments) {
        if (s.alert) alertsByIndex[s.segment_index] = s.alert;
      }

      // Map ML response fields to the DB schema.
      // xgboost_efficiency_label is derived from behaviour_label so the
      // FeedbackEventService pipeline (which reads that binary column) keeps working.
      const mapped = result.segments.map(s => ({
        segment_index:            s.segment_index,
        started_at:               s.started_at,
        ended_at:                 s.ended_at,
        avg_speed_kmh:            s.avg_speed_kmh,
        accel_variance:           s.accel_variance,
        braking_frequency:        s.braking_frequency,
        idle_time_pct:            s.idle_time_pct,
        shap_top_feature:         s.shap_top_feature,
        behaviour_label:          s.behaviour_label,
        confidence:               s.confidence,
        xgboost_efficiency_label: s.behaviour_label === 'smooth' ? 'optimal' : 'suboptimal',
      }));

      const { data: segments, error: segError } = await SegmentService.bulkInsert(trip_id, mapped);
      if (segError) return;

      // Re-attach alerts to the DB-returned segments (which now have IDs) so
      // FeedbackEventService can write them to feedback_events.message.
      for (const seg of segments) {
        seg._alert = alertsByIndex[seg.segment_index] || null;
      }

      await FeedbackEventService.bulkInsertFromSegments(trip_id, segments);
    } catch (err) {
      Logger.error(`[Telemetry] async segment analysis failed for trip ${trip_id}: ${err.message}`);
    }
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
