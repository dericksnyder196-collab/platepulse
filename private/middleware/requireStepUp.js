/* private/middleware/requireStepUp.js
 *
 * Guards high-impact (L3) actions. The caller must already be signed in (requireAuth) and must
 * send a fresh step-up pass in the X-Step-Up-Token header, obtained by entering a new one-time
 * code at POST /api/auth/mfa/step-up. The pass lasts a few minutes and belongs to one account.
 */

const { verifyStepUpToken } = require('../utils/jwtHelper');

function deny(res) {
    return res.status(403).json({
        status: 'error',
        code: 'STEP_UP_REQUIRED',
        message: 'Confirm with a fresh authentication code to continue.'
    });
}

function requireStepUp(req, res, next) {
    const token = req.get('x-step-up-token');
    if (!token || !req.user) return deny(res);

    try {
        const claims = verifyStepUpToken(token);
        if (String(claims.id) !== String(req.user.id)) return deny(res);
        next();
    } catch {
        return deny(res);
    }
}

module.exports = requireStepUp;
