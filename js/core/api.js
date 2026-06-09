// =============================================================================
// api.js — Capa de red: fetch autenticado + helpers de URL
// Depende de: state.js (state, API_BASE_URL)
// Llama en runtime: clearAuthSession, views, showLoginPanel (definidos en app.js)
// =============================================================================

async function apiFetch(path, options = {}) {
    const headers = { ...(options.headers || {}) };

    if (state.authToken) {
        headers.Authorization = `Bearer ${state.authToken}`;
    }

    if (options.body && !headers['Content-Type']) {
        headers['Content-Type'] = 'application/json';
    }

    let response;
    try {
        response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
    } catch (_error) {
        const connectionError = new Error('No se pudo conectar con el servidor de Odentara.');
        connectionError.status = 0;
        throw connectionError;
    }

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        // Clínica desactivada: cerrar sesión y mostrar mensaje claro
        if (response.status === 403 && data.code === 'CLINIC_INACTIVE') {
            clearAuthSession();
            views.app?.classList.add('hidden');
            views.login?.classList.remove('hidden');
            showLoginPanel?.('login-panel');
            setTimeout(() => alert(data.error || 'Tu clínica está desactivada.'), 100);
            const error = new Error(data.error);
            error.status = 403;
            throw error;
        }
        // Sesión expirada o token inválido: logout silencioso
        if (response.status === 401) {
            clearAuthSession();
        }
        const error = new Error(data.error || 'Error de servidor');
        error.status = response.status;
        error.payload = data;
        throw error;
    }

    return data;
}

// Calcula la URL de redirección al subdominio de la clínica.
// Devuelve null si ya estamos en el subdominio correcto o en modo dev.
function buildSubdomainRedirectUrl(clinicSlug, exchangeCode) {
    const hostname = window.location.hostname;
    if (hostname === 'localhost' || /^\d+\.\d+\.\d+\.\d+$/.test(hostname)) return null;
    const parts = hostname.split('.');
    if (parts.length < 2) return null;

    const baseDomain      = parts.slice(-2).join('.');
    const currentSubdomain = parts.length > 2 ? parts.slice(0, -2).join('.') : null;
    if (currentSubdomain === clinicSlug) return null;

    const proto = window.location.protocol;
    const port  = window.location.port ? `:${window.location.port}` : '';
    return `${proto}//${clinicSlug}.${baseDomain}${port}?__exchange=${encodeURIComponent(exchangeCode)}`;
}
