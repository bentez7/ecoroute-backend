'use strict';

const { appKeys } = require('@config');
const Response    = require('@helpers/Response.helper');

function requireServiceRole(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return Response.error(res, 'Missing or malformed Authorization header', 403);
  }

  const token = authHeader.slice(7);

  if (token !== appKeys.SUPABASE_SERVICE_ROLE_KEY) {
    return Response.error(res, 'Forbidden: invalid service role key', 403);
  }

  return next();
}

module.exports = { requireServiceRole };
