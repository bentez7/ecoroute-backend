'use strict';

const UserService           = require('./User.service');
const VehicleService        = require('./Vehicle.service');
const TripService           = require('./Trip.service');
const TelemetryService      = require('./Telemetry.service');
const SegmentService        = require('./Segment.service');
const RouteComparisonService = require('./RouteComparison.service');
const FeedbackEventService  = require('./FeedbackEvent.service');

module.exports = {
  UserService,
  VehicleService,
  TripService,
  TelemetryService,
  SegmentService,
  RouteComparisonService,
  FeedbackEventService,
};
