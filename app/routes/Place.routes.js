'use strict';

const { Router } = require('express');
const { body }   = require('express-validator');

const PlaceController = require('@controllers/Place.controller');
const { requireAuth, handleValidationErrors } = require('@middleware');

const router = Router();

// --- Validation chains ---

const autocompleteValidation = [
  body('query').isString().notEmpty().withMessage('query is required'),
  body('proximity_lat').optional().isFloat({ min: -90,  max: 90  }).withMessage('proximity_lat must be between -90 and 90'),
  body('proximity_lng').optional().isFloat({ min: -180, max: 180 }).withMessage('proximity_lng must be between -180 and 180'),
];

const searchTextValidation = [
  body('query').isString().notEmpty().withMessage('query is required'),
  body('proximity_lat').optional().isFloat({ min: -90,  max: 90  }).withMessage('proximity_lat must be between -90 and 90'),
  body('proximity_lng').optional().isFloat({ min: -180, max: 180 }).withMessage('proximity_lng must be between -180 and 180'),
];

// --- Routes ---

router.post('/autocomplete',
  requireAuth, autocompleteValidation, handleValidationErrors,
  PlaceController.autocomplete);

router.post('/search',
  requireAuth, searchTextValidation, handleValidationErrors,
  PlaceController.searchText);

module.exports = router;
