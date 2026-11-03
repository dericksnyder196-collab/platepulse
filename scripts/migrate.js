/* scripts/migrate.js
 *
 * Applies every .sql file in db/migrations (in filename order) that has not
 * been applied yet, and records each one in a schema_migrations table.
 *
 * Usage:  npm run migrate
 * Uses the same .env / environment variables as the app, so it targets
 * whichever database your DATABASE_URL (or DB_*) points at.
 */

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const { buildConnectionOptions } = require('../private/config/db.options');

const MIGRATIONS_DIR = path.join(__dirname, '..', 'db', 'migrations');

async function run() {
    const connection = await mysql.createConnection({
        ...buildConnectionOptions(),
        multipleStatements: true
    });

    try {
        await connection.query(`
            CREATE TABLE IF NOT EXISTS schema_migrations (
                name       VARCHAR(255) NOT NULL,
                applied_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (name)
            ) ENGINE=InnoDB
        `);

        const [rows] = await connection.query('SELECT name FROM schema_migrations');
        const applied = new Set(rows.map((row) => row.name));

        const files = fs
            .readdirSync(MIGRATIONS_DIR)
            .filter((file) => file.endsWith('.sql'))
            .sort();

        let appliedCount = 0;
        for (const file of files) {
            if (applied.has(file)) {
                console.log(`skip   ${file} (already applied)`);
                continue;
            }

            console.log(`apply  ${file}`);
            const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
            await connection.query(sql);
            await connection.query('INSERT INTO schema_migrations (name) VALUES (?)', [file]);
            appliedCount++;
        }

        console.log(`\nDone. ${appliedCount} migration(s) applied.`);
    } finally {
        await connection.end();
    }
}

run().catch((err) => {
    console.error(`\nMigration failed: ${err.message}`);
    process.exit(1);
});
