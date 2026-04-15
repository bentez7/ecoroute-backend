'use strict';

const { Router }       = require('express');
const { body, param }  = require('express-validator');

const TripController   = require('@controllers/Trip.controller');
const { requireAuth, handleValidationErrors } = require('@middleware');
const { models }       = require('@database');

const { VEHICLE_TYPES } = models.VehicleModel;
const fuelTypes = Object.values(VEHICLE_TYPES);

const router = Router();

// --- Validation chains ---

const createTripValidation = [
  body('vehicle_id').isUUID().withMessage('vehicle_id must be a valid UUID'),
  body('started_at').isISO8601().withMessage('started_at must be a valid ISO 8601 datetime'),
  body('origin_lat').isFloat({ min: -90,  max: 90  }).withMessage('origin_lat must be between -90 and 90'),
  body('origin_lng').isFloat({ min: -180, max: 180 }).withMessage('origin_lng must be between -180 and 180'),
  body('dest_lat').isFloat({ min: -90,  max: 90  }).withMessage('dest_lat must be between -90 and 90'),
  body('dest_lng').isFloat({ min: -180, max: 180 }).withMessage('dest_lng must be between -180 and 180'),
  body('fuel_type').isIn(fuelTypes).withMessage(`fuel_type must be one of: ${fuelTypes.join(', ')}`),
  body('origin_address').optional().isString(),
  body('dest_address').optional().isString(),
  body('route_polyline').optional().isString(),
];

const idValidation = [
  param('id').isUUID().withMessage('Invalid trip ID'),
];

const endTripValidation = [
  param('id').isUUID().withMessage('Invalid trip ID'),
  body('ended_at').isISO8601().withMessage('ended_at must be a valid ISO 8601 datetime'),
  body('distance_km').isFloat({ min: 0 }).withMessage('distance_km must be a non-negative number'),
  body('duration_sec').isInt({ min: 0 }).withMessage('duration_sec must be a non-negative integer'),
];

// --- Routes ---

router.post('/',
  requireAuth, createTripValidation, handleValidationErrors,
  TripController.createTrip);

router.get('/',
  requireAuth,
  TripController.getTrips);

router.get('/:id',
  requireAuth, idValidation, handleValidationErrors,
  TripController.getTripById);

// IMPORTANT: named sub-routes must be declared before /:id to avoid Express matching them as the :id param
router.patch('/:id/end',
  requireAuth, endTripValidation, handleValidationErrors,
  TripController.endTrip);

router.patch('/:id/cancel',
  requireAuth, idValidation, handleValidationErrors,
  TripController.cancelTrip);

router.patch('/:id',
  requireAuth, idValidation, handleValidationErrors,
  TripController.updateTrip);

module.exports = router;
