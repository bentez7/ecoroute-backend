'use strict';

const Logger   = require('@utils/Logger.util');
const Response = require('@helpers/Response.helper');

// 4-parameter signature required — Express identifies error middleware by arity
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  Logger.error(`Unhandled error: ${err.message}`, err);
  return Response.error(res, 'Internal server error', 500);
}

module.exports = { errorHandler };
