/* private/utils/hashers.js */

const argon2 = require('argon2');

function hashPassword(plainTextPassword) {
    return argon2.hash(plainTextPassword);
}

async function verifyPassword(hash, plainTextPassword) {
    try {
        return await argon2.verify(hash, plainTextPassword);
    } catch {
        // A malformed stored hash should read as "wrong password", not a crash.
        return false;
    }
}

// Login for an unknown email would otherwise return noticeably faster than a
// wrong password (no hash to check), letting attackers discover which emails
// are registered. Doing equivalent work for unknown emails evens that out.
let dummyHashPromise;
async function burnVerificationTime(plainTextPassword) {
    if (!dummyHashPromise) {
        dummyHashPromise = argon2.hash('timing-equalizer-not-a-real-password');
    }
    await verifyPassword(await dummyHashPromise, plainTextPassword);
}

module.exports = { hashPassword, verifyPassword, burnVerificationTime };
