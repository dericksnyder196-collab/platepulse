/* private/utils/jwtHelper.js */

const jwt = require('jsonwebtoken');
const config = require('../config/env');

// Pinned so a token can never choose its own (weaker) algorithm.
const ALGORITHM = 'HS256';

function signAccessToken(payload) {
    return jwt.sign(payload, config.jwt.accessSecret, {
        algorithm: ALGORITHM,
        expiresIn: config.jwt.accessExpiresIn
    });
}

function verifyAccessToken(token) {
    return jwt.verify(token, config.jwt.accessSecret, { algorithms: [ALGORITHM] });
}

module.exports = { signAccessToken, verifyAccessToken };
