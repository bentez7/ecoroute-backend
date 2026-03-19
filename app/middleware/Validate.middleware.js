'use strict';

const { validationResult } = require('express-validator');
const Response = require('@helpers/Response.helper');

/**
 * Run after express-validator chains. Collects errors and returns 422 if any failed.
 */
function handleValidationErrors(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return Response.error(res, errors.array(), 422);
  }
  return next();
}

module.exports = { handleValidationErrors };
