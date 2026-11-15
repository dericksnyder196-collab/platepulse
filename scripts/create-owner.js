/* scripts/create-owner.js
 *
 * Creates the platform owner account, the ONLY way an owner can be created. Public sign-up can
 * never create one. The script also sets up two-factor authentication on the spot, in the
 * terminal, so the authenticator secret never travels over the network.
 *
 * Usage:  npm run create-owner
 *
 * It can be run again: if an owner exists but never finished two-factor setup, it resumes.
 */

const config = require('../private/config/env');
const QRCode = require('qrcode');
const User = require('../private/models/User');
const PlatformRole = require('../private/models/PlatformRole');
const UserMfa = require('../private/models/UserMfa');
const DatabaseController = require('../private/core/DatabaseController');
const AuditService = require('../private/services/AuditService');
const MfaService = require('../private/services/MfaService');
const { validateEmail, validateNewPassword } = require('../private/utils/validators');
const { ask, askHidden } = require('./lib/prompt');

const SYSTEM_CONTEXT = Object.freeze({
    actorId: null,
    actorScope: 'system',
    ip: null,
    userAgent: 'scripts/create-owner',
    requestId: null
});

const MIN_OWNER_PASSWORD_LENGTH = 12;

async function readOwnerPassword() {
    for (;;) {
        const first = await askHidden(
            `Password (at least ${MIN_OWNER_PASSWORD_LENGTH} characters, typing is hidden): `
        );
        const second = await askHidden('Repeat the password: ');

        if (first !== second) {
            console.log('The passwords do not match. Try again.\n');
            continue;
        }
        if (first.length < MIN_OWNER_PASSWORD_LENGTH) {
            console.log(`Use at least ${MIN_OWNER_PASSWORD_LENGTH} characters.\n`);
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

async function createOrPromoteUser() {
    let email;
    for (;;) {
        const checked = validateEmail(await ask('Owner email address: '));
        if (checked.error) {
            console.log(`${checked.error}\n`);
            continue;
        }
        email = checked.value;
        break;
    }

    const existing = await User.findByEmail(email);
    let userId;

    if (existing) {
        const answer = await ask(
            `An account for ${email} already exists. Make it the platform owner? (yes/no): `
        );
        if (answer.trim().toLowerCase() !== 'yes') {
            console.log('Cancelled. Nothing was changed.');
            return null;
        }
        userId = existing.id;
    } else {
        const password = await readOwnerPassword();
        userId = await User.create(email, password, config.defaults.language);
    }

    await DatabaseController.executeTransaction(async (connection) => {
        await PlatformRole.grant(userId, 'Platform_Owner', null, connection);
        await AuditService.record(
            {
                context: SYSTEM_CONTEXT,
                action: 'OWNER_CREATED',
                entity: 'user',
                entityId: userId,
                after: { email, promotedExistingAccount: Boolean(existing) }
            },
            connection
        );
    });

    return { userId, email };
}

function printRecoveryCodes(codes) {
    console.log('\n=====================================================');
    console.log('RECOVERY CODES. Save them in a password manager NOW.');
    console.log('They are shown only once. Each one works a single time');
    console.log('if you lose your phone.');
    console.log('=====================================================\n');
    for (const code of codes) console.log(`   ${code}`);
    console.log('');
}

async function enrollTwoFactor(userId, email) {
    const { secret, uri } = await MfaService.startEnrollment({ userId, accountLabel: email });

    console.log('\nSet up two-factor authentication.');
    console.log(
        'Open an authenticator app (Google Authenticator, Microsoft Authenticator, Authy, 1Password)'
    );
    console.log('and scan this QR code:\n');
    console.log(await QRCode.toString(uri, { type: 'terminal', small: true }));
    console.log('Cannot scan it? Add an account by hand with this key:');
    console.log(`   ${secret.match(/.{1,4}/g).join(' ')}\n`);

    for (let attempt = 1; attempt <= 5; attempt++) {
        const code = await ask('Enter the 6-digit code shown in the app: ');
        try {
            const recoveryCodes = await MfaService.confirmEnrollment({
                userId,
                code,
                context: SYSTEM_CONTEXT
            });
            printRecoveryCodes(recoveryCodes);
            return true;
        } catch (error) {
            if (error.code !== 'INVALID_CODE') throw error;
            console.log(`${error.message}\n`);
        }
    }

    console.log('Too many wrong codes. Run this command again to resume the setup.');
    return false;
}

async function main() {
    console.log('PlatePulse owner setup\n');

    const owner = await PlatformRole.findOwner();
    let target;

    if (owner) {
        const mfa = await UserMfa.findByUserId(owner.id);
        if (mfa && mfa.status === 'active') {
            console.log(`The owner account (${owner.email}) is already set up with two-factor.`);
            console.log('Nothing to do. If you lost both your phone and your recovery codes, run:');
            console.log(`   npm run mfa:reset -- ${owner.email}`);
            return;
        }
        console.log(
            `The owner account (${owner.email}) exists, but two-factor setup was not finished.`
        );
        console.log('Resuming the setup.');
        target = { userId: owner.id, email: owner.email };
    } else {
        target = await createOrPromoteUser();
        if (!target) return;
    }

    const finished = await enrollTwoFactor(target.userId, target.email);
    if (finished) {
        console.log('Owner account ready. Next, with the app running in another terminal:');
        console.log('   npm run owner:check');
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(`\nSetup failed: ${error.message}`);
        process.exit(1);
    });
