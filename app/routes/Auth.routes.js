'use strict';

const { Router } = require('express');
const { body }   = require('express-validator');

const AuthController             = require('@controllers/Auth.controller');
const { requireAuth,
        handleValidationErrors } = require('@middleware');

const router = Router();

router.post('/signup',
  body('email').isEmail().withMessage('Valid email required').normalizeEmail(),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('display_name').optional().trim().notEmpty().withMessage('display_name cannot be blank'),
  handleValidationErrors,
  AuthController.signUp,
);

router.post('/signin',
  body('email').isEmail().withMessage('Valid email required').normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required'),
  handleValidationErrors,
  AuthController.signIn,
);

router.post('/signout', requireAuth, AuthController.signOut);

router.post('/refresh',
  body('refresh_token').isString().notEmpty().withMessage('refresh_token is required'),
  handleValidationErrors,
  AuthController.refreshSession,
);

router.get('/me', requireAuth, AuthController.getMe);

module.exports = router;
