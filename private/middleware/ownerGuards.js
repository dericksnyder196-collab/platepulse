/* private/middleware/ownerGuards.js
 *
 * Extra protection for the owner pages (/owner) and the owner API (/api/v1/owner):
 *  - ownerNetworkGuard: if OWNER_ALLOWED_IPS is set, only those addresses get an answer.
 *    Everyone else gets a plain 404, as if the area did not exist.
 *  - ownerHeaders: a stricter Content-Security-Policy than the rest of the site (nothing but this
 *    site's own files, no framing, no form posts elsewhere), no caching, no referrer, no indexing.
 */

const config = require('../config/env');

function clientIp(req) {
    // Some servers report IPv4 addresses in IPv6 form (::ffff:1.2.3.4).
    return String(req.ip || '').replace(/^::ffff:/, '');
}

function ownerNetworkGuard(req, res, next) {
    const allowed = config.owner.allowedIps;
    if (allowed.length === 0 || allowed.includes(clientIp(req))) return next();
    return res.status(404).json({ status: 'error', message: 'Route not found.' });
}

function ownerHeaders(req, res, next) {
    const directives = [
        "default-src 'none'",
        "script-src 'self'",
        "style-src 'self'",
        "font-src 'self'",
        "img-src 'self' data:",
        "connect-src 'self'",
        "base-uri 'none'",
        "form-action 'self'",
        "frame-ancestors 'none'"
    ];
    if (config.isProduction) directives.push('upgrade-insecure-requests');

    res.setHeader('Content-Security-Policy', directives.join('; '));
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    next();
}

module.exports = { ownerNetworkGuard, ownerHeaders };
