'use strict';

const AuthRoutes      = require('./Auth.routes');
const VehicleRoutes   = require('./Vehicle.routes');
const TripRoutes      = require('./Trip.routes');
const TelemetryRoutes = require('./Telemetry.routes');
const SegmentRoutes   = require('./Segment.routes');
const RouteRoutes     = require('./Route.routes');
const PlaceRoutes     = require('./Place.routes');
const FeedbackRoutes  = require('./Feedback.routes');

function mountRoutes(app) {
  app.use('/api/auth',      AuthRoutes);
  app.use('/api/vehicles',  VehicleRoutes);
  app.use('/api/trips',     TripRoutes);
  app.use('/api/telemetry', TelemetryRoutes);
  app.use('/api/segments',  SegmentRoutes);
  app.use('/api/routes',    RouteRoutes);
  app.use('/api/places',    PlaceRoutes);
  app.use('/api/feedback',  FeedbackRoutes);

  app.get('/health', (req, res) => res.json({ success: true, data: { status: 'ok' } }));
}

module.exports = { mountRoutes };
