/* scripts/check-crypto.js
 *
 * Checks the one-time-code and encryption code against published test vectors and edge cases.
 * Needs no database and no .env.
 *
 * Usage:  npm run check:crypto
 */

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const totp = require('../private/utils/totp');
const secretBox = require('../private/utils/secretBox');

let count = 0;
function check(name, fn) {
    fn();
    count++;
    console.log(`  ok  ${name}`);
}

console.log('One-time codes');

// RFC 6238, Appendix B: SHA-1, ASCII key "12345678901234567890", 8 digits.
const rfcKey = Buffer.from('12345678901234567890');
const rfcVectors = [
    [59, '94287082'],
    [1111111109, '07081804'],
    [1111111111, '14050471'],
    [1234567890, '89005924'],
    [2000000000, '69279037'],
    [20000000000, '65353130']
];
for (const [seconds, expected] of rfcVectors) {
    check(`RFC 6238 test vector at t=${seconds}`, () => {
        assert.equal(totp.hotp(rfcKey, totp.timeStep(seconds * 1000), 8), expected);
    });
}

check('6-digit codes are the last 6 digits of the 8-digit vector', () => {
    assert.equal(totp.hotp(rfcKey, 1, 6), '287082');
});

check('base32 matches the RFC 4648 example (foobar)', () => {
    assert.equal(totp.base32Encode(Buffer.from('foobar')), 'MZXW6YTBOI');
    assert.equal(totp.base32Decode('MZXW6YTBOI======').toString(), 'foobar');
});

check('base32 round-trips random data of every length', () => {
    for (let length = 1; length <= 40; length++) {
        const bytes = crypto.randomBytes(length);
        assert.deepEqual(totp.base32Decode(totp.base32Encode(bytes)), bytes);
    }
});

check('generated secrets are 32 characters and different each time', () => {
    const a = totp.generateSecret();
    const b = totp.generateSecret();
    assert.equal(a.length, 32);
    assert.notEqual(a, b);
});

const secret = totp.base32Encode(rfcKey);

check('the current code is accepted and returns its step', () => {
    assert.equal(totp.verifyTotp(secret, '287082', { nowMs: 59000 }), 1);
});

check('one step of clock drift is tolerated, in both directions', () => {
    assert.equal(totp.verifyTotp(secret, '287082', { nowMs: 89000 }), 1);
    assert.equal(totp.verifyTotp(secret, '287082', { nowMs: 29000 }), 1);
});

check('a code two steps old is refused', () => {
    assert.equal(totp.verifyTotp(secret, '287082', { nowMs: 119000 }), null);
});

check('a code that was already used cannot be replayed', () => {
    assert.equal(totp.verifyTotp(secret, '287082', { nowMs: 59000, lastUsedStep: 1 }), null);
    assert.equal(totp.verifyTotp(secret, '287082', { nowMs: 59000, lastUsedStep: 0 }), 1);
});

check('wrong, short, long and non-numeric codes are refused', () => {
    for (const bad of ['000000', '28708', '2870822', 'abcdef', '', '28 70 82x']) {
        assert.equal(totp.verifyTotp(secret, bad, { nowMs: 59000 }), null);
    }
});

check('spaces in a typed code are ignored', () => {
    assert.equal(totp.verifyTotp(secret, '287 082', { nowMs: 59000 }), 1);
});

check('the otpauth link carries the secret, issuer and account', () => {
    const uri = totp.buildOtpauthUri({ secret, account: 'a@b.com', issuer: 'PlatePulse' });
    assert.ok(uri.startsWith('otpauth://totp/PlatePulse:a%40b.com?'));
    assert.ok(uri.includes(`secret=${secret}`));
    assert.ok(uri.includes('issuer=PlatePulse'));
});

console.log('\nEncryption of stored secrets');

const master = crypto.randomBytes(32);
const key = secretBox.deriveKey(master, 'test-key');

check('encrypt then decrypt returns the original', () => {
    const stored = secretBox.encrypt('JBSWY3DPEHPK3PXP', key, 'mfa-secret:42');
    assert.ok(stored.startsWith('v1.'));
    assert.equal(secretBox.decrypt(stored, key, 'mfa-secret:42'), 'JBSWY3DPEHPK3PXP');
});

check('encrypting the same value twice gives different output', () => {
    const one = secretBox.encrypt('same', key, 'ctx');
    const two = secretBox.encrypt('same', key, 'ctx');
    assert.notEqual(one, two);
});

check('a value copied to another account will not decrypt', () => {
    const stored = secretBox.encrypt('secret', key, 'mfa-secret:42');
    assert.throws(() => secretBox.decrypt(stored, key, 'mfa-secret:43'));
});

check('the wrong key will not decrypt', () => {
    const stored = secretBox.encrypt('secret', key, 'ctx');
    const other = secretBox.deriveKey(crypto.randomBytes(32), 'test-key');
    assert.throws(() => secretBox.decrypt(stored, other, 'ctx'));
});

check('a tampered value is detected', () => {
    const [version, iv, tag, data] = secretBox.encrypt('secret', key, 'ctx').split('.');
    const flipped = Buffer.from(data, 'base64');
    flipped[0] ^= 1;
    const tampered = [version, iv, tag, flipped.toString('base64')].join('.');
    assert.throws(() => secretBox.decrypt(tampered, key, 'ctx'));
});

check('garbage input is rejected cleanly', () => {
    assert.throws(() => secretBox.decrypt('not-encrypted', key, 'ctx'));
});

check('derived keys are repeatable and differ by purpose', () => {
    assert.deepEqual(secretBox.deriveKey(master, 'a'), secretBox.deriveKey(master, 'a'));
    assert.notDeepEqual(secretBox.deriveKey(master, 'a'), secretBox.deriveKey(master, 'b'));
    assert.equal(secretBox.deriveKey(master, 'a').length, 32);
});

console.log(`\nAll ${count} checks passed.`);
