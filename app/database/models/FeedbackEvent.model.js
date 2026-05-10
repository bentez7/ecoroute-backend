'use strict';

const TABLE = 'feedback_events';

const FIELDS = {
  ID:           'id',
  TRIP_ID:      'trip_id',
  SEGMENT_ID:   'segment_id',
  EVENT_TYPE:   'event_type',
  SEVERITY:     'severity',
  MESSAGE:      'message',
  TRIGGERED_AT: 'triggered_at',
  ACKNOWLEDGED: 'acknowledged',
};

const EVENT_TYPES = {
  HARSH_ACCEL:    'harsh_accel',
  HARSH_BRAKE:    'harsh_brake',
  IDLING:         'idling',
  SPEED_VARIANCE: 'speed_variance',
};

const SEVERITIES = {
  INFO:     'info',
  WARNING:  'warning',
  CRITICAL: 'critical',
};

// Maps shap_top_feature values from TelemetrySegment to feedback event_type
const SHAP_TO_EVENT_TYPE = {
  accel_variance:    EVENT_TYPES.HARSH_ACCEL,
  braking_frequency: EVENT_TYPES.HARSH_BRAKE,
  idle_time_pct:     EVENT_TYPES.IDLING,
  speed_variance:    EVENT_TYPES.SPEED_VARIANCE,
};

// Default UI severity per event_type. Hard-driving cues (sudden accel /
// brake) warrant a sticky warning banner; ambient nudges (idling, speed
// variance) are dismissable info.
const EVENT_TYPE_TO_SEVERITY = {
  [EVENT_TYPES.HARSH_ACCEL]:    SEVERITIES.WARNING,
  [EVENT_TYPES.HARSH_BRAKE]:    SEVERITIES.WARNING,
  [EVENT_TYPES.IDLING]:         SEVERITIES.INFO,
  [EVENT_TYPES.SPEED_VARIANCE]: SEVERITIES.INFO,
};

function create(overrides = {}) {
  return {
    id:           null,
    trip_id:      null,
    segment_id:   null,
    event_type:   null,
    severity:     null,
    message:      null,
    triggered_at: null,
    acknowledged: false,
    ...overrides,
  };
}

module.exports = {
  TABLE,
  FIELDS,
  EVENT_TYPES,
  SEVERITIES,
  SHAP_TO_EVENT_TYPE,
  EVENT_TYPE_TO_SEVERITY,
  create,
};
