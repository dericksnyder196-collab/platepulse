/* private/config/env.js
 *
 * The single place where environment variables are read and validated.
 * Every other file should import this module instead of touching process.env.
 * If anything required is missing or invalid, the app prints every problem
 * at once and exits before it starts serving traffic.
 */

require('dotenv').config({ quiet: true });

const isProduction = process.env.NODE_ENV === 'production';
const errors = [];
const warnings = [];

/* ---------- helpers ---------- */

function optional(name, fallback) {
    const value = process.env[name];
    return value !== undefined && value.trim() !== '' ? value.trim() : fallback;
}

function required(name) {
    const value = optional(name);
    if (value === undefined) errors.push(`${name} is required but not set.`);
    return value;
}

function integer(name, fallback) {
    const value = optional(name);
    if (value === undefined) return fallback;
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed <= 0) {
        errors.push(`${name} must be a positive integer (got "${value}").`);
        return fallback;
    }
    return parsed;
}

function boolean(name) {
    const value = optional(name);
    if (value === undefined) return undefined;
    return value.toLowerCase() === 'true';
}

function list(name) {
    const value = optional(name);
    return value
        ? value
              .split(',')
              .map((item) => item.trim())
              .filter(Boolean)
        : [];
}

/* ---------- database ---------- */

function loadDatabase() {
    let connection;
    const url = optional('DATABASE_URL');

    if (url) {
        try {
            const parsed = new URL(url);
            if (!['mysql:', 'mysql2:'].includes(parsed.protocol)) {
                errors.push('DATABASE_URL must start with mysql:// .');
            }
            connection = {
                host: parsed.hostname,
                port: parsed.port ? parseInt(parsed.port, 10) : 3306,
                user: decodeURIComponent(parsed.username),
                password: decodeURIComponent(parsed.password),
                database: parsed.pathname.replace(/^\//, '') || optional('DB_NAME')
            };
            if (!connection.database) {
                errors.push('DATABASE_URL has no database name and DB_NAME is not set.');
            }
        } catch {
            errors.push(
                'DATABASE_URL is not a valid URL. Special characters in the password must be percent-encoded.'
            );
            connection = {};
        }
    } else {
        connection = {
            host: required('DB_HOST'),
            port: integer('DB_PORT', 3306),
            user: required('DB_USER'),
            password: process.env.DB_PASSWORD || '',
            database: required('DB_NAME')
        };
    }

    const isLocal = ['localhost', '127.0.0.1', '::1'].includes(connection.host);
    const sslSetting = boolean('DB_SSL');

    return {
        ...connection,
        ssl: {
            enabled: sslSetting !== undefined ? sslSetting : !isLocal,
            caPath: optional('DB_SSL_CA_PATH'),
            caPem: process.env.DB_SSL_CA || undefined
        },
        connectionLimit: integer('DB_CONNECTION_LIMIT', 10),
        connectTimeoutMs: integer('DB_CONNECT_TIMEOUT_MS', 10000)
    };
}

/* ---------- auth ---------- */

function loadJwt() {
    const secret = required('JWT_ACCESS_SECRET');
    if (secret) {
        if (isProduction && secret.length < 32) {
            errors.push('JWT_ACCESS_SECRET must be at least 32 characters in production.');
        } else if (secret.length < 32) {
            warnings.push(
                'JWT_ACCESS_SECRET is shorter than 32 characters. Use a long random value in production.'
            );
        }
    }
    return {
        accessSecret: secret,
        accessExpiresIn: optional('JWT_ACCESS_EXPIRES', '15m')
    };
}

/* ---------- assemble ---------- */

const config = {
    nodeEnv: optional('NODE_ENV', 'development'),
    isProduction,
    port: integer('PORT', 3000),

    db: loadDatabase(),
    jwt: loadJwt(),

    // Empty list = same-origin only (the frontend is served by this app, so CORS is not needed).
    corsOrigins: list('CORS_ORIGINS'),

    rateLimit: {
        windowMs: integer('RATE_LIMIT_WINDOW_MS', 15 * 60 * 1000),
        max: integer('RATE_LIMIT_MAX', 100)
    },

    bodyLimit: optional('BODY_LIMIT', '10kb'),

    defaults: {
        currency: optional('DEFAULT_CURRENCY', 'RWF').toUpperCase(),
        language: optional('DEFAULT_LANGUAGE', 'en').toLowerCase()
    }
};

if (errors.length > 0) {
    console.error('\nConfiguration error. The app cannot start:\n');
    errors.forEach((message) => console.error(`  - ${message}`));
    console.error(
        '\nSet these in your .env file (local) or the Render dashboard (production). See .env.example.\n'
    );
    process.exit(1);
}

warnings.forEach((message) => console.warn(`Config warning: ${message}`));

module.exports = Object.freeze(config);
