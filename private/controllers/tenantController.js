/* private/controllers/tenantController.js */

const config = require('../config/env');
const Tenant = require('../models/Tenant');
const { validateTenantName, validateCurrency, parseId } = require('../utils/validators');

function badRequest(res, message) {
    return res.status(400).json({ status: 'error', message });
}

function notFound(res) {
    return res.status(404).json({ status: 'error', message: 'Tenant not found.' });
}

class TenantController {
    static async createTenant(req, res) {
        const body = req.body || {};

        const name = validateTenantName(body.name);
        if (name.error) return badRequest(res, name.error);

        const currency = validateCurrency(body.currency, config.defaults.currency);
        if (currency.error) return badRequest(res, currency.error);

        const newTenantId = await Tenant.create(name.value, req.user.id, currency.value);

        res.status(201).json({
            status: 'success',
            message: 'Tenant onboarding successful.',
            data: { tenantId: newTenantId }
        });
    }

    static async getTenants(req, res) {
        const tenants = await Tenant.findByOwnerId(req.user.id);

        res.status(200).json({
            status: 'success',
            data: { tenants }
        });
    }

    static async updateTenant(req, res) {
        const tenantId = parseId(req.params.id);
        if (!tenantId) return notFound(res);

        const body = req.body || {};

        const name = validateTenantName(body.name);
        if (name.error) return badRequest(res, name.error);

        const existing = await Tenant.findOwnedById(tenantId, req.user.id);
        if (!existing) return notFound(res);

        // If no currency is sent, keep the tenant's current one.
        const currency = validateCurrency(body.currency, existing.currency);
        if (currency.error) return badRequest(res, currency.error);

        await Tenant.update(tenantId, req.user.id, name.value, currency.value);
        const tenant = await Tenant.findOwnedById(tenantId, req.user.id);

        res.status(200).json({
            status: 'success',
            message: 'Tenant updated successfully.',
            data: { tenant }
        });
    }

    static async deleteTenant(req, res) {
        const tenantId = parseId(req.params.id);
        if (!tenantId) return notFound(res);

        const result = await Tenant.delete(tenantId, req.user.id);
        if (result.affectedRows === 0) return notFound(res);

        res.status(200).json({ status: 'success', message: 'Tenant deleted successfully.' });
    }
}

module.exports = TenantController;
