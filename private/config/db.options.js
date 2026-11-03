/* private/config/db.options.js
 *
 * Builds the mysql2 connection options from the validated config.
 * Shared by the app's connection pool and the migration script so both
 * connect to Aiven the same way (host, port, SSL).
 */

const fs = require('fs');
const config = require('./env');

function loadCa() {
    const { caPath, caPem } = config.db.ssl;

    if (caPath) {
        try {
            return fs.readFileSync(caPath, 'utf8');
        } catch (err) {
            throw new Error(
                `DB_SSL_CA_PATH is set to "${caPath}" but the file could not be read: ${err.message}`
            );
        }
    }

    if (caPem) {
        // Env vars often store newlines as a literal backslash-n
        return caPem.replace(/\\n/g, '\n');
    }

    return null;
}

function buildSsl() {
    if (!config.db.ssl.enabled) return undefined;

    const ca = loadCa();
    if (ca) {
        return { ca, rejectUnauthorized: true };
    }

    console.warn(
        'DB SSL is enabled without a CA certificate: traffic is encrypted but the server identity is not verified. ' +
            'Set DB_SSL_CA_PATH or DB_SSL_CA to the Aiven CA certificate for full verification.'
    );
    return { rejectUnauthorized: false };
}

function buildConnectionOptions() {
    const { host, port, user, password, database, connectTimeoutMs } = config.db;
    return {
        host,
        port,
        user,
        password,
        database,
        ssl: buildSsl(),
        connectTimeout: connectTimeoutMs
    };
}

module.exports = { buildConnectionOptions };
