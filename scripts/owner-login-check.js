/* scripts/owner-login-check.js
 *
 * Walks the whole owner sign-in against your running local server and reports each step.
 * It checks the things that matter: a password alone is not enough, a sign-in ticket cannot be
 * used as a session, a code cannot be used twice, and step-up works.
 *
 * Usage (the app must be running in another terminal):  npm run owner:check
 */

const { ask, askHidden } = require('./lib/prompt');

const BASE_URL = process.env.CHECK_BASE_URL || 'http://localhost:3000';
let failures = 0;

async function call(method, path, body, token) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;

    const response = await fetch(`${BASE_URL}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body)
    });

    let data = {};
    try {
        data = await response.json();
    } catch {
        // not JSON
    }
    return { status: response.status, data };
}

function report(passed, label, detail = '') {
    if (!passed) failures++;
    console.log(`${passed ? '  PASS' : '  FAIL'}  ${label}${detail ? `  (${detail})` : ''}`);
}

// Reads the claims out of a token WITHOUT printing the token itself.
function claimsOf(token) {
    return JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
}

async function main() {
    console.log(`Owner sign-in check against ${BASE_URL}\n`);

    const email = (await ask('Owner email: ')).trim();
    const password = await askHidden('Password (hidden): ');

    // 1. Password step
    const login = await call('POST', '/api/auth/login', { email, password });
    const ticket = login.data.data && login.data.data.ticket;
    report(
        login.status === 200 && login.data.data && login.data.data.mfaRequired === true,
        'Password alone does not give a session',
        'asks for a code'
    );
    report(
        !(login.data.data && login.data.data.accessToken),
        'No access token is returned before the code'
    );
    if (!ticket) {
        console.log(`\nStopped: ${login.data.message || 'no sign-in ticket was returned.'}`);
        return;
    }

    // 2. The ticket must not work as a session
    const misuse = await call('GET', '/api/tenants', undefined, ticket);
    report(
        misuse.status === 401,
        'The sign-in ticket cannot be used as a session',
        `status ${misuse.status}`
    );

    // 3. Wrong code
    const wrong = await call('POST', '/api/auth/mfa/verify', { ticket, code: '000000' });
    report(wrong.status === 401, 'A wrong code is refused', `status ${wrong.status}`);

    // 4. Correct code
    const code = (await ask('\nEnter the current 6-digit code from your app: ')).trim();
    const verified = await call('POST', '/api/auth/mfa/verify', { ticket, code });
    const accessToken = verified.data.data && verified.data.data.accessToken;
    report(verified.status === 200 && Boolean(accessToken), 'The correct code gives a session');
    if (!accessToken) {
        console.log(`\nStopped: ${verified.data.message || 'no session was returned.'}`);
        return;
    }

    const claims = claimsOf(accessToken);
    report(claims.scope === 'platform', 'Session scope is platform', `scope: ${claims.scope}`);
    report(
        Array.isArray(claims.roles) && claims.roles.includes('Platform_Owner'),
        'Session carries the Platform_Owner role'
    );
    report(
        Array.isArray(claims.amr) && claims.amr.includes('otp'),
        'Session records that a one-time code was used'
    );
    console.log(`        expires in about ${claims.exp - claims.iat} seconds`);

    // 5. Replay: the same code must not work twice
    const replay = await call('POST', '/api/auth/mfa/verify', { ticket, code });
    report(replay.status === 401, 'Reusing the same code is refused', `status ${replay.status}`);

    // 6. Step-up needs a NEW code
    console.log('\nStep-up needs a fresh code. Wait until the code in your app changes.');
    const stepCode = (await ask('Enter the new 6-digit code: ')).trim();
    const stepUp = await call('POST', '/api/auth/mfa/step-up', { code: stepCode }, accessToken);
    report(
        stepUp.status === 200 && Boolean(stepUp.data.data && stepUp.data.data.stepUpToken),
        'Step-up returns a short-lived pass',
        stepUp.status === 200 ? `lasts ${stepUp.data.data.expiresInSeconds}s` : stepUp.data.message
    );

    console.log(
        failures === 0
            ? '\nAll checks passed.'
            : `\n${failures} check(s) failed. Paste this output to Claude.`
    );
}

main()
    .then(() => process.exit(failures === 0 ? 0 : 1))
    .catch((error) => {
        console.error(`\nCheck failed: ${error.message}`);
        console.error('Is the app running in another terminal (npm start)?');
        process.exit(1);
    });
