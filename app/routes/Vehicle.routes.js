'use strict';

const { Router }        = require('express');
const { body, param }   = require('express-validator');

const VehicleController = require('@controllers/Vehicle.controller');
const { requireAuth, handleValidationErrors } = require('@middleware');
const { VEHICLE_TYPES, DRIVETRAIN_TYPES } = require('@database').models.VehicleModel;

const router = Router();

const vehicleTypes    = Object.values(VEHICLE_TYPES);
const drivetrainTypes = Object.values(DRIVETRAIN_TYPES);

// --- Validation chains ---

const createValidation = [
  body('make').trim().notEmpty().withMessage('Make is required')
    .isLength({ max: 100 }).withMessage('Make must be 100 characters or fewer'),
  body('model').trim().notEmpty().withMessage('Model is required')
    .isLength({ max: 100 }).withMessage('Model must be 100 characters or fewer'),
  body('year').optional().isInt({ min: 1900, max: 2100 }).withMessage('Year must be between 1900 and 2100'),
  body('vehicle_type').isIn(vehicleTypes)
    .withMessage(`vehicle_type must be one of: ${vehicleTypes.join(', ')}`),
  body('vehicle_mass_kg').optional().isFloat({ min: 500, max: 10000 })
    .withMessage('vehicle_mass_kg must be between 500 and 10000'),
  body('drag_coefficient').optional().isFloat({ min: 0.1, max: 1.0 })
    .withMessage('drag_coefficient must be between 0.1 and 1.0'),
  body('drivetrain_type').isIn(drivetrainTypes)
    .withMessage(`drivetrain_type must be one of: ${drivetrainTypes.join(', ')}`),
];

const updateValidation = [
  param('id').isUUID().withMessage('Invalid vehicle ID'),
  body('make').optional().trim().notEmpty().isLength({ max: 100 }),
  body('model').optional().trim().notEmpty().isLength({ max: 100 }),
  body('year').optional().isInt({ min: 1900, max: 2100 }),
  body('vehicle_type').optional().isIn(vehicleTypes),
  body('vehicle_mass_kg').optional().isFloat({ min: 500, max: 10000 }),
  body('drag_coefficient').optional().isFloat({ min: 0.1, max: 1.0 }),
  body('drivetrain_type').optional().isIn(drivetrainTypes),
];

const idValidation = [
  param('id').isUUID().withMessage('Invalid vehicle ID'),
];

// --- Public routes (no auth) ---

router.get('/options',                  VehicleController.getOptions);
router.get('/makes',                    VehicleController.getMakes);
router.get('/makes/:make/models',       VehicleController.getModels);
router.get('/makes/:make/models/:model/variants', VehicleController.getVariants);

// --- Protected routes ---

router.post('/',             requireAuth, createValidation, handleValidationErrors, VehicleController.createVehicle);
router.get('/',              requireAuth, VehicleController.getVehicles);
router.get('/:id',           requireAuth, idValidation, handleValidationErrors, VehicleController.getVehicle);
router.patch('/:id',         requireAuth, updateValidation, handleValidationErrors, VehicleController.updateVehicle);
router.patch('/:id/default', requireAuth, idValidation, handleValidationErrors, VehicleController.setDefaultVehicle);
router.delete('/:id',        requireAuth, idValidation, handleValidationErrors, VehicleController.deleteVehicle);

module.exports = router;
