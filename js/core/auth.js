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

// Huella de lo que se está mostrando en el dashboard. Si después de sincronizar
// sigue siendo la misma, no hace falta redibujar nada: alcanza con repintar los
// botones de presencia que hayan cambiado.
function dashboardSignature() {
    return DB.get('appointments')
        .map(a => `${a.id}:${a.status}:${a.time}:${a.professionalId}`)
        .join('|');
}

function startDashboardAutoRefresh() {
    if (_dashboardRefreshTimer) clearInterval(_dashboardRefreshTimer);
    // Primera pasada inmediata: si hay un aviso vigente al entrar, se ve al
    // instante y no recién en el primer tick del temporizador.
    refreshAnnouncements();
    _dashboardRefreshTimer = setInterval(async () => {
        if (!state.user || !state.authToken) return;
        // Con la pestaña en segundo plano no hay nadie mirando: se evita el
        // tráfico y se retoma solo al volver.
        if (document.hidden) return;
        try {
            // Los avisos de plataforma viajan en el mismo ciclo: publicar uno
            // llega a todas las clínicas en menos de 20 segundos sin recargar.
            refreshAnnouncements();

            const before = state.currentView === 'dashboard' ? dashboardSignature() : null;
            await syncBackendSnapshotToLocalDb();

            // Va antes del corte por vista: el profesional tiene que escuchar que
            // llegó su paciente esté donde esté, no solo si dejó abierto el
            // dashboard. Adentro se filtra por rol y por turno propio.
            checkPresenceArrivals();

            if (state.currentView !== 'dashboard') return;

            // Re-renderizar entero se nota como un parpadeo, así que solo se hace
            // cuando cambió la lista de turnos (uno nuevo, cancelado, reprogramado).
            // El caso frecuente —alguien marcó la llegada de un paciente— se
            // resuelve repintando un botón, sin que la pantalla se mueva.
            if (before !== dashboardSignature()) {
                refreshCurrentView();
            } else {
                syncPresenceButtonsFromDb();
            }
        } catch (_) { /* silencioso */ }
    }, 20_000);
}

function stopDashboardAutoRefresh() {
    if (_dashboardRefreshTimer) { clearInterval(_dashboardRefreshTimer); _dashboardRefreshTimer = null; }
}

// -----------------------------------------------------------------------------
// Sesión
// -----------------------------------------------------------------------------

function saveAuthSession(token, apiUser) {
    // Si entra alguien distinto del último que usó esta máquina, el cache de la
    // sesión anterior no le corresponde. Sin esto, en la computadora de recepción
    // —que la usan varias personas— la segunda persona arrancaba viendo el padrón
    // y las fichas que había cargado la primera, incluso con menos permisos.
    // El cambio de clínica al impersonar ya hacía esto por su cuenta en
    // views/platform.js; acá se cubre el caso general.
    const usuarioAnterior = state.user?.id ?? null;
    if (usuarioAnterior !== null && usuarioAnterior !== apiUser?.id) {
        DB.clear();
    }

    state.authToken = token;
    state.user = mapApiUserToLegacyUser(apiUser);
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ token, user: apiUser }));
}

function clearAuthSession() {
    state.authToken = null;
    state.user = null;
    localStorage.removeItem(AUTH_STORAGE_KEY);

    // También se descarta la sesión de plataforma guardada al impersonar.
    //
    // Antes sobrevivía, y eso armaba un bucle sin salida: el backup se restaura
    // al entrar a una vista de plataforma, el servidor rechaza ese token (por
    // revocado o vencido) con 401, el 401 llama acá, esto limpiaba solo la
    // sesión activa y dejaba el backup intacto — así que el siguiente paso por
    // plataforma restauraba el mismo token muerto. La única salida era vaciar el
    // localStorage a mano.
    //
    // Si la sesión murió, murieron las dos: conservar un token distinto para
    // reactivarlo solo puede revivir uno que el servidor ya rechazó.
    localStorage.removeItem(PLATFORM_AUTH_BACKUP_KEY);

    // El cache local se va con la sesión.
    //
    // Hasta acá se borraban las dos claves de autenticación y quedaba intacto
    // `odentara_db_v6`, que es donde vive todo: padrón de pacientes con DNI,
    // teléfono, domicilio y obra social, más el odontograma, tratamientos,
    // recetas, presupuestos y alergias de cada ficha que se hubiera abierto.
    // Eso sobrevivía al logout sin ninguna credencial que lo protegiera, y se
    // leía desde las herramientas de desarrollo sin siquiera iniciar sesión.
    //
    // Va también en el camino del 401: si el servidor rechazó la sesión, los
    // datos que quedaron cacheados de esa sesión tampoco corresponden.
    DB.clear();

    stopDashboardAutoRefresh();
    // Los turnos de la próxima sesión no son los de esta: sin este reset, al
    // entrar otro usuario se compararía su agenda contra la anterior y podría
    // sonar un timbre por una llegada que no le corresponde.
    if (typeof resetPresenceArrivalTracking === 'function') resetPresenceArrivalTracking();
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

        localStorage.removeItem(PLATFORM_AUTH_BACKUP_KEY);

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
    if (typeof closeHelpGuide === 'function') closeHelpGuide();
    if (typeof clearNavHistory === 'function') clearNavHistory();

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

        localStorage.removeItem(PLATFORM_AUTH_BACKUP_KEY);

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
