/* private/utils/totp.js
 *
 * Time-based one-time passwords (RFC 6238, built on the RFC 4226 HMAC one-time password) using
 * only Node's built-in crypto, so there is no third-party code in the sign-in path.
 *
 * Defaults match every authenticator app: SHA-1, 6 digits, 30-second steps.
 */

const crypto = require('crypto');

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/* ---------- base32 (RFC 4648), the format authenticator apps use for secrets ---------- */

function base32Encode(buffer) {
    let bits = 0;
    let value = 0;
    let output = '';

    for (const byte of buffer) {
        value = (value << 8) | byte;
        bits += 8;
        while (bits >= 5) {
            output += ALPHABET[(value >>> (bits - 5)) & 31];
            bits -= 5;
        }
        value &= (1 << bits) - 1;
    }

    if (bits > 0) {
        output += ALPHABET[(value << (5 - bits)) & 31];
    }
    return output;
}

function base32Decode(text) {
    const clean = String(text).toUpperCase().replace(/[\s-]/g, '').replace(/=+$/, '');
    let bits = 0;
    let value = 0;
    const bytes = [];

    for (const char of clean) {
        const index = ALPHABET.indexOf(char);
        if (index === -1) throw new Error('Invalid base32 character.');
        value = (value << 5) | index;
        bits += 5;
        if (bits >= 8) {
            bytes.push((value >>> (bits - 8)) & 255);
            bits -= 8;
            value &= (1 << bits) - 1;
        }
    }
    return Buffer.from(bytes);
}

/* ---------- one-time passwords ---------- */

// 160 bits, the size recommended by RFC 4226.
function generateSecret() {
    return base32Encode(crypto.randomBytes(20));
}

// HMAC-based one-time password for a given counter.
function hotp(key, counter, digits = 6) {
    const message = Buffer.alloc(8);
    message.writeBigUInt64BE(BigInt(counter));

    const hmac = crypto.createHmac('sha1', key).update(message).digest();
    const offset = hmac[hmac.length - 1] & 0x0f;
    const binary =
        ((hmac[offset] & 0x7f) << 24) |
        (hmac[offset + 1] << 16) |
        (hmac[offset + 2] << 8) |
        hmac[offset + 3];

    return String(binary % 10 ** digits).padStart(digits, '0');
}

function timeStep(nowMs = Date.now(), period = 30) {
    return Math.floor(nowMs / 1000 / period);
}

function safeEqual(a, b) {
    const left = Buffer.from(a);
    const right = Buffer.from(b);
    return left.length === right.length && crypto.timingSafeEqual(left, right);
}

/**
 * Checks a submitted code. Returns the matching time step, or null if the code is wrong or has
 * already been used. Accepts one step either side of now to allow for clock drift.
 *
 * `lastUsedStep` is the newest step already accepted for this account. A code from that step or an
 * older one is rejected, so an intercepted code cannot be replayed.
 */
function verifyTotp(secretBase32, input, options = {}) {
    const {
        nowMs = Date.now(),
        window = 1,
        period = 30,
        digits = 6,
        lastUsedStep = null
    } = options;

    const submitted = String(input).replace(/\s/g, '');
    if (submitted.length !== digits || !/^\d+$/.test(submitted)) return null;

    const key = base32Decode(secretBase32);
    const current = timeStep(nowMs, period);
    let matched = null;

    // Every candidate is checked, with no early exit, so timing does not reveal which step matched.
    for (let offset = -window; offset <= window; offset++) {
        const step = current + offset;
        if (step < 0) continue;
        const matches = safeEqual(hotp(key, step, digits), submitted);
        if (matches && matched === null) matched = step;
    }

    if (matched === null) return null;
    if (lastUsedStep !== null && matched <= lastUsedStep) return null;
    return matched;
}

// The otpauth:// link that authenticator apps read from a QR code.
function buildOtpauthUri({ secret, account, issuer }) {
    const label = `${encodeURIComponent(issuer)}:${encodeURIComponent(account)}`;
    const query = new URLSearchParams({
        secret,
        issuer,
        algorithm: 'SHA1',
        digits: '6',
        period: '30'
    });
    return `otpauth://totp/${label}?${query.toString()}`;
}

module.exports = {
    base32Encode,
    base32Decode,
    generateSecret,
    hotp,
    timeStep,
    verifyTotp,
    buildOtpauthUri
};
