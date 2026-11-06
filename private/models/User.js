/* private/models/User.js
 *
 * `users` is a global table (a person is not owned by a restaurant), so every query here
 * uses Scope.GLOBAL.
 */

const DatabaseController = require('../core/DatabaseController');
const { Scope } = require('../core/scope');
const { hashPassword } = require('../utils/hashers');

class User {
    async findByEmail(email) {
        const sql = 'SELECT * FROM users WHERE email = ?';
        const rows = await DatabaseController.query(sql, [email], Scope.GLOBAL);
        return rows[0] || null;
    }

    // `language` is always supplied by the caller (the controller applies the configured default).
    async create(email, plainTextPassword, language) {
        const passwordHash = await hashPassword(plainTextPassword);
        const sql =
            'INSERT INTO users (uuid, email, password_hash, default_lang) VALUES (UUID(), ?, ?, ?)';
        const result = await DatabaseController.query(
            sql,
            [email, passwordHash, language],
            Scope.GLOBAL
        );
        return result.insertId;
    }

    async updateProfile(id, updateData) {
        const sql = 'UPDATE users SET default_lang = ? WHERE id = ?';
        const result = await DatabaseController.query(sql, [updateData.language, id], Scope.GLOBAL);
        return result.affectedRows > 0;
    }
}

module.exports = new User();
