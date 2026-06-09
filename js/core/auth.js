// =============================================================================
// auth.js — Sesión, login, logout, selector de clínica, auto-refresh
// Depende de: state.js, api.js (apiFetch, buildSubdomainRedirectUrl), mappers.js
// Llama en runtime: applyAuthenticatedUiState, syncBackendSnapshotToLocalDb,
//                   refreshCurrentView, renderClinicPicker, views (app.js)
// =============================================================================

let _dashboardRefreshTimer = null;

// -----------------------------------------------------------------------------
// Timers de auto-refresh
// -----------------------------------------------------------------------------

function startDashboardAutoRefresh() {
    if (_dashboardRefreshTimer) clearInterval(_dashboardRefreshTimer);
    _dashboardRefreshTimer = setInterval(async () => {
        if (!state.user || !state.authToken) return;
        try {
            await syncBackendSnapshotToLocalDb();
            if (state.currentView === 'dashboard') refreshCurrentView();
        } catch (_) { /* silencioso */ }
    }, 30_000);
}

function stopDashboardAutoRefresh() {
    if (_dashboardRefreshTimer) { clearInterval(_dashboardRefreshTimer); _dashboardRefreshTimer = null; }
}

// -----------------------------------------------------------------------------
// Sesión
// -----------------------------------------------------------------------------

function saveAuthSession(token, apiUser) {
    state.authToken = token;
    state.user = mapApiUserToLegacyUser(apiUser);
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ token, user: apiUser }));
}

function clearAuthSession() {
    state.authToken = null;
    state.user = null;
    localStorage.removeItem(AUTH_STORAGE_KEY);
    stopDashboardAutoRefresh();
}

// -----------------------------------------------------------------------------
// Restaurar sesión al cargar la página
// -----------------------------------------------------------------------------

async function tryRestoreSession() {
    // ── Token exchange al redirigir entre subdominios (?__exchange=CODE) ────
    const urlParams    = new URLSearchParams(window.location.search);
    const exchangeCode = urlParams.get('__exchange');
    if (exchangeCode) {
        urlParams.delete('__exchange');
        const cleanSearch = urlParams.toString();
        window.history.replaceState({}, '', window.location.pathname + (cleanSearch ? '?' + cleanSearch : ''));

        try {
            const exRes = await fetch(`${API_BASE_URL}/auth/exchange?code=${encodeURIComponent(exchangeCode)}`).then(r => r.json());
            if (exRes.ok && exRes.token) {
                state.authToken = exRes.token;
                const me = await apiFetch('/auth/me');
                saveAuthSession(exRes.token, me.user);
                applyAuthenticatedUiState();
                syncBackendSnapshotToLocalDb()
                    .then(() => refreshCurrentView())
                    .catch(e => console.error('[exchange] Sync error:', e));
                return;
            }
            console.error('[exchange] Falló el intercambio de token:', exRes);
        } catch (exchangeErr) {
            console.error('[exchange] Error al consumir el código:', exchangeErr?.message || exchangeErr);
        }
        clearAuthSession();
    }

    // ── Fallback legacy: token directo en URL (?__t=...) ─────────────────────
    const urlToken = urlParams.get('__t');
    if (urlToken) {
        urlParams.delete('__t');
        const cleanSearch = urlParams.toString();
        window.history.replaceState({}, '', window.location.pathname + (cleanSearch ? '?' + cleanSearch : ''));

        state.authToken = urlToken;
        try {
            const me = await apiFetch('/auth/me');
            saveAuthSession(urlToken, me.user);
            applyAuthenticatedUiState();
            syncBackendSnapshotToLocalDb()
                .then(() => refreshCurrentView())
                .catch(e => console.error('[token] Sync error:', e));
            return;
        } catch (_error) {
            clearAuthSession();
        }
    }

    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) {
        const loginUrl = getAppLoginUrl();
        if (_getCurrentClinicSlug() && loginUrl) window.location.href = loginUrl;
        return;
    }

    try {
        const saved = JSON.parse(raw);
        if (!saved?.token || !saved?.user) {
            const loginUrl = getAppLoginUrl();
            if (_getCurrentClinicSlug() && loginUrl) window.location.href = loginUrl;
            return;
        }

        // Mostrar UI inmediatamente con datos cacheados — sin esperar la red
        state.authToken = saved.token;
        state.user = mapApiUserToLegacyUser(saved.user);
        applyAuthenticatedUiState();

        // Validar token + sincronizar en background
        apiFetch('/auth/me')
            .then(me => { saveAuthSession(saved.token, me.user); return syncBackendSnapshotToLocalDb(); })
            .then(() => refreshCurrentView())
            .catch(() => {
                clearAuthSession();
                views.app.classList.remove('active');
                views.app.classList.add('hidden');
                views.login.classList.remove('hidden');
                views.login.classList.add('active');
                const loginUrl = getAppLoginUrl();
                if (_getCurrentClinicSlug() && loginUrl) window.location.href = loginUrl;
            });
    } catch (_error) {
        clearAuthSession();
        const loginUrl = getAppLoginUrl();
        if (_getCurrentClinicSlug() && loginUrl) window.location.href = loginUrl;
    }
}

// -----------------------------------------------------------------------------
// Login / logout
// -----------------------------------------------------------------------------

