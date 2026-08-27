// =============================================================================
// api.js — Capa de red: fetch autenticado + helpers de URL
// Depende de: state.js (state, API_BASE_URL)
// Llama en runtime: clearAuthSession, views (definidos en app.js / router.js)
// =============================================================================

/**
 * Devuelve la interfaz a la pantalla de login.
 *
 * No usa showLoginPanel() de app.js: esa función está declarada dentro del
 * callback de DOMContentLoaded, así que no existe en este ámbito. Y el operador
 * `?.` no ayuda — con un identificador no declarado tira ReferenceError igual,
 * no undefined. Se manipulan los paneles directamente, que además deja este
 * archivo sin depender del orden de carga.
 */
function volverAlLogin() {
    views.app?.classList.add('hidden');
    views.app?.classList.remove('active');
    views.login?.classList.remove('hidden');
    views.login?.classList.add('active');

    ['login-panel', 'forgot-panel', 'reset-panel', 'clinic-picker-panel'].forEach((id) => {
        document.getElementById(id)?.classList.toggle('hidden', id !== 'login-panel');
    });
}

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

    // El servidor renueva la sesión cuando el token pasó la mitad de su vida y
    // la manda en este header. Guardarla mantiene al usuario adentro mientras
    // trabaja, aunque el token dure solo 24 horas.
    const renewedToken = response.headers.get('X-Renewed-Token');
    if (renewedToken) {
        try {
            const saved = JSON.parse(localStorage.getItem(AUTH_STORAGE_KEY));
            if (saved?.user) {
                state.authToken = renewedToken;
                localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ ...saved, token: renewedToken }));
            }
        } catch (_e) { /* si no se puede guardar, el token actual sigue sirviendo */ }
    }

    // Se registra si el cuerpo era JSON o no. Cuando el bloqueo lo hace una capa
    // anterior a la app (el WAF del hosting, por ejemplo, ante una ráfaga de
    // peticiones pesadas), la respuesta es una página HTML de error y no un JSON
    // nuestro — sin esta distinción el usuario veía un "Error de servidor" que
    // no explicaba nada ni sugería qué hacer.
    let data = {};
    let bodyWasJson = true;
    try {
        data = await response.json();
    } catch (_e) {
        bodyWasJson = false;
    }

    if (!response.ok) {
        if (!bodyWasJson && (response.status === 403 || response.status === 429)) {
            const blockedError = new Error(
                'El servidor bloqueó temporalmente las peticiones por exceso de intentos. ' +
                'Esperá un minuto y volvé a intentarlo.'
            );
            blockedError.status = response.status;
            blockedError.blockedByEdge = true;
            throw blockedError;
        }
        // Clínica desactivada: cerrar sesión y mostrar mensaje claro
        if (response.status === 403 && data.code === 'CLINIC_INACTIVE') {
            clearAuthSession();
            volverAlLogin();
            setTimeout(() => alert(data.error || 'Tu clínica está desactivada.'), 100);
            const error = new Error(data.error);
            error.status = 403;
            throw error;
        }
        // Sesión expirada, token vencido o revocado.
        //
        // Además de limpiar, se vuelve a la pantalla de login. Antes solo se
        // limpiaba: la vista que había pedido el dato mostraba su propio cartel
        // de error ("Token invalido o vencido") y el usuario se quedaba mirando
        // esa pantalla sin salida, con la sesión ya borrada por detrás y sin
        // ningún botón que lo llevara a entrar de nuevo. Es el mismo tratamiento
        // que ya tenía la clínica desactivada, unas líneas más arriba.
        if (response.status === 401) {
            clearAuthSession();
            volverAlLogin();
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
