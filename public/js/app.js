/* public/js/app.js
 *
 * Page logic for the login/register page and the dashboard.
 * All user-supplied text is inserted with textContent, never innerHTML.
 */
(function () {
    const api = window.PlatePulseApi;
    const ui = window.PlatePulseUI;
    const page = document.body.dataset.page;

    function byId(id) {
        return document.getElementById(id);
    }

    /* ---------- login / register ---------- */

    function initAuthPage() {
        // Already signed in? Skip to the dashboard (it returns here if the token is stale).
        if (api.getToken()) {
            window.location.href = '/dashboard.html';
            return;
        }

        const form = byId('authForm');
        const title = byId('authTitle');
        const submitBtn = byId('submitBtn');
        const toggleBtn = byId('modeToggle');
        const messageDiv = byId('message');
        const emailInput = byId('email');
        const passwordInput = byId('password');
        const passwordHint = byId('passwordHint');

        const copy = {
            login: {
                title: 'Log in',
                submit: 'Log in',
                busy: 'Logging in…',
                toggle: 'Create an account'
            },
            register: {
                title: 'Create your account',
                submit: 'Create account',
                busy: 'Creating account…',
                toggle: 'I already have an account'
            }
        };

        let mode = 'login';

        function showMessage(text) {
            messageDiv.textContent = text;
        }

        function applyMode() {
            const text = copy[mode];
            title.textContent = text.title;
            document.title = `${text.title} | PlatePulse`;
            submitBtn.textContent = text.submit;
            toggleBtn.textContent = text.toggle;
            passwordHint.hidden = mode === 'login';
            passwordInput.autocomplete = mode === 'login' ? 'current-password' : 'new-password';
            passwordInput.minLength = mode === 'login' ? 0 : 8;
            showMessage('');
        }

        function setBusy(isBusy) {
            submitBtn.disabled = isBusy;
            submitBtn.setAttribute('aria-busy', String(isBusy));
            submitBtn.textContent = isBusy ? copy[mode].busy : copy[mode].submit;
        }

        toggleBtn.addEventListener('click', () => {
            mode = mode === 'login' ? 'register' : 'login';
            applyMode();
        });

        form.addEventListener('submit', async (event) => {
            event.preventDefault();
            showMessage('');
            setBusy(true);

            const email = emailInput.value;
            const password = passwordInput.value;

            try {
                if (mode === 'register') {
                    const registered = await api.request('/api/auth/register', {
                        method: 'POST',
                        body: { email, password },
                        auth: false
                    });
                    if (!registered.ok) {
                        showMessage(
                            registered.data.message || 'We couldn’t create your account. Try again.'
                        );
                        return;
                    }
                }

                const login = await api.request('/api/auth/login', {
                    method: 'POST',
                    body: { email, password },
                    auth: false
                });

                if (login.ok && login.data.data && login.data.data.accessToken) {
                    api.setToken(login.data.data.accessToken);
                    window.location.href = '/dashboard.html';
                } else {
                    showMessage(login.data.message || 'We couldn’t log you in. Try again.');
                }
            } finally {
                setBusy(false);
            }
        });

        applyMode();
    }

    /* ---------- dashboard ---------- */

    function initDashboard() {
        if (!api.getToken()) {
            api.redirectToLogin();
            return;
        }

        const container = byId('tenantsContainer');
        const form = byId('tenantForm');
        const nameInput = byId('tenantName');
        const currencyInput = byId('tenantCurrency');
        const addBtn = byId('addBtn');
        const formMessage = byId('formMessage');

        byId('logoutBtn').addEventListener('click', () => {
            api.clearToken();
            api.redirectToLogin();
        });

        function show(node) {
            container.replaceChildren(node);
            container.setAttribute('aria-busy', 'false');
        }

        function renderList(tenants) {
            const list = document.createElement('ul');
            list.className = 'list';

            for (const tenant of tenants) {
                const row = document.createElement('li');
                row.className = 'list__row';

                const text = document.createElement('div');

                const name = document.createElement('span');
                name.className = 'list__title';
                name.textContent = tenant.name;

                const meta = document.createElement('span');
                meta.className = 'list__meta';
                meta.textContent = `Currency: ${tenant.currency}`;

                text.append(name, meta);
                row.append(text);
                list.append(row);
            }

            show(list);
        }

        function renderEmpty() {
            const box = document.createElement('div');
            box.className = 'empty';

            const heading = document.createElement('h3');
            heading.textContent = 'Add your first restaurant';

            const body = document.createElement('p');
            body.className = 'muted';
            body.textContent = 'A restaurant holds your menu, orders and staff.';

            const action = document.createElement('button');
            action.className = 'btn';
            action.type = 'button';
            action.textContent = 'Add restaurant';
            action.addEventListener('click', () => nameInput.focus());

            box.append(heading, body, action);
            show(box);
        }

        function renderError() {
            const wrapper = document.createElement('div');
            wrapper.className = 'stack';

            const notice = document.createElement('div');
            notice.className = 'notice notice--error';
            notice.setAttribute('role', 'alert');
            notice.textContent =
                'We couldn’t load your restaurants. Check your connection and try again.';

            const retry = document.createElement('button');
            retry.className = 'btn btn--secondary';
            retry.type = 'button';
            retry.textContent = 'Try again';
            retry.addEventListener('click', loadTenants);

            wrapper.append(notice, retry);
            show(wrapper);
        }

        async function loadTenants() {
            container.setAttribute('aria-busy', 'true');
            const result = await api.request('/api/tenants');

            if (!result.ok) {
                renderError();
                return;
            }

            const tenants = (result.data.data && result.data.data.tenants) || [];
            if (tenants.length === 0) {
                renderEmpty();
            } else {
                renderList(tenants);
            }
        }

        form.addEventListener('submit', async (event) => {
            event.preventDefault();
            formMessage.textContent = '';
            addBtn.disabled = true;
            addBtn.setAttribute('aria-busy', 'true');
            addBtn.textContent = 'Adding…';

            // Currency is optional: the server applies its configured default when it is omitted.
            const body = { name: nameInput.value };
            if (currencyInput.value.trim() !== '') body.currency = currencyInput.value;

            try {
                const result = await api.request('/api/tenants', { method: 'POST', body });

                if (!result.ok) {
                    formMessage.textContent =
                        result.data.message || 'We couldn’t add the restaurant. Try again.';
                    return;
                }

                form.reset();
                ui.toast('Restaurant added');
                loadTenants();
            } finally {
                addBtn.disabled = false;
                addBtn.setAttribute('aria-busy', 'false');
                addBtn.textContent = 'Add restaurant';
            }
        });

        loadTenants();
    }

    if (page === 'login') initAuthPage();
    else if (page === 'dashboard') initDashboard();
})();
