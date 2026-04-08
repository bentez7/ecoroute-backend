'use strict';

const { serviceClient, models } = require('@database');
const { FeedbackEventModel, TelemetrySegmentModel } = models;

const { TABLE, FIELDS, SHAP_TO_EVENT_TYPE } = FeedbackEventModel;

async function insert(eventData) {
  return serviceClient
    .from(TABLE)
    .insert(eventData)
    .select()
    .single();
}

// Auto-generates feedback events from suboptimal segments.
// Called after ML repo writes segments — one nudge per suboptimal segment
// where shap_top_feature maps to a known event_type.
async function bulkInsertFromSegments(tripId, segments) {
  const events = [];

  for (const segment of segments) {
    const isSuboptimal = segment[TelemetrySegmentModel.FIELDS.XGBOOST_EFFICIENCY_LABEL]
      === TelemetrySegmentModel.EFFICIENCY_LABELS.SUBOPTIMAL;

    if (!isSuboptimal) continue;

    const shapFeature = segment[TelemetrySegmentModel.FIELDS.SHAP_TOP_FEATURE];
    const eventType   = SHAP_TO_EVENT_TYPE[shapFeature];

    if (!eventType) continue;

    events.push({
      [FIELDS.TRIP_ID]:      tripId,
      [FIELDS.SEGMENT_ID]:   segment.id,
      [FIELDS.EVENT_TYPE]:   eventType,
      [FIELDS.MESSAGE]:      segment._alert || null,
      [FIELDS.TRIGGERED_AT]: new Date().toISOString(),
    });
  }

  if (events.length === 0) return { data: [], error: null };

  return serviceClient.from(TABLE).insert(events).select();
}

async function getById(eventId) {
  return serviceClient
    .from(TABLE)
    .select('*')
    .eq(FIELDS.ID, eventId)
    .single();
}

async function getByTripId(tripId) {
  return serviceClient
    .from(TABLE)
    .select('*')
    .eq(FIELDS.TRIP_ID, tripId)
    .order(FIELDS.TRIGGERED_AT, { ascending: true });
}

async function acknowledge(eventId) {
  return serviceClient
    .from(TABLE)
    .update({ [FIELDS.ACKNOWLEDGED]: true })
    .eq(FIELDS.ID, eventId)
    .select()
    .single();
}

module.exports = { insert, bulkInsertFromSegments, getById, getByTripId, acknowledge };
