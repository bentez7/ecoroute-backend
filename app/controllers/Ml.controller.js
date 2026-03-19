'use strict';

const Response = require('@helpers/Response.helper');

async function writeTripResults(req, res) {
  return Response.success(res, { message: 'not implemented' });
}

async function writeSegments(req, res) {
  return Response.success(res, { message: 'not implemented' });
}

async function writeRouteComparisons(req, res) {
  return Response.success(res, { message: 'not implemented' });
}

module.exports = { writeTripResults, writeSegments, writeRouteComparisons };
