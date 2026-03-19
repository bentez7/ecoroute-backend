'use strict';

const TABLE = 'vehicles';

const FIELDS = {
  ID:               'id',
  USER_ID:          'user_id',
  MAKE:             'make',
  MODEL:            'model',
  YEAR:             'year',
  VEHICLE_TYPE:     'vehicle_type',
  VEHICLE_MASS_KG:  'vehicle_mass_kg',
  DRAG_COEFFICIENT: 'drag_coefficient',
  DRIVETRAIN_TYPE:  'drivetrain_type',
  IS_DEFAULT:       'is_default',
  CREATED_AT:       'created_at',
  UPDATED_AT:       'updated_at',
};

const VEHICLE_TYPES = {
  PETROL: 'petrol',
  DIESEL: 'diesel',
  LPG:    'lpg',
  EV:     'ev',
  HYBRID: 'hybrid',
};

const DRIVETRAIN_TYPES = {
  FWD: 'fwd',
  RWD: 'rwd',
  AWD: 'awd',
};

function create(overrides = {}) {
  return {
    id:               null,
    user_id:          null,
    make:             null,
    model:            null,
    year:             null,
    vehicle_type:     null,
    vehicle_mass_kg:  null,
    drag_coefficient: null,
    drivetrain_type:  null,
    is_default:       false,
    created_at:       null,
    updated_at:       null,
    ...overrides,
  };
}

module.exports = { TABLE, FIELDS, VEHICLE_TYPES, DRIVETRAIN_TYPES, create };
