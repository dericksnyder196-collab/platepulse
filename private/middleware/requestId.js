/* private/middleware/requestId.js
 *
 * Gives every request a unique ID, returned in the X-Request-Id header and stored in audit
 * events and logs. IDs are always generated here, never copied from the client, so they cannot
 * be spoofed to confuse an investigation.
 */

const crypto = require('crypto');

function requestId(req, res, next) {
    req.id = crypto.randomUUID();
    res.setHeader('X-Request-Id', req.id);
    next();
}

module.exports = requestId;
