/* scripts/seed-rbac.js
 *
 * Syncs private/config/permissions.js into the roles, permissions and role_permissions tables.
 * Safe to run repeatedly. The code is the source of truth: system permissions and grants that
 * are no longer in the catalog are removed.
 *
 * Usage:  npm run migrate && npm run seed:rbac
 */

const mysql = require('mysql2/promise');
const { buildConnectionOptions } = require('../private/config/db.options');
const { PERMISSIONS, ROLES } = require('../private/config/permissions');

async function run() {
    const connection = await mysql.createConnection(buildConnectionOptions());

    try {
        await connection.beginTransaction();

        // 1. Roles
        for (const role of ROLES) {
            await connection.execute(
                `INSERT INTO roles (name, scope, description, is_system) VALUES (?, ?, ?, TRUE)
                 ON DUPLICATE KEY UPDATE scope = VALUES(scope), description = VALUES(description)`,
                [role.name, role.scope, role.description]
            );
        }

        // 2. Permissions
        for (const permission of PERMISSIONS) {
            await connection.execute(
                `INSERT INTO permissions
                   (name, scope, control_level, requires_approval, description, is_system)
                 VALUES (?, ?, ?, ?, ?, TRUE)
                 ON DUPLICATE KEY UPDATE control_level = VALUES(control_level),
                   requires_approval = VALUES(requires_approval), description = VALUES(description)`,
                [
                    permission.name,
                    permission.scope,
                    permission.controlLevel,
                    permission.requiresApproval ? 1 : 0,
                    permission.description
                ]
            );
        }

        // 3. Look up ids
        const [roleRows] = await connection.execute('SELECT id, name FROM roles');
        const [permissionRows] = await connection.execute(
            'SELECT id, name, scope FROM permissions'
        );

        const roleId = new Map(roleRows.map((row) => [row.name, row.id]));
        const permissionId = new Map(
            permissionRows.map((row) => [`${row.scope}:${row.name}`, row.id])
        );

        // 4. Remove system permissions that are no longer in the catalog
        const catalogKeys = new Set(PERMISSIONS.map((p) => `${p.scope}:${p.name}`));
        let removedPermissions = 0;
        for (const row of permissionRows) {
            if (!catalogKeys.has(`${row.scope}:${row.name}`)) {
                await connection.execute(
                    'DELETE FROM permissions WHERE id = ? AND is_system = TRUE',
                    [row.id]
                );
                removedPermissions++;
            }
        }

        // 5. Make each system role's grants match the catalog exactly
        let added = 0;
        let removed = 0;
        for (const role of ROLES) {
            const id = roleId.get(role.name);
            const wanted = new Set(
                role.permissions.map((name) => permissionId.get(`${role.scope}:${name}`))
            );

            const [existingRows] = await connection.execute(
                'SELECT permission_id FROM role_permissions WHERE role_id = ?',
                [id]
            );
            const existing = new Set(existingRows.map((row) => row.permission_id));

            for (const permissionIdToAdd of wanted) {
                if (!existing.has(permissionIdToAdd)) {
                    await connection.execute(
                        'INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)',
                        [id, permissionIdToAdd]
                    );
                    added++;
                }
            }
            for (const permissionIdToRemove of existing) {
                if (!wanted.has(permissionIdToRemove)) {
                    await connection.execute(
                        'DELETE FROM role_permissions WHERE role_id = ? AND permission_id = ?',
                        [id, permissionIdToRemove]
                    );
                    removed++;
                }
            }
        }

        await connection.commit();

        console.log(`Roles: ${ROLES.length}. Permissions: ${PERMISSIONS.length}.`);
        console.log(
            `Grants added: ${added}, removed: ${removed}. Stale permissions removed: ${removedPermissions}.`
        );
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        await connection.end();
    }
}

run().catch((err) => {
    console.error(`\nSeeding failed: ${err.message}`);
    process.exit(1);
});
