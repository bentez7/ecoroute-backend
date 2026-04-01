'use strict';

const TABLE = 'trips';

const FIELDS = {
  ID:                    'id',
  USER_ID:               'user_id',
  VEHICLE_ID:            'vehicle_id',
  STARTED_AT:            'started_at',
  ENDED_AT:              'ended_at',
  DISTANCE_KM:           'distance_km',
  DURATION_SEC:          'duration_sec',
  ROUTE_POLYLINE:        'route_polyline',
  ORIGIN_LAT:            'origin_lat',
  ORIGIN_LNG:            'origin_lng',
  ORIGIN_ADDRESS:        'origin_address',
  DEST_LAT:              'dest_lat',
  DEST_LNG:              'dest_lng',
  DEST_ADDRESS:          'dest_address',
  FUEL_TYPE:             'fuel_type',
  ENERGY_KWH:            'energy_kwh',
  CO2_KG:                'co2_kg',
  EXCESS_VS_OPTIMAL_PCT: 'excess_vs_optimal_pct',
  DRIVER_PROFILE:        'driver_profile',
  STATUS:                'status',
  CREATED_AT:            'created_at',
};

const TRIP_STATUSES = {
  ACTIVE:    'active',
  ENDED:     'ended',
  CANCELLED: 'cancelled',
};

const DRIVER_PROFILES = {
  SMOOTH:     'smooth',
  NORMAL:     'normal',
  AGGRESSIVE: 'aggressive',
};

function create(overrides = {}) {
  return {
    id:                    null,
    user_id:               null,
    vehicle_id:            null,
    started_at:            null,
    ended_at:              null,
    distance_km:           null,
    duration_sec:          null,
    route_polyline:        null,
    origin_lat:            null,
    origin_lng:            null,
    origin_address:        null,
    dest_lat:              null,
    dest_lng:              null,
    dest_address:          null,
    fuel_type:             null,
    energy_kwh:            null,
    co2_kg:                null,
    excess_vs_optimal_pct: null,
    driver_profile:        null,
    status:                'active',
    created_at:            null,
    ...overrides,
  };
}

module.exports = { TABLE, FIELDS, TRIP_STATUSES, DRIVER_PROFILES, create };
