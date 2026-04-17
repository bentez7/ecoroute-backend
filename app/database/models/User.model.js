'use strict';

const TABLE = 'users';

const FIELDS = {
  ID:             'id',
  EMAIL:          'email',
  DISPLAY_NAME:   'display_name',
  AVATAR_URL:     'avatar_url',
  ROLE:           'role',
  ACCOUNT_STATUS: 'account_status',
  AUTH_PROVIDER:  'auth_provider',
  TOTAL_CO2_KG:   'total_co2_kg',
  CREATED_AT:     'created_at',
  UPDATED_AT:     'updated_at',
};

const ROLES = {
  USER:  'user',
  ADMIN: 'admin',
};

const ACCOUNT_STATUSES = {
  ACTIVE:    'active',
  SUSPENDED: 'suspended',
  DELETED:   'deleted',
};

const AUTH_PROVIDERS = {
  EMAIL:  'email',
  GOOGLE: 'google',
  GITHUB: 'github',
  APPLE:  'apple',
};

function create(overrides = {}) {
  return {
    id:             null,
    email:          null,
    display_name:   null,
    avatar_url:     null,
    role:           ROLES.USER,
    account_status: ACCOUNT_STATUSES.ACTIVE,
    auth_provider:  AUTH_PROVIDERS.EMAIL,
    total_co2_kg:   0,
    created_at:     null,
    updated_at:     null,
    ...overrides,
  };
}

module.exports = { TABLE, FIELDS, ROLES, ACCOUNT_STATUSES, AUTH_PROVIDERS, create };
