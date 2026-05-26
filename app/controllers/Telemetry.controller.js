'use strict';

const polylineCodec = require('@mapbox/polyline');
const { TelemetryService, TripService, SegmentService, FeedbackEventService } = require('@services');
const MlService = require('@helpers/MlService.helper');
const Response = require('@helpers/Response.helper');
const Logger   = require('@utils/Logger.util');

// Build segment geometry (encoded polyline + start/end lat·lng) from the GPS
// points falling inside [started_at, ended_at]. Falls back to a raw_telemetry
// lookup when the current batch doesn't fully cover the window (e.g. the window
// straddles two batches).
async function _buildSegmentGeometry(tripId, segment, currentBatchPoints) {
  const startMs = Date.parse(segment.started_at);
  const endMs   = Date.parse(segment.ended_at);

  const inRange = (p) => {
    const t = Date.parse(p.recorded_at);
    return t >= startMs && t <= endMs;
  };

  let pts = currentBatchPoints.filter(inRange);

  if (pts.length < 2) {
    const { data } = await TelemetryService.getByTimeRange(
      tripId, segment.started_at, segment.ended_at,
    );
    pts = data ?? [];
  }

  if (pts.length < 2) return null;

  const polyline = polylineCodec.encode(pts.map(p => [p.lat, p.lng]));
  return {
    polyline,
    start_lat: pts[0].lat,
    start_lng: pts[0].lng,
    end_lat:   pts[pts.length - 1].lat,
    end_lng:   pts[pts.length - 1].lng,
  };
}

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

      // Build alert + severity lookup keyed by segment_index — kept separate
      // from the DB row so unknown columns don't break the Supabase insert.
      // ML emits both fields together for non-smooth segments.
      const feedbackByIndex = {};
      for (const s of result.segments) {
        if (s.alert) {
          feedbackByIndex[s.segment_index] = { alert: s.alert, severity: s.severity };
        }
      }

      // Map ML response fields to the DB schema, attaching segment geometry so
      // the mobile app can render each window as a coloured overlay on the route.
      // xgboost_efficiency_label is derived from behaviour_label so the
      // FeedbackEventService pipeline (which reads that binary column) keeps working.
      const mapped = await Promise.all(result.segments.map(async (s) => {
        const geom = await _buildSegmentGeometry(trip_id, s, points);
        return {
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
          polyline:                 geom?.polyline  ?? null,
          start_lat:                geom?.start_lat ?? null,
          start_lng:                geom?.start_lng ?? null,
          end_lat:                  geom?.end_lat   ?? null,
          end_lng:                  geom?.end_lng   ?? null,
        };
      }));

      const { data: segments, error: segError } = await SegmentService.bulkInsert(trip_id, mapped);
      if (segError) return;

      // Re-attach alert + severity to the DB-returned segments (which now have IDs)
      // so FeedbackEventService can write them to feedback_events.
      for (const seg of segments) {
        const fb = feedbackByIndex[seg.segment_index];
        seg._alert    = fb?.alert    || null;
        seg._severity = fb?.severity || null;
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
