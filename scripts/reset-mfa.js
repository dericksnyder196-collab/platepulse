/* scripts/reset-mfa.js
 *
 * Break-glass: removes two-factor authentication and all recovery codes from an account, for the
 * case where both the phone and the recovery codes are lost. It needs access to the database
 * (this terminal), which is why it is not available from the website.
 *
 * Usage:  npm run mfa:reset -- you@example.com
 *
 * After a reset, an owner account cannot sign in until two-factor is set up again with
 * `npm run create-owner`, which resumes the setup.
 */

require('../private/config/env');
const User = require('../private/models/User');
const UserMfa = require('../private/models/UserMfa');
const PlatformRole = require('../private/models/PlatformRole');
const DatabaseController = require('../private/core/DatabaseController');
const AuditService = require('../private/services/AuditService');
const { validateEmail } = require('../private/utils/validators');
const { ask } = require('./lib/prompt');

const SYSTEM_CONTEXT = Object.freeze({
    actorId: null,
    actorScope: 'system',
    ip: null,
    userAgent: 'scripts/reset-mfa',
    requestId: null
});

async function main() {
    const typed = process.argv[2] || (await ask('Email of the account to reset: '));
    const checked = validateEmail(typed);
    if (checked.error) {
        console.log(checked.error);
        return;
    }

    const user = await User.findByEmail(checked.value);
    if (!user) {
        console.log('No account has that email address.');
        return;
    }

    const roles = await PlatformRole.forUser(user.id);
    console.log(
        `\nThis removes two-factor authentication and every recovery code for ${user.email}.`
    );
    if (roles.length > 0) {
        console.log(
            'It is a platform account, so it cannot sign in until two-factor is set up again.'
        );
    }

    const confirmation = await ask('Type RESET to continue: ');
    if (confirmation.trim() !== 'RESET') {
        console.log('Cancelled. Nothing was changed.');
        return;
    }

    await DatabaseController.executeTransaction(async (connection) => {
        await UserMfa.remove(user.id, connection);
        await AuditService.record(
            {
                context: SYSTEM_CONTEXT,
                action: 'MFA_RESET',
                entity: 'user',
                entityId: user.id,
                reason: 'Reset from the terminal'
            },
            connection
        );
    });

    console.log('\nDone.');
    if (roles.includes('Platform_Owner')) {
        console.log('Set up two-factor again with: npm run create-owner');
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(`\nReset failed: ${error.message}`);
        process.exit(1);
    });
