/* private/core/DatabaseController.js
 *
 * All SQL runs through here. Every query must declare its scope (see scope.js).
 */

const pool = require('../config/db.config');
const { applyScope } = require('./scope');

class DatabaseController {
    /**
     * query(sql, params, scope, connection?)
     * Pass a transaction `connection` (from executeTransaction) to run inside that transaction.
     */
    static async query(sql, params, scope, connection = null) {
        const scoped = applyScope(sql, params, scope);
        const executor = connection || pool;

        try {
            const [rows] = await executor.execute(scoped.sql, scoped.params);
            return rows;
        } catch (error) {
            // Keep the MySQL error code (e.g. ER_DUP_ENTRY) so callers can react to it.
            const wrapped = new Error(`Database Error: ${error.message}`);
            wrapped.code = error.code;
            wrapped.cause = error;
            throw wrapped;
        }
    }

    static async executeTransaction(callback) {
        const connection = await pool.getConnection();

        try {
            await connection.beginTransaction();
            const result = await callback(connection);
            await connection.commit();
            return result;
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }
}

module.exports = DatabaseController;
