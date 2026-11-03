/* private/models/Tenant.js */

const DatabaseController = require('../core/DatabaseController');

const COLUMNS = 'id, name, owner_id, currency, created_at, updated_at';

class Tenant {
    static async create(name, ownerId, currency) {
        const sql = 'INSERT INTO tenants (name, owner_id, currency) VALUES (?, ?, ?)';
        const result = await DatabaseController.query(sql, [name, ownerId, currency]);
        return result.insertId;
    }

    static async findByOwnerId(ownerId) {
        const sql = `SELECT ${COLUMNS} FROM tenants WHERE owner_id = ? ORDER BY created_at DESC, id DESC`;
        return await DatabaseController.query(sql, [ownerId]);
    }

    // Returns the tenant only if it belongs to this owner, otherwise null.
    static async findOwnedById(id, ownerId) {
        const sql = `SELECT ${COLUMNS} FROM tenants WHERE id = ? AND owner_id = ?`;
        const rows = await DatabaseController.query(sql, [id, ownerId]);
        return rows[0] || null;
    }

    static async update(id, ownerId, name, currency) {
        const sql = 'UPDATE tenants SET name = ?, currency = ? WHERE id = ? AND owner_id = ?';
        return await DatabaseController.query(sql, [name, currency, id, ownerId]);
    }

    static async delete(id, ownerId) {
        const sql = 'DELETE FROM tenants WHERE id = ? AND owner_id = ?';
        return await DatabaseController.query(sql, [id, ownerId]);
    }
}

module.exports = Tenant;
