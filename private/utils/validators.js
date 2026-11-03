/* private/utils/validators.js
 *
 * Each validator returns { value } on success or { error } on failure, so
 * controllers can check input in one line and never pass non-strings
 * (e.g. objects from a crafted JSON body) down to the database layer.
 */

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const LIMITS = {
    emailMax: 255,
    passwordMin: 8,
    passwordMax: 128,
    tenantNameMax: 100
};

function isBlank(value) {
    return value === undefined || value === null || value === '';
}

function validateEmail(value) {
    if (typeof value !== 'string' || value.trim() === '') {
        return { error: 'Email is required.' };
    }
    const email = value.trim().toLowerCase();
    if (email.length > LIMITS.emailMax || !EMAIL_REGEX.test(email)) {
        return { error: 'A valid email address is required.' };
    }
    return { value: email };
}

// Used when creating an account: enforces the password policy.
function validateNewPassword(value) {
    if (typeof value !== 'string' || value === '') {
        return { error: 'Password is required.' };
    }
    if (value.length < LIMITS.passwordMin) {
        return { error: `Password must be at least ${LIMITS.passwordMin} characters.` };
    }
    if (value.length > LIMITS.passwordMax) {
        return { error: `Password must be at most ${LIMITS.passwordMax} characters.` };
    }
    return { value };
}

// Used at login: only checks presence and size, so existing accounts are never locked out by a new policy.
function validateLoginPassword(value) {
    if (typeof value !== 'string' || value === '' || value.length > LIMITS.passwordMax) {
        return { error: 'Email and password are required.' };
    }
    return { value };
}

function validateTenantName(value) {
    if (typeof value !== 'string' || value.trim() === '') {
        return { error: 'Tenant name is required.' };
    }
    const name = value.trim();
    if (name.length > LIMITS.tenantNameMax) {
        return { error: `Tenant name must be at most ${LIMITS.tenantNameMax} characters.` };
    }
    return { value: name };
}

// Optional field: falls back to the given default when omitted.
function validateCurrency(value, fallback) {
    if (isBlank(value)) return { value: fallback };
    if (typeof value !== 'string' || !/^[A-Za-z]{3}$/.test(value.trim())) {
        return { error: 'Currency must be a 3-letter code such as RWF.' };
    }
    return { value: value.trim().toUpperCase() };
}

const TWO_LETTERS = /^[A-Za-z]{2}$/;

// Accepts a language such as en or fr, optionally with a region such as en-us.
function isLanguageCode(text) {
    const parts = text.split('-');
    if (parts.length > 2) return false;
    return parts.every((part) => TWO_LETTERS.test(part));
}

// Optional field: falls back to the given default when omitted.
function validateLanguage(value, fallback) {
    if (isBlank(value)) return { value: fallback };
    if (typeof value !== 'string' || !isLanguageCode(value.trim())) {
        return { error: 'Language must be a code such as en or fr.' };
    }
    return { value: value.trim().toLowerCase() };
}

// Route params arrive as strings; returns a positive integer or null.
function parseId(value) {
    if (typeof value !== 'string' || !/^\d+$/.test(value)) return null;
    const id = Number(value);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
}

module.exports = {
    validateEmail,
    validateNewPassword,
    validateLoginPassword,
    validateTenantName,
    validateCurrency,
    validateLanguage,
    parseId
};
