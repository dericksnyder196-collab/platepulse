/* private/middleware/rateLimiters.js
 *
 * Stricter limits for the sign-in endpoints, on top of the global API limiter. Only FAILED
 * attempts count (skipSuccessfulRequests), so a legitimate person is never locked out by logging
 * in normally. Counters live in memory, so they are per server instance. Move them to Redis
 * before running more than one instance (Build Guide, Step 2).
 */

const rateLimit = require('express-rate-limit');
const config = require('../config/env');

const message = { status: 'error', message: 'Too many attempts. Try again in a few minutes.' };

function build(limit) {
    return rateLimit({
        windowMs: config.authRateLimit.windowMs,
        limit,
        skipSuccessfulRequests: true,
        standardHeaders: true,
        legacyHeaders: false,
        message
    });
}

const loginLimiter = build(config.authRateLimit.loginMax);
const mfaLimiter = build(config.authRateLimit.mfaMax);

module.exports = { loginLimiter, mfaLimiter };
