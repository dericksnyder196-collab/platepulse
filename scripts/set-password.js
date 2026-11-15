/* scripts/set-password.js
 *
 * Sets a new password for an account from the terminal. For a forgotten password until the web
 * "forgot password" flow exists (Build Guide, Step 3). It needs database access, which is why it is
 * not available from the website. The change is recorded in the audit log.
 *
 * Usage:  npm run password:set -- you@example.com
 *
 * Two-factor is not touched: an owner still needs a code to sign in after the reset.
 */

require('../private/config/env');
const User = require('../private/models/User');
const PlatformRole = require('../private/models/PlatformRole');
const DatabaseController = require('../private/core/DatabaseController');
const AuditService = require('../private/services/AuditService');
const { validateEmail, validateNewPassword } = require('../private/utils/validators');
const { ask, askHidden } = require('./lib/prompt');

const SYSTEM_CONTEXT = Object.freeze({
    actorId: null,
    actorScope: 'system',
    ip: null,
    userAgent: 'scripts/set-password',
    requestId: null
});

const MIN_PLATFORM_PASSWORD_LENGTH = 12;

async function readNewPassword(minLength) {
    for (;;) {
        const first = await askHidden(
            `New password (at least ${minLength} characters, typing is hidden): `
        );
        const second = await askHidden('Repeat the new password: ');

        if (first !== second) {
            console.log('The passwords do not match. Try again.\n');
            continue;
        }
        if (first.length < minLength) {
            console.log(`Use at least ${minLength} characters.\n`);
            continue;
        }
        const checked = validateNewPassword(first);
        if (checked.error) {
            console.log(`${checked.error}\n`);
            continue;
        }
        return checked.value;
    }
}

async function main() {
    const typed = process.argv[2] || (await ask('Email of the account: '));
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
    const minLength = roles.length > 0 ? MIN_PLATFORM_PASSWORD_LENGTH : 8;

    console.log(`\nSetting a new password for ${user.email}.`);
    const password = await readNewPassword(minLength);

    await DatabaseController.executeTransaction(async (connection) => {
        const updated = await User.updatePassword(user.id, password, connection);
        if (!updated) throw new Error('The password could not be updated.');
        await AuditService.record(
            {
                context: SYSTEM_CONTEXT,
                action: 'PASSWORD_SET_FROM_TERMINAL',
                entity: 'user',
                entityId: user.id,
                reason: 'Set from the terminal'
            },
            connection
        );
    });

    console.log(
        '\nDone. The new password works now. Sessions already open stay valid until they expire.'
    );
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(`\nFailed: ${error.message}`);
        process.exit(1);
    });
