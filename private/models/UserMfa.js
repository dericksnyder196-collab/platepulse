/* private/models/UserMfa.js
 *
 * Two-factor state and recovery codes. `user_mfa` and `mfa_recovery_codes` belong to a user, not to
 * a restaurant, so every query uses Scope.GLOBAL.
 *
 * Counters are changed with single atomic UPDATE statements, so parallel requests cannot slip past
 * a lockout or reuse a code.
 */

const DatabaseController = require('../core/DatabaseController');
const { Scope } = require('../core/scope');

class UserMfa {
    static async findByUserId(userId, connection = null) {
        const rows = await DatabaseController.query(
            `SELECT user_id, secret_encrypted, status, last_used_step, failed_attempts,
                    (locked_until IS NOT NULL AND locked_until > NOW()) AS is_locked
             FROM user_mfa WHERE user_id = ?`,
            [userId],
            Scope.GLOBAL,
            connection
        );
        return rows[0] || null;
    }

    // Starts (or restarts) enrollment. The service refuses to call this for an active account.
    static async savePending(userId, secretEncrypted, connection = null) {
        await DatabaseController.query(
            `INSERT INTO user_mfa (user_id, secret_encrypted, status)
             VALUES (?, ?, 'pending')
             ON DUPLICATE KEY UPDATE secret_encrypted = VALUES(secret_encrypted), status = 'pending',
                 last_used_step = NULL, failed_attempts = 0, locked_until = NULL, enrolled_at = NULL`,
            [userId, secretEncrypted],
            Scope.GLOBAL,
            connection
        );
    }

    static async activate(userId, step, connection = null) {
        const result = await DatabaseController.query(
            `UPDATE user_mfa
             SET status = 'active', enrolled_at = NOW(), last_used_step = ?,
                 failed_attempts = 0, locked_until = NULL
             WHERE user_id = ? AND status = 'pending'`,
            [step, userId],
            Scope.GLOBAL,
            connection
        );
        return result.affectedRows === 1;
    }

    // Accepts a time step only if it is newer than every step used before. False means a replay.
    static async claimStep(userId, step) {
        const result = await DatabaseController.query(
            `UPDATE user_mfa SET last_used_step = ?
             WHERE user_id = ? AND status = 'active'
               AND (last_used_step IS NULL OR last_used_step < ?)`,
            [step, userId, step],
            Scope.GLOBAL
        );
        return result.affectedRows === 1;
    }

    // Counts a wrong code and locks the account once the limit is reached. MySQL evaluates the
    // assignments left to right, so the lock check sees the already-incremented count.
    static async recordFailure(userId, maxAttempts, lockoutMinutes) {
        await DatabaseController.query(
            `UPDATE user_mfa
             SET failed_attempts = failed_attempts + 1,
                 locked_until = IF(failed_attempts >= ?, DATE_ADD(NOW(), INTERVAL ? MINUTE), locked_until)
             WHERE user_id = ?`,
            [maxAttempts, lockoutMinutes, userId],
            Scope.GLOBAL
        );

        const rows = await DatabaseController.query(
            `SELECT failed_attempts, (locked_until IS NOT NULL AND locked_until > NOW()) AS is_locked
             FROM user_mfa WHERE user_id = ?`,
            [userId],
            Scope.GLOBAL
        );
        const row = rows[0] || { failed_attempts: 0, is_locked: 0 };
        return { failedAttempts: row.failed_attempts, isLocked: Boolean(row.is_locked) };
    }

    static async clearFailures(userId) {
        await DatabaseController.query(
            'UPDATE user_mfa SET failed_attempts = 0, locked_until = NULL WHERE user_id = ?',
            [userId],
            Scope.GLOBAL
        );
    }

    // Used by the break-glass reset script.
    static async remove(userId, connection = null) {
        await DatabaseController.query(
            'DELETE FROM mfa_recovery_codes WHERE user_id = ?',
            [userId],
            Scope.GLOBAL,
            connection
        );
        await DatabaseController.query(
            'DELETE FROM user_mfa WHERE user_id = ?',
            [userId],
            Scope.GLOBAL,
            connection
        );
    }

    static async replaceRecoveryCodes(userId, hashes, connection = null) {
        await DatabaseController.query(
            'DELETE FROM mfa_recovery_codes WHERE user_id = ?',
            [userId],
            Scope.GLOBAL,
            connection
        );
        for (const hash of hashes) {
            await DatabaseController.query(
                'INSERT INTO mfa_recovery_codes (user_id, code_hash) VALUES (?, ?)',
                [userId, hash],
                Scope.GLOBAL,
                connection
            );
        }
    }

    // Single-use: the UPDATE only matches a code that has not been used yet.
    static async consumeRecoveryCode(userId, hash) {
        const result = await DatabaseController.query(
            `UPDATE mfa_recovery_codes SET used_at = NOW()
             WHERE user_id = ? AND code_hash = ? AND used_at IS NULL`,
            [userId, hash],
            Scope.GLOBAL
        );
        return result.affectedRows === 1;
    }

    static async countUnusedRecoveryCodes(userId) {
        const rows = await DatabaseController.query(
            'SELECT COUNT(*) AS total FROM mfa_recovery_codes WHERE user_id = ? AND used_at IS NULL',
            [userId],
            Scope.GLOBAL
        );
        return Number(rows[0].total);
    }
}

module.exports = UserMfa;
