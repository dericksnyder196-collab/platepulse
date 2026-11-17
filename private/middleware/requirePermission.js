/* private/middleware/requirePermission.js
 *
 * requirePermission('audit:view') allows the request only if one of the caller's platform roles
 * holds that permission in the catalog (private/config/permissions.js).
 *
 * An unknown permission name throws when the route is defined, so a typo stops the app from
 * starting instead of silently leaving a route unprotected.
 *
 * Use after requireAuth and requirePlatformScope.
 */

const { SCOPES, isKnownPermission, permissionsForRole } = require('../config/permissions');

function requirePermission(permission) {
    if (!isKnownPermission(SCOPES.PLATFORM, permission)) {
        throw new Error(`requirePermission: "${permission}" is not a platform permission.`);
    }

    return function checkPermission(req, res, next) {
        const roles = (req.user && req.user.roles) || [];
        const allowed = roles.some((role) => permissionsForRole(role).includes(permission));

        if (!allowed) {
            return res
                .status(403)
                .json({ status: 'error', message: 'You do not have permission to do this.' });
        }
        next();
    };
}

module.exports = requirePermission;
