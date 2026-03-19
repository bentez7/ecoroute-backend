'use strict';

const { Router }         = require('express');
const SegmentController  = require('@controllers/Segment.controller');
const { requireAuth }    = require('@middleware');

const router = Router();

router.get('/trip/:tripId', requireAuth, SegmentController.getSegmentsByTrip);
router.get('/:id',          requireAuth, SegmentController.getSegmentById);

module.exports = router;
