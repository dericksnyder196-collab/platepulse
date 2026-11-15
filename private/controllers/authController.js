/* private/controllers/authController.js */

const config = require('../config/env');
const User = require('../models/User');
const PlatformRole = require('../models/PlatformRole');
const UserMfa = require('../models/UserMfa');
const { verifyPassword, burnVerificationTime } = require('../utils/hashers');
const { signMfaTicket } = require('../utils/jwtHelper');
const { issueAccessToken } = require('../services/SessionService');
const {
    validateEmail,
    validateNewPassword,
    validateLoginPassword,
    validateLanguage
} = require('../utils/validators');

function badRequest(res, message) {
    return res.status(400).json({ status: 'error', message });
}

class AuthController {
    static async register(req, res) {
        const body = req.body || {};

        const email = validateEmail(body.email);
        if (email.error) return badRequest(res, email.error);

        const password = validateNewPassword(body.password);
        if (password.error) return badRequest(res, password.error);

        const language = validateLanguage(body.language, config.defaults.language);
        if (language.error) return badRequest(res, language.error);

        const existingUser = await User.findByEmail(email.value);
        if (existingUser) {
            return res.status(409).json({ status: 'error', message: 'Email already in use.' });
        }

        let newUserId;
        try {
            newUserId = await User.create(email.value, password.value, language.value);
        } catch (error) {
            // Two simultaneous sign-ups with the same email can both pass the check above;
            // the database's unique key is the real guard.
            if (error.code === 'ER_DUP_ENTRY') {
                return res.status(409).json({ status: 'error', message: 'Email already in use.' });
            }
            throw error;
        }

        res.status(201).json({
            status: 'success',
            message: 'User successfully registered.',
            data: { userId: newUserId }
        });
    }

    static async login(req, res) {
        const body = req.body || {};

        const email = validateEmail(body.email);
        const password = validateLoginPassword(body.password);
        if (email.error || password.error) {
            return badRequest(res, 'Email and password are required.');
        }

        const user = await User.findByEmail(email.value);
        if (!user) {
            await burnVerificationTime(password.value);
            return res.status(401).json({ status: 'error', message: 'Invalid credentials.' });
        }

        const validPassword = await verifyPassword(user.password_hash, password.value);
        if (!validPassword) {
            return res.status(401).json({ status: 'error', message: 'Invalid credentials.' });
        }

        const roles = await PlatformRole.forUser(user.id);
        const mfa = await UserMfa.findByUserId(user.id);
        const mfaActive = Boolean(mfa) && mfa.status === 'active';

        // Platform accounts must use two-factor authentication. Without it they cannot sign in.
        if (roles.length > 0 && !mfaActive) {
            return res.status(403).json({
                status: 'error',
                message:
                    'This account must set up two-factor authentication before it can sign in. Contact the platform owner.'
            });
        }

        // A correct password is not enough when two-factor is on: return a short-lived ticket that
        // can only be exchanged for a session together with a valid code.
        if (mfaActive) {
            return res.status(200).json({
                status: 'success',
                data: { mfaRequired: true, ticket: signMfaTicket(user.id) }
            });
        }

        const { accessToken, scope } = issueAccessToken(user, roles, ['pwd']);

        res.status(200).json({
            status: 'success',
            data: {
                accessToken,
                scope,
                user: { uuid: user.uuid, email: user.email }
            }
        });
    }
}

module.exports = AuthController;
