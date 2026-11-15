/* private/controllers/mfaController.js
 *
 * The second step of sign-in, and step-up confirmation for high-impact actions.
 */

const config = require('../config/env');
const User = require('../models/User');
const PlatformRole = require('../models/PlatformRole');
const MfaService = require('../services/MfaService');
const { contextFromRequest } = require('../services/AuditService');
const { issueAccessToken } = require('../services/SessionService');
const { verifyMfaTicket, signStepUpToken } = require('../utils/jwtHelper');

function badRequest(res, message) {
    return res.status(400).json({ status: 'error', message });
}

class MfaController {
    // POST /api/auth/mfa/verify  { ticket, code }  ->  access token
    static async verify(req, res) {
        const body = req.body || {};
        if (typeof body.ticket !== 'string' || typeof body.code !== 'string') {
            return badRequest(res, 'A sign-in ticket and a code are required.');
        }

        let ticket;
        try {
            ticket = verifyMfaTicket(body.ticket);
        } catch {
            return res
                .status(401)
                .json({ status: 'error', message: 'Your sign-in expired. Log in again.' });
        }

        const user = await User.findById(ticket.id);
        if (!user) {
            return res
                .status(401)
                .json({ status: 'error', message: 'Your sign-in expired. Log in again.' });
        }

        const roles = await PlatformRole.forUser(user.id);
        const context = contextFromRequest(req, {
            actorId: user.id,
            actorScope: roles.length > 0 ? 'platform' : 'user'
        });

        const result = await MfaService.verifyCode({
            userId: user.id,
            code: body.code,
            context,
            purpose: 'LOGIN'
        });

        const { accessToken, scope } = issueAccessToken(user, roles, ['pwd', 'otp']);

        res.status(200).json({
            status: 'success',
            data: {
                accessToken,
                scope,
                user: { uuid: user.uuid, email: user.email },
                usedRecoveryCode: result.method === 'recovery',
                remainingRecoveryCodes: result.remainingRecoveryCodes
            }
        });
    }

    // POST /api/auth/mfa/step-up  { code }  ->  a short-lived pass for high-impact actions
    static async stepUp(req, res) {
        const body = req.body || {};
        if (typeof body.code !== 'string') {
            return badRequest(res, 'A code is required.');
        }
        if (!req.user.mfa) {
            return res.status(403).json({
                status: 'error',
                message: 'Sign in with two-factor authentication to use this.'
            });
        }

        await MfaService.verifyCode({
            userId: req.user.id,
            code: body.code,
            context: contextFromRequest(req),
            purpose: 'STEP_UP'
        });

        res.status(200).json({
            status: 'success',
            data: {
                stepUpToken: signStepUpToken(req.user.id),
                expiresInSeconds: config.mfa.stepUpTtlSeconds
            }
        });
    }
}

module.exports = MfaController;
