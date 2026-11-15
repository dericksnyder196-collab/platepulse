/* private/services/MfaService.js
 *
 * All the two-factor rules in one place:
 *  - enrollment: a secret is generated, shown once, and confirmed with a first code
 *  - checking a code at sign-in or step-up, using either an authenticator code or a recovery code
 *  - lockout after repeated wrong codes, replay protection, and an audit entry for every outcome
 *
 * Errors are MfaError, with an HTTP status the central error handler uses.
 */

const crypto = require('crypto');
const config = require('../config/env');
const DatabaseController = require('../core/DatabaseController');
const UserMfa = require('../models/UserMfa');
const AuditService = require('./AuditService');
const totp = require('../utils/totp');
const secretBox = require('../utils/secretBox');

const RECOVERY_CODE_COUNT = 10;
const RECOVERY_CODE_LENGTH = 10;

// Separate keys for separate jobs, both derived from the one master key in the environment.
const secretKey = secretBox.deriveKey(config.mfa.encryptionKey, 'mfa-secret-encryption');
const recoveryKey = secretBox.deriveKey(config.mfa.encryptionKey, 'mfa-recovery-code-hmac');

const AUDIT_ACTIONS = {
    LOGIN: { success: 'MFA_LOGIN_SUCCEEDED', failure: 'MFA_LOGIN_FAILED' },
    STEP_UP: { success: 'STEP_UP_SUCCEEDED', failure: 'STEP_UP_FAILED' }
};

class MfaError extends Error {
    constructor(code, message, status) {
        super(message);
        this.name = 'MfaError';
        this.code = code;
        this.status = status;
    }
}

function secretContext(userId) {
    return `mfa-secret:${userId}`;
}

/* ---------- recovery codes ---------- */

// Ten characters from the base32 alphabet (50 bits), shown as XXXXX-XXXXX.
function generateRecoveryCodes() {
    return Array.from({ length: RECOVERY_CODE_COUNT }, () => {
        const raw = totp.base32Encode(crypto.randomBytes(7)).slice(0, RECOVERY_CODE_LENGTH);
        return `${raw.slice(0, 5)}-${raw.slice(5)}`;
    });
}

function normalizeRecoveryCode(input) {
    return String(input)
        .toUpperCase()
        .replace(/[^A-Z2-7]/g, '');
}

// Keyed hash, so a copy of the database cannot be used to read or guess codes.
function hashRecoveryCode(input) {
    return crypto
        .createHmac('sha256', recoveryKey)
        .update(normalizeRecoveryCode(input))
        .digest('hex');
}

/* ---------- enrollment ---------- */

/**
 * Creates a fresh secret and stores it (encrypted) as pending. Returns the secret and the
 * otpauth link for the QR code. Nothing is active until confirmEnrollment succeeds.
 */
async function startEnrollment({ userId, accountLabel }) {
    const existing = await UserMfa.findByUserId(userId);
    if (existing && existing.status === 'active') {
        throw new MfaError('ALREADY_ENROLLED', 'Two-factor authentication is already set up.', 409);
    }

    const secret = totp.generateSecret();
    await UserMfa.savePending(userId, secretBox.encrypt(secret, secretKey, secretContext(userId)));

    return {
        secret,
        uri: totp.buildOtpauthUri({
            secret,
            account: accountLabel,
            issuer: config.mfa.issuer
        })
    };
}

/**
 * Checks the first code, turns two-factor on, and returns the recovery codes. The codes are
 * returned once and stored only as hashes.
 */
