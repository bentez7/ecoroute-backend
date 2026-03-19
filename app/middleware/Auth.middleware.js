'use strict';

const { anonClient } = require('@database');
const Response       = require('@helpers/Response.helper');

async function requireAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return Response.error(res, 'Missing or malformed Authorization header', 401);
  }

  const token = authHeader.slice(7);

  const { data, error } = await anonClient.auth.getUser(token);
  if (error || !data.user) {
    return Response.error(res, 'Invalid or expired token', 401);
  }

  req.user = data.user;
  return next();
}

module.exports = { requireAuth };
