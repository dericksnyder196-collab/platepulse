/* private/utils/secretBox.js
 *
 * Authenticated encryption (AES-256-GCM) for values stored in the database, such as authenticator
 * secrets. The key lives in the environment, never in the database, so a stolen database dump alone
 * is not enough to read them.
 *
 * Each value is bound to a context string (for example "mfa-secret:42") through the cipher's
 * additional authenticated data, so a ciphertext copied onto another account will not decrypt.
 *
 * Stored format: v1.<iv>.<auth tag>.<ciphertext>, each part base64.
 */

const crypto = require('crypto');

// One master key, several purpose-specific keys: a leak of one use does not expose the others.
function deriveKey(masterKey, label) {
    return Buffer.from(crypto.hkdfSync('sha256', masterKey, Buffer.alloc(0), label, 32));
}

function encrypt(plaintext, key, context) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    cipher.setAAD(Buffer.from(context));

    const data = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();

    return ['v1', iv.toString('base64'), tag.toString('base64'), data.toString('base64')].join('.');
}

function decrypt(payload, key, context) {
    const [version, iv, tag, data] = String(payload).split('.');
    if (version !== 'v1' || !iv || !tag || !data) {
        throw new Error('Unsupported or corrupt encrypted value.');
    }

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64'));
    decipher.setAAD(Buffer.from(context));
    decipher.setAuthTag(Buffer.from(tag, 'base64'));

    return Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()]).toString(
        'utf8'
    );
}

module.exports = { deriveKey, encrypt, decrypt };
