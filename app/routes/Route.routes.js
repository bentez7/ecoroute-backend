'use strict';

const { Router }      = require('express');
const { body, param } = require('express-validator');

const RouteController = require('@controllers/Route.controller');
const { requireAuth, handleValidationErrors } = require('@middleware');

const router = Router();

// --- Validation chains ---

const autocompleteValidation = [
  body('query').isString().notEmpty().withMessage('query is required'),
  body('proximity_lat').optional().isFloat({ min: -90,  max: 90  }).withMessage('proximity_lat must be between -90 and 90'),
  body('proximity_lng').optional().isFloat({ min: -180, max: 180 }).withMessage('proximity_lng must be between -180 and 180'),
];

const searchValidation = [
  body('origin_lat').isFloat({ min: -90,  max: 90  }).withMessage('origin_lat must be between -90 and 90'),
  body('origin_lng').isFloat({ min: -180, max: 180 }).withMessage('origin_lng must be between -180 and 180'),
  body('dest_lat').isFloat({ min: -90,  max: 90  }).withMessage('dest_lat must be between -90 and 90'),
  body('dest_lng').isFloat({ min: -180, max: 180 }).withMessage('dest_lng must be between -180 and 180'),
];

const tripIdValidation = [
  param('tripId').isUUID().withMessage('Invalid trip ID'),
];

// --- Routes ---

router.post('/autocomplete',
  requireAuth, autocompleteValidation, handleValidationErrors,
  RouteController.autocompleteSearch);

router.post('/search',
  requireAuth, searchValidation, handleValidationErrors,
  RouteController.searchRoutes);

router.get('/trip/:tripId',
  requireAuth, tripIdValidation, handleValidationErrors,
  RouteController.getRouteComparisonsByTrip);

module.exports = router;
