/* private/models/BaseModel.js
 *
 * Generic reads and deletes for a TENANT-OWNED table. Every method requires a scope, so a
 * caller can never accidentally read across restaurants.
 */

const DatabaseController = require('../core/DatabaseController');

class BaseModel {
    constructor(tableName) {
        // Table names are interpolated into SQL, so only allow plain identifiers.
        if (!/^[a-z_][a-z0-9_]*$/i.test(tableName)) {
            throw new Error(`Invalid table name: ${tableName}`);
        }
        this.tableName = tableName;
    }

    async findAll(scope) {
        const sql = `SELECT * FROM ${this.tableName} WHERE {tenant}`;
        return await DatabaseController.query(sql, [], scope);
    }

    async findById(id, scope) {
        const sql = `SELECT * FROM ${this.tableName} WHERE {tenant} AND id = ?`;
        const rows = await DatabaseController.query(sql, [id], scope);
        return rows[0] || null;
    }

    async delete(id, scope) {
        const sql = `DELETE FROM ${this.tableName} WHERE {tenant} AND id = ?`;
        const result = await DatabaseController.query(sql, [id], scope);
        return result.affectedRows > 0;
    }
}

module.exports = BaseModel;
