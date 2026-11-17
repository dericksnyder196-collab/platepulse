/* private/routes/index.js */

const express = require('express');
const router = express.Router();

const authRoutes = require('./authRoutes');
const ownerRoutes = require('../platform/ownerRoutes');
const TenantController = require('../controllers/tenantController');
const requireAuth = require('../middleware/requireAuth');
const { requireUserScope } = require('../middleware/scopeGuards');

// These are mounted on '/api' in server.js
router.use('/auth', authRoutes);
router.use('/v1/owner', ownerRoutes);

// Restaurant routes: ordinary sessions only. An owner session cannot be used here.
router.post('/tenants', requireAuth, requireUserScope, TenantController.createTenant);
router.get('/tenants', requireAuth, requireUserScope, TenantController.getTenants);
router.put('/tenants/:id', requireAuth, requireUserScope, TenantController.updateTenant);
router.delete('/tenants/:id', requireAuth, requireUserScope, TenantController.deleteTenant);

module.exports = router;
