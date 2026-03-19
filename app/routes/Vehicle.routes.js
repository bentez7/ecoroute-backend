'use strict';

const { Router }        = require('express');
const VehicleController = require('@controllers/Vehicle.controller');
const { requireAuth }   = require('@middleware');

const router = Router();

router.post('/',    requireAuth, VehicleController.createVehicle);
router.get('/',     requireAuth, VehicleController.getVehicles);
router.patch('/:id', requireAuth, VehicleController.updateVehicle);
router.delete('/:id', requireAuth, VehicleController.deleteVehicle);

module.exports = router;
