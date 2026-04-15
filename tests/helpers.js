'use strict';

/**
 * Build a mock Express request object.
 */
function mockReq(overrides = {}) {
  return {
    body: {},
    params: {},
    query: {},
    headers: {},
    user: { id: 'user-uuid-1' },
    ...overrides,
  };
}

/**
 * Build a mock Express response object that captures status + json calls.
 */
function mockRes() {
  const res = {
    _status: 200,
    _json: null,
    status(code) { res._status = code; return res; },
    json(body)   { res._json = body; return res; },
  };
  return res;
}

module.exports = { mockReq, mockRes };
