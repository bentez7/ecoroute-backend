'use strict';

const { Router }      = require('express');
const { body, param } = require('express-validator');

const TelemetryController = require('@controllers/Telemetry.controller');
const { requireAuth, handleValidationErrors } = require('@middleware');

const router = Router();

// --- Validation chains ---

const bulkInsertValidation = [
  body('trip_id').isUUID().withMessage('trip_id must be a valid UUID'),
  body('points').isArray({ min: 1 }).withMessage('points must be a non-empty array'),
  body('points.*.recorded_at').isISO8601().withMessage('each point must have a valid recorded_at'),
  body('points.*.lat').isFloat({ min: -90,  max: 90  }).withMessage('each point lat must be between -90 and 90'),
  body('points.*.lng').isFloat({ min: -180, max: 180 }).withMessage('each point lng must be between -180 and 180'),
  body('points.*.speed_ms').optional().isFloat({ min: 0 }),
  body('points.*.accel_ms2').optional().isFloat(),
  body('points.*.altitude_m').optional().isFloat(),
  body('points.*.heading_deg').optional().isFloat({ min: 0, max: 360 }),
];

const tripIdValidation = [
  param('tripId').isUUID().withMessage('Invalid trip ID'),
];

// --- Routes ---

router.post('/',
  requireAuth, bulkInsertValidation, handleValidationErrors,
  TelemetryController.bulkInsertTelemetry);

router.get('/trip/:tripId',
  requireAuth, tripIdValidation, handleValidationErrors,
  TelemetryController.getTelemetryByTrip);

module.exports = router;
