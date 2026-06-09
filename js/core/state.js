// =============================================================================
// state.js — Estado global de la aplicación y constantes de configuración
// Depende de: nada (debe cargarse primero)
// =============================================================================

// -----------------------------------------------------------------------------
// Constantes de configuración
// -----------------------------------------------------------------------------

const AUTH_STORAGE_KEY  = 'odentara_auth_v1';
const THEME_STORAGE_KEY = 'odentara_theme_v1';

// Subdominios reservados que no son clínicas
const PLATFORM_SUBS = new Set(['www', 'admin', 'platform', 'api', 'app']);

// -----------------------------------------------------------------------------
// URL base de la API (se resuelve una vez al cargar)
// -----------------------------------------------------------------------------

function getApiBaseUrl() {
    const { protocol, origin, hostname } = window.location;
    if (protocol === 'file:' || hostname === 'localhost' || hostname === '127.0.0.1') {
        return 'http://localhost:3001/api';
    }
    return `${origin}/api`;
}

const API_BASE_URL = getApiBaseUrl();

// -----------------------------------------------------------------------------
// Helpers de subdominio
// -----------------------------------------------------------------------------

// Devuelve el slug de clínica del subdominio actual, o null si es dominio raíz/plataforma
function _getCurrentClinicSlug() {
    const { hostname } = window.location;
    if (hostname === 'localhost' || hostname === '127.0.0.1') return null;
    const parts = hostname.split('.');
    if (parts.length < 3) return null;
    const sub = parts[0];
    return PLATFORM_SUBS.has(sub) ? null : sub;
}

// Devuelve la URL del portal de login (app.odentara.com), o null en dev
function getAppLoginUrl() {
    const { hostname, protocol, port } = window.location;
    if (hostname === 'localhost' || /^\d+\.\d+\.\d+\.\d+$/.test(hostname)) return null;
    const parts = hostname.split('.');
    if (parts.length < 2) return null;
    if (parts.length >= 3 && parts[0] === 'app') return null;
    const baseDomain = parts.slice(-2).join('.');
    const portSuffix = port ? `:${port}` : '';
    return `${protocol}//app.${baseDomain}${portSuffix}`;
}

// -----------------------------------------------------------------------------
// Estado global de la SPA
// Toda mutación de estado debe hacerse directamente sobre este objeto.
// No usar setState() — la app es vanilla JS sin reactividad.
// -----------------------------------------------------------------------------

// ID de navegación: se incrementa en cada loadView() para que solo la última
// navegación iniciada pueda renderizar. Evita condiciones de carrera en async.
let _loadViewSeq = 0;

const state = {
    user:                        null,
    authToken:                   null,
    currentView:                 'dashboard',
    sidebarOpen:                 true,
    settingsSubView:             'clinic-settings',
    editingUserId:               null,
    editingProfId:               null,
    billingSubView:              'movements',
    billingPatientId:            null,
    cajaPeriod:                  '7d',
    dashboardDate:               null,
    clinicalDraft:               null,
    loadingCount:                0,
    clinicalImageViewer:         null,
    clinicalOdontoProfessionalId: null,
};
