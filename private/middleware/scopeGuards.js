/* private/middleware/scopeGuards.js
 *
 * Keeps the two kinds of session apart, in both directions:
 *  - an ordinary session ('user') can never reach the owner area
 *  - an owner session ('platform') can never be used on restaurant routes
 *
 * Use after requireAuth. Owner routes answer 404, not 403, to anyone without a platform session,
 * so the owner area does not announce itself to people who should not know it exists.
 */

function requirePlatformScope(req, res, next) {
    const user = req.user;
    const isPlatformSession =
        Boolean(user) && user.scope === 'platform' && user.mfa === true && user.roles.length > 0;

    if (!isPlatformSession) {
        return res.status(404).json({ status: 'error', message: 'Route not found.' });
    }
    next();
}

function requireUserScope(req, res, next) {
    if (!req.user || req.user.scope !== 'user') {
        return res.status(403).json({
            status: 'error',
            message:
                'Owner accounts cannot use this area. Use a separate account for restaurants and ordering.'
        });
    }
    next();
}

module.exports = { requirePlatformScope, requireUserScope };
