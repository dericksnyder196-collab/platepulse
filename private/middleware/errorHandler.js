/* private/middleware/errorHandler.js */

const config = require('../config/env');

// Runs when no route matched an /api request.
function notFound(req, res) {
    res.status(404).json({ status: 'error', message: 'Route not found.' });
}

// Central error handler. Must be registered last, with four arguments.
function errorHandler(err, req, res, next) {
    if (res.headersSent) {
        return next(err);
    }

    let status = err.status || err.statusCode || 500;
    let message = err.message || 'Internal server error.';

    // Errors raised by express.json() / express.urlencoded()
    if (err.type === 'entity.parse.failed') {
        status = 400;
        message = 'Malformed JSON in request body.';
    } else if (err.type === 'entity.too.large') {
        status = 413;
        message = 'Request body is too large.';
    }

    if (status >= 500) {
        console.error(`[${req.method} ${req.originalUrl}]`, err);
        // Never leak internals (SQL errors, stack traces) to clients in production.
        if (config.isProduction) {
            message = 'Internal server error.';
        }
    }

    res.status(status).json({ status: 'error', message });
}

module.exports = { notFound, errorHandler };
