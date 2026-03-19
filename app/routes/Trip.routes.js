'use strict';

const { Router }      = require('express');
const TripController  = require('@controllers/Trip.controller');
const { requireAuth } = require('@middleware');

const router = Router();

router.post('/',     requireAuth, TripController.createTrip);
router.get('/',      requireAuth, TripController.getTrips);
router.get('/:id',   requireAuth, TripController.getTripById);
router.patch('/:id', requireAuth, TripController.updateTrip);

module.exports = router;
