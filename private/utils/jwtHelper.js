/* private/utils/jwtHelper.js
 *
 * Three kinds of signed token, kept apart by their audience claim so one can never be used as
 * another:
 *   access      the session token sent with every API request
 *   mfa-ticket  proves the password was right and a one-time code is still needed (5 minutes)
 *   step-up     proves a fresh one-time code was entered, for high-impact actions (5 minutes)
 */

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const config = require('../config/env');

// Pinned so a token can never choose its own (weaker) algorithm.
const ALGORITHM = 'HS256';
const ISSUER = 'platepulse';

const AUDIENCE = Object.freeze({
    ACCESS: 'platepulse:access',
    MFA_TICKET: 'platepulse:mfa-ticket',
    STEP_UP: 'platepulse:step-up'
});

function sign(payload, audience, expiresIn) {
    return jwt.sign(payload, config.jwt.accessSecret, {
        algorithm: ALGORITHM,
        audience,
        issuer: ISSUER,
        expiresIn,
        jwtid: crypto.randomUUID()
    });
}

function verify(token, audience) {
    return jwt.verify(token, config.jwt.accessSecret, {
        algorithms: [ALGORITHM],
        audience,
        issuer: ISSUER
    });
}

function signAccessToken(payload) {
    return sign(payload, AUDIENCE.ACCESS, config.jwt.accessExpiresIn);
}

function verifyAccessToken(token) {
    return verify(token, AUDIENCE.ACCESS);
}

function signMfaTicket(userId) {
    return sign({ id: userId }, AUDIENCE.MFA_TICKET, config.mfa.ticketTtlSeconds);
}

function verifyMfaTicket(token) {
    return verify(token, AUDIENCE.MFA_TICKET);
}

function signStepUpToken(userId) {
    return sign({ id: userId }, AUDIENCE.STEP_UP, config.mfa.stepUpTtlSeconds);
}

function verifyStepUpToken(token) {
    return verify(token, AUDIENCE.STEP_UP);
}

module.exports = {
    signAccessToken,
    verifyAccessToken,
    signMfaTicket,
    verifyMfaTicket,
    signStepUpToken,
    verifyStepUpToken
};
