/* private/services/SessionService.js
 *
 * Builds the access token for a signed-in user, in one place, so every sign-in path issues the
 * same claims.
 *
 *   scope  'platform' for accounts that hold a platform role, otherwise 'user'
 *   roles  the platform roles held (empty for ordinary users)
 *   amr    how the person authenticated: 'pwd' (password) and 'otp' (one-time code)
 */

const { signAccessToken } = require('../utils/jwtHelper');

function issueAccessToken(user, platformRoles, methods) {
    const scope = platformRoles.length > 0 ? 'platform' : 'user';

    const accessToken = signAccessToken({
        id: user.id,
        uuid: user.uuid,
        email: user.email,
        scope,
        roles: platformRoles,
        amr: methods
    });

    return { accessToken, scope };
}

module.exports = { issueAccessToken };
