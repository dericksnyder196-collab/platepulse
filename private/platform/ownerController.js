/* private/platform/ownerController.js
 *
 * The owner API. These handlers run only after requireAuth and requirePlatformScope, so the caller
 * has a platform session that was opened with a one-time code.
 */

const config = require('../config/env');
const User = require('../models/User');
const PlatformRole = require('../models/PlatformRole');
const { permissionsForRole } = require('../config/permissions');
const { contextFromRequest, record } = require('../services/AuditService');
const { issueAccessToken } = require('../services/SessionService');

class OwnerController {
    // GET /api/v1/owner/me  - who am I, what may I do, and when does this session end
    static async me(req, res) {
        // Roles are read from the database, not only from the token, so a removed role shows at once.
        const roles = await PlatformRole.forUser(req.user.id);
        if (roles.length === 0) {
            return res
                .status(403)
                .json({ status: 'error', message: 'This account is no longer an owner account.' });
        }

        const permissions = [...new Set(roles.flatMap((role) => permissionsForRole(role)))].sort();

        res.status(200).json({
            status: 'success',
            data: {
                email: req.user.email,
                roles,
                permissions,
                session: {
                    signedInAt: req.user.authTime,
                    expiresAt: req.user.expiresAt,
                    idleMinutes: config.owner.sessionIdleMinutes,
                    absoluteHours: config.owner.sessionAbsoluteHours
                }
            }
        });
    }

    // POST /api/v1/owner/session/renew  - a fresh token, up to the hard time limit
    static async renewSession(req, res) {
        const user = await User.findById(req.user.id);
        const roles = user ? await PlatformRole.forUser(user.id) : [];

        // The role is checked again on every renewal, so removing access ends a session within
        // the idle limit at the latest.
        if (!user || roles.length === 0) {
            return res
                .status(403)
                .json({ status: 'error', message: 'This account is no longer an owner account.' });
        }

        const session = issueAccessToken(user, roles, ['pwd', 'otp'], {
            authTime: req.user.authTime
        });
        if (!session) {
            return res.status(401).json({
                status: 'error',
                message: 'Your session reached its time limit. Sign in again.'
            });
        }

        res.status(200).json({
            status: 'success',
            data: { accessToken: session.accessToken, expiresAt: session.expiresAt }
        });
    }

    // POST /api/v1/owner/security/step-up-check  - a harmless high-impact action used to prove
    // that step-up is enforced. Real L3 actions use the same middleware chain.
    static async stepUpCheck(req, res) {
        await record({
            context: contextFromRequest(req, { actorScope: 'platform' }),
            action: 'STEP_UP_CHECK_USED',
            entity: 'owner',
            entityId: req.user.id
        });

        res.status(200).json({ status: 'success', data: { confirmed: true } });
    }
}

module.exports = OwnerController;
