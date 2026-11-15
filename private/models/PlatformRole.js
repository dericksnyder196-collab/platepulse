/* private/models/PlatformRole.js
 *
 * Platform staff roles (Platform_Owner and friends). A role is held by a person, not by a
 * restaurant, so every query uses Scope.GLOBAL.
 */

const DatabaseController = require('../core/DatabaseController');
const { Scope } = require('../core/scope');

class PlatformRole {
    // Names of the platform roles a user holds, for example ['Platform_Owner'].
    static async forUser(userId, connection = null) {
        const rows = await DatabaseController.query(
            `SELECT r.name
             FROM platform_roles pr
             JOIN roles r ON r.id = pr.role_id
             WHERE pr.user_id = ?
             ORDER BY r.name`,
            [userId],
            Scope.GLOBAL,
            connection
        );
        return rows.map((row) => row.name);
    }

    static async grant(userId, roleName, grantedBy, connection = null) {
        const result = await DatabaseController.query(
            `INSERT INTO platform_roles (user_id, role_id, granted_by)
             SELECT ?, r.id, ? FROM roles r WHERE r.name = ? AND r.scope = 'platform'`,
            [userId, grantedBy ?? null, roleName],
            Scope.GLOBAL,
            connection
        );
        if (result.affectedRows !== 1) {
            throw new Error(`Platform role "${roleName}" does not exist. Run: npm run seed:rbac`);
        }
    }

    // The first account holding Platform_Owner, or null.
    static async findOwner() {
        const rows = await DatabaseController.query(
            `SELECT u.id, u.email
             FROM platform_roles pr
             JOIN roles r ON r.id = pr.role_id
             JOIN users u ON u.id = pr.user_id
             WHERE r.name = 'Platform_Owner'
             ORDER BY u.id
             LIMIT 1`,
            [],
            Scope.GLOBAL
        );
        return rows[0] || null;
    }
}

module.exports = PlatformRole;
