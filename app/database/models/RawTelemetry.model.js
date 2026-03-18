'use strict';

const TABLE = 'raw_telemetry';

const FIELDS = {
  ID:          'id',
  TRIP_ID:     'trip_id',
  RECORDED_AT: 'recorded_at',
  LAT:         'lat',
  LNG:         'lng',
  SPEED_MS:    'speed_ms',
  ACCEL_MS2:   'accel_ms2',
  ALTITUDE_M:  'altitude_m',
  HEADING_DEG: 'heading_deg',
};

function create(overrides = {}) {
  return {
    id:          null,
    trip_id:     null,
    recorded_at: null,
    lat:         null,
    lng:         null,
    speed_ms:    null,
    accel_ms2:   null,
    altitude_m:  null,
    heading_deg: null,
    ...overrides,
  };
}

module.exports = { TABLE, FIELDS, create };
