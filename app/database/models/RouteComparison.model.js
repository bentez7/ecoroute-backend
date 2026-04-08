'use strict';

const TABLE = 'route_comparisons';

const FIELDS = {
  ID:                   'id',
  TRIP_ID:              'trip_id',
  ROUTE_LABEL:          'route_label',
  DISTANCE_KM:          'distance_km',
  ESTIMATED_ENERGY_KWH: 'estimated_energy_kwh',
  ESTIMATED_CO2_KG:     'estimated_co2_kg',
  ELEVATION_GAIN_M:     'elevation_gain_m',
  ROUTE_POLYLINE:       'route_polyline',
  CREATED_AT:           'created_at',
};

const ROUTE_LABELS = {
  ECO:      'eco',
  BALANCED: 'balanced',
  FASTEST:  'fastest',
};

function create(overrides = {}) {
  return {
    id:                   null,
    trip_id:              null,
    route_label:          null,
    distance_km:          null,
    estimated_energy_kwh: null,
    estimated_co2_kg:     null,
    elevation_gain_m:     null,
    route_polyline:       null,
    created_at:           null,
    ...overrides,
  };
}

module.exports = { TABLE, FIELDS, ROUTE_LABELS, create };
