/* server.js */

// Loads .env, validates every setting, and exits with a clear message if something is wrong.
const config = require('./private/config/env');

const path = require('path');
const express = require('express');
const helmet = require('helmet');
const morgan = require('morgan');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const routes = require('./private/routes/index');
const { notFound, errorHandler } = require('./private/middleware/errorHandler');

const app = express();

// Render (and most hosts) put a reverse proxy in front of the app. Without this,
// every visitor appears to have the proxy's IP and shares one rate-limit bucket.
if (config.isProduction) {
    app.set('trust proxy', 1);
}

// 1. SECURITY MIDDLEWARE
// Helmet's default CSP only allows scripts from this app's own origin. The frontend has no
// inline scripts, so no 'unsafe-inline' exception is needed.
app.use(helmet());

// The frontend is served by this same app, so CORS is only needed for other origins.
if (config.corsOrigins.length > 0) {
    app.use(
        cors({
            origin: config.corsOrigins,
            methods: ['GET', 'POST', 'PUT', 'DELETE'],
            credentials: true
        })
    );
}

// 2. HEALTH CHECK (before logging and rate limiting so Render's frequent pings
//    are neither logged nor counted against the limit)
app.get('/api/health', (req, res) => {
    res.status(200).json({
        status: 'success',
        message: 'PlatePulse Core Engine is online.',
        timestamp: new Date().toISOString()
    });
});

app.use(morgan(config.isProduction ? 'combined' : 'dev'));

// 3. RATE LIMITING (API endpoints only)
const globalLimiter = rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { status: 'error', message: 'Too many requests from this IP, please try again later.' }
});
app.use('/api', globalLimiter);

// 4. BODY PARSERS
app.use(express.json({ limit: config.bodyLimit }));
app.use(express.urlencoded({ extended: true, limit: config.bodyLimit }));

// 5. FRONTEND STATIC FILES (absolute path, so it works regardless of the working directory)
// The internal style guide is for development only.
if (config.isProduction) {
    app.get('/styleguide.html', (req, res) => res.sendStatus(404));
}
app.use(express.static(path.join(__dirname, 'public')));

// 6. BACKEND ROUTES
app.use('/api', routes);

// 7. ERROR HANDLING (must come last)
app.use('/api', notFound);
app.use(errorHandler);

const server = app.listen(config.port, () => {
    console.log(`\n=========================================`);
    console.log(`PlatePulse Engine: ONLINE`);
    console.log(`Environment: ${config.nodeEnv}`);
    console.log(`URL: http://localhost:${config.port}`);
    console.log(`=========================================\n`);
});

// Render sends SIGTERM on every deploy/restart. Finish in-flight requests, then exit.
process.on('SIGTERM', () => {
    console.log('SIGTERM received. Shutting down gracefully.');
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10000).unref();
});
