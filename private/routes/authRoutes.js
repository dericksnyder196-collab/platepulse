/* private/routes/authRoutes.js */

const express = require('express');
const router = express.Router();
const AuthController = require('../controllers/authController');
const MfaController = require('../controllers/mfaController');
const requireAuth = require('../middleware/requireAuth');
const { loginLimiter, mfaLimiter } = require('../middleware/rateLimiters');

router.post('/register', AuthController.register);
router.post('/login', loginLimiter, AuthController.login);

// Second step of sign-in, and step-up for high-impact actions
router.post('/mfa/verify', mfaLimiter, MfaController.verify);
router.post('/mfa/step-up', mfaLimiter, requireAuth, MfaController.stepUp);

module.exports = router;
