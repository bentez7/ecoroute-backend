'use strict';

const { Router }       = require('express');
const RouteController  = require('@controllers/Route.controller');
const { requireAuth }  = require('@middleware');

const router = Router();

router.get('/trip/:tripId', requireAuth, RouteController.getRouteComparisonsByTrip);

module.exports = router;
