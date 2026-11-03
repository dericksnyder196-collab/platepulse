/* public/js/api_client.js
 *
 * Shared by every page: token storage plus one fetch wrapper that
 * handles auth headers, JSON parsing, and expired sessions.
 */
(function () {
    const TOKEN_KEY = 'token';
    const LOGIN_PAGE = '/';

    function getToken() {
        try {
            return localStorage.getItem(TOKEN_KEY);
        } catch {
            return null;
        }
    }

    function setToken(token) {
        try {
            localStorage.setItem(TOKEN_KEY, token);
        } catch {
            /* storage unavailable */
        }
    }

    function clearToken() {
        try {
            localStorage.removeItem(TOKEN_KEY);
        } catch {
            /* storage unavailable */
        }
    }

    function redirectToLogin() {
        window.location.href = LOGIN_PAGE;
    }

    /**
     * request('/api/tenants', { method, body, auth })
     * Always resolves to { ok, status, data } and never throws.
     * With auth (the default), a missing token or a 401 response clears the
     * session and sends the user back to the login page.
     */
    async function request(path, { method = 'GET', body, auth = true } = {}) {
        const headers = {};
        if (body !== undefined) headers['Content-Type'] = 'application/json';

        if (auth) {
            const token = getToken();
            if (!token) {
                redirectToLogin();
                return { ok: false, status: 401, data: { message: 'Not logged in.' } };
            }
            headers.Authorization = `Bearer ${token}`;
        }

        let response;
        try {
            response = await fetch(path, {
                method,
                headers,
                body: body !== undefined ? JSON.stringify(body) : undefined
            });
        } catch {
            return { ok: false, status: 0, data: { message: 'Unable to reach the server.' } };
        }

        let data = {};
        try {
            data = await response.json();
        } catch {
            /* non-JSON response (e.g. proxy error page) */
        }

        if (auth && response.status === 401) {
            clearToken();
            redirectToLogin();
        }

        return { ok: response.ok, status: response.status, data };
    }

    window.PlatePulseApi = { getToken, setToken, clearToken, redirectToLogin, request };
})();
