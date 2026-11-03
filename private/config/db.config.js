/* private/config/db.config.js */

const mysql = require('mysql2/promise');
const config = require('./env');
const { buildConnectionOptions } = require('./db.options');

const pool = mysql.createPool({
    ...buildConnectionOptions(),
    waitForConnections: true,
    connectionLimit: config.db.connectionLimit,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000
});

// The database is remote, so give it a few chances before giving up at startup.
async function verifyConnection(retries = 5, delayMs = 2000) {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const connection = await pool.getConnection();
            connection.release();
            console.log(`MySQL connection pool established (${config.db.host}:${config.db.port}).`);
            return;
        } catch (err) {
            console.error(
                `Database connection attempt ${attempt}/${retries} failed: ${err.message}`
            );
            if (attempt === retries) {
                console.error('Database connection failed. Exiting.');
                process.exit(1);
            }
            await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
    }
}

verifyConnection();

module.exports = pool;
