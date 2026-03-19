'use strict';

const { Router }             = require('express');
const MlController           = require('@controllers/Ml.controller');
const { requireServiceRole } = require('@middleware');

const router = Router();

// All ML writeback endpoints use service role key — NOT user JWT
router.patch('/trips/:tripId/results',  requireServiceRole, MlController.writeTripResults);
router.post('/trips/:tripId/segments',  requireServiceRole, MlController.writeSegments);
router.post('/trips/:tripId/routes',    requireServiceRole, MlController.writeRouteComparisons);

module.exports = router;
