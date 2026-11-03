/* private/models/BaseModel.js */

const DatabaseController = require('../core/DatabaseController');

class BaseModel {
    constructor(tableName) {
        // Table names are interpolated into SQL, so only allow plain identifiers.
        if (!/^[a-z_][a-z0-9_]*$/i.test(tableName)) {
            throw new Error(`Invalid table name: ${tableName}`);
        }
        this.tableName = tableName;
    }

    async findAll(tenantId = null) {
        const sql = `SELECT * FROM ${this.tableName} WHERE {tenant}`;
        return await DatabaseController.query(sql, [], tenantId);
    }

    async findById(id, tenantId = null) {
        const sql = `SELECT * FROM ${this.tableName} WHERE {tenant} AND id = ?`;
        const rows = await DatabaseController.query(sql, [id], tenantId);
        return rows[0] || null;
    }

    async delete(id, tenantId = null) {
        const sql = `DELETE FROM ${this.tableName} WHERE {tenant} AND id = ?`;
        const result = await DatabaseController.query(sql, [id], tenantId);
        return result.affectedRows > 0;
    }
}

module.exports = BaseModel;
