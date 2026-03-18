'use strict';

const TABLE = 'users';

const FIELDS = {
  ID:             'id',
  EMAIL:          'email',
  DISPLAY_NAME:   'display_name',
  AVATAR_URL:     'avatar_url',
  ROLE:           'role',
  ACCOUNT_STATUS: 'account_status',
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

function create(overrides = {}) {
  return {
    id:             null,
    email:          null,
    display_name:   null,
    avatar_url:     null,
    role:           ROLES.USER,
    account_status: ACCOUNT_STATUSES.ACTIVE,
    created_at:     null,
    updated_at:     null,
    ...overrides,
  };
}

module.exports = { TABLE, FIELDS, ROLES, ACCOUNT_STATUSES, create };
