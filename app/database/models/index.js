'use strict';

const UserModel            = require('./User.model');
const VehicleModel         = require('./Vehicle.model');
const TripModel            = require('./Trip.model');
const RawTelemetryModel    = require('./RawTelemetry.model');
const TelemetrySegmentModel = require('./TelemetrySegment.model');
const RouteComparisonModel = require('./RouteComparison.model');
const FeedbackEventModel   = require('./FeedbackEvent.model');

module.exports = {
  UserModel,
  VehicleModel,
  TripModel,
  RawTelemetryModel,
  TelemetrySegmentModel,
  RouteComparisonModel,
  FeedbackEventModel,
};