async function confirmEnrollment({ userId, code, context }) {
    const record = await UserMfa.findByUserId(userId);
    if (!record || record.status !== 'pending') {
        throw new MfaError('NOT_PENDING', 'There is no two-factor setup in progress.', 409);
    }

    const secret = secretBox.decrypt(record.secret_encrypted, secretKey, secretContext(userId));
    const step = totp.verifyTotp(secret, code);
    if (step === null) {
        throw new MfaError(
            'INVALID_CODE',
            'That code is not right. Check your phone’s clock and try the next code.',
            401
        );
    }

    const recoveryCodes = generateRecoveryCodes();

    await DatabaseController.executeTransaction(async (connection) => {
        const activated = await UserMfa.activate(userId, step, connection);
        if (!activated) {
            throw new MfaError('NOT_PENDING', 'There is no two-factor setup in progress.', 409);
        }
        await UserMfa.replaceRecoveryCodes(userId, recoveryCodes.map(hashRecoveryCode), connection);
        await AuditService.record(
            { context, action: 'MFA_ENROLLED', entity: 'user', entityId: userId },
            connection
        );
    });

    return recoveryCodes;
}

/* ---------- checking a code ---------- */

/**
 * Verifies an authenticator code or a recovery code for an enrolled account.
 * purpose: 'LOGIN' or 'STEP_UP'. Returns { method, remainingRecoveryCodes }.
 */
async function verifyCode({ userId, code, context, purpose }) {
    const actions = AUDIT_ACTIONS[purpose];
    if (!actions) throw new Error(`Unknown MFA purpose: ${purpose}`);

    const record = await UserMfa.findByUserId(userId);
    if (!record || record.status !== 'active') {
        throw new MfaError('NOT_ENROLLED', 'Two-factor authentication is not set up.', 403);
    }
    if (record.is_locked) {
        throw new MfaError('LOCKED', 'Too many wrong codes. Try again in a few minutes.', 429);
    }

    const submitted = typeof code === 'string' ? code.trim() : '';
    const digits = submitted.replace(/\s/g, '');
    let method = null;

    if (/^\d{6}$/.test(digits)) {
        const secret = secretBox.decrypt(record.secret_encrypted, secretKey, secretContext(userId));
        const lastUsedStep = record.last_used_step === null ? null : Number(record.last_used_step);
        const step = totp.verifyTotp(secret, digits, { lastUsedStep });

        // claimStep is atomic: of two simultaneous requests with the same code, only one wins.
        if (step !== null && (await UserMfa.claimStep(userId, step))) method = 'totp';
    } else if (normalizeRecoveryCode(submitted).length === RECOVERY_CODE_LENGTH) {
        if (await UserMfa.consumeRecoveryCode(userId, hashRecoveryCode(submitted))) {
            method = 'recovery';
        }
    }

    if (method === null) {
        const failure = await UserMfa.recordFailure(
            userId,
            config.mfa.maxFailedAttempts,
            config.mfa.lockoutMinutes
        );
        await AuditService.record({
            context,
            action: actions.failure,
            entity: 'user',
            entityId: userId,
            after: { failedAttempts: failure.failedAttempts }
        });
        if (failure.isLocked) {
            await AuditService.record({
                context,
                action: 'MFA_LOCKED',
                entity: 'user',
                entityId: userId,
                reason: 'Too many wrong codes'
            });
        }
        throw new MfaError('INVALID_CODE', 'That code is not right. Check it and try again.', 401);
    }

    await UserMfa.clearFailures(userId);
    await AuditService.record({
        context,
        action: actions.success,
        entity: 'user',
        entityId: userId,
        after: { method }
    });

    let remainingRecoveryCodes = null;
    if (method === 'recovery') {
        remainingRecoveryCodes = await UserMfa.countUnusedRecoveryCodes(userId);
        await AuditService.record({
            context,
            action: 'MFA_RECOVERY_CODE_USED',
            entity: 'user',
            entityId: userId,
            after: { remaining: remainingRecoveryCodes }
        });
    }

    return { method, remainingRecoveryCodes };
}

module.exports = {
    MfaError,
    startEnrollment,
    confirmEnrollment,
    verifyCode,
    // exported for tests
    generateRecoveryCodes,
    normalizeRecoveryCode
};
