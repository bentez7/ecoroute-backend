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
  ENERGY_KWH:               'energy_kwh',
  XGBOOST_EFFICIENCY_LABEL: 'xgboost_efficiency_label',
  SHAP_TOP_FEATURE:         'shap_top_feature',
  CREATED_AT:               'created_at',
};

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
    energy_kwh:               null,
    xgboost_efficiency_label: null,
    shap_top_feature:         null,
    created_at:               null,
    ...overrides,
  };
}

module.exports = { TABLE, FIELDS, EFFICIENCY_LABELS, create };
