/* private/core/DatabaseController.js */

const pool = require('../config/db.config');

// Tenant-scoped queries must say where the tenant filter goes, e.g.
//   SELECT * FROM menu_items WHERE {tenant} AND id = ?
// With a tenantId, {tenant} becomes "tenant_id = ?" (and the id is bound at the
// right position). With no tenantId it becomes "1 = 1" (unscoped).
const TENANT_MARKER = '{tenant}';

class DatabaseController {
    static applyTenantScope(sql, params, tenantId) {
        const markerCount = sql.split(TENANT_MARKER).length - 1;

        if (tenantId === null || tenantId === undefined) {
            return { sql: sql.split(TENANT_MARKER).join('1 = 1'), params: [...params] };
        }

        if (markerCount !== 1) {
            // Fail loudly rather than silently run a query that is not tenant-filtered.
            throw new Error(
                `A tenant-scoped query must contain the ${TENANT_MARKER} marker exactly once.`
            );
        }

        const markerIndex = sql.indexOf(TENANT_MARKER);
        // Position of the new "?" among the existing placeholders
        const placeholdersBefore = (sql.slice(0, markerIndex).match(/\?/g) || []).length;

        const scopedParams = [...params];
        scopedParams.splice(placeholdersBefore, 0, tenantId);

        return { sql: sql.replace(TENANT_MARKER, 'tenant_id = ?'), params: scopedParams };
    }

    static async query(sql, params = [], tenantId = null) {
        const scoped = this.applyTenantScope(sql, params, tenantId);

        try {
            const [rows] = await pool.execute(scoped.sql, scoped.params);
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
