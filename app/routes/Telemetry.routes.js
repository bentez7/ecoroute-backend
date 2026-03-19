'use strict';

const { Router }           = require('express');
const TelemetryController  = require('@controllers/Telemetry.controller');
const { requireAuth }      = require('@middleware');

const router = Router();

router.post('/',              requireAuth, TelemetryController.bulkInsertTelemetry);
router.get('/trip/:tripId',   requireAuth, TelemetryController.getTelemetryByTrip);

module.exports = router;
