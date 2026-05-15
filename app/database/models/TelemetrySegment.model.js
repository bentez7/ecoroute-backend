'use strict';

const TABLE = 'telemetry_segments';

const FIELDS = {
  ID:                       'id',
  TRIP_ID:                  'trip_id',
  SEGMENT_INDEX:            'segment_index',
  STARTED_AT:               'started_at',
  ENDED_AT:                 'ended_at',
  AVG_SPEED_KMH:            'avg_speed_kmh',
  SPEED_VARIANCE:           'speed_variance',
  ACCEL_VARIANCE:           'accel_variance',
  BRAKING_FREQUENCY:        'braking_frequency',
  IDLE_TIME_PCT:            'idle_time_pct',
  BEHAVIOUR_LABEL:          'behaviour_label',
  CONFIDENCE:               'confidence',
  XGBOOST_EFFICIENCY_LABEL: 'xgboost_efficiency_label',
  SHAP_TOP_FEATURE:         'shap_top_feature',
  POLYLINE:                 'polyline',
  START_LAT:                'start_lat',
  START_LNG:                'start_lng',
  END_LAT:                  'end_lat',
  END_LNG:                  'end_lng',
  CREATED_AT:               'created_at',
};

// 3-way XGBoost classification returned by the ML service
const BEHAVIOUR_LABELS = {
  SMOOTH:     'smooth',
  MODERATE:   'moderate',
  AGGRESSIVE: 'aggressive',
};

// Derived binary label used by the feedback-event pipeline
const EFFICIENCY_LABELS = {
  OPTIMAL:    'optimal',
  SUBOPTIMAL: 'suboptimal',
};

function create(overrides = {}) {
  return {
    id:                       null,
    trip_id:                  null,
    segment_index:            null,
    started_at:               null,
    ended_at:                 null,
    avg_speed_kmh:            null,
    speed_variance:           null,
    accel_variance:           null,
    braking_frequency:        null,
    idle_time_pct:            null,
    behaviour_label:          null,
    confidence:               null,
    xgboost_efficiency_label: null,
    shap_top_feature:         null,
    polyline:                 null,
    start_lat:                null,
    start_lng:                null,
    end_lat:                  null,
    end_lng:                  null,
    created_at:               null,
    ...overrides,
  };
}

module.exports = { TABLE, FIELDS, BEHAVIOUR_LABELS, EFFICIENCY_LABELS, create };
