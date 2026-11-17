/* private/services/SessionService.js
 *
 * Builds the access token for a signed-in user, in one place, so every sign-in path issues the
 * same claims.
 *
 *   scope      'platform' for accounts that hold a platform role, otherwise 'user'
 *   roles      the platform roles held (empty for ordinary users)
 *   amr        how the person authenticated: 'pwd' (password) and 'otp' (one-time code)
 *   auth_time  when the person really signed in. It is carried forward when a session is renewed,
 *              which is how the hard time limit on owner sessions is enforced.
 *
 * Owner (platform) sessions are short: they expire after the idle limit unless renewed, and never
 * outlive the absolute limit measured from auth_time.
 */

const config = require('../config/env');
const { signAccessToken } = require('../utils/jwtHelper');

function nowSeconds() {
    return Math.floor(Date.now() / 1000);
}

// Seconds an owner session may still be renewed, counted from the original sign-in.
function secondsLeftInAbsoluteLimit(authTime) {
    return authTime + config.owner.sessionAbsoluteHours * 3600 - nowSeconds();
}

/**
 * Returns { accessToken, scope, expiresAt } or null when an owner session has reached its hard
 * time limit and cannot be renewed.
 */
function issueAccessToken(user, platformRoles, methods, { authTime } = {}) {
    const scope = platformRoles.length > 0 ? 'platform' : 'user';
    const signedInAt = authTime || nowSeconds();

    let expiresIn; // undefined means the normal access-token lifetime
    if (scope === 'platform') {
        const idleSeconds = config.owner.sessionIdleMinutes * 60;
        const left = secondsLeftInAbsoluteLimit(signedInAt);
        if (left <= 0) return null;
        expiresIn = Math.min(idleSeconds, left);
    }

    const accessToken = signAccessToken(
        {
            id: user.id,
            uuid: user.uuid,
            email: user.email,
            scope,
            roles: platformRoles,
            amr: methods,
            auth_time: signedInAt
        },
        expiresIn
    );

    return { accessToken, scope, expiresAt: expiresIn ? nowSeconds() + expiresIn : null };
}

module.exports = { issueAccessToken };
