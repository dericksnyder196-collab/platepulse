/* private/routes/index.js */

const express = require('express');
const router = express.Router();

const authRoutes = require('./authRoutes');
const TenantController = require('../controllers/tenantController');
const requireAuth = require('../middleware/requireAuth');

// These are mounted on '/api' in server.js
router.use('/auth', authRoutes);

router.post('/tenants', requireAuth, TenantController.createTenant);
router.get('/tenants', requireAuth, TenantController.getTenants);
router.put('/tenants/:id', requireAuth, TenantController.updateTenant);
router.delete('/tenants/:id', requireAuth, TenantController.deleteTenant);

module.exports = router;
