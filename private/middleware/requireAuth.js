/* private/middleware/requireAuth.js */

const { verifyAccessToken } = require('../utils/jwtHelper');

const requireAuth = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res
            .status(401)
            .json({ status: 'error', message: 'Unauthorized. Access token missing or malformed.' });
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = verifyAccessToken(token);
        req.user = { id: decoded.id, uuid: decoded.uuid, email: decoded.email };
        next();
    } catch (error) {
        // 401 (not 403) so clients know to send the user back to the login page.
        const message =
            error.name === 'TokenExpiredError'
                ? 'Session expired. Please log in again.'
                : 'Unauthorized. Invalid access token.';
        return res.status(401).json({ status: 'error', message });
    }
};

module.exports = requireAuth;
