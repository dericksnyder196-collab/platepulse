/* private/platform/ownerRoutes.js
 *
 * The owner API, mounted at /api/v1/owner. Everything below the first line requires a signed-in
 * platform session opened with two-factor. Each route then names the permission it needs.
 * requirePermission throws at startup for an unknown permission, so a typo cannot ship.
 */

const express = require('express');
const requireAuth = require('../middleware/requireAuth');
const requireStepUp = require('../middleware/requireStepUp');
const requirePermission = require('../middleware/requirePermission');
const { requirePlatformScope } = require('../middleware/scopeGuards');
const OwnerController = require('./ownerController');

const router = express.Router();

router.use(requireAuth, requirePlatformScope);

router.get('/me', requirePermission('overview:view'), OwnerController.me);

// Any platform account may renew its own session. The controller re-checks the role.
router.post('/session/renew', OwnerController.renewSession);

// High-impact (L3) pattern: permission, then a fresh step-up pass.
router.post(
    '/security/step-up-check',
    requirePermission('security_policy:manage'),
    requireStepUp,
    OwnerController.stepUpCheck
);

module.exports = router;
