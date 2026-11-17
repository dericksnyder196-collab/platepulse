/* public/owner/owner.js
 *
 * The owner page. The session token is kept in this script's memory ONLY: never in
 * localStorage, sessionStorage or a cookie. Closing or reloading the tab ends the session, and
 * there is nothing left behind for another script or person to find.
 *
 * All text from the server is inserted with textContent, never innerHTML.
 */
(function () {
    'use strict';

    const RENEW_CHECK_MS = 60 * 1000; // how often to consider renewing
    const ACTIVE_WINDOW_MS = 5 * 60 * 1000; // "active" means something was done in the last 5 minutes
    const RENEW_WHEN_LEFT_MS = 20 * 60 * 1000; // renew once less than this much time is left

    let accessToken = null;
    let mfaTicket = null;
    let expiresAtMs = 0;
    let lastActivityMs = Date.now();
    let clockTimer = null;
    let renewTimer = null;

    const $ = (id) => document.getElementById(id);
    const views = { signIn: $('signInView'), code: $('codeView'), app: $('appView') };

    function show(name) {
        for (const [viewName, element] of Object.entries(views)) {
            element.hidden = viewName !== name;
        }
        $('signOutBtn').hidden = name !== 'app';
    }

    async function request(path, { method = 'GET', body, token, headers = {} } = {}) {
        const finalHeaders = { ...headers };
        if (body !== undefined) finalHeaders['Content-Type'] = 'application/json';
        if (token) finalHeaders.Authorization = `Bearer ${token}`;

        let response;
        try {
            response = await fetch(path, {
                method,
                headers: finalHeaders,
                body: body === undefined ? undefined : JSON.stringify(body),
                cache: 'no-store'
            });
        } catch {
            return { ok: false, status: 0, data: { message: 'Unable to reach the server.' } };
        }

        let data = {};
        try {
            data = await response.json();
        } catch {
            // not JSON
        }
        return { ok: response.ok, status: response.status, data };
    }

    function setBusy(button, isBusy, busyText, idleText) {
        button.disabled = isBusy;
        button.setAttribute('aria-busy', String(isBusy));
        button.textContent = isBusy ? busyText : idleText;
    }

    function signOut(message) {
        accessToken = null;
        mfaTicket = null;
        expiresAtMs = 0;
        window.clearInterval(clockTimer);
        window.clearInterval(renewTimer);

        $('ownerPassword').value = '';
        $('ownerCode').value = '';
        $('stepUpCode').value = '';
        $('codeMessage').textContent = '';
        $('stepUpMessage').textContent = '';
        $('appNotice').textContent = '';
        $('signInMessage').textContent = message || '';

        show('signIn');
    }

    /* ---------- step 1: password ---------- */

    $('signInForm').addEventListener('submit', async (event) => {
        event.preventDefault();
        $('signInMessage').textContent = '';
        setBusy($('signInBtn'), true, 'Checking…', 'Continue');

        try {
            const result = await request('/api/auth/login', {
                method: 'POST',
                body: { email: $('ownerEmail').value, password: $('ownerPassword').value }
            });
            // The password never stays in the page longer than needed.
            $('ownerPassword').value = '';

            const data = result.data.data;
            if (result.ok && data && data.mfaRequired) {
                mfaTicket = data.ticket;
                show('code');
                $('ownerCode').focus();
            } else if (result.ok && data && data.accessToken) {
                // An ordinary account. The session is not kept.
                $('signInMessage').textContent = 'This is not an owner account.';
            } else {
                $('signInMessage').textContent =
                    result.data.message || 'We couldn’t sign you in. Try again.';
            }
        } finally {
            setBusy($('signInBtn'), false, 'Checking…', 'Continue');
        }
    });

    /* ---------- step 2: one-time code ---------- */

    $('codeBackBtn').addEventListener('click', () => signOut(''));

    $('codeForm').addEventListener('submit', async (event) => {
        event.preventDefault();
        $('codeMessage').textContent = '';
        setBusy($('codeBtn'), true, 'Verifying…', 'Verify');

        try {
            const result = await request('/api/auth/mfa/verify', {
                method: 'POST',
                body: { ticket: mfaTicket, code: $('ownerCode').value }
            });
            const data = result.data.data;

            if (result.ok && data && data.accessToken) {
                if (data.scope !== 'platform') {
                    signOut('This is not an owner account.');
                    return;
                }
                await startSession(data.accessToken, data);
                return;
            }

            if (result.status === 401 && /expired/i.test(result.data.message || '')) {
                signOut(result.data.message);
                return;
            }

            $('codeMessage').textContent =
                result.data.message || 'We couldn’t verify that code. Try again.';
            $('ownerCode').select();
        } finally {
            setBusy($('codeBtn'), false, 'Verifying…', 'Verify');
        }
    });

    /* ---------- signed in ---------- */

    function formatCountdown(milliseconds) {
        const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = String(totalSeconds % 60).padStart(2, '0');
        return `${minutes}:${seconds}`;
    }

    function tick() {
        const left = expiresAtMs - Date.now();
        if (left <= 0) {
            signOut('Your session timed out. Sign in again.');
            return;
        }
        $('infoCountdown').textContent = formatCountdown(left);
    }

    async function maybeRenew() {
        const left = expiresAtMs - Date.now();
        const active = Date.now() - lastActivityMs < ACTIVE_WINDOW_MS;
        if (!active || left > RENEW_WHEN_LEFT_MS) return;

        const result = await request('/api/v1/owner/session/renew', {
            method: 'POST',
            token: accessToken
        });

        if (result.ok && result.data.data) {
            accessToken = result.data.data.accessToken;
            expiresAtMs = result.data.data.expiresAt * 1000;
        } else if (result.status === 401 || result.status === 403) {
            signOut(result.data.message || 'Your session ended. Sign in again.');
        }
    }

    async function startSession(token, loginData) {
        accessToken = token;

        const me = await request('/api/v1/owner/me', { token: accessToken });
        if (!me.ok) {
            signOut(me.data.message || 'We couldn’t open your session. Sign in again.');
            return;
        }

        const info = me.data.data;
        $('infoEmail').textContent = info.email;
        $('infoRoles').textContent = info.roles.join(', ');
        $('infoPermissions').textContent = `${info.permissions.length} permissions`;
        $('infoIdle').textContent = String(info.session.idleMinutes);
        $('infoAbsolute').textContent = String(info.session.absoluteHours);

        $('appNotice').textContent = loginData.usedRecoveryCode
            ? `You signed in with a recovery code. ${loginData.remainingRecoveryCodes} recovery codes are left.`
            : '';

        expiresAtMs = info.session.expiresAt * 1000;
        lastActivityMs = Date.now();
        $('codeMessage').textContent = '';
        $('ownerCode').value = '';

        show('app');

        window.clearInterval(clockTimer);
        window.clearInterval(renewTimer);
        tick();
        clockTimer = window.setInterval(tick, 1000);
        renewTimer = window.setInterval(maybeRenew, RENEW_CHECK_MS);
    }

    $('signOutBtn').addEventListener('click', () => signOut(''));

    for (const type of ['pointerdown', 'keydown']) {
        window.addEventListener(
            type,
            () => {
                lastActivityMs = Date.now();
            },
            { passive: true }
        );
    }

    /* ---------- step-up demonstration ---------- */

    $('stepUpForm').addEventListener('submit', async (event) => {
        event.preventDefault();
        const message = $('stepUpMessage');
        message.className = 'notice notice--error';
        message.textContent = '';
        setBusy($('stepUpBtn'), true, 'Checking…', 'Test step-up');

        try {
            const step = await request('/api/auth/mfa/step-up', {
                method: 'POST',
                token: accessToken,
                body: { code: $('stepUpCode').value }
            });
            if (!step.ok) {
                message.textContent = step.data.message || 'We couldn’t confirm that code.';
                return;
            }

            const check = await request('/api/v1/owner/security/step-up-check', {
                method: 'POST',
                token: accessToken,
                headers: { 'X-Step-Up-Token': step.data.data.stepUpToken }
            });

            if (check.ok) {
                message.className = 'notice notice--success';
                message.textContent = 'Step-up works. This action was confirmed with a fresh code.';
                $('stepUpCode').value = '';
            } else {
                message.textContent = check.data.message || 'The action was refused.';
            }
        } finally {
            setBusy($('stepUpBtn'), false, 'Checking…', 'Test step-up');
        }
    });

    show('signIn');
})();