async function login(email, password, turnstileToken = '') {
    const normalizedEmail = normalizeIdentityEmail(email);
    if (!normalizedEmail || !password) {
        const el = document.getElementById('login-error-msg');
        if (el) { el.textContent = 'Ingresá tu email y contraseña.'; el.classList.remove('hidden'); }
        return;
    }

    try {
        const result = await apiFetch('/auth/login', {
            method: 'POST',
            body: JSON.stringify({
                email: normalizedEmail,
                password,
                ...(turnstileToken ? { 'cf-turnstile-response': turnstileToken } : {})
            })
        });

        localStorage.removeItem('odentara_platform_auth_backup');

        // Selector de clínica (email en múltiples clínicas)
        if (result.requiresClinicSelection) {
            renderClinicPicker(result.clinics, result.sessionToken);
            return;
        }

        // Redirección a subdominio de clínica
        if (result.clinicSlug) {
            state.authToken = result.token;
            let exchangeCode = null;
            try {
                const exRes = await apiFetch('/auth/exchange', { method: 'POST' });
                if (exRes.ok) exchangeCode = exRes.code;
            } catch (_) {}

            const redirectUrl = exchangeCode ? buildSubdomainRedirectUrl(result.clinicSlug, exchangeCode) : null;
            if (redirectUrl) { window.location.href = redirectUrl; return; }

            const currentClinicSlug = _getCurrentClinicSlug();
            if (currentClinicSlug && currentClinicSlug !== result.clinicSlug) {
                const parts = window.location.hostname.split('.');
                const baseDomain = parts.slice(-2).join('.');
                const proto = window.location.protocol;
                const port  = window.location.port ? `:${window.location.port}` : '';
                window.location.href = `${proto}//${result.clinicSlug}.${baseDomain}${port}`;
                return;
            }
        } else {
            // Usuario sin clínica (superadmin, plataforma)
            const currentClinicSlug = _getCurrentClinicSlug();
            if (currentClinicSlug) {
                const parts = window.location.hostname.split('.');
                const baseDomain = parts.slice(-2).join('.');
                const proto = window.location.protocol;
                const port  = window.location.port ? `:${window.location.port}` : '';
                window.location.href = `${proto}//${baseDomain}${port}`;
                return;
            }
        }

        saveAuthSession(result.token, result.user);
        applyAuthenticatedUiState();
        syncBackendSnapshotToLocalDb()
            .then(() => refreshCurrentView())
            .catch(e => console.error('[login] Sync error:', e));
    } catch (error) {
        const message = error.status === 0
            ? 'No se pudo conectar con el servidor de Odentara. Verifica que el sitio y la API esten publicados correctamente e intenta nuevamente.'
            : (error.payload?.error || error.message || 'No se pudo iniciar sesión.');
        showAlert(message, { title: 'Error de inicio de sesión', variant: 'error' });
    }
}

async function logout() {
    if (state.authToken) {
        try { await apiFetch('/auth/logout', { method: 'POST' }); } catch (_) {}
    }
    clearAuthSession();
    state.dashboardDate = null;

    const loginUrl = getAppLoginUrl();
    if (_getCurrentClinicSlug() && loginUrl) {
        window.location.href = loginUrl;
        return;
    }

    setSidebarOpen(false);
    applyTheme('dark', false);
    views.app.classList.remove('active');
    setTimeout(() => {
        views.app.classList.add('hidden');
        views.login.classList.remove('hidden');
        setTimeout(() => {
            views.login.classList.add('active');
            window._renderTurnstile?.();
        }, 10);
    }, 250);
}

// -----------------------------------------------------------------------------
// Selector de clínica
// -----------------------------------------------------------------------------

async function selectClinic(userId, sessionToken, clinicSlug) {
    try {
        document.querySelectorAll('.clinic-picker-card').forEach(c => { c.disabled = true; c.style.opacity = '0.6'; });

        const result = await apiFetch('/auth/select-clinic', {
            method: 'POST',
            body: JSON.stringify({ sessionToken, userId })
        });

        localStorage.removeItem('odentara_platform_auth_backup');

        if (result.clinicSlug) {
            state.authToken = result.token;
            let exchangeCode = null;
            try {
                const exRes = await apiFetch('/auth/exchange', { method: 'POST' });
                if (exRes.ok) exchangeCode = exRes.code;
            } catch (_) {}
            const redirectUrl = exchangeCode ? buildSubdomainRedirectUrl(result.clinicSlug, exchangeCode) : null;
            if (redirectUrl) { window.location.href = redirectUrl; return; }
            const currentClinicSlug = _getCurrentClinicSlug();
            if (currentClinicSlug && currentClinicSlug !== result.clinicSlug) {
                const parts = window.location.hostname.split('.');
                const baseDomain = parts.slice(-2).join('.');
                const proto = window.location.protocol;
                const port  = window.location.port ? `:${window.location.port}` : '';
                window.location.href = `${proto}//${result.clinicSlug}.${baseDomain}${port}`;
                return;
            }
        }

        saveAuthSession(result.token, result.user);
        applyAuthenticatedUiState();
        syncBackendSnapshotToLocalDb()
            .then(() => refreshCurrentView())
            .catch(e => console.error('[selectClinic] Sync error:', e));
    } catch (error) {
        document.querySelectorAll('.clinic-picker-card').forEach(c => { c.disabled = false; c.style.opacity = ''; });
        const message = error.status === 0
            ? 'No se pudo conectar con el servidor.'
            : (error.payload?.error || error.message || 'No se pudo ingresar a esa clínica.');
        showAlert(message, { title: 'Error', variant: 'error' });
    }
}
