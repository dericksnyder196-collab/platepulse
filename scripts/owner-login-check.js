/* scripts/owner-login-check.js
 *
 * Walks the whole owner sign-in against your running local server and reports each step. It checks
 * what matters: a password alone is not enough, a sign-in ticket is not a session, a code cannot be
 * used twice, owner and ordinary sessions stay apart, sessions renew but keep their hard time limit,
 * and high-impact actions demand a fresh code.
 *
 * Usage (the app must be running in another terminal):  npm run owner:check
 */

const { ask, askHidden } = require('./lib/prompt');

const BASE_URL = process.env.CHECK_BASE_URL || 'http://localhost:3000';
let failures = 0;

async function call(method, path, body, token, extraHeaders = {}) {
    const headers = { 'Content-Type': 'application/json', ...extraHeaders };
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
        // not JSON (for example an HTML page)
    }
    return { status: response.status, data, headers: response.headers };
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

    console.log('\nSign-in');

    // 1. Password step
    const login = await call('POST', '/api/auth/login', { email, password });
    const ticket = login.data.data && login.data.data.ticket;
    report(
        login.status === 200 && login.data.data && login.data.data.mfaRequired === true,
        'A password alone does not give a session',
        'it asks for a code'
    );
    report(
        !(login.data.data && login.data.data.accessToken),
        'No access token is returned before the code'
    );
    if (!ticket) {
        console.log(`\nStopped: ${login.data.message || 'no sign-in ticket was returned.'}`);
        return;
    }

    // 2. The ticket must not work as a session anywhere
    const ticketOnRestaurant = await call('GET', '/api/tenants', undefined, ticket);
    const ticketOnOwner = await call('GET', '/api/v1/owner/me', undefined, ticket);
    report(
        ticketOnRestaurant.status === 401 && ticketOnOwner.status === 401,
        'The sign-in ticket cannot be used as a session',
        `restaurant ${ticketOnRestaurant.status}, owner ${ticketOnOwner.status}`
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
    report(claims.scope === 'platform', 'The session scope is platform', `scope: ${claims.scope}`);
    report(
        Array.isArray(claims.roles) && claims.roles.includes('Platform_Owner'),
        'The session carries the Platform_Owner role'
    );
    report(
        Array.isArray(claims.amr) && claims.amr.includes('otp'),
        'The session records that a one-time code was used'
    );
    const lifetimeMinutes = Math.round((claims.exp - claims.iat) / 60);
    report(
        lifetimeMinutes <= 30,
        'The owner session is short-lived',
        `${lifetimeMinutes} minutes before renewal`
    );

    // 5. Replay: the same code must not work twice
    const replay = await call('POST', '/api/auth/mfa/verify', { ticket, code });
    report(replay.status === 401, 'Reusing the same code is refused', `status ${replay.status}`);

    console.log('\nOwner area');

    // 6. The owner API
    const me = await call('GET', '/api/v1/owner/me', undefined, accessToken);
    report(
        me.status === 200 &&
            me.data.data &&
            me.data.data.roles.includes('Platform_Owner') &&
            me.data.data.permissions.length === 79,
        'The owner API answers with your role and all 79 platform permissions',
        `status ${me.status}`
    );

    const noToken = await call('GET', '/api/v1/owner/me');
    report(
        noToken.status === 401,
        'The owner API refuses a request with no session',
        `status ${noToken.status}`
    );

    // 7. Separation: an owner session cannot be used on restaurant routes
    const ownerOnRestaurant = await call('GET', '/api/tenants', undefined, accessToken);
    report(
        ownerOnRestaurant.status === 403,
        'An owner session is refused on restaurant routes',
        `status ${ownerOnRestaurant.status}`
    );

    // 8. Security headers on the owner pages and API
    const page = await fetch(`${BASE_URL}/owner/`);
    const csp = page.headers.get('content-security-policy') || '';
    report(
        csp.includes("default-src 'none'") && csp.includes("frame-ancestors 'none'"),
        'The owner page has the strict content security policy'
    );
    report(
        (page.headers.get('cache-control') || '').includes('no-store') &&
            (me.headers.get('cache-control') || '').includes('no-store'),
        'The owner page and API are never cached'
    );

    // 9. Renewal keeps the original sign-in time
    const renewed = await call('POST', '/api/v1/owner/session/renew', undefined, accessToken);
    const renewedToken = renewed.data.data && renewed.data.data.accessToken;
    let sameSignIn = false;
    if (renewedToken) sameSignIn = claimsOf(renewedToken).auth_time === claims.auth_time;
    report(
        renewed.status === 200 && Boolean(renewedToken) && sameSignIn,
        'A session renews, and keeps its original sign-in time',
        `status ${renewed.status}`
    );

    console.log('\nHigh-impact actions');

    // 10. The L3 route refuses a request without step-up
    const noStepUp = await call(
        'POST',
        '/api/v1/owner/security/step-up-check',
        undefined,
        accessToken
    );
    report(
        noStepUp.status === 403 && noStepUp.data.code === 'STEP_UP_REQUIRED',
        'A high-impact action is refused without a fresh code',
        `status ${noStepUp.status}`
    );

    const fakePass = await call(
        'POST',
        '/api/v1/owner/security/step-up-check',
        undefined,
        accessToken,
        { 'X-Step-Up-Token': 'not-a-real-token' }
    );
    report(
        fakePass.status === 403,
        'A made-up step-up pass is refused',
        `status ${fakePass.status}`
    );

    const accessAsPass = await call(
        'POST',
        '/api/v1/owner/security/step-up-check',
        undefined,
        accessToken,
        { 'X-Step-Up-Token': accessToken }
    );
    report(
        accessAsPass.status === 403,
        'A session token cannot be used as a step-up pass',
        `status ${accessAsPass.status}`
    );

    // 11. Step-up needs a NEW code
    console.log('\nStep-up needs a fresh code. Wait until the code in your app changes.');
    const stepCode = (await ask('Enter the new 6-digit code: ')).trim();
    const stepUp = await call('POST', '/api/auth/mfa/step-up', { code: stepCode }, accessToken);
    const pass = stepUp.data.data && stepUp.data.data.stepUpToken;
    report(
        stepUp.status === 200 && Boolean(pass),
        'A fresh code gives a short-lived step-up pass',
        stepUp.status === 200 ? `lasts ${stepUp.data.data.expiresInSeconds}s` : stepUp.data.message
    );

    if (pass) {
        const allowed = await call(
            'POST',
            '/api/v1/owner/security/step-up-check',
            undefined,
            accessToken,
            { 'X-Step-Up-Token': pass }
        );
        report(
            allowed.status === 200,
            'With the pass, the high-impact action goes through',
            `status ${allowed.status}`
        );
    }

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
