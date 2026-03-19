'use strict';

const { Router }          = require('express');
const FeedbackController  = require('@controllers/Feedback.controller');
const { requireAuth }     = require('@middleware');

const router = Router();

router.get('/trip/:tripId',       requireAuth, FeedbackController.getFeedbackByTrip);
router.patch('/:id/acknowledge',  requireAuth, FeedbackController.acknowledgeFeedback);

module.exports = router;
