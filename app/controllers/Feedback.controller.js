'use strict';

const Response = require('@helpers/Response.helper');

async function getFeedbackByTrip(req, res) {
  return Response.success(res, { message: 'not implemented' });
}

async function acknowledgeFeedback(req, res) {
  return Response.success(res, { message: 'not implemented' });
}

module.exports = { getFeedbackByTrip, acknowledgeFeedback };
