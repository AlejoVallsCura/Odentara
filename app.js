// --- Navigation & State ---
let _loadViewSeq = 0; // navigation ID: solo la última navegación renderiza

const state = {
    user: null,
    authToken: null,
    currentView: 'dashboard',
    sidebarOpen: true,
    settingsSubView: 'clinic-settings',
    editingUserId: null,
    editingProfId: null,
    billingSubView: 'movements',
    billingPatientId: null,
    cajaPeriod: '7d',
    dashboardDate: null,
    clinicalDraft: null,
    loadingCount: 0,
    clinicalImageViewer: null,
    clinicalOdontoProfessionalId: null
};

function getApiBaseUrl() {
    const { protocol, origin, hostname } = window.location;

    if (protocol === 'file:') {
        return 'http://localhost:3001/api';
    }

    if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return 'http://localhost:3001/api';
    }

    return `${origin}/api`;
}

const API_BASE_URL = getApiBaseUrl();

/** Devuelve el slug de clínica del subdominio actual, o null si es dominio raíz/plataforma */
function _getCurrentClinicSlug() {
    const hostname = window.location.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1') return null;
    const PLATFORM_SUBS = new Set(['www', 'admin', 'platform', 'api', 'app']);
    const parts = hostname.split('.');
    if (parts.length < 3) return null; // odentara.com — sin subdominio
    const sub = parts[0];
    return PLATFORM_SUBS.has(sub) ? null : sub;
}

/**
 * Devuelve la URL del portal de login (app.odentara.com).
 * Retorna null en localhost/dev para no redirigir durante desarrollo.
 */
function getAppLoginUrl() {
    const hostname = window.location.hostname;
    // Dev: nunca redirigir
    if (hostname === 'localhost' || /^\d+\.\d+\.\d+\.\d+$/.test(hostname)) return null;
    const parts = hostname.split('.');
    if (parts.length < 2) return null;
    // Si ya estamos en app.*, no hace falta redirigir
    if (parts.length >= 3 && parts[0] === 'app') return null;
    const baseDomain = parts.slice(-2).join('.');
    const proto = window.location.protocol;
    const port  = window.location.port ? `:${window.location.port}` : '';
    return `${proto}//app.${baseDomain}${port}`;
}
const AUTH_STORAGE_KEY = 'odentara_auth_v1';
const THEME_STORAGE_KEY = 'odentara_theme_v1';

// MOJIBAKE_REPAIRS, repairMojibakeString, repairDomText, escapeHtml,
// BUSINESS_TIME_ZONE → js/core/utils.js

let feedbackToastRoot = null;
let feedbackDialogRoot = null;
let loadingOverlayRoot = null;

function getStoredTheme() {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    return saved === 'dark' ? 'dark' : 'light';
}

function createThemeToggleButton(extraClass = '') {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `theme-toggle-btn ${extraClass}`.trim();
    button.dataset.themeToggle = 'true';
    button.setAttribute('aria-label', 'Cambiar tema');
    button.setAttribute('title', 'Cambiar tema');
    button.innerHTML = '<i class="fa-solid fa-moon"></i>';
    return button;
}

function ensureThemeControls() {
    document.querySelector('.login-theme-toggle-wrap')?.appendChild(
        document.querySelector('.login-theme-toggle-wrap [data-theme-toggle]') || createThemeToggleButton()
    );

    document.querySelector('.header-actions [data-theme-toggle]')?.remove();

    const sidebarUserWrap = document.querySelector('.sidebar-user-wrap');
    if (sidebarUserWrap && !sidebarUserWrap.querySelector('.sidebar-theme-control [data-theme-toggle]')) {
        const existingSidebarToggle = document.querySelector('.sidebar-theme-btn[data-theme-toggle]');
        const toggleButton = existingSidebarToggle || createThemeToggleButton('sidebar-theme-btn');
        const toggleWrap = document.createElement('div');
        toggleWrap.className = 'sidebar-theme-control';
        const toggleLabel = document.createElement('span');
        toggleLabel.className = 'sidebar-theme-label';
        toggleLabel.textContent = 'Modo oscuro';
        toggleWrap.append(toggleLabel, toggleButton);
        sidebarUserWrap.appendChild(toggleWrap);
    }
}

function syncThemeToggleButtons() {
    const isDark = document.body.classList.contains('theme-dark');
    document.querySelectorAll('[data-theme-toggle]').forEach((button) => {
        button.classList.toggle('is-dark', isDark);
        button.setAttribute('aria-label', isDark ? 'Activar modo claro' : 'Activar modo oscuro');
        button.setAttribute('title', isDark ? 'Activar modo claro' : 'Activar modo oscuro');
        button.innerHTML = `<i class="fa-solid ${isDark ? 'fa-sun' : 'fa-moon'}"></i>`;
    });
}

function applyTheme(theme = 'light', persist = true) {
    const nextTheme = theme === 'dark' ? 'dark' : 'light';
    document.body.classList.toggle('theme-dark', nextTheme === 'dark');
    document.body.classList.toggle('theme-light', nextTheme !== 'dark');
    document.documentElement.style.colorScheme = nextTheme;
    if (persist) localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    syncThemeToggleButtons();
}

function toggleTheme() {
    applyTheme(document.body.classList.contains('theme-dark') ? 'light' : 'dark');
}

function ensureFeedbackUi() {
    if (!feedbackToastRoot) {
        feedbackToastRoot = document.createElement('div');
        feedbackToastRoot.id = 'feedback-toast-root';
        feedbackToastRoot.className = 'feedback-toast-root';
        document.body.appendChild(feedbackToastRoot);
    }

    if (!feedbackDialogRoot) {
        feedbackDialogRoot = document.createElement('div');
        feedbackDialogRoot.id = 'feedback-dialog-root';
        feedbackDialogRoot.className = 'feedback-dialog-root';
        document.body.appendChild(feedbackDialogRoot);
    }

    return { feedbackToastRoot, feedbackDialogRoot };
}

function ensureLoadingOverlay() {
    if (!loadingOverlayRoot) {
        loadingOverlayRoot = document.createElement('div');
        loadingOverlayRoot.id = 'app-loading-overlay';
        loadingOverlayRoot.className = 'app-loading-overlay';
        loadingOverlayRoot.innerHTML = `
            <div class="app-loading-card" role="status" aria-live="polite" aria-busy="true">
                <div class="app-loading-spinner"></div>
                <div class="app-loading-copy">
                    <p class="app-loading-eyebrow">Odentara</p>
                    <p class="app-loading-message">Guardando cambios...</p>
                </div>
            </div>
        `;
        document.body.appendChild(loadingOverlayRoot);
    }

    return loadingOverlayRoot;
}

function setAppLoading(isLoading, message = 'Guardando cambios...') {
    const overlay = ensureLoadingOverlay();
    const messageNode = overlay.querySelector('.app-loading-message');
    if (messageNode) {
        messageNode.textContent = repairMojibakeString(String(message || 'Guardando cambios...'));
    }

    state.loadingCount = Math.max(0, state.loadingCount + (isLoading ? 1 : -1));
    overlay.classList.toggle('is-visible', state.loadingCount > 0);
    document.body.classList.toggle('app-loading-active', state.loadingCount > 0);
}

function isAppLoading() {
    return state.loadingCount > 0;
}

async function withAppLoading(message, task) {
    setAppLoading(true, message);
    try {
        return await task();
    } finally {
        setAppLoading(false);
    }
}

function showToast(message, options = {}) {
    const { type = 'info', duration = 3200 } = options;
    const { feedbackToastRoot } = ensureFeedbackUi();
    const toast = document.createElement('div');
    toast.className = `feedback-toast feedback-toast-${type}`;
    toast.innerHTML = `
        <div class="feedback-toast-icon">
            <i class="fa-solid ${type === 'success' ? 'fa-check' : type === 'error' ? 'fa-circle-exclamation' : 'fa-bell'}"></i>
        </div>
        <div class="feedback-toast-copy">${repairMojibakeString(String(message ?? ''))}</div>
    `;

    feedbackToastRoot.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('is-visible'));

    const removeToast = () => {
        toast.classList.remove('is-visible');
        window.setTimeout(() => toast.remove(), 180);
    };

    window.setTimeout(removeToast, duration);
    toast.addEventListener('click', removeToast);
}

function showDialog(message, options = {}) {
    const {
        title = 'Odentara',
        variant = 'info',
        confirmText = 'Aceptar',
        cancelText = null,
        dismissible = true
    } = options;

    const { feedbackDialogRoot } = ensureFeedbackUi();
    const previousActiveElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overlay = document.createElement('div');
    overlay.className = 'feedback-dialog-overlay';
    overlay.innerHTML = `
        <div class="feedback-dialog feedback-dialog-${variant}" role="dialog" aria-modal="true" aria-label="${repairMojibakeString(title)}">
            <div class="feedback-dialog-badge">
                <i class="fa-solid ${variant === 'danger' ? 'fa-trash' : variant === 'error' ? 'fa-circle-exclamation' : variant === 'success' ? 'fa-check' : 'fa-bell'}"></i>
            </div>
            <div class="feedback-dialog-copy">
                <p class="feedback-dialog-eyebrow">${repairMojibakeString(title)}</p>
                <p class="feedback-dialog-message">${options.html ? (message ?? '') : repairMojibakeString(String(message ?? ''))}</p>
            </div>
            <div class="feedback-dialog-actions">
                ${cancelText ? `<button type="button" class="btn btn-ghost feedback-dialog-cancel">${repairMojibakeString(cancelText)}</button>` : ''}
                <button type="button" class="btn btn-primary feedback-dialog-confirm">${repairMojibakeString(confirmText)}</button>
            </div>
        </div>
    `;

    feedbackDialogRoot.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('is-visible'));

    return new Promise((resolve) => {
        const confirmButton = overlay.querySelector('.feedback-dialog-confirm');
        const cancelButton = overlay.querySelector('.feedback-dialog-cancel');

        requestAnimationFrame(() => {
            (cancelButton || confirmButton)?.focus?.({ preventScroll: true });
        });

        const cleanup = (result) => {
            overlay.classList.remove('is-visible');
            document.removeEventListener('keydown', onKeyDown);
            window.setTimeout(() => {
                overlay.remove();
                previousActiveElement?.focus?.({ preventScroll: true });
                resolve(result);
            }, 180);
        };

        const onKeyDown = (event) => {
            if (event.key === 'Escape' && dismissible) {
                event.preventDefault();
                event.stopPropagation();
                cleanup(false);
                return;
            }

            if (event.key === 'Enter') {
                event.preventDefault();
                event.stopPropagation();
                if (cancelButton) {
                    cleanup(false);
                } else {
                    cleanup(true);
                }
            }
        };

        document.addEventListener('keydown', onKeyDown);

        confirmButton?.addEventListener('click', () => cleanup(true));
        cancelButton?.addEventListener('click', () => cleanup(false));

        if (dismissible) {
            overlay.addEventListener('click', (event) => {
                if (event.target === overlay) {
                    cleanup(false);
                }
            });
        }
    });
}

function showAlert(message, options = {}) {
    return showDialog(message, {
        title: options.title || 'Odentara',
        variant: options.variant || 'info',
        confirmText: options.confirmText || 'Aceptar',
        dismissible: true,
        html: options.html || false,
    });
}

function showConfirm(message, options = {}) {
    return showDialog(message, {
        title: options.title || 'Confirmar acción',
        variant: options.variant || 'danger',
        confirmText: options.confirmText || 'Confirmar',
        cancelText: options.cancelText || 'Cancelar',
        dismissible: true
    });
}

function setupMojibakeAutoRepair() {
    const nativeConfirm = window.confirm.bind(window);

    window.alert = (message) => showAlert(message);
    window.confirm = (message) => nativeConfirm(repairMojibakeString(String(message ?? '')));
    window.appAlert = showAlert;
    window.appConfirm = showConfirm;
    window.appToast = showToast;

    const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            mutation.addedNodes.forEach((node) => {
                if (node.nodeType === Node.TEXT_NODE) {
                    const repaired = repairMojibakeString(node.nodeValue);
                    if (repaired !== node.nodeValue) {
                        node.nodeValue = repaired;
                    }
                    return;
                }

                if (node.nodeType === Node.ELEMENT_NODE) {
                    repairDomText(node);
                }
            });
        }
    });

    observer.observe(document.body, { childList: true, subtree: true });
    repairDomText(document.body);
}

// --- Database Setup ---
const DB = {
    getRaw(table) {
        return JSON.parse(localStorage.getItem('odentara_db_v6'))[table] || [];
    },
    init() {
        if (!localStorage.getItem('odentara_db_v6')) {
            localStorage.setItem('odentara_db_v6', JSON.stringify({
                users: [], professionals: [], patients: [],
                appointments: [], billing: [], clinic: {}
            }));
        }
    },
    get(table) {
        return this.getRaw(table).filter(item => !item?.deletedAt);
    },
    save(table, items) {
        const db = JSON.parse(localStorage.getItem('odentara_db_v6')) || {};
        db[table] = items;
        localStorage.setItem('odentara_db_v6', JSON.stringify(db));
    },
    add(table, item) {
        const items = this.getRaw(table);
        item.id = items.length > 0 ? Math.max(...items.map(i => i.id)) + 1 : 1;
        items.push(item);
        this.save(table, items);
    },
    update(table, id, data) {
        const items = this.getRaw(table);
        const idx = items.findIndex(i => i.id === +id);
        if (idx !== -1) {
            items[idx] = { ...items[idx], ...data };
            this.save(table, items);
        }
    },
    archive(table, id, extraData = {}) {
        const items = this.getRaw(table);
        const idx = items.findIndex(i => i.id === +id);
        if (idx !== -1) {
            items[idx] = {
                ...items[idx],
                ...extraData,
                active: false,
                deletedAt: new Date().toISOString()
            };
            this.save(table, items);
        }
    },
    delete(table, id) {
        this.archive(table, id);
    }
};
DB.init();

const DEFAULT_CLINIC_SETTINGS = {
    name: 'Centro odontológico',
    professionalColors: {}
};

function getDbSnapshot() {
    try {
        return JSON.parse(localStorage.getItem('odentara_db_v6')) || {};
    } catch (_error) {
        return {};
    }
}

function saveDbSnapshot(snapshot) {
    localStorage.setItem('odentara_db_v6', JSON.stringify(snapshot || {}));
}

function getClinicSettings() {
    const db = getDbSnapshot();
    const clinic = db.clinic && typeof db.clinic === 'object' ? db.clinic : {};
    const professionalColors = clinic.professionalColors && typeof clinic.professionalColors === 'object'
        ? clinic.professionalColors
        : {};
    return {
        ...DEFAULT_CLINIC_SETTINGS,
        ...clinic,
        professionalColors: {
            ...(DEFAULT_CLINIC_SETTINGS.professionalColors || {}),
            ...professionalColors
        }
    };
}

function saveClinicSettings(partialSettings = {}) {
    const db = getDbSnapshot();
    const current = db.clinic && typeof db.clinic === 'object' ? db.clinic : {};
    const nextProfessionalColors = partialSettings.professionalColors && typeof partialSettings.professionalColors === 'object'
        ? partialSettings.professionalColors
        : {};
    db.clinic = {
        ...DEFAULT_CLINIC_SETTINGS,
        ...current,
        ...partialSettings,
        professionalColors: {
            ...(DEFAULT_CLINIC_SETTINGS.professionalColors || {}),
            ...(current.professionalColors && typeof current.professionalColors === 'object' ? current.professionalColors : {}),
            ...nextProfessionalColors
        }
    };
    saveDbSnapshot(db);
}

function getClinicDisplayName() {
    const name = String(getClinicSettings().name || '').trim();
    return name || DEFAULT_CLINIC_SETTINGS.name;
}

function applyClinicBranding() {
    const clinicName = getClinicDisplayName();
    document.querySelectorAll('.app-brand-copy h1, .mobile-header-brand-text > span:first-child')
        .forEach((node) => {
            if (node) node.textContent = 'Odentara';
        });
    document.querySelectorAll('.logo-container h2')
        .forEach((node) => {
            if (node) node.textContent = 'Odentara.app';
        });
    document.querySelectorAll('.app-brand-subtitle')
        .forEach((node) => {
            if (node) node.textContent = clinicName;
        });
    document.title = 'Odentara';
}

// --- Role Configurations ---
const roleConfig = {
    superadmin: {
        name: 'Superadmin',
        navItems: [
            { id: 'dashboard',     icon: 'fa-chart-pie',           label: 'Dashboard' },
            { id: 'appointments',  icon: 'fa-calendar-check',      label: 'Turnos' },
            { id: 'patients',      icon: 'fa-users',               label: 'Pacientes & Historia Clínica' },
            { id: 'professionals', icon: 'fa-user-md',             label: 'Horarios Médicos' },
            { id: 'billing',       icon: 'fa-file-invoice-dollar', label: 'Facturación' },
            { id: 'settings',      icon: 'fa-cog',                 label: 'Configuración' }
        ]
    },
    admin: {
        name: 'Administrador',
        navItems: [
            { id: 'dashboard', icon: 'fa-chart-pie',           label: 'Dashboard' },
            { id: 'patients',  icon: 'fa-users',               label: 'Pacientes' },
            { id: 'billing',   icon: 'fa-file-invoice-dollar', label: 'Cuentas Corrientes' },
            { id: 'settings',  icon: 'fa-cog',                 label: 'Configuración' }
        ]
    },
    professional: {
        name: 'Profesional',
        navItems: [
            { id: 'dashboard',     icon: 'fa-chart-pie',      label: 'Mi Panel' },
            { id: 'appointments',  icon: 'fa-calendar-check', label: 'Mis Turnos' },
            { id: 'patients',      icon: 'fa-notes-medical',  label: 'Pacientes & Historia Clínica' },
            { id: 'professionals', icon: 'fa-clock',          label: 'Mis Horarios' }
        ]
    },
    secretary: {
        name: 'Secretaría',
        navItems: [
            { id: 'dashboard',     icon: 'fa-chart-pie',      label: 'Recepción' },
            { id: 'appointments',  icon: 'fa-calendar-check', label: 'Gestión de Turnos' },
            { id: 'patients',      icon: 'fa-users',          label: 'Pacientes' },
            { id: 'professionals', icon: 'fa-user-md',        label: 'Agendas Médicas' },
            { id: 'settings',      icon: 'fa-cog',            label: 'Configuración' }
        ]
    }
};

// --- Initial DOM Elements ---
const views = { login: document.getElementById('login-view'), app: document.getElementById('app-view') };

// El login siempre es dark — forzar sin persistir la preferencia del usuario
applyTheme('dark', false);
const modalsContainer = document.getElementById('modals-container');
const mainContent = document.getElementById('main-content');
const pageTitle = document.getElementById('page-title');
const appSidebar = document.getElementById('app-sidebar');
const sidebarBackdrop = document.getElementById('sidebar-backdrop');
const sidebarToggle = document.getElementById('sidebar-toggle');

function setElementText(id, value) {
    const el = document.getElementById(id);
    if (el) el.innerText = value;
}

function setPageTitle(title) {
    if (pageTitle) pageTitle.innerText = title;
}

function getPageTitle() {
    return pageTitle ? pageTitle.innerText : '';
}

function isMobileLayout() {
    return window.innerWidth <= 1024;
}

function syncSidebarLayout() {
    if (!views.app) return;
    if (isMobileLayout()) {
        views.app.classList.toggle('sidebar-open', !!state.sidebarOpen);
        if (sidebarBackdrop) sidebarBackdrop.classList.toggle('hidden', !state.sidebarOpen);
    } else {
        views.app.classList.remove('sidebar-open');
        if (sidebarBackdrop) sidebarBackdrop.classList.add('hidden');
    }
}

function setSidebarOpen(isOpen) {
    state.sidebarOpen = !!isOpen;
    syncSidebarLayout();
}


function mapApiUserToLegacyUser(apiUser = {}) {
    const displayName = apiUser.fullName || apiUser.name || apiUser.email || 'Usuario';
    const roles = Array.isArray(apiUser.roles) ? apiUser.roles : [];

    // Derivar "type" (label visual) desde los roles del backend.
    // Prioridad: professional > secretary > admin
    // Un profesional que también tiene admin sigue siendo "profesional" visualmente.
    function deriveTypeFromRoles(roleCodes) {
        const r = roleCodes.map(c => String(c).toLowerCase());
        if (r.some(c => c === 'superadmin')) return 'superadmin';
        if (r.some(c => c === 'professional' || c === 'profesional')) return 'profesional';
        if (r.some(c => c === 'secretary' || c === 'secretario')) return 'secretario';
        if (r.some(c => c === 'admin' || c === 'administrador')) return 'administrador';
        return '';
    }

    return {
        id: apiUser.id,
        email: apiUser.email,
        name: displayName,
        fullName: apiUser.fullName || displayName,
        type: apiUser.type || deriveTypeFromRoles(roles),
        roles,
        allowedProfessionals: Array.isArray(apiUser.allowedProfessionalIds) ? apiUser.allowedProfessionalIds : [],
        assignedProfessionalId: apiUser.assignedProfessionalId || null,
        assignedProfessionalName: apiUser.assignedProfessionalName || null,
        active: apiUser.active !== false,
        isPlatformAdmin: apiUser.isPlatformAdmin || false,
        clinicId: apiUser.clinicId || null,
    };
}

function isSelfPlatformAdmin() {
    return !!state.user?.isPlatformAdmin;
}

function saveAuthSession(token, apiUser) {
    state.authToken = token;
    state.user = mapApiUserToLegacyUser(apiUser);
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({
        token,
        user: apiUser
    }));
}

function clearAuthSession() {
    state.authToken = null;
    state.user = null;
    localStorage.removeItem(AUTH_STORAGE_KEY);
    stopDashboardAutoRefresh();
}

async function apiFetch(path, options = {}) {
    const headers = {
        ...(options.headers || {})
    };

    if (state.authToken) {
        headers.Authorization = `Bearer ${state.authToken}`;
    }

    if (options.body && !headers['Content-Type']) {
        headers['Content-Type'] = 'application/json';
    }

    let response;
    try {
        response = await fetch(`${API_BASE_URL}${path}`, {
            ...options,
            headers
        });
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

function clearFormValidation(form) {
    if (!form) return;

    form.querySelectorAll('.input-invalid').forEach((element) => {
        element.classList.remove('input-invalid');
        element.removeAttribute('aria-invalid');
    });

    form.querySelectorAll('.field-error-message').forEach((element) => element.remove());

    const feedback = form.querySelector('.form-feedback');
    if (feedback) {
        feedback.hidden = true;
        feedback.textContent = '';
        feedback.classList.remove('is-visible');
    }
}

function showFormFeedback(form, message) {
    if (!form || !message) return;

    const feedback = form.querySelector('.form-feedback');
    if (!feedback) return;

    feedback.textContent = message;
    feedback.hidden = false;
    feedback.classList.add('is-visible');
}

function markFieldInvalid(field, message) {
    if (!field) return;

    field.classList.add('input-invalid');
    field.setAttribute('aria-invalid', 'true');

    const inputGroup = field.closest('.input-group');
    if (!inputGroup) return;

    const existingError = inputGroup.querySelector('.field-error-message');
    if (existingError) existingError.remove();

    if (message) {
        const error = document.createElement('div');
        error.className = 'field-error-message';
        error.textContent = message;
        inputGroup.appendChild(error);
    }
}

function focusField(field) {
    if (!field || typeof field.focus !== 'function') return;

    field.focus();
    if (typeof field.select === 'function' && field.tagName === 'INPUT' && field.type !== 'date') {
        field.select();
    }
}

async function validatePatientForm(form, editId = null) {
    clearFormValidation(form);

    const fieldMap = {
        name: form.querySelector('#p-name'),
        dni: form.querySelector('#p-dni'),
        phone: form.querySelector('#p-phone'),
        email: form.querySelector('#p-email')
    };

    const rawName = fieldMap.name?.value || '';
    const rawDni = fieldMap.dni?.value || '';
    const rawPhone = fieldMap.phone?.value || '';
    const rawEmail = fieldMap.email?.value || '';

    const normalizedName = normalizePatientName(rawName);
    const normalizedDni = normalizeDni(rawDni);
    const normalizedPhone = normalizeDni(rawPhone);
    const email = rawEmail.trim();

    const fail = (fieldKey, fieldMessage, summary = fieldMessage) => {
        const field = fieldMap[fieldKey];
        showFormFeedback(form, summary);
        markFieldInvalid(field, fieldMessage);
        focusField(field);
        return { ok: false };
    };

    if (!normalizedName) {
        return fail('name', 'Ingresa el nombre y apellido del paciente.', 'Revisa el campo Nombre y Apellido.');
    }

    if (normalizedName.length < 3) {
        return fail('name', 'El nombre es demasiado corto.', 'Revisa el campo Nombre y Apellido.');
    }

    if (!normalizedDni) {
        return fail('dni', 'Ingresa un DNI válido.', 'Revisa el campo DNI.');
    }

    if (normalizedDni.length < 7) {
        return fail('dni', 'El DNI debe tener al menos 7 números.', 'Revisa el campo DNI.');
    }

    if (!normalizedPhone) {
        return fail('phone', 'Ingresa un teléfono o celular válido.', 'Revisa el campo Teléfono.');
    }

    if (normalizedPhone.length < 8) {
        return fail('phone', 'El teléfono debe tener al menos 8 números.', 'Revisa el campo Teléfono.');
    }

    if (email && fieldMap.email && !fieldMap.email.checkValidity()) {
        return fail('email', 'El email no tiene un formato válido.', 'Revisa el campo Email.');
    }

    let allPatients = [];
    try {
        const patientsRes = await apiFetch('/patients');
        allPatients = patientsRes.patients || [];
    } catch (_e) {
        // Si falla la carga, dejamos pasar — el backend validará duplicados al guardar
    }

    const duplicatedByName = allPatients.find((patient) =>
        normalizePatientName(patient.fullName) === normalizedName && patient.id !== editId
    );

    if (duplicatedByName) {
        return fail('name', 'Ya existe un paciente cargado con ese nombre.', 'Ya existe un paciente cargado con ese nombre.');
    }

    const duplicatedByDni = allPatients.find((patient) =>
        normalizeDni(patient.dni) === normalizedDni && patient.id !== editId
    );

    if (duplicatedByDni) {
        return fail('dni', 'Ya existe un paciente cargado con ese DNI.', 'Ya existe un paciente cargado con ese DNI.');
    }

    return {
        ok: true,
        normalizedName,
        normalizedDni
    };
}

function applyPatientApiErrorToForm(form, error) {
    if (!form || !error) return false;

    const payload = error.payload || {};
    const conflicts = Array.isArray(payload.conflicts) ? payload.conflicts : [];
    const message = payload.error || error.message || 'No se pudo guardar el paciente.';
    const lowerMessage = String(message).toLowerCase();

    const fieldMap = {
        name: form.querySelector('#p-name'),
        dni: form.querySelector('#p-dni'),
        phone: form.querySelector('#p-phone'),
        email: form.querySelector('#p-email')
    };

    const mark = (fieldKey, fieldMessage, summary = message) => {
        showFormFeedback(form, summary);
        markFieldInvalid(fieldMap[fieldKey], fieldMessage);
        focusField(fieldMap[fieldKey]);
        return true;
    };

    if (conflicts.length > 0) {
        const dniConflict = conflicts.find((item) => /dni/i.test(item));
        const nameConflict = conflicts.find((item) => /nombre/i.test(item));

        if (dniConflict) return mark('dni', dniConflict, dniConflict);
        if (nameConflict) return mark('name', nameConflict, nameConflict);
    }

    if (lowerMessage.includes('dni')) {
        return mark('dni', message, message);
    }

    if (lowerMessage.includes('nombre')) {
        return mark('name', message, message);
    }

    if (lowerMessage.includes('email')) {
        return mark('email', message, message);
    }

    if (lowerMessage.includes('telefono') || lowerMessage.includes('teléfono')) {
        return mark('phone', message, message);
    }

    showFormFeedback(form, message);
    return false;
}

async function deleteViaApiOrLocal({ path, localTable, localId, fallbackAction, sync = true }) {
    if (state.authToken) {
        await apiFetch(path, { method: 'DELETE' });
        if (sync) {
            await syncBackendSnapshotToLocalDb();
        }
        return;
    }

    if (typeof fallbackAction === 'function') {
        fallbackAction();
        return;
    }

    if (localTable && localId !== undefined) {
        DB.archive(localTable, localId);
    }
}

let _dashboardRefreshTimer = null;

function startDashboardAutoRefresh() {
    if (_dashboardRefreshTimer) clearInterval(_dashboardRefreshTimer);
    _dashboardRefreshTimer = setInterval(async () => {
        if (!state.user || !state.authToken) return;
        try {
            await syncBackendSnapshotToLocalDb();
            if (state.currentView === 'dashboard') {
                refreshCurrentView();
            }
        } catch (_) { /* silencioso */ }
    }, 30_000); // cada 30 segundos
}

function stopDashboardAutoRefresh() {
    if (_dashboardRefreshTimer) { clearInterval(_dashboardRefreshTimer); _dashboardRefreshTimer = null; }
}

function applyAuthenticatedUiState() {
    if (!state.user) return;
    state.dashboardDate = getTodayIsoLocal();
    const sourceName = state.user.name || state.user.fullName || state.user.email || 'Usuario';
    const initials = sourceName.substring(0, 2).toUpperCase();
    setElementText('user-name', sourceName);
    setElementText('user-initials', initials);

    if (isSelfPlatformAdmin()) {
        setElementText('user-role-display', 'Platform Admin');
    } else {
        const roleLabel = state.user.roles.map(r => roleConfig[r]?.name || r).join(' + ');
        setElementText('user-role-display', roleLabel);
        applyClinicBranding();
    }

    renderSidebar();
    setSidebarOpen(!isMobileLayout());
    views.login.classList.remove('active');
    views.login.classList.add('hidden');
    views.app.classList.remove('hidden');
    views.app.classList.add('active');
    // Restaurar el tema preferido del usuario al entrar a la app
    applyTheme(localStorage.getItem(THEME_STORAGE_KEY) === 'dark' ? 'dark' : 'light', false);

    if (isSelfPlatformAdmin()) {
        loadView('platform-clinics', 'Panel de Plataforma', { skipSync: true });
    } else {
        // Todos los roles aterrizan en Dashboard
        loadView('dashboard', 'Dashboard', { skipSync: true });
        startDashboardAutoRefresh();
    }
}

function mapApiProfessionalToLegacy(professional = {}) {
    const schedule = {};
    (professional.schedules || []).forEach(item => {
        schedule[item.weekday] = {
            active: item.active,
            start: item.startTime,
            end: item.endTime
        };
    });

    return {
        id: professional.id,
        name: professional.fullName,
        specialty: professional.specialty || '',
        email: professional.email || '',
        phone: professional.phone || '',
        color: professional.color || '#6366f1',
        status: professional.active ? 'activo' : 'inactivo',
        active: professional.active,
        userId: professional.userId ?? null,
        schedule
    };
}

function mapApiPatientToLegacy(patient = {}) {
    return {
        id: patient.id,
        name: patient.fullName,
        dni: patient.dni,
        fechaNacimiento: patient.birthDate ? formatDateToLocalIso(new Date(patient.birthDate)) : '',
        obraSocial: [patient.insuranceName, patient.insurancePlan].filter(Boolean).join(' ').trim(),
        credencial: patient.credentialNumber || '',
        domicilio: patient.address || '',
        fichaNumero: patient.chartNumber || '',
        email: patient.email || '',
        phone: patient.phone || '',
        lastVisit: '',
        notes: '',
        allergies: '',
        medicalNotes: '',
        odontograma: {},
        treatments: [],
        clinicalImages: []
    };
}

function mapApiTreatmentToLegacy(treatment = {}) {
    return {
        id: treatment.id,
        professionalId: treatment.professionalId || null,
        diente: treatment.tooth || '',
        cara: treatment.face || '',
        sector: treatment.sector || '',
        autorizacion: treatment.authorizationNumber || '',
        codigo: treatment.insuranceCode || '',
        observaciones: treatment.observations || '',
        fecha: treatment.performedAt ? new Date(treatment.performedAt).toLocaleDateString('es-AR') : '',
        firma: treatment.professional?.fullName || state.user?.fullName || state.user?.name || ''
    };
}

function mapApiClinicalImageToLegacy(image = {}) {
    return {
        id:          image.id,
        date:        image.takenAt
                        ? formatDateToLocalIso(new Date(image.takenAt))
                        : image.createdAt
                            ? formatDateToLocalIso(new Date(image.createdAt))
                            : '',
        description: image.description || '',
        dataUrl:     image.imageUrl || '',
        mimeType:    image.mimeType || 'image/jpeg',
        fileName:    image.fileName || null,
    };
}

function upsertLocalItem(table, item) {
    const items = DB.get(table);
    const index = items.findIndex((entry) => entry.id === item.id);

    if (index >= 0) {
        items[index] = {
            ...items[index],
            ...item
        };
    } else {
        items.push(item);
    }

    DB.save(table, items);
}


function clinicalRecordEntriesToLegacyOdontogram(entries = []) {
    const odontograma = {};
    const faceMap = {
        V: 'top',
        D: 'right',
        P: 'bottom',
        M: 'left',
        O: 'center',
        I: 'center',
    };
    const statusMap = {
        healthy:          'sano',
        caries:           'caries',
        restored:         'restaurado',
        absent:           'ausente',
        implant:          'implante',
        crown:            'corona',
        crown_implant:    'corona-implante',
        endodontics:      'endodoncia',
        orthodontics:     'ortodoncia',
        sealant:          'sello'
    };
    // Estados que representan el diente completo (no una cara)
    const toothStateStatuses = new Set(['ausente', 'implante', 'corona', 'corona-implante', 'endodoncia', 'ortodoncia', 'sello']);

    // Primer paso: procesar estados de diente completo
    entries.forEach((entry) => {
        const toothNumber = String(entry.toothNumber || '');
        if (!toothNumber || entry.face === 'L') return;
        if (!odontograma[toothNumber]) odontograma[toothNumber] = {};
        const status = statusMap[entry.status] || 'sano';
        if (toothStateStatuses.has(status)) {
            odontograma[toothNumber].estado = status;
        }
    });

    // Segundo paso: procesar caras y marcador de color (face='L' = azul)
    entries.forEach((entry) => {
        const toothNumber = String(entry.toothNumber || '');
        if (!toothNumber) return;
        if (!odontograma[toothNumber]) odontograma[toothNumber] = {};

        const status = statusMap[entry.status] || 'sano';

        // 'L' es el marcador de color azul para estados de diente completo
        if (entry.face === 'L') {
            if (odontograma[toothNumber].estado && status === 'restaurado') {
                odontograma[toothNumber].color = 'azul';
            }
            return;
        }

        // Ignorar entradas de estado de diente completo (ya procesadas)
        if (toothStateStatuses.has(status)) return;

        const faceKey = faceMap[entry.face] || 'center';
        if (status === 'sano') {
            delete odontograma[toothNumber][faceKey];
        } else {
            odontograma[toothNumber][faceKey] = status;
        }
    });

    return odontograma;
}

function legacyOdontogramToEntries(odontograma = {}) {
    const entries = [];
    const faceMap = {
        top: 'V',
        right: 'D',
        bottom: 'P',
        left: 'M',
        center: 'O'
    };
    const statusMap = {
        sano:             'healthy',
        caries:           'caries',
        restaurado:       'restored',
        ausente:          'absent',
        implante:         'implant',
        corona:           'crown',
        'corona-implante':'crown_implant',
        endodoncia:       'endodontics',
        ortodoncia:       'orthodontics',
        sello:            'sealant'
    };
    // Estados que se guardan como entrada de diente completo (face = null)
    const toothStateEstados = new Set(['ausente', 'implante', 'corona', 'corona-implante', 'endodoncia', 'ortodoncia', 'sello']);

    Object.entries(odontograma || {}).forEach(([toothNumber, toothData]) => {
        if (!toothData || typeof toothData !== 'object') return;

        if (toothStateEstados.has(toothData.estado)) {
            entries.push({
                toothNumber: String(toothNumber),
                face: null,
                status: statusMap[toothData.estado]
            });
            // Marcador de color azul: face='L', status='restored'
            if (toothData.color === 'azul') {
                entries.push({
                    toothNumber: String(toothNumber),
                    face: 'L',
                    status: 'restored'
                });
            }
            // Para implante, corona-implante y sello también guardar las caras si las hay
            if (toothData.estado === 'implante' || toothData.estado === 'corona-implante' || toothData.estado === 'sello') {
                ['top', 'right', 'bottom', 'left', 'center'].forEach((faceKey) => {
                    const faceStatus = toothData[faceKey];
                    if (!faceStatus || faceStatus === 'sano') return;
                    entries.push({
                        toothNumber: String(toothNumber),
                        face: faceMap[faceKey],
                        status: statusMap[faceStatus] || 'healthy'
                    });
                });
            }
            return;
        }

        ['top', 'right', 'bottom', 'left', 'center'].forEach((faceKey) => {
            const status = toothData[faceKey];
            if (!status || status === 'sano') return;

            entries.push({
                toothNumber: String(toothNumber),
                face: faceMap[faceKey],
                status: statusMap[status] || 'healthy'
            });
        });
    });

    return entries;
}

function hasChildDentitionData(patient = {}) {
    const childTeeth = new Set(['55','54','53','52','51','61','62','63','64','65','85','84','83','82','81','71','72','73','74','75']);
    const odontograma = patient.odontograma || {};
    return Object.keys(odontograma).some((tooth) => childTeeth.has(String(tooth)));
}

function createClinicalDraftFromPatient(patient) {
    if (!patient) return null;

    return {
        patientId: patient.id,
        isDirty: false,
        data: {
            fechaNacimiento: patient.fechaNacimiento || '',
            phone: patient.phone || '',
            email: patient.email || '',
            obraSocial: patient.obraSocial || '',
            credencial: patient.credencial || '',
            fichaNumero: patient.fichaNumero || '',
            domicilio: patient.domicilio || '',
            notes: patient.notes || '',
            allergies: patient.allergies || '',
            medicalNotes: patient.medicalNotes || '',
            odontograma: deepClone(patient.odontograma || {}),
            showChildDentition: Boolean(patient.showChildDentition || hasChildDentitionData(patient))
        }
    };
}

function setClinicalDraftFromPatient(patient) {
    state.clinicalDraft = createClinicalDraftFromPatient(patient);
}

function getClinicalDraft(patientId) {
    if (state.clinicalDraft?.patientId === patientId) {
        return state.clinicalDraft;
    }
    return null;
}

function getClinicalWorkingPatient(patientId) {
    const patient = DB.get('patients').find((item) => item.id === patientId);
    const draft = getClinicalDraft(patientId);
    if (!patient) return null;
    if (!draft) return patient;

    return {
        ...patient,
        ...draft.data,
        odontograma: draft.data.odontograma || {}
    };
}

function updateClinicalDraft(patientId, updater) {
    const draft = getClinicalDraft(patientId);
    if (!draft) return;
    updater(draft.data);
    draft.isDirty = true;
    syncClinicalHistorySaveState();
}

function clearClinicalDraft() {
    state.clinicalDraft = null;
    // Resetear el profesional seleccionado para que al abrir otro paciente quede en blanco
    if (isSuperadmin()) state.clinicalOdontoProfessionalId = null;
}

function hasUnsavedClinicalDraft() {
    return state.currentView === 'patient-history' && Boolean(state.clinicalDraft?.isDirty);
}

async function confirmClinicalDraftExit() {
    if (!hasUnsavedClinicalDraft()) return true;

    const shouldDiscard = await showConfirm(
        'Tienes cambios sin guardar en la historia clínica. Puedes guardarlos ahora antes de salir.',
        {
            title: 'Cambios sin guardar',
            confirmText: 'Salir sin guardar',
            cancelText: 'Guardar',
            variant: 'info'
        }
    );

    if (shouldDiscard) {
        clearClinicalDraft();
        return true;
    }

    const patientId = state.clinicalDraft?.patientId;
    if (!patientId) return false;

    try {
        await window.saveClinicalHistory(patientId);
        return true;
    } catch (_error) {
        return false;
    }
}

function syncClinicalHistorySaveState() {
    const saveButton = document.getElementById('btn-save-clinical-history');
    const isDirty = hasUnsavedClinicalDraft();

    if (saveButton) {
        saveButton.disabled = !isDirty;
        saveButton.classList.toggle('is-ready', isDirty);
    }
}

async function syncPatientClinicalData(patientId, professionalId) {
    if (!state.authToken) {
        return DB.get('patients').find((item) => item.id === patientId) || null;
    }

    const profQ = professionalId ? `&professionalId=${professionalId}` : '';
    const profQRecord = professionalId ? `?professionalId=${professionalId}` : '';
    const [patientRes, treatmentsRes, imagesRes, clinicalRecordRes] = await Promise.all([
        apiFetch(`/patients/${patientId}`),
        apiFetch(`/treatments?patientId=${patientId}${profQ}`),
        apiFetch(`/clinical-images?patientId=${patientId}${profQ}`),
        apiFetch(`/clinical-records/${patientId}${profQRecord}`)
    ]);

    const mappedPatient = mapApiPatientToLegacy(patientRes.patient || {});
    const record = clinicalRecordRes.record || null;
    const mergedPatient = {
        ...mappedPatient,
        odontograma: clinicalRecordEntriesToLegacyOdontogram(record?.odontogramEntries || []),
        treatments: (treatmentsRes.treatments || []).map(mapApiTreatmentToLegacy),
        clinicalImages: (imagesRes.images || []).map(mapApiClinicalImageToLegacy),
        notes: record?.summaryNotes || '',
        allergies: record?.allergies || '',
        medicalNotes: record?.medicalNotes || ''
    };

    upsertLocalItem('patients', mergedPatient);
    return mergedPatient;
}

function buildProfessionalSchedulesPayload(schedule = {}) {
    return Object.entries(schedule)
        .map(([weekday, values]) => ({
            weekday: Number(weekday),
            startTime: values?.start || '',
            endTime: values?.end || '',
            active: Boolean(values?.active)
        }))
        .filter(item => item.startTime && item.endTime);
}

function buildPatientApiPayload(values = {}) {
    return {
        fullName: values.name || '',
        dni: values.dni || '',
        birthDate: values.fechaNacimiento || null,
        phone: values.phone || '',
        email: values.email || '',
        address: values.domicilio || '',
        insuranceName: values.obraSocial || '',
        insurancePlan: values.insurancePlan || null,
        credentialNumber: values.credencial || '',
        chartNumber: values.fichaNumero || '',
        summaryNotes: values.notes || '',
        allergies: values.allergies || null,
        medicalNotes: values.medicalNotes || null,
        active: values.active !== false
    };
}

function coerceAppointmentDate(value) {
    if (!value) return '';
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return value;
    }
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
        const date = new Date(value);
        if (!Number.isNaN(date.getTime())) {
            return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
        }
    }
    return formatDateToLocalIso(new Date(value));
}

function coerceAppointmentTime(value) {
    if (!value) return '';
    if (typeof value === 'string' && /^\d{2}:\d{2}$/.test(value)) {
        return value;
    }
    return new Date(value).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function mapApiAppointmentToLegacy(appointment = {}) {
    return {
        id: appointment.id,
        patient: appointment.patient?.fullName || '',
        patientId: appointment.patientId,
        professionalId: appointment.professionalId,
        date: coerceAppointmentDate(appointment.date),
        time: coerceAppointmentTime(appointment.startTime),
        duration: appointment.durationMinutes,
        status: appointment.status,
        isOverbook: !!appointment.isOverbook,
        notes: appointment.notes || '',
        confirmationChannel: appointment.confirmationChannel || null,
        cancellationReason: appointment.cancellationReason || null
    };
}

function mapApiBillingToLegacy(entry = {}) {
    return {
        id: entry.id,
        patientId: entry.patientId,
        professionalId: entry.professionalId,
        appointmentId: entry.appointmentId,
        type: entry.type,
        amount: Number(entry.amount || 0),
        date: coerceAppointmentDate(entry.date),
        description: entry.description || '',
        patientName: entry.patient?.fullName || ''
    };
}

function mapApiUserToSettings(user = {}) {
    return {
        id: user.id,
        name: user.fullName || user.name || user.email,
        email: user.email,
        type: user.roles?.[0] || 'user',
        roles: user.roles || [],
        allowedProfessionals: user.allowedProfessionalIds || [],
        linkedProfessionalId: user.assignedProfessionalId || null
    };
}

async function syncBackendSnapshotToLocalDb() {
    const canManageUsers = (state.user?.roles || []).some(r => r === 'superadmin' || r === 'admin');
    const [professionalsRes, patientsRes, appointmentsRes, billingRes, usersRes] = await Promise.allSettled([
        apiFetch('/professionals'),
        apiFetch('/patients'),
        apiFetch('/appointments'),
        apiFetch('/billing'),
        canManageUsers ? apiFetch('/users') : Promise.resolve({ users: [] })
    ]);

    if (professionalsRes.status === 'fulfilled') {
        DB.save('professionals', (professionalsRes.value.professionals || []).map(mapApiProfessionalToLegacy));
    }

    if (patientsRes.status === 'fulfilled') {
        DB.save('patients', (patientsRes.value.patients || []).map(mapApiPatientToLegacy));
    }

    if (appointmentsRes.status === 'fulfilled') {
        DB.save('appointments', (appointmentsRes.value.appointments || []).map(mapApiAppointmentToLegacy));
    }

    if (billingRes.status === 'fulfilled') {
        DB.save('billing', (billingRes.value.entries || []).map(mapApiBillingToLegacy));
    }

    if (usersRes.status === 'fulfilled') {
        DB.save('users', (usersRes.value.users || []).map(mapApiUserToLegacyUser));
    }
}

async function tryRestoreSession() {
    // ── Token exchange al redirigir entre subdominios (?__exchange=CODE) ───
    const urlParams = new URLSearchParams(window.location.search);
    const exchangeCode = urlParams.get('__exchange');
    if (exchangeCode) {
        // Limpiar el código de la URL inmediatamente (no queda en historial)
        urlParams.delete('__exchange');
        const cleanSearch = urlParams.toString();
        const cleanUrl = window.location.pathname + (cleanSearch ? '?' + cleanSearch : '');
        window.history.replaceState({}, '', cleanUrl);

        try {
            // Consumir el exchange token (JWT firmado de 2 min) y obtener el JWT real
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

    // ── Fallback legacy: token directo en URL (?__t=...) ─────────────────
    // Mantenido por compatibilidad; en producción ya no se genera
    const urlToken = urlParams.get('__t');
    if (urlToken) {
        urlParams.delete('__t');
        const cleanSearch = urlParams.toString();
        const cleanUrl = window.location.pathname + (cleanSearch ? '?' + cleanSearch : '');
        window.history.replaceState({}, '', cleanUrl);

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
        // Sin sesión en subdominio de clínica → redirigir al portal de login
        const loginUrl = getAppLoginUrl();
        if (_getCurrentClinicSlug() && loginUrl) {
            window.location.href = loginUrl;
        }
        return;
    }

    try {
        const saved = JSON.parse(raw);
        if (!saved?.token || !saved?.user) {
            const loginUrl = getAppLoginUrl();
            if (_getCurrentClinicSlug() && loginUrl) {
                window.location.href = loginUrl;
            }
            return;
        }

        // ── Mostrar UI inmediatamente con datos cacheados ──────────────────
        // No esperamos la red: usamos el usuario y los datos guardados en
        // localStorage para mostrar la app al instante. La validación del
        // token y la sincronización ocurren en background.
        state.authToken = saved.token;
        state.user = mapApiUserToLegacyUser(saved.user);
        applyAuthenticatedUiState();

        // ── Validar token + sincronizar en background ──────────────────────
        apiFetch('/auth/me')
            .then(me => {
                saveAuthSession(saved.token, me.user);
                return syncBackendSnapshotToLocalDb();
            })
            .then(() => refreshCurrentView())
            .catch(() => {
                // Token expirado o inválido → cerrar sesión y volver al login
                clearAuthSession();
                views.app.classList.remove('active');
                views.app.classList.add('hidden');
                views.login.classList.remove('hidden');
                views.login.classList.add('active');
                const loginUrl = getAppLoginUrl();
                if (_getCurrentClinicSlug() && loginUrl) window.location.href = loginUrl;
            });
        return;
    } catch (_error) {
        clearAuthSession();
        // Sesión inválida en subdominio de clínica → redirigir al portal de login
        const loginUrl = getAppLoginUrl();
        if (_getCurrentClinicSlug() && loginUrl) {
            window.location.href = loginUrl;
        }
    }
}

/**
 * Calcula la URL de redirección al subdominio de la clínica.
 * Devuelve null si ya estamos en el subdominio correcto o en modo dev.
 */
function buildSubdomainRedirectUrl(clinicSlug, exchangeCode) {
    const hostname = window.location.hostname;
    // Dev/localhost: no redirigir
    if (hostname === 'localhost' || /^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
        return null;
    }
    const parts = hostname.split('.');
    if (parts.length < 2) return null;

    // Extraer dominio base (últimos 2 segmentos: odentara.com)
    const baseDomain = parts.slice(-2).join('.');
    const currentSubdomain = parts.length > 2 ? parts.slice(0, -2).join('.') : null;

    if (currentSubdomain === clinicSlug) return null; // ya en el subdominio correcto

    const proto = window.location.protocol;
    const port  = window.location.port ? `:${window.location.port}` : '';
    // Usa un código de intercambio de corta vida en lugar del JWT completo
    return `${proto}//${clinicSlug}.${baseDomain}${port}?__exchange=${encodeURIComponent(exchangeCode)}`;
}

function getPatientOptionLabel(patient) {
    return `${patient.name} | DNI ${patient.dni}`;
}

// --- Events ---
document.addEventListener('DOMContentLoaded', () => {
    clearTimeout(window.__clinicFallback); // app.js cargó — cancelar fallback de redirección

    ensureThemeControls();
    applyTheme(getStoredTheme(), false);
    applyClinicBranding();
    setupMojibakeAutoRepair();

    const loginForm = document.getElementById('login-form');
    loginForm.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter') return;
        if (isAppLoading()) {
            event.preventDefault();
            return;
        }
        event.preventDefault();
        loginForm.requestSubmit();
    });

    // ── Login setup ──────────────────────────────────────────────────────────────
    const isTurnstileHost = /^app\.odentara\.com$/i.test(location.hostname);
    const submitBtn = document.getElementById('login-submit-btn');

    function showLoginError(msg) {
        const el = document.getElementById('login-error-msg');
        if (!el) return;
        el.textContent = msg;
        el.classList.remove('hidden');
    }
    function clearLoginError() {
        const el = document.getElementById('login-error-msg');
        if (el) el.classList.add('hidden');
    }
    document.getElementById('email')?.addEventListener('input', clearLoginError);
    document.getElementById('password')?.addEventListener('input', clearLoginError);

    // ── Turnstile (solo en app.odentara.com) ─────────────────────────────────────
    if (isTurnstileHost) {
        if (submitBtn) submitBtn.disabled = true;

        // _renderTurnstile limpia e inicia el widget. Se llama en tres momentos:
        //   • Al cargar la página (desde _turnstileOnLoad o el flag de arranque)
        //   • Al hacer logout (desde logout())
        window._renderTurnstile = function() {
            const container = document.getElementById('turnstile-container');
            if (!container || !window.turnstile) return;
            container.innerHTML = '';
            if (submitBtn) submitBtn.disabled = true;
            window.turnstile.render(container, {
                sitekey: '0x4AAAAAADXSH3_I07gUFeOy',
                theme: 'dark',
                callback: function() {
                    if (submitBtn) submitBtn.disabled = false;
                    clearLoginError();
                },
                'expired-callback': function() {
                    if (submitBtn) submitBtn.disabled = true;
                },
            });
        };

        window._turnstileOnLoad = window._renderTurnstile;

        // Si CF terminó de cargar antes que app.js (flag activado por el stub):
        if (window._turnstileReadyFlag) window._renderTurnstile();

    } else {
        if (submitBtn) submitBtn.disabled = false;
    }

    // ── Submit ────────────────────────────────────────────────────────────────────
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (isAppLoading()) return;

        const email    = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;

        if (!email && !password) { showLoginError('Ingresá tu email y contraseña.'); return; }
        if (!email)               { showLoginError('Ingresá tu email.'); return; }
        if (!password)            { showLoginError('Ingresá tu contraseña.'); return; }

        const turnstileInput = document.querySelector('[name="cf-turnstile-response"]');
        if (isTurnstileHost && !turnstileInput?.value) {
            showLoginError('Completá la verificación de seguridad antes de continuar.');
            return;
        }

        clearLoginError();
        if (submitBtn) submitBtn.disabled = true;

        try {
            const turnstileToken = isTurnstileHost ? (turnstileInput?.value || '') : '';
            await withAppLoading('Iniciando sesión...', () => login(email, password, turnstileToken));
        } finally {
            if (isTurnstileHost && window.turnstile) {
                window.turnstile.reset();
                if (submitBtn) submitBtn.disabled = true;
            } else {
                if (submitBtn) submitBtn.disabled = false;
            }
        }
    });

    // ── Forgot / Reset password ──────────────────────────────────────────────────
    function showLoginPanel(panelId) {
        ['login-panel', 'forgot-panel', 'reset-panel', 'clinic-picker-panel'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.classList.toggle('hidden', id !== panelId);
        });
    }

    // Si la URL tiene ?resetToken=xxx, mostrar el formulario de reset
    const urlParams = new URLSearchParams(window.location.search);
    const resetToken = urlParams.get('resetToken');
    if (resetToken) {
        showLoginPanel('reset-panel');
        // Limpiar el token de la URL sin recargar la página
        const cleanUrl = window.location.pathname;
        window.history.replaceState({}, '', cleanUrl);
    }

    // Link "¿Olvidaste tu contraseña?"
    document.getElementById('forgot-password-link')?.addEventListener('click', () => {
        showLoginPanel('forgot-panel');
        document.getElementById('forgot-email')?.focus();
    });

    // Link "← Volver al login" desde forgot panel
    document.getElementById('back-to-login-link')?.addEventListener('click', () => {
        showLoginPanel('login-panel');
    });

    // Botón "Volver al login" desde el mensaje de éxito del forgot
    document.getElementById('forgot-back-btn')?.addEventListener('click', () => {
        document.getElementById('forgot-form')?.classList.remove('hidden');
        document.getElementById('forgot-success')?.classList.add('hidden');
        showLoginPanel('login-panel');
    });

    // Botón "← Volver al login" desde el clinic picker
    document.getElementById('clinic-picker-back-btn')?.addEventListener('click', () => {
        showLoginPanel('login-panel');
    });

    // Botón "Ir al login" desde el mensaje de éxito del reset
    document.getElementById('reset-goto-login-btn')?.addEventListener('click', () => {
        document.getElementById('reset-form')?.classList.remove('hidden');
        document.getElementById('reset-success')?.classList.add('hidden');
        showLoginPanel('login-panel');
    });

    // Formulario de forgot password
    document.getElementById('forgot-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('forgot-email')?.value?.trim();
        const btn = document.getElementById('forgot-submit-btn');
        if (!email || !btn) return;
        btn.disabled = true;
        btn.textContent = 'Enviando...';
        try {
            await apiFetch('/auth/forgot-password', {
                method: 'POST',
                body: JSON.stringify({ email }),
            });
            // Siempre mostramos éxito (el servidor no revela si existe el email)
            document.getElementById('forgot-form')?.classList.add('hidden');
            document.getElementById('forgot-success')?.classList.remove('hidden');
        } catch (_) {
            // Error de red — igual mostramos mensaje genérico
            document.getElementById('forgot-form')?.classList.add('hidden');
            document.getElementById('forgot-success')?.classList.remove('hidden');
        } finally {
            btn.disabled = false;
            btn.textContent = 'Enviar enlace';
        }
    });

    // Formulario de reset password
    document.getElementById('reset-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const password  = document.getElementById('reset-password')?.value;
        const password2 = document.getElementById('reset-password2')?.value;
        const btn = document.getElementById('reset-submit-btn');
        if (!password || !password2 || !btn) return;

        if (password !== password2) {
            alert('Las contraseñas no coinciden.');
            return;
        }
        if (password.length < 8) {
            alert('La contraseña debe tener al menos 8 caracteres.');
            return;
        }

        // Recuperamos el token que guardamos en una variable de closure
        const token = (window.__resetToken__ || '');
        if (!token) {
            alert('Token inválido. Solicitá un nuevo enlace de recuperación.');
            showLoginPanel('login-panel');
            return;
        }

        btn.disabled = true;
        btn.textContent = 'Guardando...';
        try {
            const res = await apiFetch('/auth/reset-password', {
                method: 'POST',
                body: JSON.stringify({ token, password }),
            });
            if (!res.ok) throw new Error(res.error || 'Error');
            window.__resetToken__ = null;
            document.getElementById('reset-form')?.classList.add('hidden');
            document.getElementById('reset-success')?.classList.remove('hidden');
        } catch (err) {
            alert(err.message || 'No se pudo restablecer la contraseña.');
        } finally {
            btn.disabled = false;
            btn.textContent = 'Guardar contraseña';
        }
    });

    // Guardamos el token en una variable global de módulo para el submit del reset
    if (resetToken) window.__resetToken__ = resetToken;

    document.getElementById('logout-btn').addEventListener('click', logout);
    sidebarToggle?.addEventListener('click', () => setSidebarOpen(!state.sidebarOpen));
    sidebarBackdrop?.addEventListener('click', () => setSidebarOpen(false));
    document.getElementById('sidebar-close-btn')?.addEventListener('click', () => setSidebarOpen(false));
    window.addEventListener('resize', syncSidebarLayout);
    setSidebarOpen(!isMobileLayout());
    
    document.addEventListener('click', async (e) => {
        if (e.target.matches('.modal-overlay') || e.target.closest('[data-modal-close]')) closeModal();
        if (e.target.closest('[data-theme-toggle]')) {
            e.preventDefault();
            toggleTheme();
            return;
        }

        // CRUD Routes
        if (e.target.closest('#btn-add-apt')) openAppointmentModal();
        if (e.target.closest('.btn-edit-apt')) openAppointmentModal(parseInt(e.target.closest('.btn-edit-apt').dataset.id));
        if (e.target.closest('.btn-delete-apt')) {
            const aptId = parseInt(e.target.closest('.btn-delete-apt').dataset.id);
            const apt = getAccessibleAppointments().find(item => item.id === aptId);
            if (apt && await showConfirm('¿Eliminar este turno?', { title: 'Eliminar turno', confirmText: 'Eliminar' })) {
                try {
                    await deleteViaApiOrLocal({
                        path: `/appointments/${aptId}`,
                        localTable: 'appointments',
                        localId: aptId
                    });
                    refreshCurrentView();
                } catch (error) {
                    alert(error.message || 'No se pudo eliminar el turno.');
                }
            }
        }
        
        if (e.target.closest('.btn-edit-user')) {
            const userId = parseInt(e.target.closest('.btn-edit-user').dataset.id);
            state.editingUserId = userId;
            state.settingsSubView = 'create-user';
            refreshCurrentView();
        }
        if (e.target.closest('.btn-edit-prof')) {
            const profId = parseInt(e.target.closest('.btn-edit-prof').dataset.id);
            state.editingProfId = profId;
            state.settingsSubView = 'create-professional';
            refreshCurrentView();
        }
        if (e.target.closest('#btn-add-patient') || e.target.closest('#btn-add-patient-empty')) openPatientModal();
        if (e.target.closest('#btn-import-patients') || e.target.closest('#btn-import-patients-empty')) openPatientImportModal();
        if (e.target.closest('.btn-edit-patient')) openPatientModal(parseInt(e.target.closest('.btn-edit-patient').dataset.id));
        if (e.target.closest('.btn-delete-patient')) {
            const patientId = parseInt(e.target.closest('.btn-delete-patient').dataset.id);
            if (!isSuperadmin()) {
                alert('Solo el superadmin puede eliminar pacientes.');
                return;
            }
            if (canAccessPatient(patientId) && await showConfirm('¿Eliminar paciente y su historial?', { title: 'Eliminar paciente', confirmText: 'Eliminar' })) {
                try {
                    if (state.authToken) {
                        await apiFetch(`/patients/${patientId}`, { method: 'DELETE' });
                        await syncBackendSnapshotToLocalDb();
                    } else {
                        DB.archive('patients', patientId);
                    }
                    refreshCurrentView();
                } catch (error) {
                    alert(error.message || 'No se pudo eliminar el paciente.');
                }
            }
        }
        if (e.target.closest('.btn-view-history')) {
            const patientId = parseInt(e.target.closest('.btn-view-history').dataset.id);
            if (!canViewClinicalHistoryUi()) {
                showAlert('El secretario no puede acceder a la historia clínica.', { title: 'Historia clínica', variant: 'error' });
                return;
            }
            if (canAccessPatient(patientId)) loadClinicalHistory(patientId);
        }
        if (e.target.closest('.btn-view-patient-billing')) {
            const patientId = parseInt(e.target.closest('.btn-view-patient-billing').dataset.id);
            if (Number.isInteger(patientId)) {
                if (document.getElementById('patient-billing-picker-results')) {
                    closeModal();
                }
                openPatientBilling(patientId);
            }
        }

        if (!e.target.closest('.stp-wrap')) {
            document.querySelectorAll('.stp-dropdown').forEach(d => { d.hidden = true; });
        }
        if (e.target.closest('#btn-add-tx')) openBillingModal();
        if (e.target.closest('#btn-open-patient-billing')) openPatientBillingPicker();
        if (e.target.closest('#btn-clear-patient-billing')) clearPatientBillingFilter();
        const addMovBtn = e.target.closest('#btn-add-movement-from-account');
        if (addMovBtn) openBillingModal(parseInt(addMovBtn.dataset.patientId));
        if (e.target.closest('.btn-delete-tx')) {
            const txId = parseInt(e.target.closest('.btn-delete-tx').dataset.id);
            // Buscar en local DB (ya sincronizado al cargar la vista)
            const tx = DB.get('billing').find(item => item.id === txId);
            const canAccess = tx ? canAccessProfessional(tx.professionalId) : true; // si no está en local, asumir acceso y dejar que la API rechace
            if (canAccess && await showConfirm('¿Eliminar transacción?', { title: 'Eliminar transacción', confirmText: 'Eliminar' })) {
                try {
                    await deleteViaApiOrLocal({
                        path: `/billing/${txId}`,
                        localTable: 'billing',
                        localId: txId
                    });
                    refreshCurrentView();
                } catch (error) {
                    alert(error.message || 'No se pudo eliminar la transacción.');
                }
            }
        }
        
        if (e.target.closest('.btn-edit-schedule')) {
            const profId = parseInt(e.target.closest('.btn-edit-schedule').dataset.id);
            if (canAccessProfessional(profId)) openScheduleModal(profId);
        }
    });

    // Calendar navigation & filter
    document.addEventListener('click', (e2) => {
        if (e2.target.closest('#cal-prev')) {
            const date = parseLocalIsoDate(calendarState.currentDate);
            if (calendarState.viewMode === 'day') {
                date.setDate(date.getDate() - 1);
            } else if (calendarState.viewMode === 'week') {
                date.setDate(date.getDate() - 7);
            } else if (calendarState.viewMode === 'month') {
                date.setMonth(date.getMonth() - 1);
            }
            calendarState.currentDate = formatDateToLocalIso(date);
            refreshCurrentView();
        }
        if (e2.target.closest('#cal-next')) {
            const date = parseLocalIsoDate(calendarState.currentDate);
            if (calendarState.viewMode === 'day') {
                date.setDate(date.getDate() + 1);
            } else if (calendarState.viewMode === 'week') {
                date.setDate(date.getDate() + 7);
            } else if (calendarState.viewMode === 'month') {
                date.setMonth(date.getMonth() + 1);
            }
            calendarState.currentDate = formatDateToLocalIso(date);
            refreshCurrentView();
        }
        if (e2.target.closest('#cal-view-today')) {
            calendarState.viewMode = 'day';
            calendarState.currentDate = getTodayIsoLocal();
            refreshCurrentView();
        }
        if (e2.target.closest('#cal-view-week')) {
            calendarState.viewMode = 'week';
            refreshCurrentView();
        }
        if (e2.target.closest('#cal-view-month')) {
            calendarState.viewMode = 'month';
            refreshCurrentView();
        }
        const dayJumpTarget = e2.target.closest('[data-calendar-date]');
        if (dayJumpTarget) {
            const nextDate = dayJumpTarget.dataset.calendarDate;
            if (nextDate) {
                calendarState.currentDate = nextDate;
                calendarState.viewMode = 'day';
                refreshCurrentView();
            }
        }
    });

    document.addEventListener('change', (e3) => {
        if (e3.target.id === 'dashboard-date-filter') {
            state.dashboardDate = e3.target.value || getTodayIsoLocal();
            if (state.currentView === 'dashboard') refreshCurrentView();
        }
    });
    document.addEventListener('change', (e2) => {
    });

    document.addEventListener('click', (e4) => {
        const profButton = e4.target.closest('.cal-prof-select');
        if (!profButton) return;
        const id = parseInt(profButton.dataset.id, 10);
        const professionals = getAccessibleProfessionals();
        if (!Number.isFinite(id) || !professionals.some((p) => p.id === id)) return;
        setCalendarProfessionalSelection(professionals, id);
        refreshCurrentView();
    });

    document.addEventListener('keydown', (event) => {
        if (!state.clinicalImageViewer) return;

        if (event.key === 'ArrowLeft') {
            event.preventDefault();
            stepClinicalImageViewer(-1);
        }

        if (event.key === 'ArrowRight') {
            event.preventDefault();
            stepClinicalImageViewer(1);
        }

        if (event.key === 'Escape') {
            event.preventDefault();
            closeModal();
        }
    });

    document.addEventListener('input', (e) => {
        // Auto-generar slug desde nombre en el form de clínica
        if (e.target.id === 'pcf-name') {
            const slugEl = document.getElementById('pcf-slug');
            if (slugEl && !slugEl.disabled) {
                slugEl.value = e.target.value.trim().toLowerCase()
                    .normalize('NFD').replace(/[̀-ͯ]/g, '')
                    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
            }
        }
        // Actualizar preview de URL al tipear nombre o slug
        if (e.target.id === 'pcf-name' || e.target.id === 'pcf-slug') {
            const slugEl = document.getElementById('pcf-slug');
            const preview = document.getElementById('pcf-url-preview');
            if (slugEl && preview) {
                preview.textContent = `${slugEl.value || '______'}.odentara.com`;
            }
        }

        if (e.target.id === 'search-patient') {
            const term = e.target.value.toLowerCase();
            const rows = document.querySelectorAll('#patients-table tbody tr');
            rows.forEach(row => {
                const text = row.innerText.toLowerCase();
                row.style.display = text.includes(term) ? '' : 'none';
            });
        }

        if (e.target.id === 'search-patient-billing-main') {
            syncBillingPatientSearchResults(e.target.value || '');
        }

        if (e.target.id === 'patient-billing-picker-search') {
            syncPatientBillingPickerResults(e.target.value || '');
        }
    });

    document.addEventListener('click', (e) => {
        const settingsButton = e.target.closest('[data-settings-view]');
        if (settingsButton) {
            state.settingsSubView = settingsButton.dataset.settingsView;
            state.editingUserId = null;
            state.editingProfId = null;
            refreshCurrentView();
        }
    });

    document.addEventListener('click', (e) => {
        const billingButton = e.target.closest('[data-billing-view]');
        if (billingButton) {
            state.billingSubView = billingButton.dataset.billingView;
            refreshCurrentView();
        }
        const cajaPeriodBtn = e.target.closest('[data-caja-period]');
        if (cajaPeriodBtn) {
            state.cajaPeriod = cajaPeriodBtn.dataset.cajaPeriod;
            refreshCurrentView();
        }
    });

    document.addEventListener('submit', async (e) => {
        if (e.target.id === 'clinic-settings-form') {
            e.preventDefault();
            const clinicNameInput = document.getElementById('clinic-name');
            const clinicName = String(clinicNameInput?.value || '').trim();

            if (!clinicName) {
                alert('El nombre de la clínica es obligatorio.');
                clinicNameInput?.focus();
                return;
            }

            const colorInputs = Array.from(e.target.querySelectorAll('input[name="clinic-prof-color"]'));
            const professionalColors = {};
            colorInputs.forEach((input, idx) => {
                const profId = parseInt(input.dataset.profId || '', 10);
                if (!Number.isFinite(profId)) return;
                const fallback = PROF_COLORS[idx % PROF_COLORS.length]?.bg || '#6366f1';
                const color = normalizeHexColor(input.value, fallback);
                professionalColors[String(profId)] = color;
                DB.update('professionals', profId, { color });
            });
            saveClinicSettings({
                name: clinicName,
                professionalColors
            });

            applyClinicBranding();
            showToast('Configuración de clínica guardada.', { type: 'success' });
            refreshCurrentView();
            renderSidebar();
            return;
        }

        if (e.target.id === 'new-user-form') {
            e.preventDefault();
            const editingId = parseInt(document.getElementById('u-editing-id')?.value || '', 10);
            const isEditing = Number.isFinite(editingId) && editingId > 0;
            const name     = document.getElementById('u-name').value.trim();
            const email    = document.getElementById('u-email').value.trim();
            const password = document.getElementById('u-password').value;

            if (!name || !email || (!isEditing && !password)) {
                alert(isEditing ? 'Completa nombre y email.' : 'Completa nombre, email y contraseña.');
                return;
            }
            if (password && password.length < 8) {
                alert('La contraseña debe tener al menos 8 caracteres.');
                return;
            }
            const roleNodes = Array.from(document.querySelectorAll('input[name="u-role"]:checked'));
            const roles = roleNodes.map(r => r.value);
            if (roles.length === 0) {
                alert('Selecciona al menos un rol de permisos.');
                return;
            }
            // Derivar tipo visualmente desde los roles seleccionados
            const type = (() => {
                const r = roles.map(c => String(c).toLowerCase());
                if (r.some(c => c === 'superadmin')) return 'superadmin';
                if (r.some(c => c === 'professional' || c === 'profesional')) return 'profesional';
                if (r.some(c => c === 'secretary' || c === 'secretario')) return 'secretario';
                if (r.some(c => c === 'admin' || c === 'administrador')) return 'administrador';
                return 'administrador';
            })();
            const profNodes = Array.from(document.querySelectorAll('input[name="u-profs"]:checked'));
            const selectedProfessionals = profNodes.map(p => parseInt(p.value));
            const hasProfRole = roles.includes('profesional') || roles.includes('professional');
            const linkedProfessionalId = hasProfRole && selectedProfessionals.length > 0 ? selectedProfessionals[0] : null;
            const payload = { fullName: name, email, type, roles, allowedProfessionalIds: selectedProfessionals, linkedProfessionalId };
            if (password) payload.password = password;

            try {
                await withAppLoading(isEditing ? 'Actualizando usuario...' : 'Guardando usuario...', async () => {
                    if (state.authToken) {
                        await apiFetch(isEditing ? `/users/${editingId}` : '/users', {
                            method: isEditing ? 'PUT' : 'POST',
                            body: JSON.stringify(payload)
                        });
                        await syncBackendSnapshotToLocalDb();
                    } else if (isEditing) {
                        DB.update('users', editingId, { name, email, ...(password ? { password } : {}), type, roles, allowedProfessionals: selectedProfessionals });
                    } else {
                        DB.add('users', { name, email, password, type, roles, allowedProfessionals: selectedProfessionals });
                    }
                });
                state.editingUserId = null;
                e.target.reset();
                showToast(isEditing ? 'Usuario actualizado correctamente.' : 'Usuario creado correctamente.', { type: 'success' });
            } catch (error) {
                const detail = error.payload?.detail ? `\n\nDetalle: ${error.payload.detail}` : '';
                alert((error.message || (isEditing ? 'No se pudo actualizar el usuario.' : 'No se pudo crear el usuario.')) + detail);
            }
            refreshCurrentView();
        }

        if (e.target.id === 'new-prof-form') {
            e.preventDefault();
            const editingId = parseInt(document.getElementById('p-editing-id')?.value || '', 10);
            const isEditing = Number.isFinite(editingId) && editingId > 0;
            const name      = document.getElementById('p-name').value.trim();
            const lastName  = document.getElementById('p-lastname').value.trim();
            const specialty = document.getElementById('p-specialty').value.trim();
            const phone     = document.getElementById('p-phone').value.trim();
            const email     = document.getElementById('p-email').value.trim();
            const status    = document.getElementById('p-status').value;

            if (!name || !lastName || !specialty) {
                alert('Nombre, apellido y especialidad son obligatorios para un profesional.');
                return;
            }
            const payload = { fullName: `${name} ${lastName}`.trim(), specialty, phone, email, active: (status || 'activo') === 'activo' };

            try {
                await withAppLoading(isEditing ? 'Actualizando profesional...' : 'Guardando profesional...', async () => {
                    if (state.authToken) {
                        await apiFetch(isEditing ? `/professionals/${editingId}` : '/professionals', {
                            method: isEditing ? 'PUT' : 'POST',
                            body: JSON.stringify(payload)
                        });
                        await syncBackendSnapshotToLocalDb();
                    } else if (isEditing) {
                        DB.update('professionals', editingId, { name: `${name} ${lastName}`, firstName: name, lastName, specialty, phone, email, status: status || 'activo', active: status === 'activo' });
                    } else {
                        DB.add('professionals', { name: `${name} ${lastName}`, firstName: name, lastName, specialty, phone, email, status: status || 'activo', schedule: { 1:{active:true,start:'08:00',end:'16:00'}, 2:{active:true,start:'08:00',end:'16:00'}, 3:{active:true,start:'08:00',end:'16:00'}, 4:{active:true,start:'08:00',end:'16:00'}, 5:{active:true,start:'08:00',end:'16:00'}, 6:{active:false,start:'',end:''}, 0:{active:false,start:'',end:''} } });
                    }
                });
                state.editingProfId = null;
                e.target.reset();
                showToast(isEditing ? 'Profesional actualizado correctamente.' : 'Profesional creado correctamente.', { type: 'success' });
            } catch (error) {
                alert(error.message || (isEditing ? 'No se pudo actualizar el profesional.' : 'No se pudo crear el profesional.'));
            }
            refreshCurrentView();
        }
    });

    window.addEventListener('beforeunload', (event) => {
        if (!hasUnsavedClinicalDraft()) return;
        event.preventDefault();
        event.returnValue = '';
    });

    // Si viene con ?__exchange=, ocultar el login inmediatamente para evitar
    // el flash del formulario mientras el loading overlay todavía no cargó.
    if (new URLSearchParams(location.search).has('__exchange')) {
        views.login?.classList.add('hidden');
        views.login?.classList.remove('active');
    }

    withAppLoading('Iniciando sesión...', async () => {
        await tryRestoreSession();
    });
});

// --- Auth ---
const ROLE_LABELS_ES = { superadmin: 'Superadmin', admin: 'Administrador', secretary: 'Secretario', professional: 'Profesional' };

function renderClinicPicker(clinics, sessionToken) {
    const list = document.getElementById('clinic-picker-list');
    if (!list) return;
    list.innerHTML = '';
    clinics.forEach(clinic => {
        const roleLabels = (clinic.roles || []).map(r => ROLE_LABELS_ES[r] || r).join(', ');
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'clinic-picker-card';
        btn.innerHTML = `
            <div class="clinic-picker-icon"><i class="fa-solid fa-hospital"></i></div>
            <div class="clinic-picker-info">
                <div class="clinic-picker-name">${escapeHtml(clinic.clinicName)}</div>
                <div class="clinic-picker-roles">${escapeHtml(roleLabels)}</div>
            </div>
            <i class="fa-solid fa-chevron-right clinic-picker-arrow"></i>`;
        btn.addEventListener('click', () => selectClinic(clinic.userId, sessionToken, clinic.clinicSlug));
        list.appendChild(btn);
    });
    // Mostrar el panel picker
    ['login-panel', 'forgot-panel', 'reset-panel'].forEach(id => {
        document.getElementById(id)?.classList.add('hidden');
    });
    document.getElementById('clinic-picker-panel')?.classList.remove('hidden');
}

async function selectClinic(userId, sessionToken, clinicSlug) {
    try {
        // Deshabilitar todas las tarjetas mientras carga
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
                const port = window.location.port ? `:${window.location.port}` : '';
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

        // Limpiar cualquier backup de plataforma previo para evitar que se muestre
        // el banner "Modo vista clínica" cuando el usuario inicia sesión directamente
        localStorage.removeItem('odentara_platform_auth_backup');

        // ── Selector de clínica (email en múltiples clínicas) ────────────────
        if (result.requiresClinicSelection) {
            renderClinicPicker(result.clinics, result.sessionToken);
            return;
        }

        // ── Redirección a subdominio de clínica ──────────────────────────────
        if (result.clinicSlug) {
            // Guardar token temporalmente para poder llamar al exchange endpoint
            state.authToken = result.token;
            let exchangeCode = null;
            try {
                const exRes = await apiFetch('/auth/exchange', { method: 'POST' });
                if (exRes.ok) exchangeCode = exRes.code;
            } catch (_) { /* ignorar — si falla no redirigimos */ }

            const redirectUrl = exchangeCode
                ? buildSubdomainRedirectUrl(result.clinicSlug, exchangeCode)
                : null;

            if (redirectUrl) {
                window.location.href = redirectUrl;
                return; // la página se recarga; no hacer más nada
            }

            // Si no hay redirectUrl significa que ya estamos en el subdominio correcto
            // o que el exchange falló (probablemente estamos en el subdominio equivocado).
            // Verificar que estemos en el dominio correcto antes de guardar la sesión.
            const currentClinicSlug = _getCurrentClinicSlug();
            if (currentClinicSlug && currentClinicSlug !== result.clinicSlug) {
                // Estamos en la clínica equivocada — redirigir directamente
                // (el exchange falló, pero podemos intentar la URL sin código de intercambio)
                const hostname = window.location.hostname;
                const parts = hostname.split('.');
                const baseDomain = parts.slice(-2).join('.');
                const proto = window.location.protocol;
                const port = window.location.port ? `:${window.location.port}` : '';
                window.location.href = `${proto}//${result.clinicSlug}.${baseDomain}${port}`;
                return;
            }
        } else {
            // Usuario sin clínica (superadmin de seed, plataforma, etc.)
            // Si estamos en un subdominio de clínica, redirigir al dominio raíz
            const currentClinicSlug = _getCurrentClinicSlug();
            if (currentClinicSlug) {
                const hostname = window.location.hostname;
                const parts = hostname.split('.');
                const baseDomain = parts.slice(-2).join('.');
                const proto = window.location.protocol;
                const port = window.location.port ? `:${window.location.port}` : '';
                window.location.href = `${proto}//${baseDomain}${port}`;
                return;
            }
        }

        saveAuthSession(result.token, result.user);
        applyAuthenticatedUiState();
        // Sync en background para no bloquear la UI durante el login
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
    // Revocar el token server-side (fire-and-forget; no bloquea el logout local)
    if (state.authToken) {
        try { await apiFetch('/auth/logout', { method: 'POST' }); } catch (_) {}
    }
    clearAuthSession();
    state.dashboardDate = null;

    // En subdominio de clínica → redirigir al portal de login (app.odentara.com)
    const loginUrl = getAppLoginUrl();
    if (_getCurrentClinicSlug() && loginUrl) {
        window.location.href = loginUrl;
        return;
    }

    // En app.odentara.com o localhost → volver al login en el lugar
    setSidebarOpen(false);
    applyTheme('dark', false);
    views.app.classList.remove('active');
    setTimeout(() => {
        views.app.classList.add('hidden');
        views.login.classList.remove('hidden');
        setTimeout(() => {
            views.login.classList.add('active');
            window._renderTurnstile?.(); // re-renderizar widget (quedó inválido mientras estaba oculto)
        }, 10);
    }, 250);
}

// --- Navigation ---
function renderSidebar() {
    const sidebarNav = document.getElementById('sidebar-nav');
    sidebarNav.innerHTML = '';

    // ── Banner "Volver a plataforma" cuando se está impersonando ─────────────
    const platformBackup = localStorage.getItem('odentara_platform_auth_backup');
    if (platformBackup && !isSelfPlatformAdmin()) {
        const banner = document.createElement('div');
        banner.className = 'pa-impersonate-banner';
        banner.innerHTML = `
            <span><i class="fa-solid fa-eye" style="margin-right:5px;font-size:10px"></i>Modo vista clínica</span>
            <button onclick="window.returnToPlatform()" title="Volver al panel de plataforma">
                <i class="fa-solid fa-arrow-left"></i> Plataforma
            </button>`;
        sidebarNav.appendChild(banner);
    }

    // ── Platform Admin: menú propio ──────────────────────────────────────────
    if (isSelfPlatformAdmin()) {
        const PLATFORM_NAV = [
            { id: 'platform-clinics', icon: 'fa-hospital',   label: 'Clínicas' },
            { id: 'platform-stats',   icon: 'fa-chart-bar',  label: 'Estadísticas' },
        ];
        PLATFORM_NAV.forEach(item => {
            const link = document.createElement('a');
            link.className = `nav-item ${item.id === state.currentView ? 'active' : ''}`;
            link.dataset.view = item.id;
            link.innerHTML = `<i class="fa-solid ${item.icon} w-5 text-center"></i> <span>${item.label}</span>`;
            link.addEventListener('click', async (e) => {
                e.preventDefault();
                await loadView(item.id, item.label);
                if (isMobileLayout()) setSidebarOpen(false);
            });
            sidebarNav.appendChild(link);
        });
        return;
    }

    const SETTINGS_SUB_ITEMS = [
        { id: 'clinic-settings',      icon: 'fa-hospital',     label: 'Clínica' },
        { id: 'create-user',          icon: 'fa-user-plus',    label: 'Crear usuario' },
        { id: 'create-professional',  icon: 'fa-user-doctor',  label: 'Crear profesional' },
        { id: 'users-list',           icon: 'fa-users-gear',   label: 'Usuarios existentes' },
        { id: 'professionals-list',   icon: 'fa-address-card', label: 'Profesionales existentes' },
    ];

    const BILLING_SUB_ITEMS = [
        { id: 'movements', icon: 'fa-clock-rotate-left', label: 'Últimos movimientos' },
        { id: 'accounts',  icon: 'fa-wallet',            label: 'Cuentas corrientes' },
    ];

    // Collect unique navItems from all user roles
    // Orden maestro fijo + label del rol con mayor privilegio
    const NAV_ORDER = ['dashboard', 'appointments', 'patients', 'professionals', 'billing', 'settings'];
    const ROLE_PRIORITY = ['superadmin', 'admin', 'secretary', 'professional'];
    const navItems = new Map();
    // Procesar de menor a mayor privilegio para que el de mayor privilego sobreescriba el label
    [...ROLE_PRIORITY].reverse().forEach(role => {
        if (!state.user.roles.includes(role)) return;
        if (roleConfig[role]) {
            roleConfig[role].navItems.forEach(item => {
                navItems.set(item.id, item);
            });
        }
    });
    // Reordenar según orden maestro
    const sortedNavItems = NAV_ORDER
        .filter(id => navItems.has(id))
        .map(id => navItems.get(id))
        .concat(Array.from(navItems.values()).filter(item => !NAV_ORDER.includes(item.id)));

    sortedNavItems.forEach(item => {
        const link = document.createElement('a');
        link.className = `nav-item ${item.id === state.currentView ? 'active' : ''}`;
        link.dataset.view = item.id;
        link.innerHTML = `<i class="fa-solid ${item.icon} w-5 text-center"></i> <span>${item.label}</span>`;

        link.addEventListener('click', async (e) => {
            e.preventDefault();
            const loaded = await loadView(item.id, item.label);
            if (!loaded) return;
            if (isMobileLayout()) setSidebarOpen(false);
        });
        sidebarNav.appendChild(link);

        if (item.id === 'settings' && state.currentView === 'settings') {
            const _isAdminNav = state.user.roles.some(r => ['superadmin', 'admin'].includes(r));
            const _adminOnlyItems = new Set(['create-user', 'create-professional', 'users-list', 'professionals-list']);
            SETTINGS_SUB_ITEMS.filter(sub => _isAdminNav || !_adminOnlyItems.has(sub.id)).forEach(sub => {
                const subLink = document.createElement('a');
                subLink.className = `nav-sub-item ${sub.id === state.settingsSubView ? 'active' : ''}`;
                subLink.dataset.settingsView = sub.id;
                subLink.innerHTML = `<i class="fa-solid ${sub.icon}"></i><span>${sub.label}</span>`;
                if (isMobileLayout()) subLink.addEventListener('click', () => setSidebarOpen(false));
                sidebarNav.appendChild(subLink);
            });
        }

        if (item.id === 'billing' && state.currentView === 'billing') {
            BILLING_SUB_ITEMS.forEach(sub => {
                const subLink = document.createElement('a');
                subLink.className = `nav-sub-item ${sub.id === state.billingSubView ? 'active' : ''}`;
                subLink.dataset.billingView = sub.id;
                subLink.innerHTML = `<i class="fa-solid ${sub.icon}"></i><span>${sub.label}</span>`;
                if (isMobileLayout()) subLink.addEventListener('click', () => setSidebarOpen(false));
                sidebarNav.appendChild(subLink);
            });
        }
    });
}

function refreshCurrentView() {
    // skipSync: true porque las mutaciones que llaman a refreshCurrentView ya hicieron su propio sync
    loadView(state.currentView, getPageTitle(), { skipUnsavedCheck: true, skipSync: true });
}

// Normalizes locale date strings to consistent sentence case.
// On Windows, toLocaleDateString('es-AR') returns title-cased strings
// like "Jueves, 14 De Mayo De 2026". This converts to "Jueves, 14 de mayo de 2026".

async function loadView(viewId, title = 'Dashboard', options = {}) {
    const navId = ++_loadViewSeq;

    if (!options.skipUnsavedCheck && viewId !== 'patient-history' && !(await confirmClinicalDraftExit())) {
        renderSidebar();
        return false;
    }

    // Guard: bloquear vistas no permitidas para el rol actual
    const viewGuards = {
        appointments:      () => canViewAppointmentsUi(),
        professionals:     () => state.user && state.user.roles.some(r => ['superadmin', 'secretary', 'professional'].includes(r)),
        billing:           () => canViewBillingUi() || canViewPatientBillingUi(),
        settings:          () => canAccessSettingsUi(),
        'patient-history': () => canViewClinicalHistoryUi()
    };
    if (viewGuards[viewId] && !viewGuards[viewId]()) {
        showAlert('No tenés permisos para acceder a esta sección.', { title: 'Acceso denegado', variant: 'error' });
        // Fallback: primero dashboard, si tampoco pasa el guard → patients
        viewId = 'dashboard';
        title  = 'Dashboard';
    }

    state.currentView = viewId;
    setPageTitle(title);
    // Cerrar cualquier menú de estado abierto antes de limpiar el DOM
    _closeStatusMenu();
    mainContent.innerHTML = '';
    syncSidebarLayout();

    // Sincronizar datos frescos desde la API antes de renderizar cualquier vista,
    // excepto cuando el llamador ya hizo un sync (e.g. post-mutación via refreshCurrentView).
    if (state.authToken && !options.skipSync) {
        try {
            await syncBackendSnapshotToLocalDb();
        } catch (_err) {
            // Si falla la sincronización, se renderiza con los datos cacheados
        }
    }

    // Si mientras esperaba el sync se inició otra navegación, esta ya está obsoleta
    if (navId !== _loadViewSeq) return false;

    const content = document.createElement('div');
    content.className = 'animate-fade-in';

    if (viewId === 'platform-clinics') {
        // Si hay backup de sesión de plataforma pendiente de restaurar, restaurarlo antes
        if (!isSelfPlatformAdmin()) {
            const backup = localStorage.getItem('odentara_platform_auth_backup');
            if (backup) {
                try {
                    const auth = JSON.parse(backup);
                    if (auth?.token && auth?.user?.isPlatformAdmin) {
                        localStorage.setItem('odentara_auth_v1', backup);
                        state.user = mapApiUserToLegacyUser(auth.user);
                        state.authToken = auth.token;
                        localStorage.removeItem('odentara_platform_auth_backup');
                    }
                } catch(_) {}
            }
        }
        applyPlatformTheme(true);
        content.innerHTML = '<div style="height:100%;background:#0f1117"></div>';
        mainContent.appendChild(content);
        renderPlatformClinics(content);
        return true;
    } else if (viewId === 'platform-subscriptions') {
        applyPlatformTheme(true);
        content.innerHTML = '<div style="height:100%;background:#0f1117"></div>';
        mainContent.appendChild(content);
        renderPlatformSubscriptions(content);
        return true;
    } else if (viewId === 'platform-stats') {
        applyPlatformTheme(true);
        content.innerHTML = '<div style="height:100%;background:#0f1117"></div>';
        mainContent.appendChild(content);
        renderPlatformStats(content);
        return true;
    } else {
        applyPlatformTheme(false);
    }

    if (viewId === 'dashboard') content.innerHTML = renderDashboard();
    else if (viewId === 'appointments') {
        try { content.innerHTML = renderAppointments(); }
        catch(e) { console.error('[renderAppointments]', e); content.innerHTML = `<div class="card p-6" style="color:var(--danger)"><b>Error al renderizar turnos:</b> ${e.message}</div>`; }
    }
    else if (viewId === 'professionals') content.innerHTML = renderProfessionals();
    else if (viewId === 'patients') content.innerHTML = renderPatients();
    else if (viewId === 'billing') content.innerHTML = renderBilling();
    else if (viewId === 'settings') content.innerHTML = renderSettingsSubpages();
    else if (viewId === 'patient-history') content.innerHTML = ''; // Se inyecta después por loadClinicalHistory
    else content.innerHTML = renderPlaceholder(viewId);

    mainContent.appendChild(content);
    renderSidebar();
    return true;
}

// ══════════════════════════════════════════════════════════════════════════════
// ULTRA-ADMIN (PLATFORM) VIEWS
// ══════════════════════════════════════════════════════════════════════════════

// Inyecta los estilos propios del ultra-admin (dark theme, completamente distinto al SPA clínico)
function injectPlatformStyles() {
    if (document.getElementById('platform-admin-styles')) return;
    const style = document.createElement('style');
    style.id = 'platform-admin-styles';
    style.textContent = `
        /* ── Anula los !important del SPA cuando el modo plataforma está activo ── */
        body.pa-mode #main-content,
        body.pa-mode #app-view main { background: #0f1117 !important; padding: 0 !important; }
        /* ── Layout ultra-admin ── */
        .pa-root { display:flex; flex-direction:column; min-height:100vh; background:#0f1117; color:#e2e8f0; font-family:'Inter',system-ui,sans-serif; }
        .pa-topbar { display:flex; align-items:center; justify-content:space-between; padding:0 24px; height:52px; background:#161b27; border-bottom:1px solid #1e2535; flex-shrink:0; }
        .pa-topbar-brand { display:flex; align-items:center; gap:10px; font-size:13px; font-weight:700; letter-spacing:.12em; text-transform:uppercase; color:#94a3b8; }
        .pa-topbar-brand .pa-diamond { width:22px; height:22px; background:linear-gradient(135deg,#6366f1,#8b5cf6); border-radius:5px; display:flex; align-items:center; justify-content:center; font-size:10px; color:#fff; font-weight:900; }
        .pa-topbar-right { display:flex; align-items:center; gap:16px; font-size:12px; color:#64748b; }
        .pa-topbar-right span { color:#94a3b8; }
        .pa-topbar-logout { background:none; border:1px solid #1e2535; border-radius:6px; padding:5px 12px; font-size:11px; color:#64748b; cursor:pointer; transition:all .15s; }
        .pa-topbar-logout:hover { border-color:#334155; color:#94a3b8; }

        /* ── Body split ── */
        .pa-body { display:flex; flex:1; min-height:0; }
        .pa-sidebar { width:200px; flex-shrink:0; background:#0d1119; border-right:1px solid #1e2535; padding:20px 0; display:flex; flex-direction:column; gap:2px; }
        .pa-nav-item { display:flex; align-items:center; gap:10px; padding:9px 20px; font-size:12px; color:#475569; cursor:pointer; border-left:2px solid transparent; transition:all .12s; letter-spacing:.02em; }
        .pa-nav-item:hover { color:#94a3b8; background:#161b27; }
        .pa-nav-item.active { color:#a5b4fc; border-left-color:#6366f1; background:#1a1f2e; }
        .pa-nav-item i { width:14px; text-align:center; font-size:11px; }
        .pa-nav-section { font-size:9px; font-weight:700; letter-spacing:.12em; text-transform:uppercase; color:#1e2535; padding:16px 20px 6px; }

        /* ── Main content ── */
        .pa-main { flex:1; overflow-y:auto; padding:28px 32px; }
        .pa-page-header { margin-bottom:24px; border-bottom:1px solid #1e2535; padding-bottom:20px; display:flex; align-items:flex-start; justify-content:space-between; gap:16px; }
        .pa-page-title { font-size:16px; font-weight:700; color:#f1f5f9; letter-spacing:-.01em; }
        .pa-page-sub { font-size:12px; color:#475569; margin-top:3px; font-family:'JetBrains Mono','Fira Mono',monospace; }

        /* ── Botones ── */
        .pa-btn { display:inline-flex; align-items:center; gap:7px; padding:8px 16px; border-radius:7px; font-size:12px; font-weight:600; cursor:pointer; border:none; transition:all .15s; letter-spacing:.01em; }
        .pa-btn-primary { background:#6366f1; color:#fff; }
        .pa-btn-primary:hover { background:#4f46e5; }
        .pa-btn-ghost { background:transparent; border:1px solid #1e2535; color:#64748b; }
        .pa-btn-ghost:hover { border-color:#334155; color:#94a3b8; }
        .pa-btn-danger { background:#7f1d1d; color:#fca5a5; }
        .pa-btn-danger:hover { background:#991b1b; }
        .pa-btn-sm { padding:5px 10px; font-size:11px; }
        .pa-btn-icon { padding:6px 9px; }

        /* ── Tabla de clínicas ── */
        .pa-table-wrap { background:#0d1119; border:1px solid #1e2535; border-radius:10px; overflow:hidden; }
        .pa-table { width:100%; border-collapse:collapse; font-size:12px; }
        .pa-table thead tr { background:#111520; border-bottom:1px solid #1e2535; }
        .pa-table thead th { padding:10px 16px; text-align:left; font-size:10px; font-weight:700; letter-spacing:.1em; text-transform:uppercase; color:#334155; }
        .pa-table tbody tr { border-bottom:1px solid #111520; transition:background .1s; }
        .pa-table tbody tr:last-child { border-bottom:none; }
        .pa-table tbody tr:hover { background:#111824; }
        .pa-table td { padding:14px 16px; vertical-align:middle; }
        .pa-table .td-name { font-weight:600; color:#e2e8f0; }
        .pa-table .td-url { font-family:'JetBrains Mono','Fira Mono',monospace; font-size:11px; color:#6366f1; }
        .pa-table .td-meta { font-size:11px; color:#475569; }
        .pa-table .td-actions { display:flex; gap:6px; justify-content:flex-end; }

        /* ── Badges ── */
        .pa-badge { display:inline-flex; align-items:center; gap:5px; padding:3px 8px; border-radius:20px; font-size:10px; font-weight:700; letter-spacing:.04em; text-transform:uppercase; }
        .pa-badge-active   { background:#052e16; color:#4ade80; border:1px solid #14532d; }
        .pa-badge-inactive { background:#1c1917; color:#78716c; border:1px solid #292524; }
        .pa-badge-shared   { background:#0c1a2e; color:#93c5fd; border:1px solid #1e3a5f; }
        .pa-badge-dedicated{ background:#1a0a2e; color:#c084fc; border:1px solid #3b1a5f; }
        .pa-badge-plan-inicial { background:#0a1f2e; color:#38bdf8; border:1px solid #0c4a6e; }
        .pa-badge-plan-clinica { background:#0f2d1a; color:#4ade80; border:1px solid #14532d; }
        .pa-badge-plan-pro     { background:#1e1a0a; color:#fbbf24; border:1px solid #78350f; }
        .pa-dot { width:6px; height:6px; border-radius:50%; display:inline-block; }
        .pa-dot-green { background:#22c55e; box-shadow:0 0 6px #22c55e66; }
        .pa-dot-gray { background:#44403c; }
        .pa-status-light { width:10px; height:10px; border-radius:50%; display:inline-block; flex-shrink:0; }
        .pa-status-light-on  { background:#22c55e; box-shadow:0 0 8px #22c55e99; }
        .pa-status-light-off { background:#ef4444; box-shadow:0 0 6px #ef444466; }

        /* ── Stats cards ── */
        .pa-stats-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(160px,1fr)); gap:12px; margin-bottom:24px; }
        .pa-stat-card { background:#0d1119; border:1px solid #1e2535; border-radius:10px; padding:18px 20px; }
        .pa-stat-label { font-size:10px; font-weight:700; letter-spacing:.1em; text-transform:uppercase; color:#334155; margin-bottom:8px; }
        .pa-stat-value { font-size:28px; font-weight:800; color:#f1f5f9; letter-spacing:-.02em; }
        .pa-stat-sub { font-size:11px; color:#475569; margin-top:3px; }

        /* ── Modal ultra-admin ── */
        .pa-modal-overlay { position:fixed; inset:0; background:rgba(0,0,0,.75); backdrop-filter:blur(4px); z-index:9999; display:flex; align-items:flex-start; justify-content:center; padding:20px; overflow-y:auto; }
        .pa-modal-overlay.hidden { display:none; }
        .pa-modal { background:#111520; border:1px solid #1e2535; border-radius:12px; width:100%; max-width:520px; overflow:hidden; display:flex; flex-direction:column; max-height:calc(100vh - 40px); margin:auto; }
        .pa-modal-header { display:flex; align-items:center; justify-content:space-between; padding:18px 22px; border-bottom:1px solid #1e2535; flex-shrink:0; }
        .pa-modal-title { font-size:14px; font-weight:700; color:#f1f5f9; }
        .pa-modal-close { background:none; border:none; color:#475569; cursor:pointer; padding:4px; font-size:14px; border-radius:4px; }
        .pa-modal-close:hover { color:#94a3b8; background:#1e2535; }
        .pa-modal-body { padding:22px; overflow-y:auto; flex:1; }
        .pa-modal-footer { display:flex; justify-content:flex-end; gap:8px; padding:16px 22px; border-top:1px solid #1e2535; background:#0d1119; flex-shrink:0; }

        /* ── Form ultra-admin ── */
        .pa-form-group { margin-bottom:16px; }
        .pa-form-row { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
        .pa-label { display:block; font-size:11px; font-weight:600; color:#475569; margin-bottom:5px; letter-spacing:.04em; text-transform:uppercase; }
        .pa-label .req { color:#6366f1; margin-left:2px; }
        .pa-input { width:100%; background:#0d1119; border:1px solid #1e2535; border-radius:7px; padding:9px 12px; font-size:12px; color:#e2e8f0; outline:none; transition:border .15s; box-sizing:border-box; }
        .pa-input:focus { border-color:#4f46e5; box-shadow:0 0 0 3px rgba(99,102,241,.15); }
        .pa-input::placeholder { color:#334155; }
        .pa-input.mono { font-family:'JetBrains Mono','Fira Mono',monospace; font-size:11px; }
        .pa-select { width:100%; background:#0d1119; border:1px solid #1e2535; border-radius:7px; padding:9px 12px; font-size:12px; color:#e2e8f0; outline:none; cursor:pointer; box-sizing:border-box; }
        .pa-select:focus { border-color:#4f46e5; }
        .pa-hint { font-size:10px; color:#334155; margin-top:4px; line-height:1.5; }
        .pa-db-section { background:#0a0d14; border:1px solid #1a2030; border-radius:8px; padding:14px; margin-top:4px; }
        .pa-db-section-title { font-size:10px; font-weight:700; letter-spacing:.08em; text-transform:uppercase; color:#475569; margin-bottom:10px; }

        /* ── Empty state ── */
        .pa-empty { text-align:center; padding:60px 20px; color:#334155; }
        .pa-empty i { font-size:36px; margin-bottom:12px; display:block; }
        .pa-empty p { font-size:13px; }

        /* ── Users list ── */
        .pa-users-list { max-height:320px; overflow-y:auto; }
        .pa-user-row { display:flex; align-items:center; justify-content:space-between; padding:10px 14px; border-bottom:1px solid #1e2535; }
        .pa-user-row:last-child { border-bottom:none; }
        .pa-user-name { font-size:12px; font-weight:600; color:#e2e8f0; }
        .pa-user-email { font-size:11px; color:#475569; font-family:monospace; }

        /* ── URL preview ── */
        .pa-url-preview { display:flex; align-items:center; gap:8px; background:#060910; border:1px solid #1e2535; border-radius:6px; padding:8px 12px; margin-top:6px; font-family:'JetBrains Mono','Fira Mono',monospace; font-size:12px; color:#6366f1; }
        .pa-url-preview i { color:#334155; font-size:10px; }
    `;
    document.head.appendChild(style);

    // ESC cierra cualquier modal de plataforma abierto
    document.addEventListener('keydown', function onPlatformEsc(e) {
        if (e.key !== 'Escape') return;
        const clinicModal = document.getElementById('platform-clinic-modal');
        const adminModal  = document.getElementById('platform-admin-modal');
        const usersModal  = document.getElementById('platform-users-modal');
        if (clinicModal && !clinicModal.classList.contains('hidden')) {
            window.platformCloseClinicModal?.(); return;
        }
        if (adminModal && !adminModal.classList.contains('hidden')) {
            window.platformCloseAdminModal?.(); return;
        }
        if (usersModal) {
            usersModal.remove(); return;
        }
    });
}

// Aplica el fondo oscuro al app container mientras el platform admin está activo
function applyPlatformTheme(on) {
    injectPlatformStyles(); // asegura que el <style> esté antes de aplicar la clase
    const sidebar     = document.getElementById('app-sidebar');
    const topbar      = document.querySelector('header');
    const mainContent = document.getElementById('main-content');
    if (on) {
        document.body.classList.add('pa-mode');
        if (sidebar)     sidebar.style.display = 'none';
        if (topbar)      topbar.style.display  = 'none';
        if (mainContent) { mainContent.style.padding = ''; mainContent.style.background = ''; }
    } else {
        document.body.classList.remove('pa-mode');
        if (sidebar)     sidebar.style.display = '';
        if (topbar)      topbar.style.display  = '';
        if (mainContent) { mainContent.style.padding = ''; mainContent.style.background = ''; }
    }
}

async function renderPlatformClinics(container) {
    injectPlatformStyles();

    let clinics = [];
    try {
        const res = await apiFetch('/platform/clinics');
        if (!res.ok) throw new Error(res.error || 'Error');
        clinics = res.clinics || [];
        state._platformClinics = clinics;
    } catch(e) {
        container.innerHTML = `<div class="pa-empty"><i class="fa-solid fa-triangle-exclamation"></i><p>${e.message}</p></div>`;
        return;
    }

    const rows = clinics.length === 0
        ? `<tr><td colspan="8"><div class="pa-empty"><i class="fa-solid fa-hospital"></i><p>No hay clínicas registradas.</p></div></td></tr>`
        : clinics.map(c => {
            const url = `${c.slug}.odentara.com`;
            const dbBadge = c.dbType === 'dedicated'
                ? `<span class="pa-badge pa-badge-dedicated"><i class="fa-solid fa-database" style="font-size:8px"></i>Dedicada</span>`
                : `<span class="pa-badge pa-badge-shared"><i class="fa-solid fa-share-nodes" style="font-size:8px"></i>Compartida</span>`;
            const planBadge = c.plan
                ? `<span class="pa-badge pa-badge-plan-${c.plan}">${c.plan.toUpperCase()}</span>`
                : `<span style="color:#334155;font-size:11px">—</span>`;
            return `
            <tr>
                <td class="td-name">
                    <div>
                        <div style="font-size:13px;font-weight:600;color:#e2e8f0">${c.name}</div>
                        <div style="font-family:'JetBrains Mono','Fira Mono',monospace;font-size:11px;color:#6366f1">${url}</div>
                    </div>
                </td>
                <td style="font-size:12px;color:#94a3b8;max-width:180px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${c.notes ? c.notes.replace(/"/g,'&quot;') : ''}">${c.notes || '<span style="color:#334155">—</span>'}</td>
                <td>${dbBadge}</td>
                <td>${planBadge}</td>
                <td style="font-size:11px;color:#475569">
                    <span title="Usuarios"><i class="fa-solid fa-users" style="width:12px"></i> ${c.stats.users}</span> &nbsp;
                    <span title="Profesionales"><i class="fa-solid fa-user-doctor" style="width:12px"></i> ${c.stats.professionals}</span> &nbsp;
                    <span title="Pacientes"><i class="fa-solid fa-person" style="width:12px"></i> ${c.stats.patients}</span>
                </td>
                <td style="font-size:11px;color:#475569">${new Date(c.createdAt).toLocaleDateString('es-AR')}</td>
                <td>
                    <div style="display:flex;gap:6px;justify-content:flex-end">
                        <button class="pa-btn pa-btn-ghost pa-btn-sm pa-btn-icon" title="Ver usuarios" onclick="window.platformViewUsers(${c.id},'${c.name.replace(/'/g,"\\'")}')"><i class="fa-solid fa-users"></i></button>
                        <button class="pa-btn pa-btn-ghost pa-btn-sm pa-btn-icon" title="Crear admin" onclick="window.platformOpenAdminModal(${c.id})"><i class="fa-solid fa-user-plus"></i></button>
                        <button class="pa-btn pa-btn-ghost pa-btn-sm pa-btn-icon" title="Ingresar como clínica" onclick="window.platformLoginAsClinic(${c.id},'${c.name.replace(/'/g,"\\'")}')"><i class="fa-solid fa-right-to-bracket"></i></button>
                        <button class="pa-btn pa-btn-ghost pa-btn-sm pa-btn-icon" title="Editar" onclick="window.platformEditClinic(${c.id})"><i class="fa-solid fa-pen"></i></button>
                        <button class="pa-btn ${c.active ? 'pa-btn-danger' : 'pa-btn-ghost'} pa-btn-sm pa-btn-icon" title="${c.active ? 'Desactivar' : 'Activar'}" onclick="window.platformToggleClinic(${c.id})">
                            <i class="fa-solid ${c.active ? 'fa-ban' : 'fa-circle-check'}"></i>
                        </button>
                    </div>
                </td>
                <td style="text-align:center;width:32px" title="${c.active ? 'Activa' : 'Inactiva'}">
                    <span class="pa-status-light ${c.active ? 'pa-status-light-on' : 'pa-status-light-off'}"></span>
                </td>
            </tr>`;
        }).join('');

    container.innerHTML = `
    <div class="pa-root">
        ${renderPlatformShell('platform-clinics', `
            <div class="pa-page-header">
                <div>
                    <div class="pa-page-title">Clínicas</div>
                    <div class="pa-page-sub">${clinics.length} instancia${clinics.length !== 1 ? 's' : ''} registrada${clinics.length !== 1 ? 's' : ''}</div>
                </div>
                <button class="pa-btn pa-btn-primary" onclick="window.platformOpenNewClinicModal()">
                    <i class="fa-solid fa-plus"></i> Nueva clínica
                </button>
            </div>

            <div class="pa-table-wrap">
                <table class="pa-table">
                    <thead>
                        <tr>
                            <th>Clínica / URL</th>
                            <th>Notas</th>
                            <th>Base de datos</th>
                            <th>Plan</th>
                            <th>Recursos</th>
                            <th>Creada</th>
                            <th style="text-align:right">Acciones</th>
                            <th style="width:32px"></th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        `)}
    </div>

    ${renderPlatformClinicModal()}
    ${renderPlatformAdminModal()}
    `;
}

async function renderPlatformStats(container) {
    injectPlatformStyles();
    let s = {};
    try {
        const res = await apiFetch('/platform/stats');
        if (!res.ok) throw new Error(res.error);
        s = res.stats;
    } catch(e) {
        container.innerHTML = `<div class="pa-empty"><i class="fa-solid fa-triangle-exclamation"></i><p>${e.message}</p></div>`;
        return;
    }

    container.innerHTML = `
    <div class="pa-root">
        ${renderPlatformShell('platform-stats', `
            <div class="pa-page-header">
                <div>
                    <div class="pa-page-title">Estadísticas</div>
                    <div class="pa-page-sub">Resumen global de la plataforma</div>
                </div>
            </div>

            <div class="pa-stats-grid">
                ${[
                    { label:'Clínicas totales',    value: s.totalClinics,           sub:'instancias',            icon:'fa-hospital',       color:'#6366f1' },
                    { label:'Clínicas activas',    value: s.activeClinics,          sub:'en línea',              icon:'fa-circle-check',   color:'#22c55e' },
                    { label:'Usuarios',            value: s.totalUsers,             sub:'en toda la plataforma', icon:'fa-users',          color:'#60a5fa' },
                    { label:'Pacientes',           value: s.totalPatients,          sub:'registrados',           icon:'fa-person',         color:'#c084fc' },
                    { label:'Profesionales',       value: s.totalProfessionals,     sub:'activos',               icon:'fa-user-doctor',    color:'#fb923c' },
                    { label:'Turnos este mes',     value: s.appointmentsThisMonth,  sub:'en el mes actual',      icon:'fa-calendar-check', color:'#2dd4bf' },
                ].map(m => `
                    <div class="pa-stat-card">
                        <div class="pa-stat-label"><i class="fa-solid ${m.icon}" style="color:${m.color};margin-right:6px"></i>${m.label}</div>
                        <div class="pa-stat-value">${(m.value||0).toLocaleString('es-AR')}</div>
                        <div class="pa-stat-sub">${m.sub}</div>
                    </div>
                `).join('')}
            </div>
        `)}
    </div>`;
}

// ── Cobros de suscripción ─────────────────────────────────────────────────────
async function renderPlatformSubscriptions(container) {
    injectPlatformStyles();

    let data = { clinics: [], payments: [] };
    try {
        const res = await apiFetch('/platform/subscriptions');
        if (res.ok) { data = res; window._platformSubClinics = data.clinics; }
    } catch(e) { console.error(e); }

    const PLAN_AMOUNTS = { inicial: 29, clinica: 49, pro: 89 };
    const PERIOD_LABELS = { '01':'Enero','02':'Febrero','03':'Marzo','04':'Abril','05':'Mayo','06':'Junio','07':'Julio','08':'Agosto','09':'Septiembre','10':'Octubre','11':'Noviembre','12':'Diciembre' };
    function periodLabel(p) { const [y,m] = p.split('-'); return `${PERIOD_LABELS[m]} ${y}`; }
    function now() { return new Date(); }
    const currentPeriod = `${now().getFullYear()}-${String(now().getMonth()+1).padStart(2,'0')}`;

    const rows = data.clinics.filter(c => c.active).map(c => {
        const suggested = PLAN_AMOUNTS[c.plan] || '—';
        let statusBadge, statusSort;
        if (c.currentPaid) {
            statusBadge = `<span class="pa-badge pa-badge-active">✓ Pagado</span>`;
            statusSort = 0;
        } else if (c.isOverdue) {
            statusBadge = `<span class="pa-badge" style="background:#7f1d1d;color:#fca5a5">⚠ Vencido</span>`;
            statusSort = 2;
        } else {
            statusBadge = `<span class="pa-badge" style="background:#78350f;color:#fde68a">Pendiente</span>`;
            statusSort = 1;
        }
        const owed = c.owedPeriods.length;
        const owedBadge = owed > 0
            ? `<span style="color:#f87171;font-size:11px;font-weight:600">${owed} mes${owed!==1?'es':''} adeudado${owed!==1?'s':''}</span>`
            : `<span style="color:#34d399;font-size:11px">Al día</span>`;
        const lastPay = c.lastPayment
            ? `<span style="font-size:11px;color:#94a3b8">USD ${Number(c.lastPayment.amount).toLocaleString()} · ${periodLabel(c.lastPayment.period)}</span>`
            : `<span style="font-size:11px;color:#475569">Sin pagos</span>`;
        return { statusSort, html: `
            <tr>
                <td style="font-size:13px;font-weight:600;color:#e2e8f0">${c.name}</td>
                <td>${c.plan ? `<span class="pa-badge pa-badge-plan-${c.plan}">${c.plan.toUpperCase()}</span>` : '<span style="color:#475569;font-size:11px">Sin plan</span>'}</td>
                <td style="color:#94a3b8;font-size:12px">${suggested !== '—' ? `USD ${suggested}` : '—'}</td>
                <td>${statusBadge}</td>
                <td>${owedBadge}</td>
                <td>${lastPay}</td>
                <td style="text-align:right">
                    <button class="pa-btn pa-btn-primary pa-btn-sm" onclick="window.platformOpenPaymentModal(${c.id},'${c.name.replace(/'/g,"\\'")}','${c.plan||''}')">
                        <i class="fa-solid fa-plus"></i> Registrar pago
                    </button>
                </td>
            </tr>` };
    }).sort((a,b) => b.statusSort - a.statusSort);

    // Historial de pagos
    const historialRows = data.payments.slice(0,50).map(p => {
        const clinic = data.clinics.find(c => c.id === p.clinicId);
        return `<tr>
            <td style="font-size:12px;color:#e2e8f0">${clinic?.name || '—'}</td>
            <td style="font-size:12px;color:#94a3b8">${periodLabel(p.period)}</td>
            <td style="font-size:12px;font-weight:600;color:#34d399">USD ${Number(p.amount).toLocaleString()}</td>
            <td style="font-size:11px;color:#94a3b8">${p.paymentMethod}</td>
            <td style="font-size:11px;color:#475569">${new Date(p.paidAt).toLocaleDateString('es-AR')}</td>
            <td style="font-size:11px;color:#475569">${escapeHtml(p.notes || '—')}</td>
            <td style="text-align:right">
                <button class="pa-btn pa-btn-ghost pa-btn-sm pa-btn-icon" title="Eliminar" style="color:#f87171" onclick="window.platformDeletePayment(${p.id})"><i class="fa-solid fa-trash"></i></button>
            </td>
        </tr>`;
    }).join('');

    const overdueCount = data.clinics.filter(c => c.active && c.isOverdue).length;
    const pendingCount = data.clinics.filter(c => c.active && !c.currentPaid && !c.isOverdue).length;
    const paidCount    = data.clinics.filter(c => c.active && c.currentPaid).length;

    container.innerHTML = `
    <div class="pa-root">
        ${renderPlatformShell('platform-subscriptions', `
            <div class="pa-page-header">
                <div>
                    <div class="pa-page-title">Cobros</div>
                    <div class="pa-page-sub">${periodLabel(currentPeriod)} · ${paidCount} pagado${paidCount!==1?'s':''} · ${pendingCount} pendiente${pendingCount!==1?'s':''} · ${overdueCount} vencido${overdueCount!==1?'s':''}</div>
                </div>
                <button class="pa-btn pa-btn-primary" onclick="window.platformOpenPaymentModal()">
                    <i class="fa-solid fa-plus"></i> Registrar pago
                </button>
            </div>

            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:24px">
                <div style="background:#0f2a1a;border:1px solid #166534;border-radius:10px;padding:16px">
                    <div style="font-size:11px;color:#6ee7b7;text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px">Pagaron este mes</div>
                    <div style="font-size:28px;font-weight:700;color:#34d399">${paidCount}</div>
                </div>
                <div style="background:#2a1f0a;border:1px solid #92400e;border-radius:10px;padding:16px">
                    <div style="font-size:11px;color:#fde68a;text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px">Pendientes (en plazo)</div>
                    <div style="font-size:28px;font-weight:700;color:#fbbf24">${pendingCount}</div>
                </div>
                <div style="background:#2a0f0f;border:1px solid #7f1d1d;border-radius:10px;padding:16px">
                    <div style="font-size:11px;color:#fca5a5;text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px">Vencidos (>10 del mes)</div>
                    <div style="font-size:28px;font-weight:700;color:#f87171">${overdueCount}</div>
                </div>
            </div>

            <div class="pa-table-wrap" style="margin-bottom:32px">
                <div style="font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#475569;padding:0 0 8px">Estado del mes actual</div>
                <table class="pa-table">
                    <thead><tr>
                        <th>Clínica</th><th>Plan</th><th>Monto sugerido</th><th>Estado mes actual</th><th>Deuda acumulada</th><th>Último pago</th><th style="text-align:right">Acción</th>
                    </tr></thead>
                    <tbody>${rows.map(r=>r.html).join('') || '<tr><td colspan="7" style="text-align:center;color:#475569;padding:24px">Sin clínicas activas</td></tr>'}</tbody>
                </table>
            </div>

            <div class="pa-table-wrap">
                <div style="font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#475569;padding:0 0 8px">Historial de pagos</div>
                <table class="pa-table">
                    <thead><tr><th>Clínica</th><th>Período</th><th>Monto</th><th>Método</th><th>Fecha</th><th>Notas</th><th></th></tr></thead>
                    <tbody>${historialRows || '<tr><td colspan="7" style="text-align:center;color:#475569;padding:24px">Sin pagos registrados aún</td></tr>'}</tbody>
                </table>
            </div>
        `)}
    </div>

    <!-- Modal registrar pago -->
    <div id="pa-payment-modal" class="pa-modal-overlay hidden" onclick="if(event.target===this)document.getElementById('pa-payment-modal').classList.add('hidden')">
        <div class="pa-modal" style="max-width:460px">
            <div class="pa-modal-header">
                <span class="pa-modal-title">Registrar pago</span>
                <button class="pa-modal-close" onclick="document.getElementById('pa-payment-modal').classList.add('hidden')"><i class="fa-solid fa-xmark"></i></button>
            </div>
            <div class="pa-modal-body">
                <form id="pa-payment-form" onsubmit="window.platformSavePayment(event)">
                    <div class="pa-form-group">
                        <label class="pa-label">Clínica <span class="req">*</span></label>
                        <select id="ppf-clinic" class="pa-select" required>
                            <option value="">Seleccioná una clínica...</option>
                        </select>
                    </div>
                    <div class="pa-form-row">
                        <div class="pa-form-group">
                            <label class="pa-label">Período <span class="req">*</span></label>
                            <input id="ppf-period" class="pa-input" type="month" required value="${currentPeriod}">
                        </div>
                        <div class="pa-form-group">
                            <label class="pa-label">Fecha de pago <span class="req">*</span></label>
                            <input id="ppf-paidat" class="pa-input" type="date" required value="${new Date().toISOString().slice(0,10)}">
                        </div>
                    </div>
                    <div class="pa-form-row">
                        <div class="pa-form-group">
                            <label class="pa-label">Monto (USD) <span class="req">*</span></label>
                            <input id="ppf-amount" class="pa-input" type="number" min="1" step="0.01" placeholder="49" required>
                        </div>
                        <div class="pa-form-group">
                            <label class="pa-label">Forma de pago <span class="req">*</span></label>
                            <select id="ppf-method" class="pa-select" required>
                                <option value="">Seleccioná...</option>
                                <option value="transferencia">Transferencia</option>
                                <option value="efectivo">Efectivo</option>
                                <option value="tarjeta">Tarjeta</option>
                                <option value="crypto">Crypto</option>
                                <option value="otro">Otro</option>
                            </select>
                        </div>
                    </div>
                    <div class="pa-form-group">
                        <label class="pa-label">Notas</label>
                        <input id="ppf-notes" class="pa-input" placeholder="Opcional">
                    </div>
                </form>
            </div>
            <div class="pa-modal-footer">
                <button class="pa-btn pa-btn-ghost" onclick="document.getElementById('pa-payment-modal').classList.add('hidden')">Cancelar</button>
                <button class="pa-btn pa-btn-primary" onclick="document.getElementById('pa-payment-form').requestSubmit()">
                    <i class="fa-solid fa-check"></i> Guardar pago
                </button>
            </div>
        </div>
    </div>`;
}

window.platformOpenPaymentModal = async function(clinicId, clinicName, plan) {
    const modal = document.getElementById('pa-payment-modal');
    if (!modal) return;

    // Si no hay datos en memoria, hacer fetch fresco
    if (!window._platformSubClinics || window._platformSubClinics.length === 0) {
        try {
            const res = await apiFetch('/platform/subscriptions');
            if (res.ok) window._platformSubClinics = res.clinics || [];
        } catch(e) { console.error('[platformOpenPaymentModal] fetch failed', e); }
    }

    // Poblar el select con las clínicas activas
    const sel = document.getElementById('ppf-clinic');
    if (sel) {
        const clinics = (window._platformSubClinics || []).filter(c => c.active);
        sel.innerHTML = '<option value="">Seleccioná una clínica...</option>' +
            clinics.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
        if (clinicId) sel.value = clinicId;
    }

    const PLAN_AMOUNTS = { inicial: 29, clinica: 49, pro: 89 };
    const amountInput = document.getElementById('ppf-amount');
    if (amountInput && plan && PLAN_AMOUNTS[plan]) amountInput.value = PLAN_AMOUNTS[plan];
    else if (amountInput && clinicId) {
        const c = (window._platformSubClinics || []).find(x => x.id === Number(clinicId));
        if (c?.plan && PLAN_AMOUNTS[c.plan]) amountInput.value = PLAN_AMOUNTS[c.plan];
    }

    modal.classList.remove('hidden');
    sel?.focus();
};

window.platformSavePayment = async function(e) {
    e.preventDefault();
    const btn = e.target.closest('.pa-modal')?.querySelector('.pa-btn-primary') || document.querySelector('#pa-payment-modal .pa-btn-primary');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; }
    try {
        const res = await apiFetch('/platform/subscriptions', {
            method: 'POST',
            body: JSON.stringify({
                clinicId:      Number(document.getElementById('ppf-clinic').value),
                period:        document.getElementById('ppf-period').value,
                amount:        parseFloat(document.getElementById('ppf-amount').value),
                paymentMethod: document.getElementById('ppf-method').value,
                paidAt:        document.getElementById('ppf-paidat').value,
                notes:         document.getElementById('ppf-notes').value,
            }),
        });
        if (!res.ok) throw new Error(res.error || 'Error');
        document.getElementById('pa-payment-modal').classList.add('hidden');
        const content = document.querySelector('.pa-root')?.parentElement;
        if (content) renderPlatformSubscriptions(content);
        else loadView('platform-subscriptions', 'Cobros', { skipSync: true });
    } catch(err) {
        showPlatformAlert(err.message, 'error');
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-check"></i> Guardar pago'; }
    }
};

window.platformDeletePayment = async function(id) {
    if (!await showConfirm('¿Eliminar este registro de pago?', { title: 'Eliminar pago', variant: 'danger', confirmText: 'Eliminar' })) return;
    try {
        const res = await apiFetch(`/platform/subscriptions/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error(res.error);
        loadView('platform-subscriptions', 'Cobros', { skipSync: true });
    } catch(err) {
        showPlatformAlert(err.message, 'error');
    }
};

// Shell HTML compartido (topbar + sidebar + main) del ultra-admin
function renderPlatformShell(activeView, mainHtml) {
    const NAV = [
        { id:'platform-clinics',       icon:'fa-hospital',        label:'Clínicas'      },
        { id:'platform-subscriptions', icon:'fa-dollar-sign',     label:'Cobros'        },
        { id:'platform-stats',         icon:'fa-chart-bar',       label:'Estadísticas'  },
    ];
    const navHtml = NAV.map(n => `
        <div class="pa-nav-item ${n.id === activeView ? 'active' : ''}" onclick="loadView('${n.id}','${n.label}',{skipSync:true})">
            <i class="fa-solid ${n.icon}"></i> ${n.label}
        </div>
    `).join('');

    const user = state.user || {};
    return `
        <div class="pa-topbar">
            <div class="pa-topbar-brand">
                <div class="pa-diamond">◆</div>
                ODENTARA PLATFORM
            </div>
            <div class="pa-topbar-right">
                <span>${user.email || user.name || 'Platform Admin'}</span>
                <button class="pa-topbar-logout" onclick="window.logout()"><i class="fa-solid fa-right-from-bracket" style="font-size:10px;margin-right:4px"></i>Salir</button>
            </div>
        </div>
        <div class="pa-body">
            <div class="pa-sidebar">
                <div class="pa-nav-section">Gestión</div>
                ${navHtml}
            </div>
            <div class="pa-main">${mainHtml}</div>
        </div>
    `;
}

function renderPlatformClinicModal() {
    return `
    <div id="platform-clinic-modal" class="pa-modal-overlay hidden" onclick="if(event.target===this)window.platformCloseClinicModal()">
        <div class="pa-modal">
            <div class="pa-modal-header">
                <span class="pa-modal-title" id="platform-clinic-modal-title">Nueva clínica</span>
                <button class="pa-modal-close" onclick="window.platformCloseClinicModal()"><i class="fa-solid fa-xmark"></i></button>
            </div>
            <div class="pa-modal-body">
                <form id="platform-clinic-form" onsubmit="window.platformSaveClinic(event)">
                    <input type="hidden" id="platform-clinic-id">

                    <div class="pa-form-row">
                        <div class="pa-form-group" style="grid-column:1/-1">
                            <label class="pa-label">Nombre de la clínica <span class="req">*</span></label>
                            <input id="pcf-name" class="pa-input" placeholder="Clínica San Martín" required>
                        </div>
                        <div class="pa-form-group" style="grid-column:1/-1">
                            <label class="pa-label">Notas internas</label>
                            <input id="pcf-notes" class="pa-input" placeholder="Ej: nombre real del dueño, datos de contacto interno...">
                        </div>
                        <div class="pa-form-group" style="grid-column:1/-1">
                            <label class="pa-label">Slug / Subdominio <span class="req">*</span></label>
                            <input id="pcf-slug" class="pa-input mono" placeholder="clinicasanmartin" required>
                            <div class="pa-url-preview"><i class="fa-solid fa-globe"></i><span id="pcf-url-preview">______.odentara.com</span></div>
                            <div class="pa-hint">Solo minúsculas y guiones. No se puede cambiar después de creado.</div>
                        </div>
                    </div>

                    <div class="pa-form-row">
                        <div class="pa-form-group">
                            <label class="pa-label">Teléfono</label>
                            <input id="pcf-phone" class="pa-input" placeholder="+54 261 ...">
                        </div>
                        <div class="pa-form-group">
                            <label class="pa-label">Email</label>
                            <input id="pcf-email" class="pa-input" type="email" placeholder="info@clinica.com">
                        </div>
                        <div class="pa-form-group" style="grid-column:1/-1">
                            <label class="pa-label">Dirección</label>
                            <input id="pcf-address" class="pa-input" placeholder="Av. San Martín 1234, Mendoza">
                        </div>
                        <div class="pa-form-group" style="grid-column:1/-1">
                            <label class="pa-label">Plan</label>
                            <select id="pcf-plan" class="pa-select">
                                <option value="">Sin plan</option>
                                <option value="inicial">Inicial — USD 29/mes (1 profesional)</option>
                                <option value="clinica">Clínica — USD 49/mes (3 profesionales)</option>
                                <option value="pro">Pro — USD 89/mes (ilimitados)</option>
                            </select>
                        </div>
                    </div>

                    <!-- Base de datos -->
                    <div class="pa-form-group">
                        <label class="pa-label">Base de datos</label>
                        <select id="pcf-dbtype" class="pa-select" onchange="window.platformToggleDbUrl()">
                            <option value="shared">Compartida — misma instancia de Odentara</option>
                            <option value="dedicated">Dedicada — URL de conexión personalizada</option>
                        </select>
                        <div class="pa-hint">
                            <b>Compartida:</b> más simple, los datos se aislan por clínica dentro de la misma base. <br>
                            <b>Dedicada:</b> base de datos propia, máximo aislamiento, ideal para clínicas grandes.
                        </div>
                    </div>
                    <div id="pcf-db-url-section" class="pa-db-section" style="display:none">
                        <div class="pa-db-section-title"><i class="fa-solid fa-database" style="margin-right:6px"></i>Conexión dedicada</div>
                        <div class="pa-form-group" style="margin-bottom:0">
                            <label class="pa-label">DATABASE_URL <span class="req">*</span></label>
                            <input id="pcf-dburl" class="pa-input mono" placeholder="mysql://user:pass@host:3306/dbname">
                            <div class="pa-hint">La clínica usará esta conexión de forma exclusiva. Asegurate de que la base exista y esté accesible desde el servidor.</div>
                        </div>
                    </div>

                    <!-- Superadmin inicial (solo al crear) -->
                    <div id="pcf-admin-section" class="pa-db-section" style="margin-top:16px">
                        <div class="pa-db-section-title"><i class="fa-solid fa-user-shield" style="margin-right:6px"></i>Superadmin inicial</div>
                        <div class="pa-hint" style="margin-bottom:12px">Se creará automáticamente con acceso total a esta clínica.</div>
                        <div class="pa-form-row">
                            <div class="pa-form-group" style="grid-column:1/-1">
                                <label class="pa-label">Nombre completo <span class="req">*</span></label>
                                <input id="pcf-admin-name" class="pa-input" placeholder="Dr. Juan García" required>
                            </div>
                            <div class="pa-form-group">
                                <label class="pa-label">Email <span class="req">*</span></label>
                                <input id="pcf-admin-email" class="pa-input" type="email" placeholder="admin@clinica.com" required>
                            </div>
                            <div class="pa-form-group">
                                <label class="pa-label">Contraseña inicial <span class="req">*</span></label>
                                <div style="position:relative">
                                    <input id="pcf-admin-pass" class="pa-input" type="password" value="odentara123" required style="padding-right:38px">
                                    <button type="button" onclick="const i=document.getElementById('pcf-admin-pass');i.type=i.type==='password'?'text':'password';this.querySelector('i').className='fa-solid '+(i.type==='password'?'fa-eye':'fa-eye-slash')" style="position:absolute;right:10px;top:50%;transform:translateY(-50%);background:none;border:none;color:#94a3b8;cursor:pointer;padding:2px"><i class="fa-solid fa-eye"></i></button>
                                </div>
                            </div>
                        </div>
                    </div>
                </form>
            </div>
            <div class="pa-modal-footer">
                <button class="pa-btn pa-btn-ghost" onclick="window.platformCloseClinicModal()">Cancelar</button>
                <button id="pcf-submit-btn" class="pa-btn pa-btn-primary" onclick="document.getElementById('platform-clinic-form').requestSubmit()">
                    <i class="fa-solid fa-check"></i> Crear clínica
                </button>
            </div>
        </div>
    </div>`;
}

function renderPlatformAdminModal() {
    return `
    <div id="platform-admin-modal" class="pa-modal-overlay hidden" onclick="if(event.target===this)window.platformCloseAdminModal()">
        <div class="pa-modal" style="max-width:420px">
            <div class="pa-modal-header">
                <span class="pa-modal-title">Crear administrador</span>
                <button class="pa-modal-close" onclick="window.platformCloseAdminModal()"><i class="fa-solid fa-xmark"></i></button>
            </div>
            <div class="pa-modal-body">
                <div style="background:#0a1525;border:1px solid #1e3a5f;border-radius:6px;padding:10px 12px;margin-bottom:16px;font-size:11px;color:#60a5fa;">
                    <i class="fa-solid fa-info-circle" style="margin-right:6px"></i>
                    El administrador recibirá acceso completo a la clínica como superadmin.
                </div>
                <form id="platform-admin-form" onsubmit="window.platformSaveAdmin(event)">
                    <input type="hidden" id="paf-clinic-id">
                    <div class="pa-form-group">
                        <label class="pa-label">Nombre completo <span class="req">*</span></label>
                        <input id="paf-name" class="pa-input" placeholder="Dr. Juan Pérez" required>
                    </div>
                    <div class="pa-form-group">
                        <label class="pa-label">Email <span class="req">*</span></label>
                        <input id="paf-email" class="pa-input" type="email" placeholder="admin@clinica.com" required>
                    </div>
                    <div class="pa-form-group">
                        <label class="pa-label">Contraseña inicial <span class="req">*</span></label>
                        <div style="position:relative">
                            <input id="paf-pass" class="pa-input mono" type="password" value="odentara123" required style="padding-right:38px">
                            <button type="button" onclick="const i=document.getElementById('paf-pass');i.type=i.type==='password'?'text':'password';this.querySelector('i').className='fa-solid '+(i.type==='password'?'fa-eye':'fa-eye-slash')" style="position:absolute;right:10px;top:50%;transform:translateY(-50%);background:none;border:none;color:#94a3b8;cursor:pointer;padding:2px"><i class="fa-solid fa-eye"></i></button>
                        </div>
                        <div class="pa-hint">El usuario deberá cambiarla en su primer ingreso.</div>
                    </div>
                </form>
            </div>
            <div class="pa-modal-footer">
                <button class="pa-btn pa-btn-ghost" onclick="window.platformCloseAdminModal()">Cancelar</button>
                <button class="pa-btn pa-btn-primary" onclick="document.getElementById('platform-admin-form').requestSubmit()">
                    <i class="fa-solid fa-user-plus"></i> Crear admin
                </button>
            </div>
        </div>
    </div>`;
}

// ── Handlers ─────────────────────────────────────────────────────────────────

window.platformToggleDbUrl = function() {
    const type = document.getElementById('pcf-dbtype')?.value;
    const section = document.getElementById('pcf-db-url-section');
    if (section) section.style.display = type === 'dedicated' ? 'block' : 'none';
};

window.platformOpenNewClinicModal = function() {
    document.getElementById('platform-clinic-id').value = '';
    document.getElementById('platform-clinic-modal-title').textContent = 'Nueva clínica';
    const sb = document.getElementById('pcf-submit-btn');
    if (sb) sb.innerHTML = '<i class="fa-solid fa-check"></i> Crear clínica';
    document.getElementById('pcf-name').value    = '';
    document.getElementById('pcf-slug').value    = '';
    document.getElementById('pcf-phone').value   = '';
    document.getElementById('pcf-email').value   = '';
    document.getElementById('pcf-address').value = '';
    document.getElementById('pcf-plan').value    = '';
    document.getElementById('pcf-notes').value   = '';
    document.getElementById('pcf-dbtype').value  = 'shared';
    const dburlEl = document.getElementById('pcf-dburl');
    if (dburlEl) dburlEl.value = '';
    document.getElementById('pcf-slug').disabled = false;
    document.getElementById('pcf-db-url-section').style.display = 'none';
    document.getElementById('pcf-url-preview').textContent = '______.odentara.com';
    // Campos del superadmin inicial
    document.getElementById('pcf-admin-name').value  = '';
    document.getElementById('pcf-admin-email').value = '';
    document.getElementById('pcf-admin-pass').value  = 'odentara123';
    document.getElementById('pcf-admin-section').style.display = 'block';
    const adminInputs = document.querySelectorAll('#pcf-admin-name, #pcf-admin-email, #pcf-admin-pass');
    adminInputs.forEach(el => el.required = true);
    document.getElementById('platform-clinic-modal').classList.remove('hidden');
};

window.platformEditClinic = function(id) {
    const c = (state._platformClinics || []).find(x => x.id === id);
    if (!c) return;
    document.getElementById('platform-clinic-id').value = id;
    document.getElementById('platform-clinic-modal-title').textContent = 'Editar clínica';
    const sb = document.getElementById('pcf-submit-btn');
    if (sb) sb.innerHTML = '<i class="fa-solid fa-save"></i> Guardar cambios';
    document.getElementById('pcf-name').value    = c.name    || '';
    document.getElementById('pcf-slug').value    = c.slug    || '';
    document.getElementById('pcf-phone').value   = c.phone   || '';
    document.getElementById('pcf-email').value   = c.email   || '';
    document.getElementById('pcf-address').value = c.address || '';
    document.getElementById('pcf-plan').value    = c.plan    || '';
    document.getElementById('pcf-notes').value   = c.notes   || '';
    document.getElementById('pcf-dbtype').value  = c.dbType  || 'shared';
    const dburlEl = document.getElementById('pcf-dburl');
    if (dburlEl) dburlEl.value = c.databaseUrl || '';
    document.getElementById('pcf-slug').disabled = true;
    document.getElementById('pcf-db-url-section').style.display = c.dbType === 'dedicated' ? 'block' : 'none';
    document.getElementById('pcf-url-preview').textContent = `${c.slug}.odentara.com`;
    // Al editar no se crea superadmin
    document.getElementById('pcf-admin-section').style.display = 'none';
    const adminInputs = document.querySelectorAll('#pcf-admin-name, #pcf-admin-email, #pcf-admin-pass');
    adminInputs.forEach(el => el.required = false);
    document.getElementById('platform-clinic-modal').classList.remove('hidden');
};

window.platformCloseClinicModal = function() {
    document.getElementById('platform-clinic-modal').classList.add('hidden');
};

window.platformSaveClinic = async function(e) {
    e.preventDefault();
    const id      = document.getElementById('platform-clinic-id').value;
    const dbType  = document.getElementById('pcf-dbtype').value;
    const dburlEl = document.getElementById('pcf-dburl');
    const dbUrl   = dburlEl ? dburlEl.value.trim() : null;

    if (dbType === 'dedicated' && !dbUrl) {
        showPlatformAlert('Ingresá la DATABASE_URL para la base de datos dedicada.', 'error'); return;
    }

    const body = {
        name:        document.getElementById('pcf-name').value.trim(),
        slug:        document.getElementById('pcf-slug').value.trim(),
        phone:       document.getElementById('pcf-phone').value.trim()   || null,
        email:       document.getElementById('pcf-email').value.trim()   || null,
        address:     document.getElementById('pcf-address').value.trim() || null,
        plan:        document.getElementById('pcf-plan').value           || null,
        notes:       document.getElementById('pcf-notes').value.trim()   || null,
        dbType,
        databaseUrl: dbType === 'dedicated' ? dbUrl : null,
    };

    // Al crear, incluir datos del superadmin inicial
    if (!id) {
        body.adminName     = document.getElementById('pcf-admin-name').value.trim();
        body.adminEmail    = document.getElementById('pcf-admin-email').value.trim();
        body.adminPassword = document.getElementById('pcf-admin-pass').value;
    }

    try {
        const res = id
            ? await apiFetch(`/platform/clinics/${id}`, { method:'PUT',  body:JSON.stringify(body) })
            : await apiFetch('/platform/clinics',        { method:'POST', body:JSON.stringify(body) });
        if (!res.ok) throw new Error(res.error || 'Error al guardar');
        window.platformCloseClinicModal();
        await loadView('platform-clinics', 'Clínicas', { skipSync:true });
        // Toast informativo post-creación
        if (!id) {
            const adminInfo = res.adminUser ? ` · Superadmin: ${res.adminUser.email}` : '';
            showPlatformAlert(`Clínica "${res.clinic.name}" creada${adminInfo}`, 'success');
        } else {
            showPlatformAlert('Clínica actualizada correctamente.', 'success');
        }
    } catch(err) {
        showPlatformAlert(err.message, 'error');
    }
};

window.platformToggleClinic = async function(id) {
    const clinic = (state._platformClinics || []).find(x => x.id === id);
    const isActive = clinic?.active ?? true;
    const action = isActive ? 'desactivar' : 'activar';
    const confirmed = await showConfirm(
        `¿Querés ${action} la clínica "${clinic?.name || id}"? ${isActive ? 'Los usuarios no podrán ingresar mientras esté inactiva.' : ''}`,
        { title: isActive ? 'Desactivar clínica' : 'Activar clínica', variant: isActive ? 'danger' : 'info',
          confirmText: isActive ? 'Sí, desactivar' : 'Sí, activar' }
    );
    if (!confirmed) return;
    try {
        const res = await apiFetch(`/platform/clinics/${id}/toggle`, { method:'PATCH' });
        if (!res.ok) throw new Error(res.error || 'Error');
        await loadView('platform-clinics', 'Clínicas', { skipSync:true });
    } catch(err) {
        showPlatformAlert(err.message, 'error');
    }
};

// Eliminación de clínicas deshabilitada intencionalmente.
// Las clínicas solo pueden desactivarse o archivarse, nunca eliminarse.
window.platformDeleteClinic = function() {
    showPlatformAlert('Las clínicas no pueden eliminarse. Podés desactivarlas o archivarlas.', 'error');
};

window.platformLoginAsClinic = async function(clinicId, clinicName) {
    // Verificar contra el servidor que el token actual pertenece a un platform admin
    try {
        const me = await apiFetch('/auth/me');
        if (!me?.permissions?.isPlatformAdmin) {
            // El token actual no es de platform admin — intentar restaurar desde backup
            const backup = localStorage.getItem('odentara_platform_auth_backup');
            if (backup) {
                const backupAuth = JSON.parse(backup);
                if (backupAuth?.token) {
                    state.authToken = backupAuth.token;
                    const me2 = await apiFetch('/auth/me');
                    if (me2?.permissions?.isPlatformAdmin) {
                        saveAuthSession(backupAuth.token, me2.user);
                        localStorage.removeItem('odentara_platform_auth_backup');
                    } else {
                        showPlatformAlert('No tenés permisos de administrador de plataforma. Iniciá sesión con tu cuenta de plataforma.', 'error');
                        return;
                    }
                } else {
                    showPlatformAlert('No tenés permisos de administrador de plataforma.', 'error');
                    return;
                }
            } else {
                showPlatformAlert(`Esta cuenta (${me?.user?.email || ''}) no es administrador de plataforma. Cerrá sesión e ingresá con la cuenta correcta.`, 'error');
                return;
            }
        }
    } catch(verifyErr) {
        showPlatformAlert('No se pudo verificar la sesión: ' + (verifyErr.message || 'error'), 'error');
        return;
    }

    // Buscar el superadmin de la clínica para mostrarlo en el confirm
    let adminLabel = 'el superadmin';
    try {
        const usersRes = await apiFetch(`/platform/clinics/${clinicId}/users`);
        if (usersRes.ok) {
            const superadmin = (usersRes.users || []).find(u => u.roles.includes('superadmin') && u.active);
            if (superadmin) adminLabel = superadmin.email;
        }
    } catch(_) { /* silencioso */ }

    const confirmed = await showConfirm(
        `Vas a ingresar a "${clinicName}" como <strong>${adminLabel}</strong>. Tu sesión de plataforma quedará guardada y podrás volver desde el banner superior.`,
        { title: 'Ingresar como clínica', variant: 'info', confirmText: 'Ingresar' }
    );
    if (!confirmed) return;
    try {
        const res = await apiFetch('/platform/login-as-clinic', { method: 'POST', body: JSON.stringify({ clinicId }) });
        if (!res.ok) throw new Error(res.error || 'No se pudo ingresar a la clínica.');
        // Guardar token de plataforma para poder volver
        const platformAuth = JSON.parse(localStorage.getItem('odentara_auth_v1') || '{}');
        localStorage.setItem('odentara_platform_auth_backup', JSON.stringify(platformAuth));
        // Aplicar el token de la clínica
        const auth = { token: res.token, user: res.user };
        localStorage.setItem('odentara_auth_v1', JSON.stringify(auth));
        state.user = res.user;
        state.authToken = res.token;
        // Limpiar snapshot de localStorage de la clínica anterior y cargar el de la nueva
        localStorage.removeItem('odentara_db_v6');
        await syncBackendSnapshotToLocalDb();
        applyPlatformTheme(false);
        await loadView('dashboard');
        showToast(`Ingresaste como ${res.user.fullName || res.user.email} en ${clinicName}`, 'success');
    } catch(err) {
        showPlatformAlert(err.message || 'Error al ingresar a la clínica.', 'error');
    }
};

window.returnToPlatform = async function() {
    const backup = localStorage.getItem('odentara_platform_auth_backup');
    if (!backup) return;

    // Revocar el token de clínica actual
    if (state.authToken) {
        try { await apiFetch('/auth/logout', { method: 'POST' }); } catch (_) {}
    }

    const auth = JSON.parse(backup);
    localStorage.removeItem('odentara_platform_auth_backup');
    localStorage.removeItem('odentara_db_v6');

    // Si estamos en subdominio de clínica → redirigir a app.odentara.com con exchange code
    const loginUrl = getAppLoginUrl();
    if (_getCurrentClinicSlug() && loginUrl) {
        state.authToken = auth.token;
        try {
            const exRes = await apiFetch('/auth/exchange', { method: 'POST' });
            if (exRes.ok && exRes.code) {
                window.location.href = `${loginUrl}?__exchange=${encodeURIComponent(exRes.code)}`;
                return;
            }
        } catch (_) {}
        // Fallback: ir a app sin exchange (tendrá que loguearse de nuevo)
        window.location.href = loginUrl;
        return;
    }

    // En app.odentara.com → restaurar sesión directamente
    localStorage.setItem('odentara_auth_v1', backup);
    state.user = mapApiUserToLegacyUser(auth.user);
    state.authToken = auth.token;
    loadView('platform-clinics', 'Clínicas', { skipSync: true });
};

window.platformOpenAdminModal = function(clinicId) {
    document.getElementById('paf-clinic-id').value = clinicId;
    document.getElementById('paf-name').value  = '';
    document.getElementById('paf-email').value = '';
    document.getElementById('paf-pass').value  = 'odentara123';
    document.getElementById('platform-admin-modal').classList.remove('hidden');
};

window.platformCloseAdminModal = function() {
    document.getElementById('platform-admin-modal').classList.add('hidden');
};

window.platformSaveAdmin = async function(e) {
    e.preventDefault();
    const clinicId = document.getElementById('paf-clinic-id').value;
    const body = {
        fullName: document.getElementById('paf-name').value.trim(),
        email:    document.getElementById('paf-email').value.trim(),
        password: document.getElementById('paf-pass').value,
    };
    try {
        const res = await apiFetch(`/platform/clinics/${clinicId}/admin`, { method:'POST', body:JSON.stringify(body) });
        if (!res.ok) throw new Error(res.error || 'Error');
        window.platformCloseAdminModal();
        showPlatformAlert(`Admin ${res.user.email} creado correctamente.`, 'success');
    } catch(err) {
        showPlatformAlert(err.message, 'error');
    }
};

window.platformViewUsers = async function(clinicId, clinicName) {
    try {
        const res = await apiFetch(`/platform/clinics/${clinicId}/users`);
        if (!res.ok) throw new Error(res.error);
        const users = res.users || [];

        const existing = document.getElementById('platform-users-modal');
        if (existing) existing.remove();
        const modal = document.createElement('div');
        modal.id = 'platform-users-modal';
        modal.className = 'pa-modal-overlay';
        modal.innerHTML = `
            <div class="pa-modal" style="max-width:560px">
                <div class="pa-modal-header">
                    <span class="pa-modal-title">${clinicName} — ${users.length} usuario${users.length !== 1 ? 's' : ''}</span>
                    <button class="pa-modal-close" onclick="document.getElementById('platform-users-modal').remove()"><i class="fa-solid fa-xmark"></i></button>
                </div>
                <div class="pa-users-list">
                    ${users.length === 0
                        ? '<div class="pa-empty" style="padding:30px"><i class="fa-solid fa-user-slash"></i><p>Sin usuarios</p></div>'
                        : users.map(u => `
                            <div class="pa-user-row">
                                <div>
                                    <div class="pa-user-name">${escapeHtml(u.fullName)}</div>
                                    <div class="pa-user-email">${escapeHtml(u.email)}</div>
                                </div>
                                <div style="display:flex;gap:6px;align-items:center">
                                    ${u.roles.map(r => `<span class="pa-badge pa-badge-shared">${r}</span>`).join('')}
                                    <span class="pa-badge ${u.active ? 'pa-badge-active' : 'pa-badge-inactive'}">${u.active ? '●' : '○'}</span>
                                </div>
                            </div>
                        `).join('')
                    }
                </div>
                <div class="pa-modal-footer">
                    <button class="pa-btn pa-btn-ghost" onclick="document.getElementById('platform-users-modal').remove()">Cerrar</button>
                </div>
            </div>`;
        document.body.appendChild(modal);
    } catch(err) {
        showPlatformAlert(err.message, 'error');
    }
};

function showPlatformAlert(msg, type = 'info') {
    const colors     = { error:'#7f1d1d',  success:'#052e16', info:'#0c1a2e' };
    const textColors = { error:'#fca5a5',  success:'#4ade80', info:'#60a5fa' };
    const icons      = { error:'fa-circle-exclamation', success:'fa-check-circle', info:'fa-info-circle' };
    const toast = document.createElement('div');
    toast.style.cssText = `position:fixed;bottom:24px;right:24px;z-index:99999;background:${colors[type]};border:1px solid ${textColors[type]}22;color:${textColors[type]};padding:12px 18px;border-radius:8px;font-size:12px;display:flex;align-items:center;gap:10px;max-width:340px;box-shadow:0 4px 20px rgba(0,0,0,.5)`;
    toast.innerHTML = `<i class="fa-solid ${icons[type]}"></i><span>${msg}</span>`;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
}

// ── Fin Ultra-Admin Views ─────────────────────────────────────────────────────

function renderPlaceholder(viewId) {
    return `<div class="card p-12 text-center"><i class="fa-solid fa-tools text-4xl text-gray-300 mb-4"></i><h3 class="text-lg font-medium text-gray-700">Módulo ${viewId} en Construcción</h3></div>`;
}

// --- Helpers ---
function getProfName(id) {
    const p = DB.get('professionals').find(x => x.id === parseInt(id));
    return p ? p.name : 'Desconocido';
}

function getPatientByAppointment(apt) {
    return DB.get('patients').find(p => p.id === apt.patientId) || null;
}

function isSuperadmin() {
    return !!state.user && state.user.roles.includes('superadmin');
}

function isProfessionalUser() {
    return !!state.user && state.user.roles.includes('professional');
}

function canManagePatientBillingUi() {
    return !!state.user && state.user.roles.some((role) => ['superadmin', 'admin'].includes(role));
}

function canViewPatientBillingUi() {
    return !!state.user && state.user.roles.some((role) => ['superadmin', 'admin'].includes(role));
}

function canManageAppointmentsUi() {
    return !!state.user && state.user.roles.some((role) => ['superadmin', 'secretary'].includes(role));
}

function canViewAppointmentsUi() {
    return !!state.user && state.user.roles.some((role) => ['superadmin', 'secretary', 'professional'].includes(role));
}

function canEditAppointmentsUi() {
    return !!state.user && state.user.roles.some((role) => ['superadmin', 'secretary', 'professional'].includes(role));
}

function canCreatePatientUi() {
    return !!state.user && state.user.roles.some((role) => ['superadmin', 'secretary'].includes(role));
}

function canEditPatientUi() {
    return !!state.user && state.user.roles.some((role) => ['superadmin', 'secretary'].includes(role));
}

function canManageProfessionalSchedulesUi() {
    return !!state.user && state.user.roles.some((role) => ['superadmin', 'secretary'].includes(role));
}

function canManageProfessionalsUi() {
    return !!state.user && state.user.roles.some((role) => ['superadmin', 'admin'].includes(role));
}

function canViewBillingUi() {
    return !!state.user && state.user.roles.some((role) => ['superadmin', 'admin'].includes(role));
}

function canManageUsersUi() {
    return !!state.user && state.user.roles.includes('superadmin');
}

function canAccessSettingsUi() {
    return !!state.user && state.user.roles.some((role) => ['superadmin', 'admin', 'secretary'].includes(role));
}

function getBillingEntriesForPatient(patientId) {
    return DB.get('billing')
        .filter((entry) => entry.patientId === patientId && canAccessProfessional(entry.professionalId))
        .sort((a, b) => String(b.date).localeCompare(String(a.date)) || (b.id - a.id));
}

function getPatientCurrentAccountSummary(patientId) {
    const patient = getAccessiblePatients().find((item) => item.id === patientId);
    const entries = getBillingEntriesForPatient(patientId);
    const professionals = getAccessibleProfessionals();
    const byProfessionalMap = new Map();

    entries.forEach((entry) => {
        const professional = professionals.find((item) => item.id === entry.professionalId);
        if (!professional) return;

        if (!byProfessionalMap.has(entry.professionalId)) {
            byProfessionalMap.set(entry.professionalId, {
                professionalId: professional.id,
                professionalName: professional.name,
                deuda: 0,
                pagado: 0
            });
        }

        const item = byProfessionalMap.get(entry.professionalId);
        if (entry.type === 'debt') item.deuda += entry.amount;
        if (entry.type === 'income' || entry.type === 'payment') item.pagado += entry.amount;
    });

    const byProfessional = Array.from(byProfessionalMap.values())
        .map((item) => ({
            ...item,
            balance: item.deuda - item.pagado
        }))
        .sort((a, b) => a.professionalName.localeCompare(b.professionalName));

    const deuda = byProfessional.reduce((sum, item) => sum + item.deuda, 0);
    const pagado = byProfessional.reduce((sum, item) => sum + item.pagado, 0);

    return {
        patient,
        entries,
        byProfessional,
        deuda,
        pagado,
        balance: deuda - pagado
    };
}

function getPatientCurrentAccountSummaries() {
    return getAccessiblePatients()
        .map((patient) => {
            const summary = getPatientCurrentAccountSummary(patient.id);
            return {
                patientId: patient.id,
                name: patient.name,
                dni: patient.dni,
                deuda: summary.deuda,
                pagado: summary.pagado,
                balance: summary.balance,
                byProfessional: summary.byProfessional,
                movementCount: summary.entries.length
            };
        })
        .sort((a, b) => a.name.localeCompare(b.name));
}

function getPatientProfessionalAccountRows() {
    return getAccessiblePatients()
        .flatMap((patient) => {
            const summary = getPatientCurrentAccountSummary(patient.id);
            if (!summary.byProfessional.length) {
                return [{
                    patientId: patient.id,
                    name: patient.name,
                    dni: patient.dni,
                    professionalId: null,
                    professionalName: 'Sin movimientos',
                    deuda: 0,
                    pagado: 0,
                    balance: 0
                }];
            }

            return summary.byProfessional.map((item) => ({
                patientId: patient.id,
                name: patient.name,
                dni: patient.dni,
                professionalId: item.professionalId,
                professionalName: item.professionalName,
                deuda: item.deuda,
                pagado: item.pagado,
                balance: item.balance
            }));
        })
        .sort((a, b) => {
            const byPatient = a.name.localeCompare(b.name);
            if (byPatient !== 0) return byPatient;
            return a.professionalName.localeCompare(b.professionalName);
        });
}

window.openPatientBilling = async function(patientId) {
    if (!canViewPatientBillingUi() || !canAccessPatient(patientId)) {
        showAlert('No tienes permisos para acceder a la cuenta corriente de este paciente.', { title: 'Facturación', variant: 'error' });
        return;
    }
    state.billingSubView = 'accounts';
    state.billingPatientId = patientId;
    await loadView('billing', 'Cuentas Corrientes', { skipUnsavedCheck: true });
};

window.clearPatientBillingFilter = async function() {
    state.billingPatientId = null;
    state.billingSubView = 'accounts';
    await loadView('billing', 'Cuentas Corrientes', { skipUnsavedCheck: true });
};

function getAccessibleProfessionalIds() {
    const allProfs = DB.get('professionals');
    if (!state.user) return [];
    if (isSuperadmin()) return allProfs.map(p => p.id);

    // Admin (con o sin rol profesional) ve todos los profesionales
    // Solo podrá editar su propio horario, pero puede verlos todos
    if (state.user.roles.includes('admin')) return allProfs.map(p => p.id);

    const explicitAllowed = Array.isArray(state.user.allowedProfessionals) ? state.user.allowedProfessionals : [];

    if (isProfessionalUser()) {
        if (explicitAllowed.length > 0) return explicitAllowed;
        return allProfs
            .filter(p => p.name === state.user.name || (p.email && p.email === state.user.email))
            .map(p => p.id);
    }

    if (explicitAllowed.length > 0) return explicitAllowed;

    return allProfs.map(p => p.id);
}

function canAccessProfessional(profId) {
    return getAccessibleProfessionalIds().includes(parseInt(profId));
}

function getAccessibleProfessionals() {
    const allowedIds = new Set(getAccessibleProfessionalIds());
    return DB.get('professionals').filter(p => allowedIds.has(p.id));
}

function getAccessibleAppointments() {
    const allowedIds = new Set(getAccessibleProfessionalIds());
    return DB.get('appointments').filter(apt => allowedIds.has(apt.professionalId));
}

function getAccessiblePatientIds() {
    // Los pacientes pertenecen a toda la clínica — todos los roles ven todos los pacientes
    return DB.get('patients').map(p => p.id);
}

function canAccessPatient(patientId) {
    return getAccessiblePatientIds().includes(parseInt(patientId));
}

function getAccessiblePatients() {
    const allowedIds = new Set(getAccessiblePatientIds());
    return DB.get('patients').filter(p => allowedIds.has(p.id));
}

function canEditClinicalHistoryUi() {
    if (!state.user) return false;
    return state.user.roles.includes('professional') || state.user.roles.includes('superadmin');
}

function canViewClinicalHistoryUi() {
    if (!state.user) return false;
    return state.user.roles.includes('professional') || state.user.roles.includes('superadmin');
}

function getCurrentOdontoProfessionalId() {
    // Superadmin o usuario con múltiples profesionales en scope: usa el selector
    if (isSuperadmin() || (state.user?.allowedProfessionals || []).length > 1) {
        return state.clinicalOdontoProfessionalId || null;
    }
    // Vínculo directo (Professional.userId = user.id)
    if (state.user?.assignedProfessionalId) return state.user.assignedProfessionalId;
    // Fallback: exactamente un profesional en el scope (mismo criterio que el backend)
    const scoped = state.user?.allowedProfessionals || [];
    if (scoped.length === 1) return scoped[0];
    return null;
}

function isBlockingAppointmentStatus(status = '') {
    const normalized = normalizeAppointmentStatus(status);
    return normalized !== 'cancelled' && normalized !== 'rescheduled';
}

function normalizeAppointmentStatus(status = '') {
    if (status === 'pending') return 'not_sent';
    if (status === 'in progress') return 'sent';
    if (status === 'reprogramado') return 'rescheduled';
    return status || 'not_sent';
}

function getAppointmentStatusMeta(status) {
    const normalized = normalizeAppointmentStatus(status);
    if (normalized === 'confirmed') return { key: normalized, label: 'Confirmado', badge: 'badge-success', color: '#10b981' };
    if (normalized === 'rescheduled') return { key: normalized, label: 'Reprogramado', badge: 'badge-purple', color: '#7c3aed' };
    if (normalized === 'cancelled') return { key: normalized, label: 'Cancelado', badge: 'badge-danger', color: '#ef4444' };
    if (normalized === 'sent') return { key: normalized, label: 'Enviado / Sin respuesta', badge: 'badge-info', color: '#3b82f6' };
    return { key: 'not_sent', label: 'Sin enviar', badge: 'badge-warning', color: '#f59e0b' };
}

function renderStatusDropdownHtml(aptId, statusMeta) {
    const opts = [
        { value: 'not_sent',    label: 'Sin enviar',   badge: 'badge-warning' },
        { value: 'sent',        label: 'Enviado',       badge: 'badge-info' },
        { value: 'confirmed',   label: 'Confirmado',    badge: 'badge-success' },
        { value: 'rescheduled', label: 'Reprogramado',  badge: 'badge-purple' },
        { value: 'cancelled',   label: 'Cancelado',     badge: 'badge-danger' }
    ];
    const optsHtml = opts.map(o =>
        `<button type="button" class="status-opt ${o.badge}${o.value === statusMeta.key ? ' is-current' : ''}" onclick="selectStatusOpt(this,${aptId},'${o.value}')">${o.label}</button>`
    ).join('');
    return `<div class="status-dropdown"><button type="button" class="status-dropdown-trigger ${statusMeta.badge}" onclick="toggleStatusDropdown(this)"><span>${statusMeta.label}</span><i class="fa-solid fa-chevron-down status-dropdown-chevron"></i></button><div class="status-dropdown-menu">${optsHtml}</div></div>`;
}

let _openStatusMenu = null; // { dropdown, menu, originalParent, close }

function _closeStatusMenu() {
    if (!_openStatusMenu) return;
    const { dropdown, menu, originalParent, close } = _openStatusMenu;
    // Null out first to prevent re-entrant calls
    _openStatusMenu = null;
    document.removeEventListener('click', close, true);
    dropdown.classList.remove('is-open');
    if (menu.parentNode === document.body) {
        document.body.removeChild(menu);
        // Only re-attach if originalParent is still in the document
        if (document.contains(originalParent)) {
            originalParent.appendChild(menu);
        }
    }
    menu.style.cssText = '';
}

window.toggleStatusDropdown = function(btn) {
    const dropdown = btn.closest('.status-dropdown');
    if (_openStatusMenu) {
        const wasThis = _openStatusMenu.dropdown === dropdown;
        _closeStatusMenu();
        if (wasThis) return; // toggle: cerrar si era el mismo
    }

    const menu = dropdown.querySelector('.status-dropdown-menu');
    if (!menu) return;

    const originalParent = menu.parentNode;
    const rect = btn.getBoundingClientRect();

    // Mover al body para escapar cualquier overflow/stacking context
    document.body.appendChild(menu);

    menu.style.cssText = `
        display: flex;
        flex-direction: column;
        position: fixed;
        top: ${rect.bottom + 5}px;
        left: ${rect.left}px;
        min-width: ${Math.max(rect.width, 160)}px;
        z-index: 99999;
    `;

    dropdown.classList.add('is-open');

    const close = (e) => {
        // Also close if dropdown was removed from document (page re-rendered)
        if (!document.contains(dropdown) || (!dropdown.contains(e.target) && !menu.contains(e.target))) {
            _closeStatusMenu();
        }
    };

    setTimeout(() => document.addEventListener('click', close, true), 10);
    _openStatusMenu = { dropdown, menu, originalParent, close };
};

window.selectStatusOpt = async function(btn, aptId, newStatus) {
    _closeStatusMenu();
    await updateAppointmentStatus(aptId, newStatus);
};

// ── Presencia en sala ──────────────────────────────────────────────────────
const PRESENCE_STATES = [
    { key: '',             label: 'Sin llegar',     icon: 'fa-circle-minus',    cls: 'presence-none'        },
    { key: 'waiting',      label: 'En sala',         icon: 'fa-couch',           cls: 'presence-waiting'     },
    { key: 'consulting',   label: 'En consultorio',  icon: 'fa-user-doctor',     cls: 'presence-consulting'  },
    { key: 'done',         label: 'Finalizado',      icon: 'fa-circle-check',    cls: 'presence-done'        },
];

function getPresenceState(aptId) {
    return localStorage.getItem(`apt_presence_${aptId}`) || '';
}

function renderPresenceBtnHtml(aptId) {
    const key   = getPresenceState(aptId);
    const state = PRESENCE_STATES.find(s => s.key === key) || PRESENCE_STATES[0];
    return `<button type="button" class="presence-btn ${state.cls}" onclick="cyclePresence(${aptId})" title="${state.label}"><i class="fa-solid ${state.icon}"></i><span>${state.label}</span></button>`;
}

window.cyclePresence = function(aptId) {
    const current = getPresenceState(aptId);
    const idx     = PRESENCE_STATES.findIndex(s => s.key === current);
    const next    = PRESENCE_STATES[(idx + 1) % PRESENCE_STATES.length];
    if (next.key === '') {
        localStorage.removeItem(`apt_presence_${aptId}`);
    } else {
        localStorage.setItem(`apt_presence_${aptId}`, next.key);
    }
    // Actualizar solo el botón sin re-renderizar toda la vista
    const btn = document.querySelector(`.presence-btn[onclick="cyclePresence(${aptId})"]`);
    if (btn) {
        PRESENCE_STATES.forEach(s => btn.classList.remove(s.cls));
        btn.classList.add(next.cls);
        btn.title = next.label;
        btn.innerHTML = `<i class="fa-solid ${next.icon}"></i><span>${next.label}</span>`;
    }
};
// ──────────────────────────────────────────────────────────────────────────

function canManageAppointmentStatusUi() {
    return !!state.user && state.user.roles.some(r => ['superadmin', 'secretary'].includes(r));
}

function canSendAppointmentWhatsappUi() {
    return !!state.user && state.user.roles.some(r => ['superadmin', 'secretary'].includes(r));
}

window.updateAppointmentStatus = async function(aptId, nextStatus) {
    if (!canManageAppointmentStatusUi()) {
        showAlert('No tienes permisos para modificar la confirmación de los turnos.', { title: 'Turnos', variant: 'error' });
        return;
    }

    if (!nextStatus) return;
    const normalizedNextStatus = normalizeAppointmentStatus(nextStatus);

    try {
        if (state.authToken) {
            // Leer el turno actual desde la API para obtener status fresco
            const aptRes = await apiFetch(`/appointments/${aptId}`);
            const apt = aptRes.appointment;
            if (!apt) return;

            const payload = { status: normalizedNextStatus };

            if (normalizedNextStatus === 'sent' && normalizeAppointmentStatus(apt.status) !== 'sent') {
                payload.confirmationChannel = apt.confirmationChannel || 'manual';
                payload.confirmationSentAt = new Date().toISOString();
            }

            await apiFetch(`/appointments/${aptId}`, {
                method: 'PUT',
                body: JSON.stringify(payload)
            });
            await syncBackendSnapshotToLocalDb();
        } else {
            const apt = DB.get('appointments').find(item => item.id === aptId);
            if (!apt) return;
            DB.update('appointments', aptId, { status: normalizedNextStatus });
        }

        if (state.currentView === 'dashboard' || state.currentView === 'appointments') {
            refreshCurrentView();
        }
    } catch (error) {
        showAlert(error.message || 'No se pudo actualizar el estado del turno.', { title: 'Turnos', variant: 'error' });
    }
};

function getWhatsAppLink(patient, apt) {
    if (!patient || !patient.phone) return '';
    const phone = String(patient.phone).replace(/\D/g, '');
    if (!phone) return '';
    const dateLabel = parseLocalIsoDate(apt.date).toLocaleDateString('es-AR');
    const message = `Hola ${patient.name}, te escribimos de Odentara para confirmar tu turno del ${dateLabel} a las ${apt.time} con ${getProfName(apt.professionalId)}. Por favor responde CONFIRMADO o si necesitas reprogramarlo.`;
    return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

window.markAppointmentAsSent = async function(aptId) {
    if (!canSendAppointmentWhatsappUi()) {
        showAlert('No tienes permisos para enviar confirmaciones por WhatsApp.', { title: 'Turnos', variant: 'error' });
        return;
    }

    try {
        if (state.authToken) {
            // Leer el turno desde la API para obtener el estado actual
            const aptRes = await apiFetch(`/appointments/${aptId}`);
            const apt = aptRes.appointment;
            if (!apt) return;
            const normalizedStatus = normalizeAppointmentStatus(apt.status);
            if (normalizedStatus !== 'not_sent') return;

            await apiFetch(`/appointments/${aptId}`, {
                method: 'PUT',
                body: JSON.stringify({
                    status: 'sent',
                    confirmationChannel: 'whatsapp',
                    confirmationSentAt: new Date().toISOString()
                })
            });
            await syncBackendSnapshotToLocalDb();
        } else {
            const apt = DB.get('appointments').find(item => item.id === aptId);
            if (!apt) return;
            const normalizedStatus = normalizeAppointmentStatus(apt.status);
            if (normalizedStatus !== 'not_sent') return;
            DB.update('appointments', aptId, { status: 'sent' });
        }
    } catch (error) {
        showAlert(error.message || 'No se pudo actualizar el estado del turno.', { title: 'Turnos', variant: 'error' });
        return;
    }
    if (state.currentView === 'dashboard' || state.currentView === 'appointments') refreshCurrentView();
};

window.sendWhatsAppMessage = async function(aptId) {
    if (!canSendAppointmentWhatsappUi()) {
        showAlert('No tienes permisos para enviar confirmaciones por WhatsApp.', { title: 'Turnos', variant: 'error' });
        return;
    }
    const aptLocal = DB.get('appointments').find(a => a.id === aptId);
    const patient  = getPatientByAppointment(aptLocal);
    const link     = getWhatsAppLink(patient, aptLocal);
    if (!link) return;

    // Abrir WhatsApp primero
    window.open(link, '_blank', 'noopener,noreferrer');

    // Confirmar si se pudo enviar
    setTimeout(async () => {
        const sent = await showConfirm(
            '¿Pudiste enviar el mensaje de confirmación al paciente?',
            {
                title: 'Confirmar envío por WhatsApp',
                variant: 'success',
                confirmText: 'Sí, lo envié',
                cancelText: 'Todavía no'
            }
        );
        if (sent) await markAppointmentAsSent(aptId);
    }, 400);
};

window._cancelEditUser = function() {
    state.editingUserId = null;
    state.settingsSubView = 'create-user';
    refreshCurrentView();
};

window._cancelEditProf = function() {
    state.editingProfId = null;
    state.settingsSubView = 'create-professional';
    refreshCurrentView();
};

function viewProfessionalCalendar(profId) {
    if (!canAccessProfessional(profId)) return;
    const profs = DB.get('professionals');
    profs.forEach(p => {
        calendarState.visibleProfs[p.id] = p.id === profId;
    });
    loadView('appointments');
}

// --- Modal System & Forms ---
function closeModal() {
    state.clinicalImageViewer = null;
    modalsContainer.innerHTML = '';
}

function getClinicalImagesForPatient(patientId) {
    const patient = getClinicalWorkingPatient(patientId);
    return ((patient?.clinicalImages) || [])
        .slice()
        .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
}

function formatClinicalImageDate(date) {
    return date ? String(date).split('-').reverse().join('/') : 'Sin fecha';
}

window.openClinicalImageViewer = function(patientId, imageId) {
    const images = getClinicalImagesForPatient(patientId);
    if (!images.length) return;

    const imageIndex = Math.max(0, images.findIndex((image, index) => (image.id ?? index) === imageId));
    state.clinicalImageViewer = { patientId, index: imageIndex < 0 ? 0 : imageIndex };
    renderClinicalImageViewer();
};

window.goToClinicalImageViewer = function(index) {
    if (!state.clinicalImageViewer) return;

    const images = getClinicalImagesForPatient(state.clinicalImageViewer.patientId);
    if (!images.length) return;

    state.clinicalImageViewer.index = Math.min(Math.max(Number(index) || 0, 0), images.length - 1);
    renderClinicalImageViewer();
};

window.stepClinicalImageViewer = function(direction) {
    if (!state.clinicalImageViewer) return;
    const { patientId, index } = state.clinicalImageViewer;
    const images = getClinicalImagesForPatient(patientId);
    if (!images.length) return;

    const nextIndex = (index + direction + images.length) % images.length;
    state.clinicalImageViewer.index = nextIndex;
    renderClinicalImageViewer();
};

let _viewerZoom = 1;
let _viewerPanX = 0;
let _viewerPanY = 0;

function _applyViewerTransform() {
    const wrap = document.getElementById('clinical-viewer-zoom-wrap');
    if (!wrap) return;
    wrap.style.transform = `scale(${_viewerZoom}) translate(${_viewerPanX}px, ${_viewerPanY}px)`;
    wrap.style.cursor = _viewerZoom > 1 ? 'grab' : 'zoom-in';
}

window.adjustViewerZoom = function(delta) {
    if (delta === 0) {
        _viewerZoom = 1; _viewerPanX = 0; _viewerPanY = 0;
    } else {
        _viewerZoom = Math.min(5, Math.max(1, _viewerZoom + delta));
        if (_viewerZoom === 1) { _viewerPanX = 0; _viewerPanY = 0; }
    }
    _applyViewerTransform();
};

window.toggleViewerZoom = function() {
    _viewerZoom = _viewerZoom > 1 ? 1 : 2.5;
    _viewerPanX = 0; _viewerPanY = 0;
    _applyViewerTransform();
};

function _bindViewerZoomEvents() {
    const wrap = document.getElementById('clinical-viewer-zoom-wrap');
    if (!wrap) return;
    _viewerZoom = 1; _viewerPanX = 0; _viewerPanY = 0;
    _applyViewerTransform();

    // Pinch-to-zoom
    let lastDist = null;
    let lastZoom = 1;
    wrap.addEventListener('touchstart', (e) => {
        if (e.touches.length === 2) {
            lastDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
            lastZoom = _viewerZoom;
            e.preventDefault();
        }
    }, { passive: false });
    wrap.addEventListener('touchmove', (e) => {
        if (e.touches.length === 2 && lastDist) {
            const dist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
            _viewerZoom = Math.min(5, Math.max(1, lastZoom * (dist / lastDist)));
            if (_viewerZoom === 1) { _viewerPanX = 0; _viewerPanY = 0; }
            _applyViewerTransform();
            e.preventDefault();
        }
    }, { passive: false });
    wrap.addEventListener('touchend', () => { lastDist = null; });

    // Wheel zoom
    wrap.addEventListener('wheel', (e) => {
        e.preventDefault();
        _viewerZoom = Math.min(5, Math.max(1, _viewerZoom - e.deltaY * 0.001));
        if (_viewerZoom === 1) { _viewerPanX = 0; _viewerPanY = 0; }
        _applyViewerTransform();
    }, { passive: false });

    // Mouse drag to pan
    let isDragging = false;
    let dragStartX = 0, dragStartY = 0;
    let panStartX = 0, panStartY = 0;

    wrap.addEventListener('mousedown', (e) => {
        if (_viewerZoom <= 1) return;
        isDragging = true;
        dragStartX = e.clientX; dragStartY = e.clientY;
        panStartX = _viewerPanX; panStartY = _viewerPanY;
        wrap.style.cursor = 'grabbing';
        e.preventDefault();
    });
    window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        _viewerPanX = panStartX + (e.clientX - dragStartX) / _viewerZoom;
        _viewerPanY = panStartY + (e.clientY - dragStartY) / _viewerZoom;
        _applyViewerTransform();
    });
    window.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            wrap.style.cursor = _viewerZoom > 1 ? 'grab' : 'zoom-in';
        }
    });

    // Single-finger touch drag to pan
    let touchDragging = false;
    let touchStartX = 0, touchStartY = 0;
    let touchPanStartX = 0, touchPanStartY = 0;

    wrap.addEventListener('touchstart', (e) => {
        if (e.touches.length === 1 && _viewerZoom > 1) {
            touchDragging = true;
            touchStartX = e.touches[0].clientX; touchStartY = e.touches[0].clientY;
            touchPanStartX = _viewerPanX; touchPanStartY = _viewerPanY;
        }
    }, { passive: true });
    wrap.addEventListener('touchmove', (e) => {
        if (e.touches.length === 1 && touchDragging && _viewerZoom > 1) {
            _viewerPanX = touchPanStartX + (e.touches[0].clientX - touchStartX) / _viewerZoom;
            _viewerPanY = touchPanStartY + (e.touches[0].clientY - touchStartY) / _viewerZoom;
            _applyViewerTransform();
            e.preventDefault();
        }
    }, { passive: false });
    wrap.addEventListener('touchend', () => { touchDragging = false; });
}

function renderClinicalImageViewer() {
    const viewer = state.clinicalImageViewer;
    if (!viewer) return;

    const images = getClinicalImagesForPatient(viewer.patientId);
    if (!images.length) {
        closeModal();
        return;
    }

    const safeIndex = Math.min(Math.max(viewer.index, 0), images.length - 1);
    state.clinicalImageViewer.index = safeIndex;
    const image = images[safeIndex];
    const patient = getClinicalWorkingPatient(viewer.patientId);
    const label = image.description || 'Imagen clínica';
    const dateLabel = formatClinicalImageDate(image.date);
    const progress = Math.round(((safeIndex + 1) / images.length) * 100);
    const previousImage = images[(safeIndex - 1 + images.length) % images.length];
    const nextImage = images[(safeIndex + 1) % images.length];
    const viewerTitle = `${label} - ${safeIndex + 1} de ${images.length}`;

    modalsContainer.innerHTML = `
        <div class="modal-overlay active clinical-image-viewer-overlay">
            <div class="clinical-image-viewer" role="dialog" aria-modal="true" aria-label="${escapeHtml(viewerTitle)}">
                <header class="clinical-image-viewer-header">
                    <div class="clinical-image-viewer-heading">
                        <span class="clinical-image-viewer-kicker">Secuencia clínica</span>
                        <h3>${escapeHtml(patient?.name || 'Paciente')}</h3>
                    </div>
                    <div class="clinical-image-viewer-header-actions">
                        <span class="clinical-image-viewer-counter">${safeIndex + 1} / ${images.length}</span>
                        <div class="clinical-image-viewer-zoom-btns">
                            <button type="button" class="clinical-image-viewer-zoom-btn" onclick="event.stopPropagation(); adjustViewerZoom(-0.5)" aria-label="Alejar"><i class="fa-solid fa-minus"></i></button>
                            <button type="button" class="clinical-image-viewer-zoom-btn" onclick="event.stopPropagation(); adjustViewerZoom(0)" aria-label="Tamaño original"><i class="fa-solid fa-expand"></i></button>
                            <button type="button" class="clinical-image-viewer-zoom-btn" onclick="event.stopPropagation(); adjustViewerZoom(0.5)" aria-label="Acercar"><i class="fa-solid fa-plus"></i></button>
                        </div>
                        <button type="button" class="clinical-image-viewer-close" onclick="event.stopPropagation(); closeModal();" aria-label="Cerrar visor">
                            <i class="fa-solid fa-xmark"></i>
                        </button>
                    </div>
                </header>

                <div class="clinical-image-viewer-layout">
                    <div class="clinical-image-viewer-stage">
                        <button type="button" class="clinical-image-viewer-nav prev" onclick="event.stopPropagation(); stepClinicalImageViewer(-1)" aria-label="Imagen anterior">
                            <i class="fa-solid fa-chevron-left"></i>
                        </button>
                        <figure class="clinical-image-viewer-figure" id="clinical-viewer-figure">
                            <div class="clinical-image-viewer-zoom-wrap" id="clinical-viewer-zoom-wrap">
                            <img src="${escapeHtml(image.dataUrl)}" alt="${escapeHtml(label)}" class="clinical-image-viewer-img" id="clinical-viewer-img" ondblclick="event.stopPropagation(); toggleViewerZoom()">
                            </div>
                            <figcaption class="clinical-image-viewer-caption">
                                <span>${escapeHtml(dateLabel)}</span>
                                <strong>${escapeHtml(label)}</strong>
                            </figcaption>
                        </figure>
                        <button type="button" class="clinical-image-viewer-nav next" onclick="event.stopPropagation(); stepClinicalImageViewer(1)" aria-label="Imagen siguiente">
                            <i class="fa-solid fa-chevron-right"></i>
                        </button>
                    </div>

                    <aside class="clinical-image-viewer-panel">
                        <div class="clinical-image-viewer-progress" aria-hidden="true">
                            <span style="width: ${progress}%"></span>
                        </div>
                        <div class="clinical-image-viewer-detail">
                            <span>Fecha</span>
                            <strong>${escapeHtml(dateLabel)}</strong>
                        </div>
                        <div class="clinical-image-viewer-detail">
                            <span>Descripción</span>
                            <strong>${escapeHtml(label)}</strong>
                        </div>
                        <div class="clinical-image-viewer-detail">
                            <span>Registro</span>
                            <strong>${safeIndex + 1} de ${images.length}</strong>
                        </div>
                        ${images.length > 1 ? `
                        <div class="clinical-image-viewer-neighbors">
                            <button type="button" onclick="event.stopPropagation(); stepClinicalImageViewer(-1)">
                                <i class="fa-solid fa-arrow-left"></i>
                                <span>${escapeHtml(formatClinicalImageDate(previousImage.date))}</span>
                            </button>
                            <button type="button" onclick="event.stopPropagation(); stepClinicalImageViewer(1)">
                                <span>${escapeHtml(formatClinicalImageDate(nextImage.date))}</span>
                                <i class="fa-solid fa-arrow-right"></i>
                            </button>
                        </div>
                        ` : ''}
                    </aside>
                </div>

                <div class="clinical-image-viewer-thumbs" aria-label="Miniaturas de imágenes clínicas">
                    ${images.map((item, index) => {
                        const itemLabel = item.description || 'Imagen clínica';
                        return `
                        <button type="button" class="clinical-image-viewer-thumb ${index === safeIndex ? 'is-active' : ''}" onclick="event.stopPropagation(); goToClinicalImageViewer(${index})" aria-label="Ver ${escapeHtml(itemLabel)}">
                            <img src="${escapeHtml(item.dataUrl)}" alt="${escapeHtml(itemLabel)}">
                            <span>${escapeHtml(formatClinicalImageDate(item.date))}</span>
                        </button>
                        `;
                    }).join('')}
                </div>
            </div>
        </div>
    `;
    _bindViewerZoomEvents();
}

function openAppointmentViewModal(aptId) {
    const apt = getAccessibleAppointments().find(a => a.id === aptId);
    if (!apt) return;

    const patient = getPatientByAppointment(apt);
    const prof = DB.get('professionals').find(p => p.id === apt.professionalId);
    const statusMeta = getAppointmentStatusMeta(apt.status);

    modalsContainer.innerHTML = `
        <div class="modal-overlay active">
            <div class="modal-content" onclick="event.stopPropagation()">
                <div class="modal-header">
                    <h3>Detalles del Turno</h3>
                    <button type="button" class="modal-close-x" onclick="closeModal()" aria-label="Cerrar"><i class="fa-solid fa-xmark"></i></button>
                </div>
                <div class="modal-body">
                    <div class="apt-view-info-grid">
                        <div class="apt-view-row"><strong>Paciente</strong><span>${escapeHtml(apt.patient)}</span></div>
                        <div class="apt-view-row"><strong>Teléfono</strong><span>${escapeHtml(patient?.phone || '—')}</span></div>
                        <div class="apt-view-row"><strong>Profesional</strong><span>${escapeHtml(prof?.name || '—')}</span></div>
                        <div class="apt-view-row"><strong>Fecha</strong><span>${normalizeDateLabel(parseLocalIsoDate(apt.date).toLocaleDateString('es-AR', { weekday:'long', day:'numeric', month:'long', year:'numeric' }))}</span></div>
                        <div class="apt-view-row"><strong>Hora</strong><span>${apt.time} · ${apt.duration} min</span></div>
                        <div class="apt-view-row"><strong>Estado</strong><span class="badge ${statusMeta.badge}">${statusMeta.label}</span></div>
                        ${apt.notes ? `<div class="apt-view-row apt-view-row-full"><strong>Motivo</strong><span>${escapeHtml(apt.notes)}</span></div>` : ''}
                    </div>
                </div>
                <div class="modal-footer">
                    ${patient && canViewClinicalHistoryUi() ? `<button type="button" class="btn btn-secondary" onclick="closeModal(); loadClinicalHistory(${patient.id})">Historia Clínica</button>` : ''}
                    ${canEditCalendar() && apt.status !== 'cancelled' ? `<button type="button" class="btn btn-cancel-apt" onclick="closeModal(); _confirmCancelApt(${aptId})"><i class="fa-solid fa-ban"></i> Cancelar turno</button>` : ''}
                    ${canEditCalendar() ? `<button type="button" class="btn btn-primary" onclick="openAppointmentModal(${aptId})">Editar turno</button>` : ''}
                </div>
            </div>
        </div>
    `;
}

function getProfessionalDaySchedule(professionalId, dateStr) {
    const prof = DB.get('professionals').find(p => p.id === professionalId);
    if (!prof || !dateStr) return null;
    const [year, month, day] = dateStr.split('-').map(Number);
    const dateObj = new Date(year, month - 1, day);
    const weekday = dateObj.getDay();
    const daySchedule = prof.schedule?.[weekday];
    if (!daySchedule || !daySchedule.active) return null;
    return daySchedule;
}

function getAppointmentIntervalsForDate(professionalId, dateStr, excludedAppointmentId = null) {
    return DB.get('appointments')
        .filter(a =>
            a.professionalId === professionalId &&
            a.date === dateStr &&
            a.id !== excludedAppointmentId &&
            isBlockingAppointmentStatus(a.status)
        )
        .map(a => {
            const start = timeToMinutes(a.time);
            return {
                start,
                end: start + (a.duration || 0),
                isOverbook: !!a.isOverbook
            };
        })
        .filter(interval => interval.start !== null);
}

function getContiguousAvailabilityMinutes(professionalId, dateStr, startTime, isOverbook = false, excludedAppointmentId = null) {
    const daySchedule = getProfessionalDaySchedule(professionalId, dateStr);
    const startMinutes = timeToMinutes(startTime);
    if (!daySchedule || startMinutes === null) return 0;

    const scheduleStart = timeToMinutes(daySchedule.start);
    const scheduleEnd = timeToMinutes(daySchedule.end);
    if (scheduleStart === null || scheduleEnd === null) return 0;
    if (startMinutes < scheduleStart || startMinutes >= scheduleEnd) return 0;

    const intervals = getAppointmentIntervalsForDate(professionalId, dateStr, excludedAppointmentId);
    const relevantIntervals = intervals.filter(interval => interval.isOverbook === isOverbook);

    let cursor = startMinutes;
    while (cursor < scheduleEnd) {
        const nextCursor = cursor + 15;
        const overlaps = relevantIntervals.some(interval => cursor < interval.end && nextCursor > interval.start);
        if (overlaps) break;
        cursor = nextCursor;
    }

    return Math.max(0, cursor - startMinutes);
}

function openAppointmentModal(editId = null) {
    const apt = editId ? getAccessibleAppointments().find(a => a.id === editId) : null;
    if (editId && !apt) return;
    const patients = getAccessiblePatients();
    const professionals = getAccessibleProfessionals();
    
    if (patients.length === 0) {
        alert("Atención: Necesitas crear al menos un paciente en el directorio antes de agendar un turno.");
        return;
    }
    
    modalsContainer.innerHTML = `
        <div class="modal-overlay active">
            <div class="modal-content modal-content-appointment" onclick="event.stopPropagation()">
                <div class="modal-header">
                    <h3>${editId ? 'Editar Turno' : 'Nuevo Turno'}</h3>
                </div>
                <form id="apt-form">
                    <div class="modal-body">
                        <div class="input-group">
                            <label>Paciente (Solo pacientes registrados)</label>
                            <input type="search" id="apt-patient" class="form-input" list="apt-patient-list" placeholder="Buscar por nombre o DNI..." value="${apt ? getPatientOptionLabel(patients.find(patient => patient.name === apt.patient) || { name: apt.patient, dni: '' }) : ''}" required>
                            <datalist id="apt-patient-list">
                                ${patients.map(patient => `<option value="${getPatientOptionLabel(patient)}"></option>`).join('')}
                            </datalist>
                        </div>
                        <div class="input-group">
                            <label>Profesional *</label>
                            <select id="apt-professional" required>
                                ${!apt ? '<option value="">— Seleccionar profesional —</option>' : ''}
                                ${professionals.map(p => `<option value="${p.id}" ${apt && apt.professionalId === p.id ? 'selected':''}>${escapeHtml(p.name)}</option>`).join('')}
                            </select>
                        </div>
                        <div class="appointment-form-row">
                            <div class="input-group flex-1"><label>Fecha</label><input type="date" id="apt-date" min="${getTodayIsoLocal()}" value="${apt ? apt.date : getTodayIsoLocal()}" required></div>
                            <div class="input-group flex-1">
                                <label>Hora (Intervalos de 15m)</label>
                                <select id="apt-time" required></select>
                            </div>
                        </div>
                        
                        <div class="checkbox-group mt-2">
                            <input type="checkbox" id="apt-sobreturno" ${apt && apt.isOverbook ? 'checked' : ''}>
                            <label for="apt-sobreturno" class="text-purple-600 font-semibold"><i class="fa-solid fa-bolt"></i> Sobreturno (15 min superpuesto)</label>
                        </div>
                        
                        <div class="input-group mb-0" id="duration-group">
                            <label>Duración</label>
                            <select id="apt-duration">
                                <option value="30" ${!apt || apt.duration===30?'selected':''}>30 minutos</option>
                                <option value="60" ${apt && apt.duration===60?'selected':''}>60 minutos (1 hora)</option>
                                <option value="90" ${apt && apt.duration===90?'selected':''}>90 minutos (1.5 horas)</option>
                                <option value="120" ${apt && apt.duration===120?'selected':''}>120 minutos (2 horas)</option>
                            </select>
                        </div>
                    </div>
                    <div class="modal-footer appointment-modal-footer">
                        <button type="button" class="btn btn-ghost" onclick="closeModal()">Cancelar</button>
                        <button type="submit" class="btn btn-primary">Guardar Turno</button>
                    </div>
                </form>
            </div>
        </div>
    `;

    // ESC cierra el modal de turno
    const _aptEscHandler = (e) => {
        if (e.key !== 'Escape') return;
        closeModal();
    };
    document.addEventListener('keydown', _aptEscHandler, { once: true });

    const profSelect = document.getElementById('apt-professional');
    const timeSelect = document.getElementById('apt-time');
    const sCheck = document.getElementById('apt-sobreturno');
    const dGroup = document.getElementById('duration-group');
    const durSelect = document.getElementById('apt-duration');
    const patientInput = document.getElementById('apt-patient');

    const renderDurationOptions = () => {
        const isOverbook = sCheck.checked;
        if (isOverbook) return; 

        const profId = parseInt(profSelect.value);
        const dateStr = document.getElementById('apt-date').value;
        const timeVal = timeSelect.value;
        if (!timeVal) {
            durSelect.innerHTML = '<option value="">-</option>';
            return;
        }

        const maxDuration = getContiguousAvailabilityMinutes(profId, dateStr, timeVal, false, editId);
        
        const currentDur = parseInt(durSelect.value) || (apt ? apt.duration : 30);
        durSelect.innerHTML = '';
        
        const durations = [
            { val: 30, label: '30 minutos' },
            { val: 60, label: '60 minutos (1 hora)' },
            { val: 90, label: '90 minutos (1.5 horas)' },
            { val: 120, label: '120 minutos (2 horas)' }
        ];
        
        let hasSelected = false;
        durations.forEach(d => {
            if (d.val <= maxDuration) {
                const isSelected = (d.val === currentDur) ? 'selected' : '';
                if(isSelected) hasSelected = true;
                durSelect.innerHTML += `<option value="${d.val}" ${isSelected}>${d.label}</option>`;
            }
        });
        
        // If the previously selected duration is now invalid, select the max one
        if (durSelect.options.length > 0 && !hasSelected) {
            durSelect.value = durSelect.options[durSelect.options.length - 1].value; 
        }
    };

    const renderTimeOptions = () => {
        timeSelect.innerHTML = '';
        const profId = parseInt(profSelect.value);
        const dateStr = document.getElementById('apt-date').value;
        const isOverbook = sCheck.checked;

        if (isPastDate(dateStr)) {
            timeSelect.innerHTML = '<option value="">No se pueden asignar turnos en fechas pasadas</option>';
            timeSelect.disabled = true;
            durSelect.innerHTML = '<option value="">-</option>';
            return;
        }
        
        const daySchedule = getProfessionalDaySchedule(profId, dateStr);
        if (!daySchedule) {
            if (dateStr) {
                timeSelect.innerHTML = '<option value="">No atiende en esta fecha</option>';
            } else {
                timeSelect.innerHTML = '<option value="">-</option>';
            }
            timeSelect.disabled = true;
            renderDurationOptions();
            return;
        }

        if (!dateStr) {
            timeSelect.innerHTML = '<option value="">-</option>';
            timeSelect.disabled = true;
            return;
        }

        const [sh, sm] = daySchedule.start.split(':').map(Number);
        const [eh, em] = daySchedule.end.split(':').map(Number);
        
        const startMinBase = sh * 60 + sm;
        const endMin = eh * 60 + em;
        const currentMinutes = getCurrentMinutes();
        const isToday = isTodayDate(dateStr);
        
        let foundSelected = false;
        const minDuration = isOverbook ? 15 : 30;
        
        for (let t = startMinBase; t + minDuration <= endMin; t += 15) {
            if (isToday && !isOverbook && t < currentMinutes) {
                continue;
            }

            const h = Math.floor(t / 60).toString().padStart(2, '0');
            const m = (t % 60).toString().padStart(2, '0');
            const val = `${h}:${m}`;
            const availableMinutes = getContiguousAvailabilityMinutes(profId, dateStr, val, isOverbook, editId);
            if (availableMinutes < minDuration) continue;

            const isSelected = apt && apt.time === val;
            if(isSelected) foundSelected = true;
            timeSelect.innerHTML += `<option value="${val}" ${isSelected ? 'selected' : ''}>${val}</option>`;
        }
        
        if (timeSelect.options.length === 0) {
            timeSelect.innerHTML = '<option value="">Sin horarios disponibles</option>';
            timeSelect.disabled = true;
        } else {
            timeSelect.disabled = false;
            if (!foundSelected && apt && timeSelect.querySelector(`option[value="${apt.time}"]`)) {
                 timeSelect.value = apt.time;
            } else if (!foundSelected) {
                 timeSelect.selectedIndex = 0;
            }
        }
        
        renderDurationOptions();
    };

    profSelect.addEventListener('change', renderTimeOptions);
    document.getElementById('apt-date').addEventListener('change', renderTimeOptions);
    timeSelect.addEventListener('change', renderDurationOptions);
    
    // Duration toggle
    const toggleDur = () => { dGroup.style.display = sCheck.checked ? 'none' : 'flex'; renderTimeOptions(); };
    sCheck.addEventListener('change', toggleDur); 
    toggleDur(); // Also calls renderTimeOptions
    
    document.getElementById('apt-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        if (form.dataset.submitting === 'true') return;
        const selectedDate = document.getElementById('apt-date').value;
        const selectedTime = timeSelect.value;
        const isOverbook = sCheck.checked;
        const selectedMinutes = timeToMinutes(selectedTime);

        if (isPastDate(selectedDate)) {
            alert('No se pueden sacar turnos para días anteriores.');
            return;
        }

        if (isTodayDate(selectedDate) && !isOverbook && selectedMinutes !== null && selectedMinutes < getCurrentMinutes()) {
            alert('Ese horario ya pasó. Para horarios pasados del día de hoy solo se permiten sobreturnos.');
            return;
        }

        const patientSearchValue = patientInput.value.trim();
        const matchedPatient = patients.find(patient => {
            const optionLabel = normalizePatientName(getPatientOptionLabel(patient));
            const patientName = normalizePatientName(patient.name);
            const patientDni = normalizeDni(patient.dni);
            const normalizedValue = normalizePatientName(patientSearchValue);
            const normalizedValueDni = normalizeDni(patientSearchValue);
            return optionLabel === normalizedValue || patientName === normalizedValue || patientDni === normalizedValueDni;
        });

        if (!matchedPatient) {
            alert('Selecciona un paciente válido.');
            return;
        }

        const data = {
            patient: matchedPatient.name,
            patientId: matchedPatient.id,
            professionalId: parseInt(profSelect.value),
            date: selectedDate,
            time: selectedTime,
            duration: isOverbook ? 15 : parseInt(durSelect.value),
            isOverbook,
            status: apt ? normalizeAppointmentStatus(apt.status) : 'not_sent'
        };
        try {
            form.dataset.submitting = 'true';
            await withAppLoading(editId ? 'Actualizando turno...' : 'Guardando turno...', async () => {
                if (state.authToken) {
                    const payload = {
                        patientId: data.patientId,
                        professionalId: data.professionalId,
                        date: data.date,
                        time: data.time,
                        durationMinutes: data.duration,
                        isOverbook: data.isOverbook,
                        status: data.status
                    };

                    if (editId) {
                        await apiFetch(`/appointments/${editId}`, {
                            method: 'PUT',
                            body: JSON.stringify(payload)
                        });
                    } else {
                        await apiFetch('/appointments', {
                            method: 'POST',
                            body: JSON.stringify(payload)
                        });
                    }

                    await syncBackendSnapshotToLocalDb();
                } else {
                    if (editId) DB.update('appointments', editId, data);
                    else DB.add('appointments', data);
                }
            });

            closeModal();
            refreshCurrentView();
        } catch (error) {
            showAlert(error.message || 'No se pudo guardar el turno.', { title: 'Turnos', variant: 'error' });
        } finally {
            delete form.dataset.submitting;
        }
    });
}

function buildSchedTimePicker(id, value) {
    const [hStr, mStr] = (value || '08:00').split(':');
    const selH = parseInt(hStr) || 0;
    const selM = parseInt(mStr) || 0;
    const hours   = Array.from({length: 24}, (_, i) => `<button type="button" class="stp-item${i === selH ? ' is-sel' : ''}" data-val="${i}">${String(i).padStart(2,'0')}</button>`).join('');
    const minutes = Array.from({length: 60}, (_, i) => `<button type="button" class="stp-item${i === selM ? ' is-sel' : ''}" data-val="${i}">${String(i).padStart(2,'0')}</button>`).join('');
    return `<div class="stp-wrap" data-id="${id}">
        <input type="hidden" id="${id}" value="${String(selH).padStart(2,'0')}:${String(selM).padStart(2,'0')}">
        <button type="button" class="stp-trigger">${String(selH).padStart(2,'0')}:${String(selM).padStart(2,'0')}</button>
        <div class="stp-dropdown" hidden>
            <div class="stp-cols">
                <div class="stp-col-wrap"><div class="stp-col-label">HH</div><div class="stp-col" data-unit="h">${hours}</div></div>
                <div class="stp-sep">:</div>
                <div class="stp-col-wrap"><div class="stp-col-label">MM</div><div class="stp-col" data-unit="m">${minutes}</div></div>
            </div>
            <button type="button" class="stp-confirm">Listo</button>
        </div>
    </div>`;
}

function initSchedTimePickers() {
    document.querySelectorAll('.stp-wrap').forEach(wrap => {
        const id = wrap.dataset.id;
        const hidden = document.getElementById(id);
        const trigger = wrap.querySelector('.stp-trigger');
        const dropdown = wrap.querySelector('.stp-dropdown');

        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = !dropdown.hidden;
            document.querySelectorAll('.stp-dropdown').forEach(d => { d.hidden = true; });
            if (isOpen) return;
            dropdown.hidden = false;
            // Scroll to selected items
            dropdown.querySelectorAll('.stp-col').forEach(col => {
                const sel = col.querySelector('.is-sel');
                if (sel) { col.scrollTop = sel.offsetTop - col.clientHeight / 2 + sel.clientHeight / 2; }
            });
        });

        wrap.querySelector('.stp-col[data-unit="h"]').addEventListener('click', (e) => {
            const btn = e.target.closest('.stp-item');
            if (!btn) return;
            e.stopPropagation();
            wrap.querySelectorAll('.stp-col[data-unit="h"] .stp-item').forEach(b => b.classList.remove('is-sel'));
            btn.classList.add('is-sel');
            const [, m] = hidden.value.split(':');
            hidden.value = `${String(btn.dataset.val).padStart(2,'0')}:${m}`;
            trigger.textContent = hidden.value;
        });

        wrap.querySelector('.stp-col[data-unit="m"]').addEventListener('click', (e) => {
            const btn = e.target.closest('.stp-item');
            if (!btn) return;
            e.stopPropagation();
            wrap.querySelectorAll('.stp-col[data-unit="m"] .stp-item').forEach(b => b.classList.remove('is-sel'));
            btn.classList.add('is-sel');
            const [h] = hidden.value.split(':');
            hidden.value = `${h}:${String(btn.dataset.val).padStart(2,'0')}`;
            trigger.textContent = hidden.value;
        });

        wrap.querySelector('.stp-confirm').addEventListener('click', (e) => {
            e.stopPropagation();
            dropdown.hidden = true;
        });
    });
}

function openScheduleModal(profId) {
    if (!canAccessProfessional(profId)) return;
    const prof = DB.get('professionals').find(x => x.id === profId);
    
    const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    
    let daysHtml = '';
    for(let i=0; i<7; i++) {
        const d = prof.schedule[i] || { active: false, start: '08:00', end: '16:00' };
        daysHtml += `
            <div class="schedule-day-row">
                <div class="schedule-day-label">
                    <label class="schedule-day-check">
                        <input type="checkbox" id="sch-active-${i}" ${d.active ? 'checked' : ''} class="w-4 h-4 text-primary-600 rounded">
                        <span class="schedule-day-name">${days[i]}</span>
                    </label>
                </div>
                <div class="schedule-time-grid">
                    <div class="schedule-time-field">
                        <span class="schedule-time-caption">Desde</span>
                        ${buildSchedTimePicker(`sch-start-${i}`, d.start)}
                    </div>
                    <div class="schedule-time-separator">a</div>
                    <div class="schedule-time-field">
                        <span class="schedule-time-caption">Hasta</span>
                        ${buildSchedTimePicker(`sch-end-${i}`, d.end)}
                    </div>
                </div>
            </div>
        `;
    }

    modalsContainer.innerHTML = `
        <div class="modal-overlay active">
            <div class="modal-content modal-content-schedule w-auto max-w-2xl" onclick="event.stopPropagation()">
                <div class="modal-header">
                    <h3>Horarios Diarios de ${escapeHtml(prof.name)}</h3>
                </div>
                <form id="schedule-form">
                    <div class="modal-body max-h-[60vh] overflow-y-auto">
                        <div class="schedule-form-shell">
                            <p class="schedule-form-intro">Selecciona qué días trabaja el profesional y define su horario de entrada y salida.</p>
                            <div class="schedule-days-list">
                                ${daysHtml}
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer schedule-modal-footer">
                        <button type="button" class="btn btn-ghost" onclick="closeModal()">Cancelar</button>
                        <button type="submit" class="btn btn-primary">Actualizar Agenda</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    initSchedTimePickers();
    // ESC cierra el modal
    const _escHandler = (e) => {
        if (e.key !== 'Escape') return;
        closeModal();
    };
    document.addEventListener('keydown', _escHandler, { once: true });
    document.getElementById('schedule-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const newSched = {};
        for(let i=0; i<7; i++) {
            newSched[i] = {
                active: document.getElementById(`sch-active-${i}`).checked,
                start: document.getElementById(`sch-start-${i}`).value,
                end: document.getElementById(`sch-end-${i}`).value
            };
        }
        // Validar cada día activo
        for (let i = 0; i < 7; i++) {
            if (!newSched[i].active) continue;
            const start = newSched[i].start;
            const end = newSched[i].end;

            // Convertir a minutos
            const [sh, sm] = start.split(':').map(Number);
            const [eh, em] = end.split(':').map(Number);
            const startMins = sh * 60 + sm;
            const endMins = eh * 60 + em;

            const days = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];

            if (startMins >= endMins) {
                alert(`${days[i]}: el horario de inicio debe ser antes que el de fin.`);
                return;
            }
            if (endMins - startMins < 30) {
                alert(`${days[i]}: el horario mínimo de atención es 30 minutos.`);
                return;
            }
        }

        try {
            await withAppLoading('Guardando horarios...', async () => {
                if (state.authToken) {
                    await apiFetch(`/professionals/${profId}`, {
                        method: 'PUT',
                        body: JSON.stringify({
                            fullName: prof.name,
                            specialty: prof.specialty || '',
                            email: prof.email || '',
                            phone: prof.phone || '',
                            color: prof.color || '#6366f1',
                            active: prof.active !== false && prof.status !== 'inactivo',
                            schedules: buildProfessionalSchedulesPayload(newSched)
                        })
                    });
                    await syncBackendSnapshotToLocalDb();
                } else {
                    DB.update('professionals', profId, { schedule: newSched });
                }
            });

            closeModal();
            refreshCurrentView();
        } catch (error) {
            alert(error.message || 'No se pudieron guardar los horarios.');
        }
    });
}

// ── Exportación de pacientes a Excel ──────────────────────────────────────────
function exportPatients() {
    if (typeof XLSX === 'undefined') {
        const script = document.createElement('script');
        script.src = '/xlsx.full.min.js';
        script.onload = () => exportPatients();
        script.onerror = () => showAlert('No se pudo cargar la librería para generar Excel.', { title: 'Error', variant: 'error' });
        document.head.appendChild(script);
        return;
    }
    const patients = DB.get('patients') || [];
    if (patients.length === 0) {
        showAlert('No hay pacientes para exportar.', { title: 'Sin datos', variant: 'warning' });
        return;
    }
    const rows = patients.map(p => ({
        'Nombre completo':  p.name || p.fullName || '',
        'DNI':              p.dni || '',
        'Teléfono':         p.phone || '',
        'Email':            p.email || '',
        'Dirección':        p.domicilio || p.address || '',
        'Obra social':      p.obraSocial || p.insuranceName || '',
        'Plan':             p.insurancePlan || '',
        'Credencial':       p.credencial || p.credentialNumber || '',
        'Historia':         p.fichaNumero || p.chartNumber || '',
        'Fecha nacimiento': p.fechaNacimiento || p.birthDate || '',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Pacientes');
    // Ancho de columnas automático
    const colWidths = Object.keys(rows[0]).map(k => ({ wch: Math.max(k.length, 16) }));
    ws['!cols'] = colWidths;
    const fecha = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `pacientes_odentara_${fecha}.xlsx`);
}

// ── Importación de pacientes desde Excel ──────────────────────────────────────
function openPatientImportModal() {
    if (typeof XLSX === 'undefined') {
        // Intentar cargar SheetJS dinámicamente si no cargó por CDN
        const script = document.createElement('script');
        script.src = '/xlsx.full.min.js';
        script.onload = () => openPatientImportModal();
        script.onerror = () => showAlert('No se pudo cargar la librería para leer Excel. Verificá tu conexión a internet.', { title: 'Error', variant: 'error' });
        document.head.appendChild(script);
        return;
    }

    // Columnas aceptadas (case-insensitive, con y sin tildes)
    const COL_MAP = {
        nombre: 'fullName', apellido: 'fullName', 'nombre completo': 'fullName',
        dni: 'dni', documento: 'dni',
        telefono: 'phone', tel: 'phone', celular: 'phone',
        'teléfono': 'phone',
        email: 'email', correo: 'email',
        direccion: 'address', domicilio: 'address',
        'dirección': 'address',
        'obra social': 'insuranceName', 'obrasocial': 'insuranceName', mutual: 'insuranceName',
        plan: 'insurancePlan',
        credencial: 'credentialNumber', 'nro credencial': 'credentialNumber',
        historia: 'chartNumber', 'nro historia': 'chartNumber', 'historia clinica': 'chartNumber',
        nacimiento: 'birthDate', 'fecha nacimiento': 'birthDate', 'fecha de nacimiento': 'birthDate',
    };

    function normalize(s) {
        return String(s || '').trim().toLowerCase()
            .replace(/[áàäâ]/g, 'a')
            .replace(/[éèëê]/g, 'e')
            .replace(/[íìïî]/g, 'i')
            .replace(/[óòöô]/g, 'o')
            .replace(/[úùüû]/g, 'u')
            .replace(/ñ/g, 'n');
    }

    function parseSheet(file) {
        return new Promise((resolve, reject) => {
            const isCsv = file.name.toLowerCase().endsWith('.csv');
            const reader = new FileReader();
            reader.onload = e => {
                try {
                    let wb;
                    if (isCsv) {
                        // Leer CSV como texto UTF-8 para preservar acentos
                        wb = XLSX.read(e.target.result, { type: 'string' });
                    } else {
                        wb = XLSX.read(e.target.result, { type: 'array', cellDates: true });
                    }
                    const ws = wb.Sheets[wb.SheetNames[0]];
                    const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
                    resolve(rows);
                } catch(err) { reject(err); }
            };
            reader.onerror = reject;
            if (isCsv) {
                reader.readAsText(file, 'UTF-8');
            } else {
                reader.readAsArrayBuffer(file);
            }
        });
    }

    function mapRow(raw) {
        const out = {};
        for (const [col, val] of Object.entries(raw)) {
            const key = COL_MAP[normalize(col)];
            if (!key) continue;
            if (key === 'fullName' && out.fullName) {
                out.fullName = out.fullName + ' ' + String(val).trim(); // apellido separado
            } else {
                if (key === 'birthDate' && typeof val === 'number') {
                    // XLSX convierte fechas CSV a serial de Excel; convertir a ISO
                    const d = new Date(Math.round((val - 25569) * 86400 * 1000));
                    out[key] = isNaN(d) ? '' : d.toISOString().slice(0, 10);
                } else {
                    out[key] = val instanceof Date
                        ? val.toISOString().slice(0,10)
                        : String(val).trim();
                }
            }
        }
        return out;
    }

    function renderPreview(rows, existingDnis) {
        const existing = DB.get('patients').map(p => p.dni);
        const dupeSet = new Set(existing);
        let html = `<div style="max-height:320px;overflow-y:auto;margin-top:12px">
        <table style="width:100%;border-collapse:collapse;font-size:12px">
            <thead style="position:sticky;top:0;background:var(--surface,#fff)">
                <tr>
                    <th style="padding:6px 8px;text-align:left;border-bottom:1px solid var(--border)">Estado</th>
                    <th style="padding:6px 8px;text-align:left;border-bottom:1px solid var(--border)">Nombre</th>
                    <th style="padding:6px 8px;text-align:left;border-bottom:1px solid var(--border)">DNI</th>
                    <th style="padding:6px 8px;text-align:left;border-bottom:1px solid var(--border)">Teléfono</th>
                    <th style="padding:6px 8px;text-align:left;border-bottom:1px solid var(--border)">Obra social</th>
                </tr>
            </thead><tbody>`;
        let willImport = 0, willUpdate = 0, willSkip = 0, willError = 0;
        const seenDnis = new Set();
        // Mapa de paciente local para detectar cuáles se pueden completar
        const localPatientMap = new Map(DB.get('patients').map(p => [String(p.dni).replace(/\D/g,''), p]));
        for (const row of rows) {
            const mapped = mapRow(row);
            const dniClean = mapped.dni ? String(mapped.dni).replace(/\D/g,'') : '';
            const isDupe = dniClean && (dupeSet.has(dniClean) || seenDnis.has(dniClean));
            const noName  = !mapped.fullName;
            const noDni   = !mapped.dni;
            const noPhone = !mapped.phone;
            if (dniClean) seenDnis.add(dniClean);
            let badge, rowStyle;
            if (noName || noDni || noPhone) {
                const missing = [noName && 'nombre', noDni && 'DNI', noPhone && 'teléfono'].filter(Boolean).join(', ');
                badge = `<span style="background:#fee2e2;color:#991b1b;padding:2px 6px;border-radius:4px;font-size:10px;font-weight:600" title="Falta: ${missing}">Error</span>`;
                rowStyle = 'background:rgba(239,68,68,0.04)';
                willError++;
            } else if (isDupe) {
                // Verificar si el paciente local tiene campos vacíos que el Excel puede completar
                const local = localPatientMap.get(dniClean);
                const canFill = local && ['phone','email','address','insuranceName'].some(f => !local[f] && mapped[f === 'insuranceName' ? 'insuranceName' : f]);
                if (canFill) {
                    badge = `<span style="background:#dbeafe;color:#1e40af;padding:2px 6px;border-radius:4px;font-size:10px;font-weight:600" title="Se completarán datos faltantes">Actualizar</span>`;
                    rowStyle = 'background:rgba(59,130,246,0.04)';
                    willUpdate++;
                } else {
                    badge = `<span style="background:#fef3c7;color:#92400e;padding:2px 6px;border-radius:4px;font-size:10px;font-weight:600">Duplicado</span>`;
                    rowStyle = 'background:rgba(245,158,11,0.06)';
                    willSkip++;
                }
            } else {
                badge = `<span style="background:#d1fae5;color:#065f46;padding:2px 6px;border-radius:4px;font-size:10px;font-weight:600">Nuevo</span>`;
                rowStyle = '';
                willImport++;
            }
            html += `<tr style="${rowStyle}">
                <td style="padding:5px 8px;border-bottom:1px solid var(--border)">${badge}</td>
                <td style="padding:5px 8px;border-bottom:1px solid var(--border)">${mapped.fullName || '<i style="color:#9ca3af">Sin nombre</i>'}</td>
                <td style="padding:5px 8px;border-bottom:1px solid var(--border);font-family:monospace">${mapped.dni || '<i style="color:#9ca3af">Sin DNI</i>'}</td>
                <td style="padding:5px 8px;border-bottom:1px solid var(--border)">${mapped.phone || '—'}</td>
                <td style="padding:5px 8px;border-bottom:1px solid var(--border)">${mapped.insuranceName || '—'}</td>
            </tr>`;
        }
        html += `</tbody></table></div>
        <div style="display:flex;gap:12px;margin-top:10px;font-size:12px;font-weight:600;flex-wrap:wrap">
            ${willImport ? `<span style="color:#065f46"><i class="fa-solid fa-circle-check"></i> ${willImport} para importar</span>` : ''}
            ${willUpdate ? `<span style="color:#1e40af"><i class="fa-solid fa-pen-to-square"></i> ${willUpdate} para actualizar</span>` : ''}
            ${willSkip   ? `<span style="color:#92400e"><i class="fa-solid fa-triangle-exclamation"></i> ${willSkip} duplicado${willSkip!==1?'s':''}</span>` : ''}
            ${willError  ? `<span style="color:#991b1b"><i class="fa-solid fa-circle-xmark"></i> ${willError} con error</span>` : ''}
        </div>`;
        return { html, willImport: willImport + willUpdate };
    }

    let _parsedRows = [];

    const modal = document.createElement('div');
    modal.className = 'modal-overlay active';
    modal.innerHTML = `
    <div class="modal-content" style="max-width:680px;width:95vw;margin-top:2rem">
        <div class="modal-header">
            <h3 class="modal-title"><i class="fa-solid fa-file-excel" style="color:#16a34a"></i> Importar pacientes desde Excel</h3>
            <button class="modal-close" id="import-modal-close"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div class="modal-body">
            <div id="import-dropzone" style="border:2px dashed var(--border);border-radius:10px;padding:32px;text-align:center;cursor:pointer;transition:border-color .15s">
                <i class="fa-solid fa-cloud-arrow-up" style="font-size:2rem;color:#6366f1;margin-bottom:8px"></i>
                <div style="font-weight:600;margin-bottom:4px">Arrastrá tu archivo Excel o CSV aquí</div>
                <div style="font-size:12px;color:#6b7280">Formatos: .xlsx, .xls, .csv — columnas: Nombre, DNI, Teléfono, Email, Obra Social, Plan, Dirección, Nacimiento</div>
                <input type="file" id="import-file-input" accept=".xlsx,.xls,.csv" style="display:none">
                <button class="btn btn-secondary mt-4" id="import-pick-file" style="margin-top:12px"><i class="fa-solid fa-folder-open"></i> Elegir archivo</button>
            </div>
            <div id="import-preview"></div>
        </div>
        <div class="modal-footer">
            <a href="#" id="import-download-template" style="font-size:12px;color:#6366f1;text-decoration:none;margin-right:auto"><i class="fa-solid fa-download"></i> Descargar plantilla</a>
            <button class="btn btn-ghost" id="import-cancel">Cancelar</button>
            <button class="btn btn-primary" id="import-confirm" disabled><i class="fa-solid fa-file-import"></i> Importar</button>
        </div>
    </div>`;

    document.body.appendChild(modal);

    const fileInput = modal.querySelector('#import-file-input');
    const dropzone  = modal.querySelector('#import-dropzone');
    const preview   = modal.querySelector('#import-preview');
    const confirmBtn = modal.querySelector('#import-confirm');

    function close() { modal.classList.remove('active'); setTimeout(() => modal.remove(), 200); }
    modal.addEventListener('click', e => { if (e.target === modal) close(); });
    modal.querySelector('#import-modal-close').onclick = close;
    modal.querySelector('#import-cancel').onclick = close;
    modal.querySelector('#import-pick-file').onclick = () => fileInput.click();

    // Plantilla descargable
    modal.querySelector('#import-download-template').onclick = e => {
        e.preventDefault();
        const ws = XLSX.utils.aoa_to_sheet([
            ['Nombre','DNI','Teléfono','Email','Dirección','Obra Social','Plan','Credencial','Historia','Nacimiento'],
            ['Juan Pérez','12345678','2613001234','juan@mail.com','Av. San Martín 100','OSDE','210','12345','HC001','1985-03-15'],
        ]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Pacientes');
        XLSX.writeFile(wb, 'plantilla_pacientes.xlsx');
    };

    // Drag & drop
    dropzone.addEventListener('dragover', e => { e.preventDefault(); dropzone.style.borderColor='#6366f1'; });
    dropzone.addEventListener('dragleave', () => { dropzone.style.borderColor=''; });
    dropzone.addEventListener('drop', e => {
        e.preventDefault();
        dropzone.style.borderColor='';
        if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
    });
    fileInput.addEventListener('change', () => { if (fileInput.files[0]) handleFile(fileInput.files[0]); });

    async function handleFile(file) {
        preview.innerHTML = '<div style="padding:16px;text-align:center;color:#6b7280"><i class="fa-solid fa-spinner fa-spin"></i> Procesando...</div>';
        confirmBtn.disabled = true;
        try {
            _parsedRows = await parseSheet(file);
            if (_parsedRows.length === 0) {
                preview.innerHTML = '<div style="color:#ef4444;padding:12px">El archivo está vacío o no tiene el formato correcto.</div>';
                return;
            }
            const { html, willImport } = renderPreview(_parsedRows);
            preview.innerHTML = `<div style="margin-top:8px;font-size:12px;color:#6b7280">${file.name} — ${_parsedRows.length} fila${_parsedRows.length!==1?'s':''}</div>` + html;
            confirmBtn.disabled = willImport === 0;
        } catch(err) {
            preview.innerHTML = `<div style="color:#ef4444;padding:12px">Error al leer el archivo: ${err.message}</div>`;
        }
    }

    confirmBtn.onclick = async () => {
        if (_parsedRows.length === 0) return;
        confirmBtn.disabled = true;
        confirmBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Importando...';
        // Enviar todas las filas válidas; el backend descarta duplicados
        const seenDnis = new Set();
        const patients = _parsedRows.map(mapRow).filter(r => {
            if (!r.fullName || !r.dni || !r.phone) return false;
            const dni = String(r.dni).replace(/\D/g, '');
            if (seenDnis.has(dni)) return false;
            seenDnis.add(dni);
            return true;
        });
        try {
            const res = await apiFetch('/patients/import', { method: 'POST', body: JSON.stringify({ patients }) });
            if (!res.ok) throw new Error(res.error || 'Error al importar');
            await syncBackendSnapshotToLocalDb();
            close();
            refreshCurrentView();
            const parts = [];
            if (res.created) parts.push(`${res.created} paciente${res.created!==1?'s':''} importado${res.created!==1?'s':''}`);
            if (res.updated) parts.push(`${res.updated} paciente${res.updated!==1?'s':''} modificado${res.updated!==1?'s':''}`);
            if (res.skipped) parts.push(`${res.skipped} omitido${res.skipped!==1?'s':''}`);
            showToast(`✓ ${parts.join(' · ')}`, { type: 'success', duration: 7000 });
        } catch(err) {
            showToast(err.message, 'error');
            confirmBtn.disabled = false;
            confirmBtn.innerHTML = '<i class="fa-solid fa-file-import"></i> Importar';
        }
    };
}

function openPatientModal(editId = null) {
    const p = editId ? getAccessiblePatients().find(x => x.id === editId) : null;
    if (editId && !p) return;
    modalsContainer.innerHTML = `
        <div class="modal-overlay active">
            <div class="modal-content modal-content-patient" onclick="event.stopPropagation()">
                <div class="modal-header">
                    <h3>${editId ? 'Editar Paciente' : 'Nuevo Paciente'}</h3>
                </div>
                <form id="patient-form">
                    <div class="modal-body">
                        <div class="form-feedback" id="patient-form-feedback" hidden></div>
                        <div class="input-group"><label>Nombre y Apellido *</label><input type="text" id="p-name" value="${p?escapeHtml(p.name):''}" required></div>
                        <div class="patient-form-row patient-form-row-2">
                            <div class="input-group flex-1"><label>DNI *</label><input type="text" id="p-dni" value="${p?escapeHtml(p.dni||''):''}" required></div>
                            <div class="input-group flex-1"><label>Teléfono (Celular) *</label><input type="text" id="p-phone" value="${p?escapeHtml(p.phone||''):''}" required></div>
                        </div>
                        <div class="patient-form-row patient-form-row-2">
                            <div class="input-group flex-1"><label>Fecha de Nacimiento</label><input type="date" id="p-nacimiento" value="${p?escapeHtml(p.fechaNacimiento||''):''}"></div>
                            <div class="input-group flex-1"><label>Email</label><input type="email" id="p-email" value="${p?escapeHtml(p.email||''):''}"></div>
                        </div>
                        <div class="input-group"><label>Domicilio</label><input type="text" id="p-domicilio" value="${p?escapeHtml(p.domicilio||''):''}"></div>
                        <div class="patient-form-row patient-form-row-3">
                            <div class="input-group flex-1"><label>Obra Social / Plan</label><input type="text" id="p-obrasocial" value="${p?escapeHtml(p.obraSocial||''):''}"></div>
                            <div class="input-group flex-1"><label>Credencial</label><input type="text" id="p-credencial" value="${p?escapeHtml(p.credencial||''):''}"></div>
                            <div class="input-group flex-1"><label>Ficha N°</label><input type="text" id="p-ficha" value="${p?escapeHtml(p.fichaNumero||''):''}"></div>
                        </div>
                        <div class="input-group"><label>Observaciones Médicas / Alergias</label><input type="text" id="p-notes" value="${p?escapeHtml(p.notes||''):''}"></div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-ghost" onclick="closeModal()">Cancelar</button>
                        <button type="submit" class="btn btn-primary">Guardar Paciente</button>
                    </div>
                </form>
            </div>
        </div>
    `;

    // ESC cierra el modal
    const _escHandler = (e) => {
        if (e.key !== 'Escape') return;
        closeModal();
    };
    document.addEventListener('keydown', _escHandler, { once: true });
    const patientForm = document.getElementById('patient-form');

    // Al editar, cargar las notas desde el ClinicalRecord
    if (editId && state.authToken) {
        const _profId = getCurrentOdontoProfessionalId() || getAccessibleProfessionals()[0]?.id || null;
        const _url = _profId ? `/clinical-records/${editId}?professionalId=${_profId}` : null;
        if (_url) {
            apiFetch(_url).then(res => {
                const notesField = document.getElementById('p-notes');
                if (notesField && res?.record?.summaryNotes) {
                    notesField.value = res.record.summaryNotes;
                }
            }).catch(() => {});
        }
    }

    ['#p-name', '#p-dni', '#p-phone', '#p-email'].forEach((selector) => {
        const field = patientForm.querySelector(selector);
        if (!field) return;

        field.addEventListener('input', () => {
            if (field.classList.contains('input-invalid')) {
                clearFormValidation(patientForm);
            }
        });
    });

    patientForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const validation = await validatePatientForm(patientForm, editId);
        if (!validation.ok) {
            return;
        }

        const data = {
            name: document.getElementById('p-name').value,
            dni: validation.normalizedDni,
            email: document.getElementById('p-email').value,
            phone: document.getElementById('p-phone').value,
            fechaNacimiento: document.getElementById('p-nacimiento').value,
            domicilio: document.getElementById('p-domicilio').value,
            obraSocial: document.getElementById('p-obrasocial').value,
            credencial: document.getElementById('p-credencial').value,
            fichaNumero: document.getElementById('p-ficha').value,
            notes: document.getElementById('p-notes').value,
            lastVisit: p ? p.lastVisit : getTodayIsoLocal(),
            odontograma: p ? p.odontograma : {},
            treatments: p ? p.treatments : [],
            clinicalImages: p ? (p.clinicalImages || []) : []
        };
        try {
            await withAppLoading(editId ? 'Actualizando paciente...' : 'Guardando paciente...', async () => {
                if (state.authToken) {
                    const payload = buildPatientApiPayload(data);
                    let targetPatientId = editId;
                    if (editId) {
                        await apiFetch(`/patients/${editId}`, {
                            method: 'PUT',
                            body: JSON.stringify(payload)
                        });
                    } else {
                        const res = await apiFetch('/patients', {
                            method: 'POST',
                            body: JSON.stringify(payload)
                        });
                        targetPatientId = res?.patient?.id || null;
                    }
                    // Guardar notas en el ClinicalRecord (requiere professionalId)
                    const _profId = getCurrentOdontoProfessionalId() || getAccessibleProfessionals()[0]?.id || null;
                    if (targetPatientId && _profId && data.notes !== undefined) {
                        await apiFetch(`/clinical-records/${targetPatientId}`, {
                            method: 'PUT',
                            body: JSON.stringify({ professionalId: _profId, summaryNotes: data.notes || null })
                        });
                    }
                    await syncBackendSnapshotToLocalDb();
                } else {
                    if (editId) DB.update('patients', editId, data); else DB.add('patients', data);
                }
            });

            closeModal();
            refreshCurrentView();
        } catch (error) {
            const mapped = applyPatientApiErrorToForm(patientForm, error);
            if (!mapped) {
                showFormFeedback(patientForm, error.message || 'No se pudo guardar el paciente.');
            }
        }
    });
}

function openBillingModal(preselectedPatientId = null) {
    const patients = getAccessiblePatients();
    const professionals = getAccessibleProfessionals();

    if (patients.length === 0) { alert("Debes crear pacientes primero en el directorio."); return; }

    modalsContainer.innerHTML = `
        <div class="modal-overlay active">
            <div class="modal-content modal-content-billing" onclick="event.stopPropagation()">
                <div class="modal-header">
                    <h3>Nueva Transacción</h3>
                    <button class="btn-ghost" data-modal-close><i class="fa-solid fa-times"></i></button>
                </div>
                <form id="tx-form">
                    <div class="modal-body">
                        <div class="input-group">
                            <label>Paciente</label>
                            <input type="text" id="tx-patient-search" autocomplete="off" placeholder="Buscar por nombre o DNI..." style="width:100%;"
                                value="${preselectedPatientId ? (patients.find(p => p.id === preselectedPatientId)?.name + ' (DNI ' + patients.find(p => p.id === preselectedPatientId)?.dni + ')') : ''}">
                            <input type="hidden" id="tx-patient" value="${preselectedPatientId || ''}">
                        </div>
                        <div class="input-group">
                            <label>Profesional Asignado a la Transacción</label>
                            <select id="tx-prof" required>
                                ${professionals.map(p => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('')}
                            </select>
                        </div>
                        <div class="input-group"><label>Tipo de Registro</label><select id="tx-type" required><option value="income">Abono / Pago recibido (Ingreso)</option><option value="debt">Cargo por Tratamiento (Deuda)</option></select></div>
                        <div class="input-group"><label>Monto ($)</label><input type="number" id="tx-amount" min="1" required></div>
                        <div class="input-group"><label>Concepto / Descripción</label><input type="text" id="tx-desc" required placeholder="Ej: Tratamiento conducto, Pago parcial..."></div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-ghost" onclick="closeModal()">Cancelar</button>
                        <button type="submit" class="btn btn-primary">Registrar en Cuenta Corriente</button>
                    </div>
                </form>
            </div>
        </div>
    `;

    // ESC cierra el modal
    const _escHandler = (e) => {
        if (e.key !== 'Escape') return;
        closeModal();
    };
    document.addEventListener('keydown', _escHandler, { once: true });
    // Autocomplete paciente — el dropdown se monta en body para evitar overflow:hidden del modal
    const txSearch = document.getElementById('tx-patient-search');
    const txHidden = document.getElementById('tx-patient');

    // Crear dropdown en body
    const txResults = document.createElement('div');
    txResults.id = 'tx-patient-results';
    txResults.style.cssText = 'display:none;position:fixed;background:var(--surface,#fff);border:1px solid var(--border,#e2e8f0);border-radius:0.5rem;box-shadow:0 10px 25px rgba(0,0,0,0.15);z-index:99999;max-height:220px;overflow-y:auto;';
    document.body.appendChild(txResults);

    function positionTxDropdown() {
        const rect = txSearch.getBoundingClientRect();
        txResults.style.top  = (rect.bottom + 4) + 'px';
        txResults.style.left = rect.left + 'px';
        txResults.style.width = rect.width + 'px';
    }

    function removeTxDropdown() {
        txResults.style.display = 'none';
    }

    txSearch.addEventListener('input', () => {
        const q = txSearch.value.trim().toLowerCase();
        txHidden.value = '';
        if (!q) { removeTxDropdown(); return; }
        const matches = patients.filter(p =>
            p.name.toLowerCase().includes(q) || String(p.dni).includes(q)
        ).slice(0, 8);
        if (!matches.length) { removeTxDropdown(); return; }
        txResults.innerHTML = matches.map(p =>
            `<div class="tx-patient-option" data-id="${p.id}" data-label="${escapeHtml(p.name)} (DNI ${p.dni})"
                style="padding:0.6rem 1rem;cursor:pointer;font-size:0.875rem;border-bottom:1px solid var(--border,#e2e8f0);">
                <strong>${escapeHtml(p.name)}</strong> <span style="color:var(--text-muted,#94a3b8);">DNI ${p.dni}</span>
            </div>`
        ).join('');
        positionTxDropdown();
        txResults.style.display = 'block';
        txResults.querySelectorAll('.tx-patient-option').forEach(opt => {
            opt.addEventListener('mousedown', (ev) => {
                ev.preventDefault();
                txHidden.value = opt.dataset.id;
                txSearch.value = opt.dataset.label;
                removeTxDropdown();
            });
            opt.addEventListener('mouseover', () => opt.style.background = 'var(--surface-hover,#f3f4f6)');
            opt.addEventListener('mouseout', () => opt.style.background = '');
        });
    });
    txSearch.addEventListener('blur', () => setTimeout(removeTxDropdown, 150));
    txSearch.addEventListener('focus', () => { if (txSearch.value) txSearch.dispatchEvent(new Event('input')); });
    // Limpiar el dropdown del body cuando se cierra el modal
    const _origCloseModal = typeof closeModal === 'function' ? closeModal : null;
    const _txCleanup = () => { if (txResults.parentNode) txResults.parentNode.removeChild(txResults); };
    document.querySelector('[data-modal-close]')?.addEventListener('click', _txCleanup, { once: true });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') _txCleanup(); }, { once: true });

    document.getElementById('tx-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!document.getElementById('tx-patient').value) {
            showAlert('Seleccioná un paciente de la lista.', { title: 'Transacción', variant: 'warning' });
            document.getElementById('tx-patient-search').focus();
            return;
        }
        const data = {
            patientId: parseInt(document.getElementById('tx-patient').value),
            professionalId: parseInt(document.getElementById('tx-prof').value),
            type: document.getElementById('tx-type').value,
            amount: parseFloat(document.getElementById('tx-amount').value),
            description: document.getElementById('tx-desc').value,
            date: getTodayIsoLocal()
        };

        try {
            await withAppLoading('Registrando movimiento...', async () => {
                if (state.authToken) {
                    await apiFetch('/billing', {
                        method: 'POST',
                        body: JSON.stringify(data)
                    });
                    await syncBackendSnapshotToLocalDb();
                } else {
                    DB.add('billing', data);
                }
            });

            closeModal();
            refreshCurrentView();
        } catch (error) {
            showAlert(error.message || 'No se pudo registrar el movimiento.', { title: 'Facturación', variant: 'error' });
        }
    });
}

function openPatientBillingPicker() {
    if (!canViewPatientBillingUi()) {
        showAlert('No tienes permisos para acceder a cuentas corrientes por paciente.', { title: 'Facturación', variant: 'error' });
        return;
    }

    const patients = getAccessiblePatients().sort((a, b) => a.name.localeCompare(b.name));
    if (!patients.length) {
        showAlert('No hay pacientes disponibles para consultar.', { title: 'Facturación', variant: 'warning' });
        return;
    }

    modalsContainer.innerHTML = `
        <div class="modal-overlay active">
            <div class="modal-content modal-content-billing" onclick="event.stopPropagation()">
                <div class="modal-header">
                    <h3>Cuenta Corriente por Paciente</h3>
                    <button class="btn-ghost" data-modal-close><i class="fa-solid fa-times"></i></button>
                </div>
                <div class="modal-body">
                    <div class="billing-patient-search-card billing-patient-search-card-modal">
                        <div class="billing-patient-search-head">
                            <div>
                                <span class="section-eyebrow">Buscar paciente</span>
                                <h4>Selecciona una cuenta corriente</h4>
                                <p>Escribe nombre o DNI para encontrar rápidamente al paciente correcto.</p>
                            </div>
                        </div>
                        <div class="patient-search-shell billing-patient-search-shell">
                            <input
                                type="search"
                                id="patient-billing-picker-search"
                                class="form-input w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 text-sm"
                                placeholder="Buscar por nombre o DNI..."
                                autocomplete="off"
                            >
                        </div>
                        <div id="patient-billing-picker-results" class="billing-patient-search-results"></div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-ghost" onclick="closeModal()">Cancelar</button>
                </div>
            </div>
        </div>
    `;

    syncPatientBillingPickerResults('');
}

function getBillingPatientSearchMatches(query = '', patients = getAccessiblePatients()) {
    const normalizedQuery = normalizePatientName(query);
    const normalizedDniQuery = normalizeDni(query);
    const sortedPatients = [...patients].sort((a, b) => a.name.localeCompare(b.name));

    if (!normalizedQuery && !normalizedDniQuery) {
        return [];
    }

    return sortedPatients
        .filter((patient) => {
            const patientName = normalizePatientName(patient.name);
            const patientDni = normalizeDni(patient.dni);
            return patientName.includes(normalizedQuery) || (normalizedDniQuery !== '' && patientDni.includes(normalizedDniQuery));
        })
        .slice(0, 10);
}

function renderBillingPatientSearchResultsMarkup(query = '', options = {}) {
    const { inModal = false } = options;
    const matches = getBillingPatientSearchMatches(query);

    if (!query.trim()) {
        return `
            <div class="billing-patient-search-empty">
                <i class="fa-solid fa-magnifying-glass"></i>
                <p>Escribe nombre o DNI para buscar una cuenta corriente.</p>
            </div>
        `;
    }

    if (!matches.length) {
        return `
            <div class="billing-patient-search-empty">
                <i class="fa-regular fa-folder-open"></i>
                <p>No encontramos pacientes que coincidan con esa búsqueda.</p>
            </div>
        `;
    }

    return matches.map((patient) => {
        const account = getPatientCurrentAccountSummary(patient.id);
        const professionalCount = account?.byProfessional?.length || 0;
        return `
            <button type="button" class="billing-patient-result btn-view-patient-billing" data-id="${patient.id}">
                <div class="billing-patient-result-main">
                    <strong>${patient.name}</strong>
                    <span>DNI ${patient.dni}</span>
                </div>
                <div class="billing-patient-result-meta">
                    <span>${professionalCount} profesional${professionalCount === 1 ? '' : 'es'} con movimientos</span>
                    <i class="fa-solid fa-chevron-right"></i>
                </div>
            </button>
        `;
    }).join('');
}

function syncPatientBillingPickerResults(query = '') {
    const resultsContainer = document.getElementById('patient-billing-picker-results');
    if (!resultsContainer) return;
    resultsContainer.innerHTML = renderBillingPatientSearchResultsMarkup(query, { inModal: true });
}

function syncBillingPatientSearchResults(query = '') {
    const resultsContainer = document.getElementById('billing-patient-search-results');
    if (!resultsContainer) return;
    resultsContainer.innerHTML = renderBillingPatientSearchResultsMarkup(query);
}

function filterBillingTable(query = '') {
    const q = query.trim().toLowerCase();
    const table = document.querySelector('#billing-text-search')?.closest('.view-content, section, main')?.querySelector('.table-container table tbody');
    if (!table) return;
    const rows = table.querySelectorAll('tr');
    rows.forEach(row => {
        if (!q) {
            row.style.display = '';
            return;
        }
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(q) ? '' : 'none';
    });
}

// --- Views Rendering ---
function renderDashboard() {
    const apts = getAccessibleAppointments();
    const patients = getAccessiblePatients();
    const today = getTodayIsoLocal();
    const todaysApts = apts
        .filter(apt => apt.date === today)
        .sort((a, b) => a.time.localeCompare(b.time));
    const selectedDate = state.dashboardDate || today;
    const selectedDateApts = apts
        .filter(apt => apt.date === selectedDate)
        .sort((a, b) => a.time.localeCompare(b.time));
    return renderDashboardContent(apts, patients, todaysApts, selectedDate, selectedDateApts);
    return `
        <div class="metrics-grid">
            <div class="card metric-card">
                <div class="metric-icon metric-blue"><i class="fa-solid fa-users"></i></div>
                <div class="metric-info"><h3>Total Pacientes</h3><p>${patients.length}</p></div>
            </div>
            <div class="card metric-card">
                <div class="metric-icon metric-green"><i class="fa-solid fa-calendar-check"></i></div>
                <div class="metric-info"><h3>Turnos Activos</h3><p>${apts.length}</p></div>
            </div>
            <div class="card metric-card">
                <div class="metric-icon metric-purple"><i class="fa-solid fa-bolt" style="color:var(--purple)"></i></div>
                <div class="metric-info"><h3>Sobreturnos</h3><p>${apts.filter(a => a.isOverbook).length}</p></div>
            </div>
        </div>

        <div class="table-container shadow-sm mt-6 border border-gray-200">
            <div class="table-header">
                <h3>Próximos Turnos</h3>
            </div>
            <div class="overflow-x-auto">
                <table class="w-full text-left">
                    <thead><tr><th>Hora</th><th>Paciente</th><th>Estado</th></tr></thead>
                    <tbody>
                        ${apts.sort((a,b)=>a.time.localeCompare(b.time)).slice(0, 5).map(apt => `
                            <tr class="${apt.isOverbook?'tr-sobreturno':''}">
                                <td><span class="font-semibold">${apt.time}</span> <span class="text-xs text-gray-500">(${apt.duration}m)</span></td>
                                <td>${escapeHtml(apt.patient)} ${apt.isOverbook ? '<span class="badge badge-purple text-xs ml-2">Sobreturno</span>' : ''}</td>
                                <td><span class="badge ${getAppointmentStatusMeta(apt.status).badge}">${getAppointmentStatusMeta(apt.status).label}</span></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

// --- Calendar State ---
const calendarState = {
    currentDate: getTodayIsoLocal(),
    viewMode: 'day', // 'day', 'week', 'month'
    visibleProfs: {}
};

function getSelectedCalendarProfessionalId(professionals = getAccessibleProfessionals()) {
    const selected = professionals.find((p) => calendarState.visibleProfs[p.id]);
    return selected ? selected.id : (professionals[0]?.id ?? null);
}

function setCalendarProfessionalSelection(professionals, selectedId) {
    professionals.forEach((p) => {
        calendarState.visibleProfs[p.id] = p.id === selectedId;
    });
}

function ensureSingleCalendarProfessional(professionals) {
    if (!professionals.length) {
        calendarState.visibleProfs = {};
        return null;
    }

    const selectedId = getSelectedCalendarProfessionalId(professionals);
    const safeSelectedId = professionals.some((p) => p.id === selectedId) ? selectedId : professionals[0].id;
    setCalendarProfessionalSelection(professionals, safeSelectedId);
    return safeSelectedId;
}

const PROF_COLORS = [
    { bg: '#14b8a6', text: '#ffffff' },
    { bg: '#8b5cf6', text: '#ffffff' },
    { bg: '#f97316', text: '#ffffff' },
    { bg: '#3b82f6', text: '#ffffff' },
    { bg: '#eab308', text: '#111827' },
    { bg: '#ec4899', text: '#ffffff' },
    { bg: '#10b981', text: '#ffffff' },
];

/**
 * Devuelve '#111827' (negro) o '#ffffff' (blanco) según la luminancia del color
 * de fondo, usando la fórmula WCAG para garantizar contraste legible.
 */
function getContrastTextColor(hex) {
    const h = String(hex || '').replace('#', '');
    if (h.length < 6) return '#ffffff';
    const r = parseInt(h.slice(0, 2), 16) / 255;
    const g = parseInt(h.slice(2, 4), 16) / 255;
    const b = parseInt(h.slice(4, 6), 16) / 255;
    const toLinear = c => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    const L = 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
    return L > 0.179 ? '#111827' : '#ffffff';
}

function getProfColor(profId) {
    const profs = DB.get('professionals');
    const clinicSettings = getClinicSettings();
    const customColorMap = clinicSettings.professionalColors || {};
    const idx = profs.findIndex(p => p.id === profId);
    const paletteColor = PROF_COLORS[(idx >= 0 ? idx : 0) % PROF_COLORS.length] || { bg: '#6b7280', text: '#ffffff' };
    // Solo usar color personalizado si fue explícitamente asignado en configuración
    const customColor = customColorMap[String(profId)];
    const bg = customColor ? normalizeHexColor(customColor, paletteColor.bg) : paletteColor.bg;
    // Calcular texto con contraste automático para colores personalizados
    const text = customColor ? getContrastTextColor(bg) : paletteColor.text;
    return { bg, text };
}

function getAppointmentVisual(apt) {
    const profColor = getProfColor(apt.professionalId);
    const status = normalizeAppointmentStatus(apt.status);

    if (status === 'cancelled') {
        return {
            bg: '#fef2f2',
            text: '#b91c1c',
            border: '#fca5a5',
            accent: '#ef4444',
            cancelled: true
        };
    }

    if (apt.isOverbook) {
        return {
            bg: '#fff7ed',
            text: '#9a3412',
            border: '#f97316',
            accent: '#fb923c'
        };
    }

    return {
        bg: profColor.bg,
        text: profColor.text,
        border: profColor.bg,
        accent: profColor.bg
    };
}

function getWeekDays(offset = 0) {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const monday = new Date(today);
    monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1) + offset * 7);
    const days = [];
    for (let i = 0; i < 7; i++) {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        days.push(d);
    }
    return days;
}

function isCompactAppointmentsLayout() {
    return window.innerWidth <= 1024;
}

function renderCalendarFilterLegend(professionals, options = {}) {
    // Con un solo profesional no hay nada que filtrar — ocultar la barra
    if (!professionals || professionals.length <= 1) return '';
    const {
        horizontal = false,
        compact = false
    } = options;
    const selectedId = ensureSingleCalendarProfessional(professionals);
    return `
        <div class="cal-legend ${isCompactAppointmentsLayout() ? 'cal-legend-mobile' : ''} ${horizontal ? 'cal-legend-horizontal' : ''} ${compact ? 'cal-legend-compact' : ''}">
            <div class="cal-legend-title">Profesionales</div>
            <div class="cal-legend-list">
                ${professionals.map(p => {
                    const color = getProfColor(p.id);
                    return `<button type="button" class="cal-legend-item cal-prof-select ${selectedId === p.id ? 'is-active' : ''}" data-id="${p.id}">
                        <span class="cal-legend-chip" style="background:${color.bg}; color:${color.text};">${escapeHtml(p.name)}</span>
                    </button>`;
                }).join('')}
            </div>
        </div>`;
}

function renderCalendarToolbar(dateLabel, canEdit) {
    return `
        <div class="cal-toolbar card mb-4">
            <div class="cal-toolbar-inner">
                <div class="cal-toolbar-nav">
                    <button class="btn btn-ghost btn-sm" id="cal-prev" aria-label="Día anterior"><i class="fa-solid fa-chevron-left"></i></button>
                    <span class="font-semibold text-gray-700 text-sm cal-toolbar-date" id="cal-date-display">${dateLabel}</span>
                    <button class="btn btn-ghost btn-sm" id="cal-next" aria-label="Día siguiente"><i class="fa-solid fa-chevron-right"></i></button>
                </div>
                <div class="cal-toolbar-actions">
                    <div class="cal-view-switcher" role="tablist" aria-label="Vista del calendario">
                        <button class="btn btn-secondary btn-sm ${calendarState.viewMode === 'day' ? 'is-active' : ''}" id="cal-view-today">Hoy</button>
                        <button class="btn btn-secondary btn-sm ${calendarState.viewMode === 'week' ? 'is-active' : ''}" id="cal-view-week">Semana</button>
                        <button class="btn btn-secondary btn-sm ${calendarState.viewMode === 'month' ? 'is-active' : ''}" id="cal-view-month">Mes</button>
                    </div>
                    ${canEdit ? '<button class="btn btn-primary btn-sm" id="btn-add-apt"><i class="fa-solid fa-plus"></i> Nuevo Turno</button>' : ''}
                </div>
            </div>
        </div>
    `;
}

function formatAppointmentCountLabel(count) {
    if (!count) return 'Sin turnos';
    return `${count} turno${count === 1 ? '' : 's'}`;
}

function renderAppointmentCompactCard(apt) {
    const patient = getPatientByAppointment(apt);
    const statusMeta = getAppointmentStatusMeta(apt.status);
    const visual = getAppointmentVisual(apt);
    return `
        <article class="cal-mobile-card ${apt.isOverbook ? 'is-overbook' : ''} ${visual.cancelled ? 'is-cancelled' : ''}" style="border-left-color:${visual.border}">
            <div class="cal-mobile-card-top">
                <div>
                    <div class="cal-mobile-card-time">${apt.time}</div>
                    <div class="cal-mobile-card-duration">${apt.duration} min</div>
                </div>
                <div class="cal-mobile-card-badges">
                    <span class="badge ${statusMeta.badge}">${statusMeta.label}</span>
                    ${apt.isOverbook ? '<span class="badge badge-purple">Sobreturno</span>' : ''}
                </div>
            </div>
            <div class="cal-mobile-card-name ${visual.cancelled ? 'cal-apt-name-cancelled' : ''}">${escapeHtml(apt.patient)}</div>
            <div class="cal-mobile-card-prof">${getProfName(apt.professionalId)}</div>
            <div class="cal-mobile-card-actions">
                ${patient && canViewClinicalHistoryUi() ? `<button class="btn btn-ghost btn-sm" onclick="loadClinicalHistory(${patient.id})">Historia</button>` : ''}
                <button class="btn btn-secondary btn-sm" onclick="openAppointmentViewModal(${apt.id})">Ver</button>
                ${canManageAppointmentsUi() ? `<button class="btn btn-primary btn-sm" onclick="openAppointmentModal(${apt.id})">Editar</button>` : ''}
            </div>
        </article>
    `;
}

function renderAppointmentsCompact(professionals, allApts, currentDate, canEdit) {
    const legendHtml = renderCalendarFilterLegend(professionals, { horizontal: true, compact: true });
    const toolbar = renderCalendarToolbar(
        parseLocalIsoDate(currentDate).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
        canEdit
    );
    const selectedProfessionalId = getSelectedCalendarProfessionalId(professionals);
    const selectedProfessionalColor = selectedProfessionalId
        ? getProfColor(selectedProfessionalId)
        : { bg: '#64748b', text: '#ffffff' };

    let sectionsHtml = '';

    if (calendarState.viewMode === 'day') {
        const selectedProfessionalId = ensureSingleCalendarProfessional(professionals);
        const visibleProfs = professionals.filter((p) => p.id === selectedProfessionalId);
        sectionsHtml = visibleProfs.map(prof => {
            const profApts = allApts
                .filter(apt => apt.date === currentDate && apt.professionalId === prof.id)
                .sort((a, b) => a.time.localeCompare(b.time));
            return `
                <section class="cal-mobile-section">
                    <header class="cal-mobile-section-header">${escapeHtml(prof.name)}</header>
                    <div class="cal-mobile-list">
                        ${profApts.length ? profApts.map(renderAppointmentCompactCard).join('') : '<div class="cal-mobile-empty">Sin turnos para este profesional.</div>'}
                    </div>
                </section>
            `;
        }).join('');
    } else if (calendarState.viewMode === 'week') {
        const startOfWeek = parseLocalIsoDate(currentDate);
        startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
        const days = Array.from({ length: 7 }, (_, index) => {
            const day = new Date(startOfWeek);
            day.setDate(startOfWeek.getDate() + index);
            return day;
        });
        sectionsHtml = days.map(day => {
            const iso = formatDateToLocalIso(day);
            const dayApts = allApts
                .filter(apt => apt.date === iso && calendarState.visibleProfs[apt.professionalId])
                .sort((a, b) => a.time.localeCompare(b.time));
            const countLabel = formatAppointmentCountLabel(dayApts.length);
            return `
                <section class="cal-mobile-section" data-calendar-date="${iso}" style="cursor:pointer;">
                    <header class="cal-mobile-section-header">${normalizeDateLabel(day.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' }))}</header>
                    <div class="cal-mobile-list">
                        ${dayApts.length
                            ? `<div class="cal-mobile-count" style="background:${selectedProfessionalColor.bg}; color:${selectedProfessionalColor.text};">${countLabel}</div>`
                            : '<div class="cal-mobile-empty">Sin turnos.</div>'}
                    </div>
                </section>
            `;
        }).join('');
    } else {
        const baseDate = parseLocalIsoDate(currentDate);
        const month = baseDate.getMonth();
        const year = baseDate.getFullYear();
        const monthApts = allApts
            .filter(apt => {
                const aptDate = parseLocalIsoDate(apt.date);
                return aptDate.getMonth() === month && aptDate.getFullYear() === year && calendarState.visibleProfs[apt.professionalId];
            })
            .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));

        const grouped = monthApts.reduce((acc, apt) => {
            acc[apt.date] ||= [];
            acc[apt.date].push(apt);
            return acc;
        }, {});

        sectionsHtml = Object.keys(grouped).length
            ? Object.entries(grouped).map(([dateStr, items]) => `
                <section class="cal-mobile-section" data-calendar-date="${dateStr}" style="cursor:pointer;">
                    <header class="cal-mobile-section-header">${normalizeDateLabel(parseLocalIsoDate(dateStr).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' }))}</header>
                    <div class="cal-mobile-list">
                        <div class="cal-mobile-count" style="background:${selectedProfessionalColor.bg}; color:${selectedProfessionalColor.text};">${formatAppointmentCountLabel(items.length)}</div>
                    </div>
                </section>
            `).join('')
            : '<div class="cal-mobile-empty cal-mobile-empty-root">No hay turnos para este mes.</div>';
    }

    return `
        <div class="cal-wrapper cal-wrapper-mobile">
            ${toolbar}
            ${legendHtml}
            <div class="cal-mobile-sections">${sectionsHtml}</div>
        </div>
    `;
}

function canEditCalendar() {
    return state.user?.roles?.some(r => ['secretary', 'superadmin', 'admin'].includes(r)) ?? false;
}

// ── Acciones de turno: toggle al hacer clic ────────────────────────────────
function toggleAptActions(event, aptId) {
    event.stopPropagation();

    // Si hay popup abierto (mismo u otro turno) → cerrarlo
    const existing = document.getElementById('cal-apt-popup');
    if (existing) {
        existing.remove();
        // Si era el mismo turno → solo cerrar (toggle)
        if (existing.dataset.aptId === String(aptId)) return;
    }

    const block = event.currentTarget;
    const apt = getAccessibleAppointments().find(a => a.id === aptId);
    if (!apt) return;

    const patient = getPatientByAppointment(apt);
    const canEdit = canEditCalendar();

    const prof = DB.get('professionals').find(p => p.id === apt.professionalId);
    const profName = prof ? prof.name : null;
    const isCancelled = apt.status === 'cancelled';
    const duration = apt.isOverbook ? 15 : apt.duration;

    // Calcular hora de fin
    const [ah, am] = apt.time.split(':').map(Number);
    const endMin = ah * 60 + am + duration;
    const endTime = `${String(Math.floor(endMin / 60)).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}`;

    const statusBadge = isCancelled
        ? `<span class="cal-apt-popup-badge cal-apt-popup-badge-cancelled"><i class="fa-solid fa-ban"></i> Cancelado</span>`
        : apt.isOverbook
            ? `<span class="cal-apt-popup-badge cal-apt-popup-badge-overbook"><i class="fa-solid fa-bolt"></i> Sobreturno</span>`
            : '';

    const popup = document.createElement('div');
    popup.id = 'cal-apt-popup';
    popup.className = 'cal-apt-popup';
    popup.dataset.aptId = aptId;
    popup.setAttribute('role', 'menu');
    popup.innerHTML = `
        <div class="cal-apt-popup-info">
            <div class="cal-apt-popup-patient">${escapeHtml(apt.patient)}</div>
            ${statusBadge}
            <div class="cal-apt-popup-row"><i class="fa-solid fa-clock"></i> ${apt.time} – ${endTime} <span class="cal-apt-popup-dur">${duration} min</span></div>
            ${profName ? `<div class="cal-apt-popup-row"><i class="fa-solid fa-user-doctor"></i> ${escapeHtml(profName)}</div>` : ''}
            ${apt.notes ? `<div class="cal-apt-popup-notes"><i class="fa-solid fa-note-sticky"></i> ${escapeHtml(apt.notes)}</div>` : ''}
        </div>
        <div class="cal-apt-popup-divider"></div>
        <button class="cal-apt-popup-btn" onclick="closeCalAptPopup()">
            <i class="fa-solid fa-xmark"></i> Cerrar
        </button>
        ${patient && canViewClinicalHistoryUi() ? `
        <button class="cal-apt-popup-btn" onclick="closeCalAptPopup(); loadClinicalHistory(${patient.id})">
            <i class="fa-solid fa-notes-medical"></i> Historia Clínica
        </button>` : ''}
        ${canEdit && !isCancelled ? `
        <button class="cal-apt-popup-btn" onclick="closeCalAptPopup(); openAppointmentModal(${aptId})">
            <i class="fa-solid fa-pen"></i> Editar turno
        </button>
        <button class="cal-apt-popup-btn cal-apt-popup-btn-danger" onclick="closeCalAptPopup(); _confirmCancelApt(${aptId})">
            <i class="fa-solid fa-ban"></i> Cancelar turno
        </button>` : ''}
    `;

    // Insertar off-screen para medir
    popup.style.visibility = 'hidden';
    document.body.appendChild(popup);

    const rect = block.getBoundingClientRect();
    const pw = popup.offsetWidth || 190;
    const ph = popup.offsetHeight || 160;
    const gap = 8;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // Preferir a la derecha del bloque, alineado arriba
    let left = rect.right + gap;
    let top  = rect.top;

    // Si se va de pantalla a la derecha → mostrar a la izquierda
    if (left + pw > vw - gap) left = rect.left - pw - gap;
    left = Math.max(gap, left);
    // Si se va de pantalla abajo → subir
    if (top + ph > vh - gap) top = vh - ph - gap;
    top = Math.max(gap, top);

    popup.style.left        = `${left}px`;
    popup.style.top         = `${top}px`;
    popup.style.visibility  = '';

    // Cerrar al hacer click fuera
    const onOutside = (e) => {
        if (!document.getElementById('cal-apt-popup')?.contains(e.target)) {
            closeCalAptPopup();
            document.removeEventListener('click', onOutside);
        }
    };
    setTimeout(() => document.addEventListener('click', onOutside), 0);
}

function closeCalAptPopup() {
    const popup = document.getElementById('cal-apt-popup');
    if (popup) { popup.remove(); return true; }
    return false;
}

// Mantener por compatibilidad (ya no se usa activamente)
function closeAptActions() { closeCalAptPopup(); }

async function _confirmCancelApt(aptId) {
    const apt = getAccessibleAppointments().find(a => a.id === aptId);
    if (!apt) return;
    if (await showConfirm('¿Cancelar este turno?', { title: 'Cancelar turno', confirmText: 'Sí, cancelar' })) {
        try {
            if (state.authToken) {
                // PATCH status → 'cancelled' (el turno queda visible en rojo en el calendario)
                await apiFetch(`/appointments/${aptId}`, {
                    method: 'PATCH',
                    body: JSON.stringify({ status: 'cancelled' }),
                });
                await syncBackendSnapshotToLocalDb();
            } else {
                // Offline: actualizar en la base local
                DB.update('appointments', aptId, { status: 'cancelled' });
            }
            refreshCurrentView();
        } catch (err) {
            alert(err.message || 'No se pudo cancelar el turno.');
        }
    }
}

// Calendar constants
const CAL_START_HOUR = 8;   // 8:00
const CAL_END_HOUR   = 20;  // 20:00
const CAL_TOTAL_MINS = (CAL_END_HOUR - CAL_START_HOUR) * 60; // 720 min
const CAL_PX_PER_MIN = 1.4;   // 30% más compacto: 1 hora = 84px
const CAL_TOTAL_HEIGHT = CAL_TOTAL_MINS * CAL_PX_PER_MIN;    // 1008px

function renderCalendarViewSwitcher() {
    return '';
}

function renderAppointments() {
    closeCalAptPopup(); // cerrar popup si quedó abierto de una vista anterior
    const professionals = getAccessibleProfessionals();
    const selectedProfessionalId = ensureSingleCalendarProfessional(professionals);

    const allApts = getAccessibleAppointments();
    const currentDate = calendarState.currentDate;
    const canEdit = canManageAppointmentsUi();

    if (isCompactAppointmentsLayout()) {
        return renderAppointmentsCompact(professionals, allApts, currentDate, canEdit);
    }

    // For day view: columns per professional
    if (calendarState.viewMode === 'day') {
        const activeProfessional = professionals.find((p) => p.id === selectedProfessionalId) || professionals[0] || null;
        if (!activeProfessional) {
            return `
                <div class="cal-wrapper">
                    ${renderCalendarToolbar(normalizeDateLabel(parseLocalIsoDate(currentDate).toLocaleDateString('es-AR', {weekday:'long', day:'numeric', month:'long', year:'numeric'})), canEdit)}
                    <div class="card p-6 text-center text-gray-500">No hay profesionales disponibles para mostrar esta agenda.</div>
                </div>
            `;
        }

        // Rango horario dinámico según schedule del profesional ese día
        const daySchedule = getProfessionalDaySchedule(activeProfessional.id, currentDate);
        const profWorksToday = !!daySchedule;
        const CAL_PAD_MINS = 10; // margen visual antes y después del horario
        let calStartMin = CAL_START_HOUR * 60;
        let calEndMin   = CAL_END_HOUR   * 60;
        if (daySchedule) {
            const [sh, sm] = daySchedule.start.split(':').map(Number);
            const [eh, em] = daySchedule.end.split(':').map(Number);
            calStartMin = Math.max(0, sh * 60 + sm - CAL_PAD_MINS);
            calEndMin   = eh * 60 + em + CAL_PAD_MINS;
        }
        const calTotalMins   = calEndMin - calStartMin;
        const CAL_TOP_OFFSET = 8; // px de margen superior para que el primer label no quede cortado
        const calTotalHeight = calTotalMins * CAL_PX_PER_MIN + CAL_TOP_OFFSET;
        // hora entera más cercana hacia abajo/arriba para las etiquetas
        const calLabelStart = Math.floor(calStartMin / 60);
        const calLabelEnd   = Math.ceil(calEndMin   / 60);

        // Mensaje si no trabaja hoy
        if (!profWorksToday) {
            const dateLabel = normalizeDateLabel(parseLocalIsoDate(currentDate).toLocaleDateString('es-AR', {weekday:'long', day:'numeric', month:'long'}));
            const profColor = getProfColor(activeProfessional.id);
            const legendHtml = renderCalendarFilterLegend(professionals, { horizontal: true, compact: true });
            return `
            <div class="cal-wrapper">
                ${renderCalendarToolbar(normalizeDateLabel(parseLocalIsoDate(currentDate).toLocaleDateString('es-AR', {weekday:'long', day:'numeric', month:'long', year:'numeric'})), canEdit)}
                ${legendHtml}
                <div class="cal-no-work-card">
                    <div class="cal-no-work-icon" style="background:${profColor.bg}22; color:${profColor.bg};">
                        <i class="fa-solid fa-calendar-xmark"></i>
                    </div>
                    <div class="cal-no-work-body">
                        <h4><span style="color:${profColor.bg}">${activeProfessional.name}</span> no trabaja este día</h4>
                        <p>${dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1)} no tiene horario configurado.</p>
                    </div>
                </div>
            </div>`;
        }

        // Build time labels (left gutter)
        let timeLabelsHtml = '';
        for (let h = calLabelStart; h <= calLabelEnd; h++) {
            const top = (h * 60 - calStartMin) * CAL_PX_PER_MIN + CAL_TOP_OFFSET;
            timeLabelsHtml += `<div class="cal-hour-label" style="top:${top}px">${String(h).padStart(2,'0')}:00</div>`;
        }

        // Build horizontal hour lines
        let linesHtml = '';
        for (let h = calLabelStart; h <= calLabelEnd; h++) {
            const top = (h * 60 - calStartMin) * CAL_PX_PER_MIN + CAL_TOP_OFFSET;
            linesHtml += `<div class="cal-h-line" style="top:${top}px"></div>`;
            if (h < calLabelEnd) {
                linesHtml += `<div class="cal-h-line cal-h-half" style="top:${top + 60 * CAL_PX_PER_MIN / 2}px"></div>`;
            }
        }

        // Build professional columns
        let profCols = '';
        [activeProfessional].forEach(p => {
            const color = getProfColor(p.id);
            const dayApts = allApts
                .filter(a => a.date === currentDate && a.professionalId === p.id)
                .sort((a, b) => {
                    const timeDiff = a.time.localeCompare(b.time);
                    if (timeDiff !== 0) return timeDiff;
                    if (a.isOverbook === b.isOverbook) return 0;
                    return a.isOverbook ? -1 : 1;
                });

            // Build appointment blocks
            const aptBlocks = dayApts.map(apt => {
                const patient = getPatientByAppointment(apt);
                const [ah, am] = apt.time.split(':').map(Number);
                const startMin = ah * 60 + am;
                const offsetMin = startMin - calStartMin;
                const duration = apt.isOverbook ? 15 : apt.duration;
                const topPx = offsetMin * CAL_PX_PER_MIN + CAL_TOP_OFFSET;
                const heightPx = Math.max(duration * CAL_PX_PER_MIN, 28);
                const visual = getAppointmentVisual(apt);
                const blockClasses = `cal-apt-block ${apt.isOverbook ? 'cal-apt-overbook' : ''} ${visual.cancelled ? 'cal-apt-cancelled' : ''}`;
                const blockStyle = apt.isOverbook
                    ? `background:${visual.bg}; color:${visual.text}; border-left:4px solid ${visual.border}; top:${topPx}px; height:${heightPx}px; cursor:pointer; z-index:20;`
                    : `background:${visual.bg}; color:${visual.text}; border-left:4px solid ${visual.border}; top:${topPx}px; height:${heightPx}px; cursor:pointer;`;

                return `<div class="${blockClasses}"
                    style="${blockStyle}"
                    onclick="openAppointmentViewModal(${apt.id})">
                    <div class="cal-apt-content">
                        <span class="cal-apt-name ${visual.cancelled ? 'cal-apt-name-cancelled' : ''}">${escapeHtml(apt.patient)}</span>
                        <span class="cal-apt-meta">${apt.time} · ${duration}min${visual.cancelled ? ' · Cancelado' : apt.isOverbook ? ' · Sobreturno' : ''}</span>
                    </div>
                </div>`;
            }).join('');

            profCols += `
            <div class="cal-prof-col">
                <div class="cal-prof-header">
                    <div style="display:flex;flex-direction:column;align-items:center;gap:0.15rem;">
                        <span class="cal-prof-name">${escapeHtml(p.name)}</span>
                        <span class="cal-prof-schedule-badge">${daySchedule.start} – ${daySchedule.end}</span>
                    </div>
                </div>
                <div class="cal-prof-body" style="height:${calTotalHeight}px; position:relative;">
                    ${linesHtml}
                    ${aptBlocks}
                </div>
            </div>`;
        });

        // Sidebar legend
        const legendHtml = renderCalendarFilterLegend(professionals, { horizontal: true, compact: true });

        return `
        <div class="cal-wrapper">
            ${renderCalendarToolbar(normalizeDateLabel(parseLocalIsoDate(currentDate).toLocaleDateString('es-AR', {weekday:'long', day:'numeric', month:'long', year:'numeric'})), canEdit)}
            ${legendHtml}
            <div class="cal-scroll-wrap cal-scroll-wrap-day">
                <div class="cal-grid-day">
                    <!-- Gutter -->
                    <div class="cal-gutter-col">
                        <div class="cal-gutter-header"></div>
                        <div class="cal-gutter-body" style="height:${calTotalHeight}px; position:relative;">
                            ${timeLabelsHtml}
                        </div>
                    </div>
                    <!-- Professional columns -->
                    ${profCols}
                </div>
            </div>
        </div>`;
    } else if (calendarState.viewMode === 'week') {
        // Week view: days as columns, appointments listed per day
        const startOfWeek = parseLocalIsoDate(currentDate);
        startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay()); // Sunday
        const selectedProfessionalId = getSelectedCalendarProfessionalId(professionals);
        const selectedProfessionalColor = selectedProfessionalId ? getProfColor(selectedProfessionalId) : { bg: '#64748b', text: '#ffffff' };
        const days = [];
        for (let i = 0; i < 7; i++) {
            const d = new Date(startOfWeek);
            d.setDate(startOfWeek.getDate() + i);
            days.push(d);
        }

        const weekSelectedProf = professionals.find(p => p.id === selectedProfessionalId) || null;

        let dayCols = '';
        days.forEach(d => {
            const iso = formatDateToLocalIso(d);
            const isToday = iso === getTodayIsoLocal();
            const dayName = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'][d.getDay()];
            const dayNum = d.getDate();

            // ¿Trabaja el profesional seleccionado este día?
            const profScheduleDay = weekSelectedProf ? getProfessionalDaySchedule(weekSelectedProf.id, iso) : null;
            const profWorksDay = !!profScheduleDay;

            const dayApts = allApts.filter(a => a.date === iso && calendarState.visibleProfs[a.professionalId]);
            const countLabel = formatAppointmentCountLabel(dayApts.length);

            let summaryContent;
            if (!profWorksDay && weekSelectedProf) {
                summaryContent = `<div class="cal-month-no-work"><i class="fa-solid fa-moon"></i><span>No trabaja</span></div>`;
            } else if (dayApts.length) {
                summaryContent = `<button type="button" class="cal-month-summary-card" data-calendar-date="${iso}" style="background:${selectedProfessionalColor.bg}; color:${selectedProfessionalColor.text}; border-color:${selectedProfessionalColor.bg};">
                        <span class="cal-month-summary-label">${countLabel}</span>
                   </button>`;
            } else {
                summaryContent = `<div class="cal-month-dayempty">Sin turnos</div>`;
            }

            const schedLabel = profScheduleDay ? `<div class="cal-week-sched-line">${profScheduleDay.start}–${profScheduleDay.end}</div>` : '';
            dayCols += `
            <div class="cal-month-cell${!profWorksDay && weekSelectedProf ? ' cal-month-cell-no-work' : ''}" data-calendar-date="${iso}" style="cursor:pointer;">
                <button type="button" class="cal-month-dayhead cal-week-dayhead ${isToday ? 'is-today' : ''}" data-calendar-date="${iso}">
                    <span class="cal-week-dayname">${dayName}</span>
                    <span class="cal-month-daynum">${dayNum}</span>
                </button>
                <div class="cal-month-daybody">
                    ${schedLabel}
                    ${summaryContent}
                </div>
            </div>`;
        });

        const legendHtml = renderCalendarFilterLegend(professionals, { horizontal: true, compact: true });

        return `
        <div class="cal-wrapper">
            ${renderCalendarToolbar(`${normalizeDateLabel(days[0].toLocaleDateString('es-AR',{day:'numeric',month:'short'}))} – ${normalizeDateLabel(days[6].toLocaleDateString('es-AR',{day:'numeric',month:'short',year:'numeric'}))}`, canEdit)}

            <div class="cal-month-layout">
                ${legendHtml}
                <div class="cal-scroll-wrap cal-scroll-wrap-month">
                    <div class="cal-month-board">
                        <div class="cal-month-grid cal-week-grid">
                            ${dayCols}
                        </div>
                    </div>
                </div>
            </div>
        </div>`;
    } else if (calendarState.viewMode === 'month') {
        const date = parseLocalIsoDate(currentDate);
        const month = date.getMonth();
        const year = date.getFullYear();
        const selectedProfessionalId = getSelectedCalendarProfessionalId(professionals);
        const selectedProfessionalColor = selectedProfessionalId ? getProfColor(selectedProfessionalId) : { bg: '#64748b', text: '#ffffff' };
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const daysInMonth = lastDay.getDate();
        const startOffset = firstDay.getDay(); // sunday=0

        let cells = '';
        const totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7;

        for (let i = 0; i < totalCells; i++) {
            const dayNum = i - startOffset + 1;
            let cellDate = null;
            let isCurrentMonth = false;
            let content = '<div class="cal-month-empty-slot"></div>';
            let monthProfWorks = true; // default: fuera del mes actual no aplica

            if (dayNum > 0 && dayNum <= daysInMonth) {
                isCurrentMonth = true;
                cellDate = new Date(year, month, dayNum);
                const iso = formatDateToLocalIso(cellDate);
                const isToday = iso === getTodayIsoLocal();
                let dayApts = allApts.filter(a => a.date === iso && calendarState.visibleProfs[a.professionalId]);
                dayApts = dayApts.sort((a,b)=>a.time.localeCompare(b.time));
                const countLabel = formatAppointmentCountLabel(dayApts.length);

                const monthProfSched = selectedProfessionalId ? getProfessionalDaySchedule(selectedProfessionalId, iso) : null;
                monthProfWorks = !selectedProfessionalId || !!monthProfSched;

                let summaryContent;
                if (!monthProfWorks) {
                    summaryContent = `<div class="cal-month-no-work"><i class="fa-solid fa-moon"></i><span>No trabaja</span></div>`;
                } else if (dayApts.length) {
                    summaryContent = `<button type="button" class="cal-month-summary-card" data-calendar-date="${iso}" style="background:${selectedProfessionalColor.bg}; color:${selectedProfessionalColor.text}; border-color:${selectedProfessionalColor.bg};">
                            <span class="cal-month-summary-label">${countLabel}</span>
                       </button>`;
                } else {
                    summaryContent = `<div class="cal-month-dayempty">Sin turnos</div>`;
                }

                content = `
                    <button type="button" class="cal-month-dayhead ${isToday ? 'is-today' : ''}" data-calendar-date="${iso}">
                        <span class="cal-month-daynum">${dayNum}</span>
                    </button>
                    <div class="cal-month-daybody">
                        ${summaryContent}
                    </div>
                `;
            }

            cells += `<div class="cal-month-cell ${isCurrentMonth ? '' : 'is-outside-month'}${isCurrentMonth && !monthProfWorks ? ' cal-month-cell-no-work' : ''}"${isCurrentMonth && cellDate ? ` data-calendar-date="${formatDateToLocalIso(cellDate)}" style="cursor:pointer;"` : ''}>${content}</div>`;
        }

        const monthName = normalizeDateLabel(date.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' }));

        const legend = renderCalendarFilterLegend(professionals, { horizontal: true, compact: true });

        return `
        <div class="cal-wrapper">
            ${renderCalendarToolbar(monthName, canEdit)}

            <div class="cal-month-layout">
                ${legend}
                <div class="cal-scroll-wrap cal-scroll-wrap-month">
                    <div class="cal-month-board">
                        <div class="cal-month-weekdays">
                            <div class="cal-month-weekday">Dom</div>
                            <div class="cal-month-weekday">Lun</div>
                            <div class="cal-month-weekday">Mar</div>
                            <div class="cal-month-weekday">Mié</div>
                            <div class="cal-month-weekday">Jue</div>
                            <div class="cal-month-weekday">Vie</div>
                            <div class="cal-month-weekday">Sáb</div>
                        </div>
                        <div class="cal-month-grid">
                        ${cells}
                        </div>
                    </div>
                </div>
            </div>
        </div>`;
    }
}

function renderProfessionals() {
    const profs = getAccessibleProfessionals();
    return `
        <div class="card mb-6 section-hero-card section-hero-inline">
            <div class="section-hero-copy">
                <span class="section-eyebrow">Agendas</span>
                <h3 class="section-title">Horarios de Atención</h3>
                <p class="section-subtitle">Administra la disponibilidad semanal de cada profesional y organiza la agenda activa.</p>
            </div>
        </div>
        <div class="prof-schedule-list">
            ${profs.length === 0 ? `
                <div class="prof-schedule-empty">
                    <i class="fa-solid fa-user-doctor"></i>
                    <span>No hay profesionales disponibles</span>
                </div>
            ` : profs.map((p, idx) => {
                const profColor = getProfColor(p.id);
                const initials = (p.name || '').split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
                return `
                <div class="prof-schedule-card">
                    <div class="prof-schedule-avatar" style="background:${profColor.bg}22; color:${profColor.bg}; border: 2px solid ${profColor.bg}44;">
                        ${initials || '<i class="fa-solid fa-user-doctor"></i>'}
                    </div>
                    <div class="prof-schedule-info">
                        <span class="prof-schedule-name">${escapeHtml(p.name)}</span>
                        ${p.specialty ? `<span class="prof-schedule-specialty">${escapeHtml(p.specialty)}</span>` : ''}
                    </div>
                    ${canAccessProfessional(p.id) ? `
                    <button class="btn btn-secondary btn-sm btn-edit-schedule prof-schedule-btn" data-id="${p.id}" aria-label="Configurar horarios de ${escapeHtml(p.name)}" title="Configurar horarios">
                        <i class="fa-solid fa-clock"></i>
                        <span>Horarios</span>
                    </button>` : ''}
                </div>`;
            }).join('')}
        </div>
        <p class="schedules-hint mt-4 text-sm text-gray-500 ml-1"><i class="fa-solid fa-circle-info mr-1 text-primary-400"></i> Los turnos solo se asignan dentro del horario activo configurado para cada día.</p>
    `;
}

function renderPatients() {
    const patients = getAccessiblePatients().sort((a,b)=>a.name.localeCompare(b.name));
    const canCreate = canCreatePatientUi();
    const emptyState = patients.length === 0 ? `
        <div class="patients-empty-state">
            <div class="patients-empty-icon">
                <i class="fa-solid fa-users"></i>
            </div>
            <h3 class="patients-empty-title">Todavía no hay pacientes cargados</h3>
            <p class="patients-empty-sub">Podés agregar pacientes de dos maneras:</p>
            <div class="patients-empty-methods">
                <div class="patients-empty-method">
                    <div class="patients-empty-method-icon">
                        <i class="fa-solid fa-user-plus"></i>
                    </div>
                    <div>
                        <strong>Uno por uno</strong>
                        <p>Hacé clic en <em>Nuevo Paciente</em> y completá el formulario con los datos del paciente (nombre, DNI, teléfono, etc.).</p>
                    </div>
                </div>
                <div class="patients-empty-method">
                    <div class="patients-empty-method-icon patients-empty-method-icon--excel">
                        <i class="fa-solid fa-file-excel"></i>
                    </div>
                    <div>
                        <strong>Importar desde Excel</strong>
                        <p>Usá la plantilla de Excel para cargar múltiples pacientes a la vez. Descargá la plantilla desde <em>Exportar Excel</em>, completala y luego importala con <em>Importar Excel</em>.</p>
                    </div>
                </div>
            </div>
            ${canCreate ? `
            <div class="patients-empty-actions">
                <button class="btn btn-primary" id="btn-add-patient-empty"><i class="fa-solid fa-user-plus"></i> Nuevo Paciente</button>
                <button class="btn btn-secondary" id="btn-import-patients-empty"><i class="fa-solid fa-file-excel"></i> Importar Excel</button>
            </div>` : ''}
        </div>
    ` : '';
    return `
        <div class="card mb-6 section-hero-card section-hero-inline">
            <div class="section-hero-copy">
                <span class="section-eyebrow">Pacientes</span>
                <h3 class="section-title">Registro de Pacientes</h3>
                <p class="section-subtitle">Visualiza, edita y administra los datos base de cada paciente.</p>
            </div>
            ${canCreate ? `
            <div class="flex gap-2 flex-wrap">
                <button class="btn btn-primary" id="btn-add-patient"><i class="fa-solid fa-user-plus"></i> Nuevo Paciente</button>
                <button class="btn btn-secondary" id="btn-import-patients"><i class="fa-solid fa-file-excel"></i> Importar Excel</button>
                <button class="btn btn-secondary" id="btn-export-patients" onclick="exportPatients()"><i class="fa-solid fa-file-arrow-down"></i> Exportar Excel</button>
            </div>` : ''}
        </div>
        ${patients.length > 0 ? `
        <div class="patient-search-shell mb-4">
            <i class="fa-solid fa-magnifying-glass patient-search-icon"></i>
            <input type="search" id="search-patient" placeholder="Buscar pacientes por nombre o DNI..." class="form-input w-full border text-sm">
        </div>
        <div class="table-container table-container-patients shadow-sm">
            <div class="patients-scroll-inner">
                <table class="w-full text-left" id="patients-table">
                    <thead><tr><th>Paciente</th><th>Contacto</th><th>DNI</th><th>Acciones</th></tr></thead>
                    <tbody>
                        ${patients.map((p, i) => `
                            <tr style="animation-delay:${Math.min(i * 35, 350)}ms">
                                <td class="font-medium flex items-center gap-3" data-label="Paciente">
                                    <div class="patient-list-avatar">${p.name.split(' ').filter(Boolean).slice(0,2).map(w=>w[0]).join('').toUpperCase()}</div>
                                    ${escapeHtml(p.name)}
                                </td>
                                <td data-label="Contacto">
                                    <span class="block text-sm text-gray-600" style="margin-bottom:4px;"><i class="fa-solid fa-phone mr-1"></i> ${escapeHtml(p.phone)}</span>
                                    <span class="block text-xs text-gray-400"><i class="fa-solid fa-envelope mr-1"></i> ${escapeHtml(p.email || 'Sin email')}</span>
                                </td>
                                <td class="text-sm font-semibold" data-label="DNI">${p.dni}</td>
                                <td data-label="Acciones" class="table-actions-cell">
                                    <div class="flex gap-2 patient-actions">
                                        ${canViewClinicalHistoryUi() ? `<button class="btn btn-ghost p-1 btn-view-history" data-id="${p.id}" title="Historia Clínica"><i class="fa-solid fa-file-medical text-purple-600"></i></button>` : ''}
                                        ${canEditPatientUi() ? `<button class="btn btn-ghost p-1 btn-edit-patient" data-id="${p.id}" title="Editar"><i class="fa-solid fa-pen text-primary-600"></i></button>` : ''}
                                        ${isSuperadmin() ? `<button class="btn btn-ghost p-1 btn-delete-patient" data-id="${p.id}" title="Eliminar"><i class="fa-solid fa-trash text-danger"></i></button>` : ''}
                                        ${canViewPatientBillingUi() ? `<button class="btn btn-ghost p-1 btn-view-patient-billing" data-id="${p.id}" title="Cuenta Corriente"><i class="fa-solid fa-wallet text-emerald-600"></i></button>` : ''}
                                    </div>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>` : emptyState}
    `;
}

function renderBilling() {
    const txs = DB.get('billing').filter(t => canAccessProfessional(t.professionalId));
    const patients = getAccessiblePatients().sort((a,b)=>a.name.localeCompare(b.name));
    const professionals = getAccessibleProfessionals();
    const today = getTodayIsoLocal();
    const billingSections = [
        { id: 'movements', label: 'Caja', icon: 'fa-cash-register', description: 'Ingresos y cargos del período seleccionado.' },
        { id: 'accounts', label: 'Cuentas corrientes', icon: 'fa-wallet', description: 'Historial completo por paciente.' }
    ];
    const activeBillingSection = billingSections.some((section) => section.id === state.billingSubView)
        ? state.billingSubView
        : 'movements';
    state.billingSubView = activeBillingSection;
    const selectedPatientId = Number.isInteger(Number(state.billingPatientId)) ? Number(state.billingPatientId) : null;
    const selectedAccount = selectedPatientId ? getPatientCurrentAccountSummary(selectedPatientId) : null;
    const filteredTxs = selectedPatientId ? txs.filter((entry) => entry.patientId === selectedPatientId) : txs;
    const metricsSourceTxs = selectedPatientId ? filteredTxs : txs;
    const todaysTxs = metricsSourceTxs.filter((t) => coerceAppointmentDate(t.date) === today);
    const selectedPatientDetailedMovements = selectedPatientId
        ? (() => {
            const chronological = [...filteredTxs].sort((a, b) => {
                const dateCompare = coerceAppointmentDate(a.date).localeCompare(coerceAppointmentDate(b.date));
                return dateCompare || (a.id - b.id);
            });
            const runningBalanceByProfessional = new Map();
            const enriched = chronological.map((entry) => {
                const previousBalance = runningBalanceByProfessional.get(entry.professionalId) || 0;
                const delta = entry.type === 'debt' ? entry.amount : -entry.amount;
                const nextBalance = previousBalance + delta;
                runningBalanceByProfessional.set(entry.professionalId, nextBalance);
                return {
                    ...entry,
                    runningBalance: nextBalance
                };
            });
            return enriched.sort((a, b) => {
                const dateCompare = coerceAppointmentDate(b.date).localeCompare(coerceAppointmentDate(a.date));
                return dateCompare || (b.id - a.id);
            });
        })()
        : [];
    
    // Caja: filtro por período
    const cajaPeriod = state.cajaPeriod || '7d';
    const cajaPeriodDays = cajaPeriod === '1d' ? 1 : cajaPeriod === '7d' ? 7 : cajaPeriod === '30d' ? 30 : 90;
    const cajaPeriodLabel = cajaPeriod === '1d' ? 'Últimas 24 hs' : cajaPeriod === '7d' ? ' Últimos 7 días' : cajaPeriod === '30d' ? 'Últimos 30 días' : 'Últimos 90 días';
    const cajaCutoff = (() => {
        const d = new Date(); d.setDate(d.getDate() - (cajaPeriodDays - 1)); return formatDateToLocalIso(d);
    })();
    const cajaTxs = txs.filter(t => coerceAppointmentDate(t.date) >= cajaCutoff);
    const cajaIngresos = cajaTxs.filter(t => ['income', 'payment'].includes(t.type)).reduce((sum,t)=>sum+t.amount,0);
    const cajaCargos = cajaTxs.filter(t => t.type === 'debt').reduce((sum,t)=>sum+t.amount,0);
    const cajaBalance = cajaIngresos - cajaCargos;

    const ingresos = todaysTxs.filter(t => ['income', 'payment'].includes(t.type)).reduce((sum,t)=>sum+t.amount,0);
    const deudas = todaysTxs.filter(t=>t.type==='debt').reduce((sum,t)=>sum+t.amount,0);

    const patientAccountHero = selectedAccount?.patient ? `
        <div class="card mt-6 mb-6 billing-summary-card">
            <div class="section-headline">
                <div>
                    <span class="section-eyebrow">Cuenta corriente por paciente</span>
                    <h3 class="section-title section-title-sm">${selectedAccount.patient.name}</h3>
                    <p class="section-subtitle">DNI ${selectedAccount.patient.dni} · Seguimiento individual de movimientos, cargos y pagos.</p>
                </div>
                <div class="flex gap-2 flex-wrap">
                    <button class="btn btn-secondary" id="btn-clear-patient-billing"><i class="fa-solid fa-arrow-left"></i> Volver</button>
                    ${canManagePatientBillingUi() ? `<button class="btn btn-primary" id="btn-add-movement-from-account" data-patient-id="${selectedAccount.patient.id}"><i class="fa-solid fa-plus"></i> Agregar movimiento</button>` : ''}
                </div>
            </div>
            <div class="mt-4 text-sm text-gray-500">
                La cuenta corriente se muestra separada por profesional. Un mismo paciente puede deber, estar al día o tener saldo a favor según cada profesional.
            </div>
            <div class="table-container shadow-sm border border-gray-100 mt-4">
                <table class="w-full text-left bg-white">
                    <thead class="bg-gray-50 text-gray-600"><tr><th>Profesional</th><th>Cargos</th><th>Pagos</th><th>Saldo</th></tr></thead>
                    <tbody>
                        ${selectedAccount.byProfessional.map((item) => `
                            <tr>
                                <td class="font-medium">${item.professionalName}</td>
                                <td>$${item.deuda.toLocaleString()}</td>
                                <td class="text-success font-semibold">$${item.pagado.toLocaleString()}</td>
                                <td>
                                    ${item.balance > 0
                                        ? `<span class="badge badge-warning text-xs">Debe $${item.balance.toLocaleString()}</span>`
                                        : `<span class="badge badge-success text-xs">${item.balance < 0 ? `A favor $${Math.abs(item.balance).toLocaleString()}` : 'Al día'}</span>`}
                                </td>
                            </tr>
                        `).join('')}
                        ${selectedAccount.byProfessional.length === 0 ? '<tr><td colspan="4" class="text-center py-4 text-gray-400">Este paciente todavía no tiene movimientos en cuenta corriente.</td></tr>' : ''}
                    </tbody>
                </table>
            </div>
            <div class="card mt-4">
                <div class="section-headline">
                    <div>
                        <span class="section-eyebrow">Detalle completo</span>
                        <h3 class="section-title section-title-sm">Movimientos de cuenta corriente</h3>
                        <p class="section-subtitle">Registro movimiento por movimiento con saldo acumulado por profesional.</p>
                    </div>
                </div>
                <div class="table-container shadow-sm border border-gray-100 mt-4 overflow-x-auto">
                    <table class="w-full text-left bg-white table-nowrap">
                        <thead class="bg-gray-50 text-gray-600">
                            <tr>
                                <th>Fecha</th>
                                <th class="col-hide-xs">Profesional</th>
                                <th>Tipo</th>
                                <th class="col-hide-sm">Concepto</th>
                                <th class="col-hide-sm">Cargo</th>
                                <th>Monto</th>
                                <th class="col-hide-sm">Saldo</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${selectedPatientDetailedMovements.map((movement) => {
                                const professionalName = professionals.find((p) => p.id === movement.professionalId)?.name || 'Sin profesional';
                                const isPositiveMovement = ['income', 'payment'].includes(movement.type);
                                const typeLabel = movement.type === 'debt'
                                    ? 'Cargo / Deuda'
                                    : movement.type === 'payment'
                                        ? 'Pago'
                                        : 'Ingreso';
                                const movementDate = coerceAppointmentDate(movement.date);
                                const montoDisplay = `$${movement.amount.toLocaleString()}`;
                                return `
                                    <tr>
                                        <td class="text-sm text-gray-500">${movementDate}</td>
                                        <td class="font-medium col-hide-xs">${professionalName}</td>
                                        <td><span class="badge ${isPositiveMovement ? 'badge-success' : 'badge-warning'}">${typeLabel}</span></td>
                                        <td class="text-gray-700 col-hide-sm">${movement.description || 'Sin descripción'}</td>
                                        <td class="font-semibold text-warning col-hide-sm">${movement.type === 'debt' ? montoDisplay : '-'}</td>
                                        <td class="font-semibold ${isPositiveMovement ? 'text-success' : 'text-warning'}">${montoDisplay}</td>
                                        <td class="col-hide-sm">
                                            ${movement.runningBalance > 0
                                                ? `<span class="badge badge-warning text-xs">Debe $${movement.runningBalance.toLocaleString()}</span>`
                                                : movement.runningBalance < 0
                                                    ? `<span class="badge badge-success text-xs">A favor $${Math.abs(movement.runningBalance).toLocaleString()}</span>`
                                                    : `<span class="badge badge-gray text-xs">Al día</span>`}
                                        </td>
                                    </tr>
                                `;
                            }).join('')}
                            ${selectedPatientDetailedMovements.length === 0 ? '<tr><td colspan="7" class="text-center py-4 text-gray-400">Este paciente todavía no tiene movimientos registrados.</td></tr>' : ''}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    ` : '';

    const cajaPeriodOptions = [
        { key: '1d', label: '24 hs' },
        { key: '7d', label: '7 días' },
        { key: '30d', label: '30 días' },
        { key: '90d', label: '90 días' },
    ];

    const movementsContent = `
        <div class="card mb-6 section-hero-card section-hero-inline section-hero-compact">
            <div class="section-hero-copy">
                <span class="section-eyebrow">Caja</span>
                <h3 class="section-title section-title-sm">Movimientos de Caja</h3>
                <p class="section-subtitle">Ingresos y cargos del período seleccionado, filtrados por tus profesionales asignados.</p>
            </div>
            ${state.user.roles.some(r => ['admin', 'superadmin'].includes(r)) ?
            '<button class="btn btn-primary" id="btn-add-tx"><i class="fa-solid fa-plus"></i> Registrar Movimiento</button>' : ''}
        </div>

        <div class="caja-period-bar">
            <span class="caja-period-label"><i class="fa-solid fa-calendar-days"></i> Período:</span>
            <div class="caja-period-options">
                ${cajaPeriodOptions.map(o => `
                    <button class="caja-period-btn ${cajaPeriod === o.key ? 'is-active' : ''}" data-caja-period="${o.key}">${o.label}</button>
                `).join('')}
            </div>
        </div>

        <div class="metrics-grid mt-4 mb-6">
            <div class="card metric-card">
                <div class="metric-icon metric-green"><i class="fa-solid fa-arrow-trend-up"></i></div>
                <div class="metric-info">
                    <h3>Recaudado</h3>
                    <p>$${cajaIngresos.toLocaleString()}</p>
                    <small class="text-xs text-gray-400">${cajaPeriodLabel}</small>
                </div>
            </div>
            <div class="card metric-card">
                <div class="metric-icon metric-red"><i class="fa-solid fa-arrow-trend-down"></i></div>
                <div class="metric-info">
                    <h3>Cargos emitidos</h3>
                    <p>$${cajaCargos.toLocaleString()}</p>
                    <small class="text-xs text-gray-400">${cajaPeriodLabel}</small>
                </div>
            </div>
            <div class="card metric-card">
                <div class="metric-icon metric-purple"><i class="fa-solid fa-scale-balanced"></i></div>
                <div class="metric-info">
                    <h3>Balance neto</h3>
                    <p>$${Math.abs(cajaBalance).toLocaleString()}</p>
                    <small class="text-xs text-gray-400">${cajaPeriodLabel}</small>
                </div>
            </div>
        </div>

        <div class="input-group mb-3">
            <input type="text" id="billing-text-search" placeholder="Buscar por paciente, DNI o descripción..." class="w-full" oninput="filterBillingTable(this.value)">
        </div>

        <div class="table-container shadow-sm overflow-x-auto">
            <table class="w-full text-left table-nowrap">
                <thead><tr><th>Fecha</th><th>Paciente</th><th class="col-hide-xs">Profesional</th><th>Tipo</th><th class="col-hide-sm">Concepto</th><th>Monto</th><th></th></tr></thead>
                <tbody>
                    ${cajaTxs.sort((a,b) => coerceAppointmentDate(b.date).localeCompare(coerceAppointmentDate(a.date)) || b.id - a.id).map(t => {
                        const pName = patients.find(p=>p.id === t.patientId)?.name || 'Desconocido';
                        const professionalName = professionals.find(p=>p.id === t.professionalId)?.name || 'Sin profesional';
                        const isPago = ['income', 'payment'].includes(t.type);
                        const typeLabel = t.type === 'debt' ? 'Cargo' : t.type === 'payment' ? 'Pago' : 'Ingreso';
                        return `
                        <tr>
                            <td class="text-sm text-gray-500">${coerceAppointmentDate(t.date)}</td>
                            <td class="font-medium">${pName}</td>
                            <td class="text-sm text-gray-600 col-hide-xs">${professionalName}</td>
                            <td><span class="badge ${isPago ? 'badge-success' : 'badge-warning'}">${typeLabel}</span></td>
                            <td class="text-gray-700 col-hide-sm">${t.description || 'Sin descripción'}</td>
                            <td class="font-bold ${isPago ? 'text-success' : 'text-warning'}">$${t.amount.toLocaleString()}</td>
                            <td>
                                ${state.user.roles.some(r => ['superadmin', 'admin'].includes(r)) ?
                                `<button class="btn btn-icon btn-delete-tx" data-id="${t.id}" title="Eliminar" style="color:var(--danger)"><i class="fa-solid fa-trash"></i></button>` : ''}
                            </td>
                        </tr>`;
                    }).join('')}
                    ${cajaTxs.length === 0 ? `<tr><td colspan="7" class="text-center py-8 text-gray-400"><i class="fa-solid fa-inbox fa-2x mb-2 block opacity-30"></i>Sin movimientos en ${cajaPeriodLabel.toLowerCase()}.</td></tr>` : ''}
                </tbody>
            </table>
        </div>
    `;

    const accountsOverview = `
        <div class="card mt-6 mb-6 billing-summary-card">
            <div class="section-headline">
                <div>
                    <span class="section-eyebrow">Cuenta corriente</span>
                    <h3 class="section-title section-title-sm">Cuentas Corrientes por Paciente</h3>
                    <p class="section-subtitle">Cada paciente mantiene un saldo independiente con cada profesional.</p>
                </div>
            </div>
            <div class="billing-patient-search-card">
                <div class="billing-patient-search-head">
                    <div>
                        <h4>Buscar paciente</h4>
                        <p>No mostramos listados masivos. Busca por nombre o DNI y abre solo la cuenta que necesitas revisar.</p>
                    </div>
                    <span class="billing-patient-search-count">${patients.length} paciente${patients.length === 1 ? '' : 's'} disponible${patients.length === 1 ? '' : 's'}</span>
                </div>
                <div class="patient-search-shell billing-patient-search-shell">
                    <input
                        type="search"
                        id="search-patient-billing-main"
                        placeholder="Buscar cuenta corriente por nombre o DNI..."
                        class="form-input w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 text-sm"
                        autocomplete="off"
                    >
                </div>
                <div id="billing-patient-search-results" class="billing-patient-search-results">
                    <div class="billing-patient-search-empty">
                        <i class="fa-solid fa-magnifying-glass"></i>
                        <p>Empieza a escribir para encontrar un paciente.</p>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    return `
        <section class="settings-card settings-nav-card mb-6">
            <div class="settings-nav-header">
                <div>
                    <span class="section-eyebrow">Facturación</span>
                    <h3 class="section-title section-title-sm">Cuentas Corrientes</h3>
                    <p class="subtext">Organizá la facturación entre movimientos recientes y cuentas corrientes por paciente.</p>
                </div>
            </div>
            <div class="settings-subnav">
                ${billingSections.map(section => `
                    <button type="button" class="settings-subnav-item ${section.id === activeBillingSection ? 'active' : ''}" data-billing-view="${section.id}">
                        <i class="fa-solid ${section.icon}"></i>
                        <span>${section.label}</span>
                        <small>${section.description}</small>
                    </button>
                `).join('')}
            </div>
        </section>

        ${activeBillingSection === 'movements' ? movementsContent : `${accountsOverview}${patientAccountHero}`}
    `;
}

function renderDashboardContent(apts, patients, todaysApts, selectedDate, selectedDateApts) {
    const now = new Date();
    // Todos los turnos del día (excluye cancelados/reprogramados)
    const todaysOpenApts = todaysApts.filter(apt => isBlockingAppointmentStatus(apt.status));

    // Turnos no iniciados: aún no empezaron (hora de inicio en el futuro)
    const notStartedApts = todaysApts.filter(apt => {
        if (!isBlockingAppointmentStatus(apt.status)) return false;
        const [hours, minutes] = apt.time.split(':').map(Number);
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0, 0);
        return start > now;
    });

    // Turnos activos (corriendo ahora) — se mantiene para uso interno
    const currentRunningApts = todaysApts.filter(apt => {
        if (!isBlockingAppointmentStatus(apt.status)) return false;
        const [hours, minutes] = apt.time.split(':').map(Number);
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0, 0);
        const duration = apt.isOverbook ? 15 : (apt.duration || 0);
        const end = new Date(start.getTime() + duration * 60000);
        return start <= now && end > now;
    });

    const patientsTodayCount = new Set(todaysOpenApts.map(apt => apt.patient)).size;
    const selectedLabel = formatDashboardDateLabel(selectedDate);
    const selectedTitle = selectedDate === getTodayIsoLocal() ? 'Turnos de Hoy' : 'Turnos Programados';
    const canManageStatus = canManageAppointmentStatusUi();
    const canUseWhatsapp = canSendAppointmentWhatsappUi();

    const todayOverbooksCount = todaysApts.filter(a => a.isOverbook && isBlockingAppointmentStatus(a.status)).length;

    const isToday = selectedDate === getTodayIsoLocal();

    // Separar en pendientes y finalizados (solo si es hoy)
    const pendingApts = isToday
        ? selectedDateApts.filter(apt => {
            const [h, m] = apt.time.split(':').map(Number);
            const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0, 0);
            const duration = apt.isOverbook ? 15 : (apt.duration || 30);
            return new Date(start.getTime() + duration * 60000) > now;
        })
        : selectedDateApts;

    const finishedApts = isToday
        ? selectedDateApts.filter(apt => {
            const [h, m] = apt.time.split(':').map(Number);
            const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0, 0);
            const duration = apt.isOverbook ? 15 : (apt.duration || 30);
            return new Date(start.getTime() + duration * 60000) <= now;
        })
        : [];

    const emptyStateText = (isToday && finishedApts.length > 0)
        ? 'Todos los turnos de hoy ya finalizaron.'
        : 'No hay turnos para la fecha seleccionada.';

    return `
        <div class="metrics-grid">
            <div class="card metric-card">
                <div class="metric-icon metric-blue"><i class="fa-solid fa-calendar-day"></i></div>
                <div class="metric-info"><h3>Turnos de Hoy</h3><p>${todaysOpenApts.length}</p></div>
            </div>
            <div class="card metric-card">
                <div class="metric-icon metric-orange"><i class="fa-solid fa-hourglass-half"></i></div>
                <div class="metric-info"><h3>Pendientes</h3><p>${notStartedApts.length}</p></div>
            </div>
            <div class="card metric-card">
                <div class="metric-icon metric-purple"><i class="fa-solid fa-bolt"></i></div>
                <div class="metric-info"><h3>Sobreturnos</h3><p>${todayOverbooksCount}</p></div>
            </div>
        </div>

        <div class="dashboard-main-card mt-6">
            <div class="dashboard-sticky-header">
                <div>
                    <h3>${selectedTitle}</h3>
                    <p class="dashboard-date-label">${selectedLabel}</p>
                </div>
                <div class="dashboard-date-filter-wrap">
                    <label for="dashboard-date-filter" class="dashboard-date-filter-label">Fecha</label>
                    <input type="date" id="dashboard-date-filter" class="dashboard-date-filter" value="${selectedDate}">
                </div>
            </div>
            ${pendingApts.length === 0 ? `
            <div class="dashboard-empty-state">
                <div class="dashboard-empty-icon"><i class="fa-regular fa-calendar-check"></i></div>
                <p class="dashboard-empty-title">${emptyStateText}</p>
            </div>` : `
            <div class="overflow-x-auto">
                <table class="w-full text-left">
                    <colgroup>
                        <col style="width:120px; min-width:120px;">
                        <col>
                        <col>
                        <col>
                        <col>
                        <col>
                        <col>
                    </colgroup>
                    <thead><tr><th class="col-sticky-left">Hora</th><th>Paciente</th><th class="col-hide-xs">Profesional</th><th class="col-hide-sm">Sala</th><th class="col-hide-lg">Confirmación</th><th class="col-show-lg">Estado</th>${canUseWhatsapp ? '<th class="col-hide-lg">Whatsapp</th>' : ''}</tr></thead>
                    <tbody>
                        ${pendingApts.map(apt => {
                            const patient = getPatientByAppointment(apt);
                            const whatsappLink = getWhatsAppLink(patient, apt);
                            const statusMeta = getAppointmentStatusMeta(apt.status);
                            const profColor = getProfColor(apt.professionalId);
                            const _r = parseInt(profColor.bg.slice(1,3), 16);
                            const _g = parseInt(profColor.bg.slice(3,5), 16);
                            const _b = parseInt(profColor.bg.slice(5,7), 16);
                            const _isDark = document.body.classList.contains('theme-dark');
                            const _br = _isDark ? 30 : 255, _bg2 = _isDark ? 41 : 255, _bb = _isDark ? 59 : 255;
                            const _a = _isDark ? 0.14 : 0.08;
                            const _rowBg = `rgb(${Math.round(_br*(1-_a)+_r*_a)},${Math.round(_bg2*(1-_a)+_g*_a)},${Math.round(_bb*(1-_a)+_b*_a)})`;
                            const rowStyle = `border-left: 3px solid ${profColor.bg}; background: ${_rowBg};`;
                            return `
                                <tr class="${apt.isOverbook ? 'tr-sobreturno' : ''}" style="${rowStyle}">
                                    <td class="col-sticky-left" style="background:${_rowBg}"><span class="font-semibold">${apt.time}</span> <span class="text-xs text-gray-500">(${apt.duration}m)</span></td>
                                    <td>${escapeHtml(apt.patient)} ${apt.isOverbook ? '<span class="badge badge-purple text-xs ml-2">Sobreturno</span>' : ''}</td>
                                    <td class="col-hide-xs"><span class="dash-prof-chip" style="background:${profColor.bg}; color:${profColor.text};">${escapeHtml(getProfName(apt.professionalId))}</span></td>
                                    <td class="col-hide-sm">${renderPresenceBtnHtml(apt.id)}</td>
                                    <td class="col-hide-lg">${canManageStatus ? renderStatusDropdownHtml(apt.id, statusMeta) : `<span class="badge ${statusMeta.badge}">${statusMeta.label}</span>`}</td>
                                    <td class="col-show-lg">
                                        <div style="display:flex;flex-direction:column;align-items:flex-start;gap:4px;">
                                            <span class="badge ${statusMeta.badge}">${statusMeta.label}</span>
                                            ${canUseWhatsapp ? (whatsappLink ? (() => {
                                                const alreadySent = ['sent', 'confirmed', 'rescheduled', 'cancelled'].includes(statusMeta.key);
                                                return alreadySent
                                                    ? `<span class="wa-sent-badge"><i class="fa-brands fa-whatsapp"></i> Enviado</span>`
                                                    : `<button type="button" class="btn btn-secondary btn-sm dashboard-wa-btn" onclick="sendWhatsAppMessage(${apt.id})"><i class="fa-brands fa-whatsapp"></i> Enviar</button>`;
                                            })() : '') : ''}
                                        </div>
                                    </td>
                                    ${canUseWhatsapp ? `<td class="col-hide-lg">${whatsappLink ? (() => {
                                            const alreadySent = ['sent', 'confirmed', 'rescheduled', 'cancelled'].includes(statusMeta.key);
                                            return alreadySent
                                                ? `<span class="wa-sent-badge"><i class="fa-brands fa-whatsapp"></i> Enviado</span>`
                                                : `<button type="button" class="btn btn-secondary btn-sm dashboard-wa-btn" onclick="sendWhatsAppMessage(${apt.id})"><i class="fa-brands fa-whatsapp"></i> Enviar</button>`;
                                        })() : '<span class="text-xs text-gray-400">Sin teléfono</span>'}</td>` : ''}
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>`}
            ${finishedApts.length > 0 ? `
            <details class="finished-apts-details">
                <summary class="finished-apts-summary">
                    <span class="finished-apts-summary-inner">
                        <i class="fa-solid fa-chevron-right finished-apts-chevron"></i>
                        <span>Turnos finalizados</span>
                        <span class="badge badge-gray finished-apts-count">${finishedApts.length}</span>
                    </span>
                </summary>
                <div class="overflow-x-auto mt-2">
                    <table class="w-full text-left opacity-60">
                        <thead><tr><th>Hora</th><th>Paciente</th><th class="col-hide-xs">Profesional</th><th>Estado</th></tr></thead>
                        <tbody>
                            ${finishedApts.map(apt => {
                                const statusMeta = getAppointmentStatusMeta(apt.status);
                                return `
                                    <tr class="${apt.isOverbook ? 'tr-sobreturno' : ''}">
                                        <td><span class="font-semibold">${apt.time}</span> <span class="text-xs text-gray-400">(${apt.duration}m)</span></td>
                                        <td>${escapeHtml(apt.patient)} ${apt.isOverbook ? '<span class="badge badge-purple text-xs ml-2">Sobreturno</span>' : ''}</td>
                                        <td class="col-hide-xs">${escapeHtml(getProfName(apt.professionalId))}</td>
                                        <td><span class="badge ${statusMeta.badge}">${statusMeta.label}</span></td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            </details>
            ` : ''}
        </div>
    `;
}

function renderSettingsSubpages() {
    const users = DB.get('users');
    const profs = DB.get('professionals');
    const clinicSettings = getClinicSettings();
    const clinicName = String(clinicSettings.name || DEFAULT_CLINIC_SETTINGS.name);
    const isSuper = state.user.roles.includes('superadmin');
    const isAdmin = state.user.roles.some(role => ['superadmin', 'admin'].includes(role));
    const isSecretary = state.user.roles.includes('secretary');
    const canManageSettings = isAdmin || isSecretary;
    const canManageUsers = isAdmin;       // crear/ver usuarios y profesionales
    const canManageClinic = isSecretary || isAdmin; // configuración de clínica

    if (!canManageSettings) {
        return `
            <div class="settings-card">
                <h3>Acceso denegado</h3>
                <p>No tenés permisos para acceder a la configuración.</p>
            </div>
        `;
    }

    const _roleBadgeClass = r => r === 'superadmin' ? 'badge-danger' : r === 'admin' ? 'badge-info' : r === 'secretary' ? 'badge-warning' : r === 'professional' ? 'badge-success' : 'badge-gray';
    const _roleLabel = r => ({ superadmin: 'superadmin', admin: 'admin', secretary: 'secretario', professional: 'profesional' }[r] || r);
    const userCards = users.map(u => {
        const rolesList = (u.roles || (u.role ? [u.role] : []));
        const initials = (u.name || u.email || 'U').substring(0, 2).toUpperCase();
        const roleBadges = rolesList.length
            ? rolesList.map(r => `<span class="badge ${_roleBadgeClass(r)} flex-shrink-0">${_roleLabel(r)}</span>`).join('')
            : `<span class="badge badge-gray flex-shrink-0">sin rol</span>`;
        return `
            <div class="settings-entity-card">
                <div class="settings-entity-avatar">${escapeHtml(initials)}</div>
                <div class="settings-entity-info">
                    <span class="settings-entity-name">${escapeHtml(u.name || 'Sin nombre')}</span>
                    <span class="settings-entity-sub">${escapeHtml(u.email || '-')}</span>
                </div>
                <div class="user-role-badges flex-shrink-0" style="display:flex;gap:4px;flex-wrap:wrap;justify-content:flex-end;">${roleBadges}</div>
                <div class="settings-entity-actions">
                    ${(isSuper || u.id === state.user?.id) ? `
                    <button class="btn btn-icon btn-edit-user" data-id="${u.id}" title="Editar"><i class="fa-solid fa-pen"></i></button>` : ''}
                    ${isSuper && !u.isPlatformAdmin ? `<button class="btn btn-icon" onclick="deleteUser(${u.id})" title="Eliminar" style="color:var(--danger)"><i class="fa-solid fa-trash"></i></button>` : ''}
                </div>
            </div>`;
    }).join('');

    const profesionalRows = profs.map(p => {
        const statusLabel = p.status === 'activo'
            ? `<span class="badge badge-success">Activo</span>`
            : `<span class="badge badge-gray">Inactivo</span>`;
        return `
            <div class="settings-entity-card">
                <div class="settings-entity-avatar" style="background:${getProfColor(p.id).bg}22; color:${getProfColor(p.id).bg}; border:2px solid ${getProfColor(p.id).bg}44;">
                    ${(p.name||'').split(' ').map(w=>w[0]).join('').substring(0,2).toUpperCase() || '?'}
                </div>
                <div class="settings-entity-info">
                    <span class="settings-entity-name">${escapeHtml(p.name)}${p.lastName ? ' ' + escapeHtml(p.lastName) : ''}</span>
                    <span class="settings-entity-sub">${escapeHtml(p.specialty || p.email || '-')}</span>
                </div>
                ${statusLabel}
                <div class="settings-entity-actions">
                    <button class="btn btn-icon btn-edit-prof" data-id="${p.id}" title="Editar"><i class="fa-solid fa-pen"></i></button>
                    ${canViewAppointmentsUi() ? `<button class="btn btn-icon" onclick="viewProfessionalCalendar(${p.id})" title="Calendario"><i class="fa-solid fa-calendar-days"></i></button>` : ''}
                    ${canManageProfessionalSchedulesUi() ? `<button class="btn btn-icon btn-edit-schedule" data-id="${p.id}" title="Horarios"><i class="fa-solid fa-clock"></i></button>` : ''}
                </div>
            </div>`;
    }).join('');

    const professionalColorRows = profs.length
        ? profs.map((professional, idx) => {
            // Usar getProfColor como fuente única — es lo que muestran los chips realmente
            const currentColor = getProfColor(professional.id).bg;
            const swatchId = `swatch-${professional.id}`;
            const hexId    = `hexval-${professional.id}`;
            const chipId   = `chip-${professional.id}`;
            return `
                <div class="prof-color-row">
                    <span class="dash-prof-chip" id="${chipId}" style="background:${currentColor};color:#fff;min-width:7rem;text-align:center;">
                        ${escapeHtml(professional.name)}
                    </span>
                    <label class="prof-color-swatch-label" title="Cambiar color">
                        <span class="prof-color-swatch" id="${swatchId}" style="background:${currentColor}"></span>
                        <span class="prof-color-hex" id="${hexId}">${currentColor}</span>
                        <input type="color" name="clinic-prof-color" data-prof-id="${professional.id}" value="${currentColor}"
                            class="prof-color-input-hidden"
                            oninput="
                                document.getElementById('${swatchId}').style.background=this.value;
                                document.getElementById('${hexId}').textContent=this.value;
                                document.getElementById('${chipId}').style.background=this.value;
                            ">
                    </label>
                </div>
            `;
        }).join('')
        : '<p class="subtext">No hay profesionales cargados todavía.</p>';

    const settingsSections = [
        ...(canManageClinic ? [{ id: 'clinic-settings', label: 'Configuración clínica', icon: 'fa-hospital', description: 'Nombre comercial e identidad visual de profesionales.' }] : []),
        ...(canManageUsers ? [{ id: 'create-user', label: 'Crear usuario', icon: 'fa-user-plus', description: 'Alta de nuevos usuarios y permisos.' }] : []),
        ...(canManageUsers ? [{ id: 'create-professional', label: 'Crear profesional', icon: 'fa-user-doctor', description: 'Registro de profesionales y datos base.' }] : []),
        ...(canManageUsers ? [{ id: 'users-list', label: 'Usuarios existentes', icon: 'fa-users-gear', description: 'Listado de usuarios y accesos asignados.' }] : []),
        ...(canManageUsers ? [{ id: 'professionals-list', label: 'Profesionales existentes', icon: 'fa-address-card', description: 'Vista de profesionales y acceso al calendario.' }] : []),
    ];

    const activeSection = settingsSections.some(section => section.id === state.settingsSubView)
        ? state.settingsSubView
        : (settingsSections[0]?.id || 'create-professional');
    state.settingsSubView = activeSection;

    const settingsContent = {
        'clinic-settings': `
            <section class="settings-card settings-panel-card">
                <header>
                    <div>
                        <h3>Configuración de la Clínica</h3>
                        <p class="subtext">"Odentara" queda fijo. Aquí personalizas el subtítulo (debajo del logo) y los colores de cada profesional en agenda y vistas de turnos.</p>
                    </div>
                </header>
                <form id="clinic-settings-form" class="settings-form-row columns-1">
                    <div class="input-group">
                        <label>Subtítulo de la clínica (debajo de Odentara) *</label>
                        <input type="text" id="clinic-name" value="${clinicName}" required>
                    </div>

                    <div class="settings-subsection">
                        <h4>Color por profesional</h4>
                        <p class="subtext">Estos colores se usan en chips, agenda diaria y referencias de turnos.</p>
                        <div class="settings-list settings-list-static">
                            ${professionalColorRows}
                        </div>
                    </div>

                    <button type="submit" class="btn btn-primary">Guardar Configuración</button>
                </form>
            </section>
        `,
        'create-user': canManageUsers ? (() => {
            const editingUser = state.editingUserId ? users.find(u => u.id === state.editingUserId) : null;
            const isEditing = !!editingUser;
            const editingRoles = new Set(editingUser ? (editingUser.roles || (editingUser.role ? [editingUser.role] : [])) : []);
            const currentLinkedProfId = editingUser?.assignedProfessionalId || editingUser?.linkedProfessionalId || null;
            const editingProfs = new Set([
                ...((editingUser && editingUser.allowedProfessionals) || []).map(id => parseInt(id, 10)),
                ...(currentLinkedProfId ? [currentLinkedProfId] : [])
            ]);
            const isRoleChecked = (r) => editingRoles.has(r) || (r==='administrador'&&editingRoles.has('admin')) || (r==='secretario'&&editingRoles.has('secretary')) || (r==='profesional'&&editingRoles.has('professional'));
            return `
            <section class="settings-card settings-panel-card">
                <header>
                    <div>
                        <h3>${isEditing ? 'Editar Usuario' : 'Crear Nuevo Usuario'}</h3>
                        <p class="subtext">${isEditing ? 'La contraseña es opcional; completala solo si querés cambiarla.' : 'Campos obligatorios: Nombre completo, Email y Contraseña. El tipo se define por los roles.'}</p>
                    </div>
                </header>
                <form id="new-user-form" class="settings-form-row columns-1">
                    <input type="hidden" id="u-editing-id" value="${isEditing ? editingUser.id : ''}">
                    <div class="input-group"><label>Nombre completo *</label><input type="text" id="u-name" value="${isEditing ? escapeHtml(editingUser.name||editingUser.fullName||'') : ''}" required></div>
                    <div class="input-group"><label>Email *</label><input type="email" id="u-email" value="${isEditing ? escapeHtml(editingUser.email||'') : ''}" required></div>
                    <div class="input-group"><label>Contraseña ${isEditing ? '(opcional — completá solo si querés cambiarla)' : '*'}</label><div class="pwd-wrap"><input type="password" id="u-password" minlength="8" placeholder="${isEditing ? 'Dejar vacío para no cambiar' : 'Mínimo 8 caracteres'}" ${isEditing ? '' : 'required'} style="padding-right:40px;"><button type="button" class="login-pwd-toggle" tabindex="-1" onclick="const i=document.getElementById('u-password');i.type=i.type==='password'?'text':'password';this.querySelector('i').className='fa-solid '+(i.type==='password'?'fa-eye':'fa-eye-slash')"><i class="fa-solid fa-eye"></i></button></div></div>
                    ${(isAdmin || !isEditing || editingUser?.id !== state.user?.id) ? `
                    <div class="settings-subsection">
                        <h4>Roles de Permisos</h4>
                        <p class="subtext">Selecciona uno o varios roles.</p>
                        <div class="settings-list settings-list-static">
                            <div class="checkbox-group"><input type="checkbox" name="u-role" value="administrador" ${isRoleChecked('administrador')?'checked':''}><label>Administrador</label></div>
                            <div class="checkbox-group"><input type="checkbox" name="u-role" value="secretario" ${isRoleChecked('secretario')?'checked':''}><label>Secretario</label></div>
                            <div class="checkbox-group"><input type="checkbox" name="u-role" value="profesional" ${isRoleChecked('profesional')?'checked':''}><label>Profesional</label></div>
                        </div>
                    </div>
                    <div class="settings-subsection">
                        <h4>Asignar Profesionales</h4>
                        <p class="subtext">Para rol <strong>Profesional</strong>: seleccioná el profesional que corresponde a este usuario — determina a qué agenda, odontograma y tratamientos accede. Para otros roles: acceso completo si no se selecciona ninguno.</p>
                        <div class="settings-list settings-list-static">
                            ${profs.map(p => `<div class="checkbox-group"><input type="checkbox" name="u-profs" value="${p.id}" ${editingProfs.has(p.id)?'checked':''}><label>${escapeHtml(p.name)}</label></div>`).join('')}
                        </div>
                    </div>` : `
                    <input type="hidden" name="u-role" value="${[...editingRoles][0] || ''}">
                    `}
                    <div class="form-action-row">
                        <button type="submit" class="btn btn-primary">${isEditing ? 'Actualizar Usuario' : 'Guardar Usuario'}</button>
                        ${isEditing ? '<button type="button" class="btn btn-ghost" onclick="window._cancelEditUser()">Cancelar</button>' : ''}
                    </div>
                </form>
            </section>`;
        })() : '',
        'create-professional': (() => {
            const editingProf = state.editingProfId ? profs.find(p => p.id === state.editingProfId) : null;
            const isEditing = !!editingProf;
            const nameParts = String((editingProf && editingProf.name) || '').trim().split(/\s+/).filter(Boolean);
            const firstName = isEditing ? (editingProf.firstName || nameParts.slice(0,-1).join(' ') || nameParts[0] || '') : '';
            const lastName  = isEditing ? (editingProf.lastName  || (nameParts.length>1 ? nameParts[nameParts.length-1] : '')) : '';
            const profStatus = isEditing ? (editingProf.status || (editingProf.active ? 'activo' : 'inactivo')) : 'activo';
            return `
            <section class="settings-card settings-panel-card">
                <header>
                    <div>
                        <h3>${isEditing ? 'Editar Profesional' : 'Crear Profesional'}</h3>
                        <p class="subtext">Campos obligatorios: Nombre, Apellido, Especialidad.</p>
                    </div>
                </header>
                <form id="new-prof-form" class="settings-form-row columns-1">
                    <input type="hidden" id="p-editing-id" value="${isEditing ? editingProf.id : ''}">
                    <div class="input-group"><label>Nombre *</label><input type="text" id="p-name" value="${escapeHtml(firstName)}" required></div>
                    <div class="input-group"><label>Apellido *</label><input type="text" id="p-lastname" value="${escapeHtml(lastName)}" required></div>
                    <div class="input-group"><label>Especialidad *</label><input type="text" id="p-specialty" value="${isEditing ? escapeHtml(editingProf.specialty||'') : ''}" required></div>
                    <div class="input-group"><label>Teléfono</label><input type="text" id="p-phone" value="${isEditing ? escapeHtml(editingProf.phone||'') : ''}"></div>
                    <div class="input-group"><label>Email</label><input type="email" id="p-email" value="${isEditing ? escapeHtml(editingProf.email||'') : ''}"></div>
                    <div class="input-group"><label>Estado</label><select id="p-status"><option value="activo" ${profStatus==='activo'?'selected':''}>Activo</option><option value="inactivo" ${profStatus==='inactivo'?'selected':''}>Inactivo</option></select></div>
                    <div class="form-action-row">
                        <button type="submit" class="btn btn-primary">${isEditing ? 'Actualizar Profesional' : 'Guardar Profesional'}</button>
                        ${isEditing ? '<button type="button" class="btn btn-ghost" onclick="window._cancelEditProf()">Cancelar</button>' : ''}
                    </div>
                </form>
            </section>`;
        })(),
        'users-list': canManageUsers ? `
            <section class="settings-card settings-panel-card">
                <header><h3>Usuarios Existentes</h3></header>
                <div class="settings-entity-list">
                    ${userCards || `<div class="settings-entity-empty"><i class="fa-solid fa-users"></i><span>No hay usuarios registrados</span></div>`}
                </div>
            </section>
        ` : '',
        'professionals-list': `
            <section class="settings-card settings-panel-card">
                <header><h3>Profesionales Existentes</h3></header>
                <div class="settings-entity-list">
                    ${profesionalRows || `<div class="settings-entity-empty"><i class="fa-solid fa-user-doctor"></i><span>No hay profesionales registrados</span></div>`}
                </div>
            </section>
        `
    };

    return `
    <div class="settings-area">
        <section class="settings-card settings-nav-card">
            <div class="settings-nav-header">
                <div>
                    <span class="section-eyebrow">Administración</span>
                    <h3 class="section-title section-title-sm">Configuración</h3>
                    <p class="subtext">Elegí una sección para trabajar dentro de la configuración general.</p>
                </div>
            </div>

            <div class="settings-subnav">
                ${settingsSections.map(section => `
                    <button type="button" class="settings-subnav-item ${section.id === activeSection ? 'active' : ''}" data-settings-view="${section.id}">
                        <i class="fa-solid ${section.icon}"></i>
                        <span>${section.label}</span>
                        <small>${section.description}</small>
                    </button>
                `).join('')}
            </div>
        </section>

        <div class="settings-subpage-content">
            ${settingsContent[activeSection]}
        </div>
    </div>
    `;
}

function renderSettings() {
    const users = DB.get('users');
    const profs = DB.get('professionals');
    const isSuper = state.user.roles.includes('superadmin');
    const isAdmin = state.user.roles.some(role => ['superadmin', 'admin'].includes(role));
    const isSecretary = state.user.roles.includes('secretary');
    const canManageSettings = isAdmin || isSecretary;

    if (!canManageSettings) {
        return `
            <div class="settings-card">
                <h3>Acceso denegado</h3>
                <p>No tenés permisos para acceder a la configuración.</p>
            </div>
        `;
    }

    const userRows = users.map(u => {
        const roles = (u.roles || (u.role ? [u.role] : [])).map(r => `
            <span class="badge ${r === 'superadmin' ? 'badge-primary' : (r === 'admin' ? 'badge-info' : (r === 'secretary' ? 'badge-warning' : 'badge-gray'))}">${r}</span>
        `).join(' ');

        const profNames = u.allowedProfessionals && u.allowedProfessionals.length > 0
            ? u.allowedProfessionals.map(id => `<span class="badge badge-gray">${getProfName(id)}</span>`).join(' ')
            : `<span class="badge badge-gray">No asignado</span>`;

        return `
            <tr class="hover-row">
                <td class="table-name"><strong>${escapeHtml(u.name || 'Sin nombre')}</strong><br><span class="subtle">${escapeHtml(u.email || '-')}</span></td>
                <td>${u.type || '-'}</td>
                <td>${roles}</td>
                <td>${profNames}</td>
                <td class="text-center">
                    ${(isSuper || u.id === state.user?.id) ? `<button class="btn btn-icon btn-edit-user" data-id="${u.id}" title="Editar usuario"><i class="fa-solid fa-pen"></i></button>` : ''}
                    ${isSuper && !u.isPlatformAdmin ? `<button class="btn btn-icon" onclick="deleteUser(${u.id})" title="Eliminar usuario" style="color:var(--danger)"><i class="fa-solid fa-trash"></i></button>` : ''}
                </td>
            </tr>`;
    }).join('');

    const profesionalRows = profs.map(p => {
        const statusLabel = p.status === 'activo'
            ? `<span class="badge badge-success">Activo</span>`
            : `<span class="badge badge-gray">Inactivo</span>`;
        return `
            <tr class="hover-row">
                <td class="table-name">${escapeHtml(p.name)}</td>
                <td>${escapeHtml(p.lastName || '-')}</td>
                <td>${escapeHtml(p.specialty || '-')}</td>
                <td>${escapeHtml(p.phone || '-')}</td>
                <td>${escapeHtml(p.email || '-')}</td>
                <td>${statusLabel}</td>
                <td class="text-center">${canViewAppointmentsUi() ? `<button class="btn btn-icon" onclick="viewProfessionalCalendar(${p.id})" title="Ver calendario"><i class="fa-solid fa-calendar-days"></i></button>` : ''}${canManageProfessionalSchedulesUi() ? `<button class="btn btn-icon btn-edit-schedule" data-id="${p.id}" title="Configurar horarios"><i class="fa-solid fa-clock"></i></button>` : ''}</td>
            </tr>`;
    }).join('');

    return `
    <div class="settings-area">
        <div class="settings-top-grid">
            <section class="settings-card">
                <header>
                    <div>
                        <h3>Crear Nuevo Usuario</h3>
                        <p class="subtext">Campos obligatorios: Nombre completo, Email y Contraseña. El tipo se define por los roles.</p>
                    </div>
                </header>
                <form id="new-user-form" class="settings-form-row columns-1">
                    <div class="input-group"><label>Nombre completo *</label><input type="text" id="u-name" required></div>
                    <div class="input-group"><label>Email *</label><input type="email" id="u-email" required></div>
                    <div class="input-group"><label>Contraseña *</label><div class="pwd-wrap"><input type="password" id="u-password" minlength="8" placeholder="Mínimo 8 caracteres" required style="padding-right:40px;"><button type="button" class="login-pwd-toggle" tabindex="-1" onclick="const i=document.getElementById('u-password');i.type=i.type==='password'?'text':'password';this.querySelector('i').className='fa-solid '+(i.type==='password'?'fa-eye':'fa-eye-slash')"><i class="fa-solid fa-eye"></i></button></div></div>

                    <div class="settings-subsection">
                        <h4>Roles de Permisos</h4>
                        <p class="subtext">Selecciona uno o varios roles.</p>
                        <div class="checkbox-group"><input type="checkbox" name="u-role" value="administrador"><label>Administrador</label></div>
                        <div class="checkbox-group"><input type="checkbox" name="u-role" value="secretario"><label>Secretario</label></div>
                        <div class="checkbox-group"><input type="checkbox" name="u-role" value="profesional"><label>Profesional</label></div>
                    </div>

                    <div class="settings-subsection">
                        <h4>Asignar Profesionales (opcional)</h4>
                        <p class="subtext">Se puede dejar vacío; acceso completo si no se selecciona ninguno.</p>
                        <div class="settings-list settings-list-static">
                            ${profs.map(p => `<div class="checkbox-group"><input type="checkbox" name="u-profs" value="${p.id}"><label>${escapeHtml(p.name)}</label></div>`).join('')}
                        </div>
                    </div>
                    <button type="submit" class="btn btn-primary">Guardar Usuario</button>
                </form>
            </section>

            <section class="settings-card">
                <header>
                    <div>
                        <h3>Crear Profesional</h3>
                        <p class="subtext">Campos obligatorios: Nombre, Apellido, Especialidad.</p>
                    </div>
                </header>
                <form id="new-prof-form" class="settings-form-row columns-1">
                    <div class="input-group"><label>Nombre *</label><input type="text" id="p-name" required></div>
                    <div class="input-group"><label>Apellido *</label><input type="text" id="p-lastname" required></div>
                    <div class="input-group"><label>Especialidad *</label><input type="text" id="p-specialty" required></div>
                    <div class="input-group"><label>Teléfono</label><input type="text" id="p-phone"></div>
                    <div class="input-group"><label>Email</label><input type="email" id="p-email"></div>
                    <div class="input-group"><label>Estado</label><select id="p-status"><option value="activo">Activo</option><option value="inactivo">Inactivo</option></select></div>
                    <button type="submit" class="btn btn-primary">Guardar Profesional</button>
                </form>
            </section>
        </div>

        <div class="settings-tables-grid">
            <section class="settings-card">
                <header><h3>Usuarios Existentes</h3></header>
                <div class="table-container overflow-x-auto">
                    <table class="table-modern table-compact">
                        <thead>
                            <tr>
                                <th>Nombre / Email</th>
                                <th>Tipo</th>
                                <th>Roles</th>
                                <th>Profesionales</th>
                                <th>Acción</th>
                            </tr>
                        </thead>
                        <tbody>${userRows || `<tr><td colspan="5" class="text-gray-500">No hay usuarios registrados</td></tr>`}</tbody>
                    </table>
                </div>
            </section>
            <section class="settings-card">
                <header><h3>Profesionales Existentes</h3></header>
                <div class="table-container overflow-x-auto">
                    <table class="table-modern table-compact">
                        <thead>
                            <tr>
                                <th>Nombre</th>
                                <th>Apellido</th>
                                <th>Especialidad</th>
                                <th>Teléfono</th>
                                <th>Email</th>
                                <th>Estado</th>
                                <th>Acción</th>
                            </tr>
                        </thead>
                        <tbody>${profesionalRows || `<tr><td colspan="7" class="text-gray-500">No hay profesionales registrados</td></tr>`}</tbody>
                    </table>
                </div>
            </section>
        </div>
    </div>
    `;
}

// --- Ficha ClÃ­nica y Odontograma ---

async function loadClinicalHistory(patientId, options = {}) {
    if (!canAccessPatient(patientId)) return;
    if (!canViewClinicalHistoryUi()) {
        showAlert('El secretario no puede acceder a la historia clínica.', { title: 'Historia clínica', variant: 'error' });
        return;
    }
    if (!options.skipUnsavedCheck) {
        const switchingPatient = state.currentView === 'patient-history' && state.currentPatientId !== patientId;
        if ((switchingPatient || state.currentView !== 'patient-history') && !(await confirmClinicalDraftExit())) {
            return;
        }
    }
    state.currentView = 'patient-history';
    state.currentPatientId = patientId;
    pageTitle.innerText = 'Ficha Odontológica';
    mainContent.innerHTML = '<div class="card p-6 text-center text-gray-500">Cargando historia clínica...</div>';
    
    // Determinar qué profesional se usa para el odontograma
    const scopedProfs = state.user?.allowedProfessionals || [];
    const needsSelector = isSuperadmin() || scopedProfs.length > 1;
    if (needsSelector && !state.clinicalOdontoProfessionalId) {
        const allProfs = DB.get('professionals').filter(p => p.active !== false && p.status !== 'inactivo');
        const candidates = isSuperadmin() ? allProfs : allProfs.filter(p => scopedProfs.includes(p.id));
        if (candidates.length > 0) {
            state.clinicalOdontoProfessionalId = candidates[0].id;
        }
    }

    try {
        if (!options.skipSync) {
            await syncPatientClinicalData(patientId, getCurrentOdontoProfessionalId());
        }
    } catch (error) {
        showAlert(error.message || 'No se pudo cargar la historia clínica.', { title: 'Historia clínica', variant: 'error' });
    }

    setClinicalDraftFromPatient(DB.get('patients').find((item) => item.id === patientId));

    mainContent.innerHTML = '';

    const content = document.createElement('div');
    content.className = 'animate-fade-in clinical-print-root';
    content.innerHTML = renderClinicalHistory(patientId);
    mainContent.appendChild(content);
    enhanceClinicalPatientEditor(patientId);

    attachClinicalHistoryEvents(patientId);
    syncClinicalHistorySaveState();
    renderSidebar();
}

function enhanceClinicalPatientEditor(patientId) {
    const patient = getClinicalWorkingPatient(patientId);
    if (!patient) return;
    const canEditClinical = canEditClinicalHistoryUi();

    let age = '-';
    if (patient.fechaNacimiento) {
        const diff = Date.now() - new Date(patient.fechaNacimiento).getTime();
        age = Math.abs(new Date(diff).getUTCFullYear() - 1970);
    }

    const container = document.querySelector('.clinical-info-grid');
    if (!container) return;

    container.innerHTML = `
        <div class="clinical-edit-grid clinical-edit-grid-compact">
            <div class="clinical-info-item clinical-info-item-compact">
                <strong class="text-gray-600 uppercase text-xs">Nombre</strong>
                <input class="form-input clinical-readonly" type="text" value="${patient.name || ''}" disabled>
            </div>
            <div class="clinical-info-item clinical-info-item-compact">
                <strong class="text-gray-600 uppercase text-xs">DNI</strong>
                <input class="form-input clinical-readonly" type="text" value="${patient.dni || ''}" disabled>
            </div>
            <div class="clinical-info-item clinical-info-item-compact">
                <strong class="text-gray-600 uppercase text-xs">Nacimiento</strong>
                <input class="form-input" type="date" id="clinical-fecha-nacimiento" value="${patient.fechaNacimiento || ''}" ${canEditClinical ? '' : 'disabled'}>
            </div>
            <div class="clinical-info-item clinical-info-item-compact">
                <strong class="text-gray-600 uppercase text-xs">Edad</strong>
                <div class="clinical-static-value">${age} años</div>
            </div>
            <div class="clinical-info-item clinical-info-item-compact">
                <strong class="text-gray-600 uppercase text-xs">Teléfono</strong>
                <input class="form-input" type="text" id="clinical-phone" value="${patient.phone || ''}" ${canEditClinical ? '' : 'disabled'}>
            </div>
            <div class="clinical-info-item clinical-info-item-compact">
                <strong class="text-gray-600 uppercase text-xs">Email</strong>
                <input class="form-input" type="email" id="clinical-email" value="${patient.email || ''}" ${canEditClinical ? '' : 'disabled'}>
            </div>
            <div class="clinical-info-item clinical-info-item-compact">
                <strong class="text-gray-600 uppercase text-xs">Obra Social / Plan</strong>
                <input class="form-input" type="text" id="clinical-obra-social" value="${patient.obraSocial || ''}" ${canEditClinical ? '' : 'disabled'}>
            </div>
            <div class="clinical-info-item clinical-info-item-compact">
                <strong class="text-gray-600 uppercase text-xs">Credencial</strong>
                <input class="form-input" type="text" id="clinical-credencial" value="${patient.credencial || ''}" ${canEditClinical ? '' : 'disabled'}>
            </div>
            <div class="clinical-info-item clinical-info-item-compact">
                <strong class="text-gray-600 uppercase text-xs">Ficha N°</strong>
                <input class="form-input" type="text" id="clinical-ficha-numero" value="${patient.fichaNumero || ''}" ${canEditClinical ? '' : 'disabled'}>
            </div>
            <div class="clinical-info-item clinical-info-item-compact clinical-info-item-wide">
                <strong class="text-gray-600 uppercase text-xs">Domicilio</strong>
                <input class="form-input" type="text" id="clinical-domicilio" value="${patient.domicilio || ''}" ${canEditClinical ? '' : 'disabled'}>
            </div>
        </div>
    `;
}

// ── Odontogram tool state ─────────────────────────────────────
let odontogramTool = { color: 'rojo', treatment: null, clearing: false };

function calcAge(fechaNacimiento) {
    if (!fechaNacimiento) return null;
    const birth = new Date(fechaNacimiento);
    if (isNaN(birth.getTime())) return null;
    const now = new Date();
    let age = now.getFullYear() - birth.getFullYear();
    const m = now.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
    return age;
}

window.toggleInfantilSection = function() {
    const section = document.getElementById('odonto-infantil-section');
    const icon    = document.getElementById('odonto-infantil-icon');
    if (!section) return;
    const visible = section.style.display !== 'none';
    section.style.display = visible ? 'none' : 'flex';
    if (icon) icon.className = visible ? 'fa-solid fa-chevron-down' : 'fa-solid fa-chevron-up';
};

function drawTeethRow(teethArray, patientOdontograma, isUpper = true) {
    if(!patientOdontograma) patientOdontograma = {};
    const S = '#b0a0a0';   // stroke color
    const BG = '#f2e8e8';  // face background (light pinkish)

    return teethArray.map(id => {
        const toothData = patientOdontograma[id] || {};
        const estado = toothData.estado;
        const tColor = toothData.color || 'rojo';
        const xColor = tColor === 'azul' ? '#2563eb' : '#dc2626';

        const getColor = (f) => {
            if(toothData[f] === 'caries')     return '#ef4444';
            if(toothData[f] === 'restaurado') return '#2563eb';
            return BG;
        };

        const baseFaces = (interactable = true) => {
            const cls = interactable ? 'class="tooth-face cursor-pointer" pointer-events="all"' : 'pointer-events="none"';
            const getC = interactable ? getColor : () => BG;
            return `
                <polygon points="2,2 98,2 50,50"   ${interactable ? `class="tooth-face cursor-pointer" data-tooth="${id}" data-face="top"` : ''} fill="${getC('top')}"    stroke="${S}" stroke-width="1.5" ${interactable ? 'pointer-events="all"' : 'pointer-events="none"'}/>
                <polygon points="98,2 98,98 50,50"  ${interactable ? `class="tooth-face cursor-pointer" data-tooth="${id}" data-face="right"` : ''} fill="${getC('right')}"  stroke="${S}" stroke-width="1.5" ${interactable ? 'pointer-events="all"' : 'pointer-events="none"'}/>
                <polygon points="98,98 2,98 50,50"  ${interactable ? `class="tooth-face cursor-pointer" data-tooth="${id}" data-face="bottom"` : ''} fill="${getC('bottom')}" stroke="${S}" stroke-width="1.5" ${interactable ? 'pointer-events="all"' : 'pointer-events="none"'}/>
                <polygon points="2,98 2,2 50,50"    ${interactable ? `class="tooth-face cursor-pointer" data-tooth="${id}" data-face="left"` : ''} fill="${getC('left')}"   stroke="${S}" stroke-width="1.5" ${interactable ? 'pointer-events="all"' : 'pointer-events="none"'}/>
                <circle cx="50" cy="50" r="24" ${interactable ? `class="tooth-face cursor-pointer" data-tooth="${id}" data-face="center"` : ''} fill="${getC('center')}" stroke="${S}" stroke-width="2" ${interactable ? 'pointer-events="all"' : 'pointer-events="none"'}/>
                <rect x="2" y="2" width="96" height="96" fill="transparent" stroke="${S}" stroke-width="2.5" pointer-events="none"/>
            `;
        };

        let facesHtml = '';
        let indHtml = '';   // indicator below/above tooth (same slot on every tooth)

        if(estado === 'ausente') {
            facesHtml = `
                <rect x="2" y="2" width="96" height="96" fill="${BG}" stroke="${S}" stroke-width="2.5"/>
                ${baseFaces(false)}
                <line x1="12" y1="12" x2="88" y2="88" stroke="${xColor}" stroke-width="10" stroke-linecap="round"/>
                <line x1="88" y1="12" x2="12" y2="88" stroke="${xColor}" stroke-width="10" stroke-linecap="round"/>
                <rect x="0" y="0" width="100" height="100" class="tooth-face cursor-pointer" data-tooth="${id}" data-face="center" fill="transparent" stroke="none"/>
            `;
        } else if(estado === 'implante') {
            const ic = tColor === 'azul' ? '#1d4ed8' : '#dc2626';
            facesHtml = `
                <rect x="2" y="2" width="96" height="96" fill="${BG}" stroke="${S}" stroke-width="2.5"/>
                ${baseFaces(true)}
            `;
            indHtml = `<svg width="11" height="11" viewBox="0 0 11 11"><rect x="0" y="0" width="11" height="11" fill="${ic}" rx="1.5"/></svg>`;
        } else if(estado === 'corona-implante') {
            const ci = tColor === 'azul' ? '#2563eb' : '#dc2626';
            facesHtml = `
                <rect x="2" y="2" width="96" height="96" fill="${BG}" stroke="${S}" stroke-width="2.5"/>
                ${baseFaces(true)}
            `;
            indHtml = `<svg width="11" height="11" viewBox="0 0 11 11"><polygon points="5.5,0 11,5.5 5.5,11 0,5.5" fill="${ci}"/></svg>`;
        } else if(estado === 'corona') {
            const cc = tColor === 'azul' ? '#2563eb' : '#dc2626';
            facesHtml = `
                <rect x="2" y="2" width="96" height="96" fill="${BG}" stroke="${S}" stroke-width="2.5"/>
                ${baseFaces(false)}
                <circle cx="50" cy="50" r="38" fill="transparent" stroke="${cc}" stroke-width="10"/>
                <rect x="0" y="0" width="100" height="100" class="tooth-face cursor-pointer" data-tooth="${id}" data-face="center" fill="transparent" stroke="none"/>
            `;
        } else if(estado === 'endodoncia') {
            const ec = tColor === 'azul' ? '#2563eb' : '#dc2626';
            facesHtml = `
                <rect x="2" y="2" width="96" height="96" fill="${BG}" stroke="${S}" stroke-width="2.5"/>
                ${baseFaces(false)}
                <rect x="24" y="16" width="52" height="12" fill="${ec}"/>
                <rect x="44" y="28" width="12" height="44" fill="${ec}"/>
                <rect x="24" y="72" width="52" height="12" fill="${ec}"/>
                <rect x="0" y="0" width="100" height="100" class="tooth-face cursor-pointer" data-tooth="${id}" data-face="center" fill="transparent" stroke="none"/>
            `;
        } else if(estado === 'sello') {
            const sc = tColor === 'azul' ? '#2563eb' : '#dc2626';
            facesHtml = `
                <rect x="2" y="2" width="96" height="96" fill="${BG}" stroke="${S}" stroke-width="2.5"/>
                ${baseFaces(true)}
                <text x="50" y="56" font-size="54" font-weight="900" text-anchor="middle" dominant-baseline="middle" fill="${sc}" font-family="Georgia,serif" opacity="0.88" pointer-events="none">S</text>
            `;
        } else if(estado === 'ortodoncia') {
            const oc = tColor === 'azul' ? '#2563eb' : '#dc2626';
            facesHtml = `
                <rect x="2" y="2" width="96" height="96" fill="${BG}" stroke="${S}" stroke-width="2.5"/>
                ${baseFaces(false)}
                <path d="M 62 20 C 62 20 28 20 28 42 C 28 62 72 40 72 62 C 72 82 38 82 38 82" stroke="${oc}" stroke-width="10" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
                <rect x="0" y="0" width="100" height="100" class="tooth-face cursor-pointer" data-tooth="${id}" data-face="center" fill="transparent" stroke="none"/>
            `;
        } else {
            facesHtml = `
                <rect x="2" y="2" width="96" height="96" fill="${BG}" stroke="${S}" stroke-width="2.5"/>
                ${baseFaces(true)}
            `;
        }

        const numSpan = `<span class="text-[9px] md:text-[11px] font-bold text-gray-600 w-full text-center leading-tight">${id}</span>`;
        const svgBox = `<div class="relative tooth-svg-box">
                <svg viewBox="0 0 100 100" class="w-full h-full" style="filter:drop-shadow(0 1px 2px rgba(0,0,0,.12));">
                    ${facesHtml}
                </svg>
            </div>`;
        // Fila inferior: número e indicador en la misma línea
        // implante → cuadrado a la izquierda del número; corona-implante → rombo a la derecha
        const lowerBottom = `<div class="tooth-ind-slot" style="justify-content:center;gap:2px;">
            <div style="width:11px;height:11px;flex-shrink:0;">${estado === 'implante' ? indHtml : ''}</div>
            <span class="text-[9px] md:text-[11px] font-bold text-gray-600 leading-tight">${id}</span>
            <div style="width:11px;height:11px;flex-shrink:0;">${estado === 'corona-implante' ? indHtml : ''}</div>
        </div>`;

        const upperIndAlign = estado === 'corona-implante' ? 'flex-end' : 'flex-start';
        return isUpper
            ? `<div class="flex flex-col items-center tooth-box" data-tooth="${id}">${numSpan}${svgBox}<div class="tooth-ind-slot" style="justify-content:${upperIndAlign};">${indHtml}</div></div>`
            : `<div class="flex flex-col items-center tooth-box" data-tooth="${id}">${svgBox}${lowerBottom}</div>`;
    }).join('');
}

function renderClinicalHistory(patientId) {
    const patient = getClinicalWorkingPatient(patientId);
    if(!patient) return '<p>Paciente no encontrado</p>';
    const clinicalImages = (patient.clinicalImages || []).slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    const latestClinicalImage = clinicalImages[0];
    const canEditClinical = canEditClinicalHistoryUi();
    const draft = getClinicalDraft(patientId);

    // Tratamientos filtrados por profesional seleccionado
    // Los tratamientos sin professionalId (null) se muestran para todos los profesionales
    const selectedProfId = getCurrentOdontoProfessionalId();
    const visibleTreatments = selectedProfId
        ? (patient.treatments || []).filter(t => !t.professionalId || t.professionalId === selectedProfId)
        : (patient.treatments || []);

    let age = '-';
    if(patient.fechaNacimiento) {
        const diff = Date.now() - new Date(patient.fechaNacimiento).getTime();
        age = Math.abs(new Date(diff).getUTCFullYear() - 1970);
    }

    return `
    <div class="clinical-history-card rounded-xl max-w-5xl mx-auto overflow-hidden" style="font-family: Arial, sans-serif;">
        <!-- Cabecera estilo Recetario -->
        <div class="flex flex-col md:flex-row justify-between items-center p-6 border-b-2 border-primary-800 bg-primary-50">
            <div class="flex items-center gap-4 mb-4 md:mb-0">
                <img src="favicon.svg" alt="Odentara" class="clinical-brand-logo">
                <div>
                    <h2 class="text-xl md:text-2xl font-black text-gray-900 tracking-tight uppercase">${escapeHtml(getClinicDisplayName())}</h2>
                    <p class="text-sm font-semibold text-primary-700">Ficha Clínica Odontológica</p>
                </div>
            </div>
            <div class="text-right text-sm clinical-header-actions">
                <div class="clinical-print-toolbar print-hidden">
                    <button type="button" class="btn btn-primary btn-sm" onclick="printClinicalHistory()">
                        <i class="fa-solid fa-print"></i> Imprimir Historia
                    </button>
                </div>
            </div>
        </div>
        
        <div class="p-6">
            <!-- Datos del Paciente -->
            <div class="clinical-info-grid mb-10 pb-6 border-b border-dashed border-gray-300">
                <div class="clinical-info-summary">
                    <div><strong class="text-gray-600 uppercase text-xs">Obra Social / Plan</strong><div class="text-base font-semibold text-gray-800">${patient.obraSocial || '-'}</div></div>
                    <div><strong class="text-gray-600 uppercase text-xs">Credencial</strong><div class="text-base font-semibold text-gray-800">${patient.credencial || '-'}</div></div>
                    <div><strong class="text-gray-600 uppercase text-xs">Ficha N°</strong><div class="text-base font-semibold text-primary-700">${patient.fichaNumero || '-'}</div></div>
                </div>
                <div class="clinical-info-item"><strong class="text-gray-600 uppercase text-xs">Nacimiento</strong><div>${patient.fechaNacimiento ? patient.fechaNacimiento.split('-').reverse().join('/') : '-'}</div></div>
                <div class="clinical-info-item"><strong class="text-gray-600 uppercase text-xs">Edad</strong><div>${age} años</div></div>
                <div class="clinical-info-item"><strong class="text-gray-600 uppercase text-xs">Teléfono</strong><div>${patient.phone || '-'}</div></div>
                <div class="clinical-info-item col-span-full"><strong class="text-gray-600 uppercase text-xs">Domicilio</strong><div>${patient.domicilio || '-'}</div></div>
            </div>

            <!-- ODONTOGRAMA -->
            <div class="mb-10 clinical-odontogram-block">
                <div class="odontogram-header mb-4 clinical-odontogram-section">
                    <h3 class="font-black text-gray-800 uppercase tracking-widest text-sm bg-gray-100 py-1 px-3 rounded inline-block border-l-4 border-primary-600">Odontograma</h3>
                    ${(() => {
                        const _scopedProfs = state.user?.allowedProfessionals || [];
                        const _needsSelector = isSuperadmin() || _scopedProfs.length > 1;
                        if (_needsSelector) {
                            const allProfs = DB.get('professionals').filter(p => p.active !== false && p.status !== 'inactivo');
                            const profs = isSuperadmin() ? allProfs : allProfs.filter(p => _scopedProfs.includes(p.id));
                            const selectedId = state.clinicalOdontoProfessionalId;
                            return `<div class="odonto-prof-selector print-hidden">
                                <label class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Profesional:</label>
                                <select id="odonto-prof-select" class="odonto-prof-select-input" onchange="window.changeOdontoProfessional(${patientId}, this.value)">
                                    <option value="">— Seleccionar —</option>
                                    ${profs.map(p => `<option value="${p.id}" ${p.id === selectedId ? 'selected' : ''}>${escapeHtml(p.name)}${p.specialty ? ' · ' + escapeHtml(p.specialty) : ''}</option>`).join('')}
                                </select>
                            </div>`;
                        }
                        const profName = state.user?.assignedProfessionalName || '';
                        const profLabel = profName && !/^Dr\.?\/?(Dra\.?)?|^Dr\.?\s/i.test(profName) ? `Dr/Dra. ${profName}` : profName;
                        return profLabel ? `<span class="text-xs text-gray-500 font-medium print-hidden">${profLabel}</span>` : '';
                    })()}
                </div>
                
                <div class="odontogram-wrapper overflow-x-auto pb-4">
                    <div class="flex flex-col items-center gap-5 min-w-max">
                        <div class="w-full flex flex-col items-center gap-3">
                            <div class="text-[10px] md:text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Dentición Adulta</div>
                            <div class="flex gap-4 md:gap-8 justify-center min-w-max">
                                <div class="flex gap-[2px] md:gap-1"> ${drawTeethRow([18,17,16,15,14,13,12,11], patient.odontograma, true)} </div>
                                <div class="flex gap-[2px] md:gap-1 border-l-2 border-gray-300 pl-4 md:pl-8"> ${drawTeethRow([21,22,23,24,25,26,27,28], patient.odontograma, true)} </div>
                            </div>
                            <div class="odonto-jaw-gap"></div>
                            <div class="flex gap-4 md:gap-8 justify-center min-w-max">
                                <div class="flex gap-[2px] md:gap-1"> ${drawTeethRow([48,47,46,45,44,43,42,41], patient.odontograma, false)} </div>
                                <div class="flex gap-[2px] md:gap-1 border-l-2 border-gray-300 pl-4 md:pl-8"> ${drawTeethRow([31,32,33,34,35,36,37,38], patient.odontograma, false)} </div>
                            </div>
                        </div>

                        ${(() => { const _age = calcAge(patient.fechaNacimiento); const _show = (_age !== null && _age < 13) || hasChildDentitionData(patient); return `
                        <button class="odonto-infantil-toggle" onclick="window.toggleInfantilSection()">
                            <span class="odonto-infantil-toggle-line"></span>
                            <span>Dentición Infantil</span>
                            <i id="odonto-infantil-icon" class="fa-solid ${_show ? 'fa-chevron-up' : 'fa-chevron-down'}"></i>
                            <span class="odonto-infantil-toggle-line"></span>
                        </button>
                        <div id="odonto-infantil-section" style="display:${_show ? 'flex' : 'none'};flex-direction:column;align-items:center;gap:12px;width:100%;">
                            <div class="flex gap-4 md:gap-8 justify-center min-w-max">
                                <div class="flex gap-[2px] md:gap-1"> ${drawTeethRow([55,54,53,52,51], patient.odontograma, true)} </div>
                                <div class="flex gap-[2px] md:gap-1 border-l-2 border-gray-300 pl-4 md:pl-8"> ${drawTeethRow([61,62,63,64,65], patient.odontograma, true)} </div>
                            </div>
                            <div class="odonto-jaw-gap"></div>
                            <div class="flex gap-4 md:gap-8 justify-center min-w-max">
                                <div class="flex gap-[2px] md:gap-1"> ${drawTeethRow([85,84,83,82,81], patient.odontograma, false)} </div>
                                <div class="flex gap-[2px] md:gap-1 border-l-2 border-gray-300 pl-4 md:pl-8"> ${drawTeethRow([71,72,73,74,75], patient.odontograma, false)} </div>
                            </div>
                        </div>`; })()}
                    </div>
                </div>
                <div class="odontogram-mobile-notice print-hidden">
                    <i class="fa-solid fa-display"></i>
                    <div>
                        <strong>Odontograma no disponible</strong>
                        <span>Accedé desde una tablet o computadora para ver y editar el odontograma.</span>
                    </div>
                </div>
                ${canEditClinical ? `
                <div class="odontogram-toolbar print-hidden" id="odontogram-toolbar">
                    <div class="odonto-color-group">
                        <button class="odonto-color-btn odonto-rojo is-active" data-color="rojo" title="Rojo – Caries / Problema">
                            <svg viewBox="0 0 32 32" width="22" height="22"><circle cx="16" cy="16" r="12" fill="#ef4444"/></svg>
                        </button>
                        <button class="odonto-color-btn odonto-azul" data-color="azul" title="Azul – Restaurado / Tratado">
                            <svg viewBox="0 0 32 32" width="22" height="10"><rect x="2" y="10" width="28" height="12" rx="2" fill="#2563eb"/></svg>
                        </button>
                    </div>
                    <div class="odonto-treat-group">
                        <button class="odonto-treat-btn is-active" data-treatment="" title="Arreglo">
                            <img src="/img/odonto/01-arreglo.jpg" alt="Arreglo" class="odonto-treat-img">
                            <span class="odonto-treat-label">Arreglo</span>
                        </button>
                        <button class="odonto-treat-btn" data-treatment="ausente" title="Extracción">
                            <img src="/img/odonto/02-extraccion.jpg" alt="Extracción" class="odonto-treat-img">
                            <span class="odonto-treat-label">Extracción</span>
                        </button>
                        <button class="odonto-treat-btn" data-treatment="implante" title="Implante">
                            <img src="/img/odonto/03-implante.jpg" alt="Implante" class="odonto-treat-img">
                            <span class="odonto-treat-label">Implante</span>
                        </button>
                        <button class="odonto-treat-btn" data-treatment="corona" title="Corona sobre diente">
                            <img src="/img/odonto/04-corona-sobre-diente.jpg" alt="Corona sobre diente" class="odonto-treat-img">
                            <span class="odonto-treat-label">Corona sobre diente</span>
                        </button>
                        <button class="odonto-treat-btn" data-treatment="corona-implante" title="Corona sobre implante">
                            <img src="/img/odonto/05-corona-sobre-implante.jpg" alt="Corona sobre implante" class="odonto-treat-img">
                            <span class="odonto-treat-label">Corona sobre implante</span>
                        </button>
                        <button class="odonto-treat-btn" data-treatment="sello" title="Sellante">
                            <img src="/img/odonto/06-sellante.jpg" alt="Sellante" class="odonto-treat-img">
                            <span class="odonto-treat-label">Sellante</span>
                        </button>
                        <button class="odonto-treat-btn" data-treatment="endodoncia" title="Endodoncia">
                            <img src="/img/odonto/07-endodoncia.jpg" alt="Endodoncia" class="odonto-treat-img">
                            <span class="odonto-treat-label">Endodoncia</span>
                        </button>
                    </div>
                    <div class="odonto-action-group">
                        <button class="odonto-apply-btn" onclick="window.saveClinicalHistory(${patientId})">
                            <i class="fa-solid fa-tooth"></i> APLICAR
                        </button>
                        <button class="odonto-clear-btn" onclick="window.clearOdontogramTooth(${patientId})" id="btn-odonto-clear">
                            <i class="fa-solid fa-eraser"></i> LIMPIAR
                        </button>
                    </div>
                </div>
                ` : ''}
            </div>

            <!-- TRATAMIENTOS -->
            <div class="mb-6">
                <div class="treatments-header bg-gray-100 py-1 px-3 rounded border-l-4 border-primary-600 mb-3">
                    <h3 class="font-black text-gray-800 uppercase tracking-widest text-sm">Registro de Tratamientos</h3>
                    ${canEditClinical ? '<button class="btn btn-primary btn-sm whitespace-nowrap print-hidden" id="btn-add-treatment"><i class="fa-solid fa-plus"></i> Añadir</button>' : ''}
                </div>
                <div class="table-container overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
                    <table class="w-full text-left text-xs md:text-sm table-nowrap" id="treatments-table">
                        <thead class="bg-gray-50 border-b border-gray-200">
                            <tr>
                                <th class="py-2.5 px-3 font-semibold text-gray-600 uppercase tracking-wide text-[10px]">Diente</th>
                                <th class="py-2.5 px-3 font-semibold text-gray-600 uppercase tracking-wide text-[10px] col-hide-sm">Cara</th>
                                <th class="py-2.5 px-3 font-semibold text-gray-600 uppercase tracking-wide text-[10px] col-hide-sm">Sector</th>
                                <th class="py-2.5 px-3 font-semibold text-gray-600 uppercase tracking-wide text-[10px] col-hide-sm">Autorización</th>
                                <th class="py-2.5 px-3 font-semibold text-gray-600 uppercase tracking-wide text-[10px]">Código</th>
                                <th class="py-2.5 px-3 font-semibold text-gray-600 uppercase tracking-wide text-[10px]">Fecha</th>
                                <th class="py-2.5 px-3 font-semibold text-gray-600 uppercase tracking-wide text-[10px] col-hide-xs">Observaciones</th>
                                <th class="py-2.5 px-3 print-hidden"></th>
                            </tr>
                        </thead>
                        <tbody>
                            ${visibleTreatments.map((t, idx) => `
                                <tr class="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                                    <td class="py-2.5 px-3 font-bold text-primary-700">${t.diente}</td>
                                    <td class="py-2.5 px-3 text-gray-600 col-hide-sm">${t.cara || '-'}</td>
                                    <td class="py-2.5 px-3 text-gray-600 col-hide-sm">${t.sector || '-'}</td>
                                    <td class="py-2.5 px-3 text-gray-600 col-hide-sm">${t.autorizacion || '-'}</td>
                                    <td class="py-2.5 px-3 font-mono text-primary-600 font-semibold">${t.codigo || '-'}</td>
                                    <td class="py-2.5 px-3">
                                        <div class="text-gray-800 font-medium">${t.fecha || '-'}</div>
                                        ${t.firma ? `<div class="text-[10px] text-gray-400 mt-0.5">${t.firma}</div>` : ''}
                                    </td>
                                    <td class="py-2.5 px-3 text-gray-500 max-w-xs col-hide-xs">${t.observaciones || '-'}</td>
                                    <td class="py-2 px-2 print-hidden">
                                        ${canEditClinical ? `
                                        <button class="btn-ghost text-gray-300 hover:text-red-500 p-1 transition-colors rounded" onclick="deleteTreatment(${patientId}, ${t.id ?? idx})" title="Eliminar">
                                            <i class="fa-solid fa-trash-can text-xs"></i>
                                        </button>` : ''}
                                    </td>
                                </tr>
                            `).join('')}
                            ${!visibleTreatments.length ? `
                            <tr>
                                <td colspan="8" class="text-center py-10 text-gray-400">
                                    <div class="flex flex-col items-center gap-2">
                                        <i class="fa-solid fa-clipboard text-2xl opacity-30"></i>
                                        <span class="text-sm">No hay tratamientos registrados</span>
                                    </div>
                                </td>
                            </tr>` : ''}
                        </tbody>
                    </table>
                </div>
            </div>

            <div class="mb-4 print-hidden">
                <div class="treatments-header bg-gray-100 py-1 px-3 rounded border-l-4 border-primary-600 mb-4">
                    <h3 class="font-black text-gray-800 uppercase tracking-widest text-sm">Archivos Clínicos</h3>
                    ${canEditClinical ? `
                    <div style="display:flex;gap:8px;flex-wrap:wrap">
                        <button class="btn btn-primary btn-sm whitespace-nowrap" id="btn-add-clinical-image"><i class="fa-solid fa-image"></i> Imagen</button>
                        <button class="btn btn-secondary btn-sm whitespace-nowrap" id="btn-add-clinical-pdf"><i class="fa-solid fa-file-pdf"></i> PDF</button>
                    </div>` : ''}
                </div>
                <div class="clinical-images-shell">
                    <div class="clinical-images-summary">
                        <div>
                            <span>Imágenes</span>
                            <strong>${clinicalImages.filter(i => (i.mimeType || '').startsWith('image/')).length}</strong>
                        </div>
                        <div>
                            <span>Documentos PDF</span>
                            <strong>${clinicalImages.filter(i => i.mimeType === 'application/pdf').length}</strong>
                        </div>
                        <div>
                            <span>Última carga</span>
                            <strong>${escapeHtml(formatClinicalImageDate(latestClinicalImage?.date))}</strong>
                        </div>
                    </div>
                    <div class="clinical-images-grid">
                    ${clinicalImages.map((image, idx) => {
                        const isPdf = image.mimeType === 'application/pdf';
                        const fileId = image.id ?? idx;
                        const deleteBtn = canEditClinical ? `
                            <button type="button" class="clinical-image-action-btn clinical-image-action-delete" onclick="deleteClinicalImage(${patientId}, ${fileId})" aria-label="Eliminar archivo">
                                <i class="fa-solid fa-trash"></i><span>Eliminar</span>
                            </button>` : '';
                        if (isPdf) {
                            const name = escapeHtml(image.fileName || image.description || 'documento.pdf');
                            const url  = escapeHtml(image.dataUrl);
                            return `
                            <article class="clinical-image-card clinical-pdf-card">
                                <div class="clinical-image-actions">
                                    <a href="${url}" target="_blank" rel="noopener" class="clinical-image-action-btn clinical-image-action-view">
                                        <i class="fa-solid fa-eye"></i><span>Ver</span>
                                    </a>
                                    <a href="${url + '&download=1'}" class="clinical-image-action-btn" download>
                                        <i class="fa-solid fa-download"></i><span>Bajar</span>
                                    </a>
                                    ${deleteBtn}
                                </div>
                                <a href="${url}" target="_blank" rel="noopener" class="clinical-pdf-preview-link" style="display:block;text-decoration:none" aria-label="Abrir PDF">
                                    <div class="clinical-pdf-icon"><i class="fa-solid fa-file-pdf"></i></div>
                                </a>
                                <div class="clinical-image-body">
                                    <div class="clinical-image-meta">
                                        <div class="clinical-image-date">${escapeHtml(formatClinicalImageDate(image.date))}</div>
                                        <a href="${url}" target="_blank" rel="noopener" class="clinical-image-inline-link">Abrir</a>
                                    </div>
                                    <p class="clinical-image-description" title="${name}">${name}</p>
                                </div>
                            </article>`;
                        }
                        return `
                        <article class="clinical-image-card">
                            <div class="clinical-image-actions">
                                <button type="button" class="clinical-image-action-btn clinical-image-action-view" onclick="event.stopPropagation(); openClinicalImageViewer(${patientId}, ${fileId})" aria-label="Ver imagen ampliada">
                                    <i class="fa-solid fa-expand"></i><span>Ver</span>
                                </button>
                                ${deleteBtn}
                            </div>
                            <button type="button" class="clinical-image-preview-button" onclick="event.stopPropagation(); openClinicalImageViewer(${patientId}, ${fileId})" aria-label="Ver imagen ampliada">
                                <img src="${escapeHtml(image.dataUrl)}" alt="${escapeHtml(image.description || 'Imagen clínica')}" class="clinical-image-preview" onerror="this.style.display='none'; this.closest('.clinical-image-card')?.querySelector('.clinical-image-body')?.classList.add('clinical-image-body--error'); this.closest('.clinical-image-card')?.classList.add('clinical-image-card--broken');">
                            </button>
                            <div class="clinical-image-body">
                                <div class="clinical-image-meta">
                                    <div class="clinical-image-date">${escapeHtml(formatClinicalImageDate(image.date))}</div>
                                    <button type="button" class="clinical-image-inline-link" onclick="event.stopPropagation(); openClinicalImageViewer(${patientId}, ${fileId})">Abrir</button>
                                </div>
                                <p class="clinical-image-description">${escapeHtml(image.description || 'Sin descripción')}</p>
                                <p class="clinical-image-error">La imagen guardada está incompleta. Vuelve a cargarla.</p>
                            </div>
                        </article>`;
                    }).join('')}
                    ${clinicalImages.length === 0 ? '<div class="clinical-image-empty">Todavía no hay archivos cargados en la historia clínica.</div>' : ''}
                    </div>
                </div>
            </div>

            <!-- NOTAS -->
            <div class="mt-8 bg-yellow-50 p-4 border border-yellow-200 rounded-lg">
                <h3 class="font-bold text-yellow-800 mb-2 uppercase text-xs"><i class="fa-solid fa-notes-medical"></i> Observaciones Generales y Alergias</h3>
                <textarea id="p-general-notes" class="form-input w-full h-20 p-2 text-sm bg-transparent border-yellow-300 focus:border-yellow-500 focus:ring-yellow-500 rounded" ${canEditClinical ? '' : 'disabled'}>${patient.notes || ''}</textarea>
            </div>

            ${canEditClinical ? `
            <div class="clinical-save-footer print-hidden">
                <button type="button" id="btn-save-clinical-history" class="btn btn-primary btn-lg clinical-save-btn ${draft?.isDirty ? 'is-ready' : ''}" onclick="saveClinicalHistory(${patientId})" ${draft?.isDirty ? '' : 'disabled'}>
                    Guardar Historia Clínica
                </button>
            </div>
            ` : ''}
        </div>
    </div>
    `;
}

window.printClinicalHistory = function() {
    document.body.classList.add('printing-clinical-history');

    const cleanup = () => {
        document.body.classList.remove('printing-clinical-history');
    };

    window.addEventListener('afterprint', cleanup, { once: true });
    window.print();

    setTimeout(() => {
        document.body.classList.remove('printing-clinical-history');
    }, 1200);
};

function bindClinicalToothEvents(patientId) {
    document.querySelectorAll('.tooth-face').forEach(face => {
        face.addEventListener('click', (e) => {
            e.stopPropagation();
            const tooth = e.target.dataset.tooth;
            const faceName = e.target.dataset.face;
            if (!tooth) return;

            const draft = getClinicalDraft(patientId);
            if (!draft) return;
            if (!draft.data.odontograma) draft.data.odontograma = {};
            if (!draft.data.odontograma[tooth]) draft.data.odontograma[tooth] = {};

            const toothState = draft.data.odontograma[tooth];
            const { color, treatment } = odontogramTool;

            // LIMPIAR mode — permanece activo hasta que se desactive explícitamente
            if (odontogramTool.clearing) {
                delete draft.data.odontograma[tooth];
                draft.isDirty = true;
                renderClinicalOdontogram(patientId);
                syncClinicalHistorySaveState();
                return;
            }

            const colorValue = color === 'rojo' ? 'caries' : 'restaurado';

            if (treatment === 'ausente') {
                // Toggle ausente
                if (toothState.estado === 'ausente' && toothState.color === color) {
                    delete draft.data.odontograma[tooth];
                } else {
                    draft.data.odontograma[tooth] = { estado: 'ausente', color };
                }
            } else if (treatment && treatment !== '') {
                // Apply treatment to whole tooth
                if (toothState.estado === treatment && toothState.color === color) {
                    delete draft.data.odontograma[tooth];
                } else {
                    draft.data.odontograma[tooth] = { estado: treatment, color };
                }
            } else {
                // Libre: apply color to specific face
                if (toothState.estado) {
                    delete toothState.estado;
                    delete toothState.color;
                }
                if (toothState[faceName] === colorValue) {
                    delete toothState[faceName];
                } else {
                    toothState[faceName] = colorValue;
                }
                const active = ['top','right','bottom','left','center'].filter(k => toothState[k]);
                if (!active.length && !Object.keys(toothState).length) {
                    delete draft.data.odontograma[tooth];
                }
            }

            draft.isDirty = true;
            renderClinicalOdontogram(patientId);
            syncClinicalHistorySaveState();
        });
    });
}

function updateTreatBtnActiveStyle(btn) {
    if (!btn) return;
    if (!btn.classList.contains('is-active')) {
        btn.style.borderColor = '';
        btn.style.background  = '';
        btn.style.boxShadow   = '';
        return;
    }
    const activeStyle = odontogramTool.color === 'azul'
        ? { borderColor: '#2563eb', background: '#2563eb18', boxShadow: '0 2px 8px #2563eb44' }
        : { borderColor: '#dc2626', background: '#dc262618', boxShadow: '0 2px 8px #dc262644' };
    btn.style.borderColor = activeStyle.borderColor;
    btn.style.background  = activeStyle.background;
    btn.style.boxShadow   = activeStyle.boxShadow;
}

function attachOdontogramToolbar(patientId) {
    const toolbar = document.getElementById('odontogram-toolbar');
    if (!toolbar) return;

    odontogramTool.clearing = false;

    // Sincronizar estado interno con el botón activo del HTML (siempre arranca en rojo)
    const activeColorBtn = toolbar.querySelector('.odonto-color-btn.is-active');
    odontogramTool.color = activeColorBtn?.dataset.color || 'rojo';

    toolbar.querySelectorAll('.odonto-color-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            toolbar.querySelectorAll('.odonto-color-btn').forEach(b => b.classList.remove('is-active'));
            btn.classList.add('is-active');
            odontogramTool.color = btn.dataset.color;
            toolbar.querySelectorAll('.odonto-treat-btn').forEach(updateTreatBtnActiveStyle);
        });
    });

    toolbar.querySelectorAll('.odonto-treat-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const already = btn.classList.contains('is-active');
            odontogramTool.clearing = false;
            document.getElementById('btn-odonto-clear')?.classList.remove('is-clearing');
            document.querySelector('.odontogram-wrapper')?.classList.remove('odontogram-erasing');

            toolbar.querySelectorAll('.odonto-treat-btn').forEach(b => {
                b.classList.remove('is-active');
                updateTreatBtnActiveStyle(b);
            });
            if (!already) {
                btn.classList.add('is-active');
                odontogramTool.treatment = btn.dataset.treatment;
                updateTreatBtnActiveStyle(btn);
            } else {
                odontogramTool.treatment = null;
            }
        });
    });

    toolbar.querySelectorAll('.odonto-treat-btn').forEach(updateTreatBtnActiveStyle);
    document.getElementById('btn-odonto-clear')?.classList.toggle('is-clearing', odontogramTool.clearing);
    document.querySelector('.odontogram-wrapper')?.classList.toggle('odontogram-erasing', odontogramTool.clearing);
}

window.clearOdontogramTooth = function(patientId) {
    odontogramTool.clearing = !odontogramTool.clearing;
    const btn     = document.getElementById('btn-odonto-clear');
    const wrapper = document.querySelector('.odontogram-wrapper');
    btn?.classList.toggle('is-clearing', odontogramTool.clearing);
    wrapper?.classList.toggle('odontogram-erasing', odontogramTool.clearing);
};

function attachClinicalHistoryEvents(patientId) {
    if(!canEditClinicalHistoryUi()) return; // Read Only for clinical charting

    const bindDraftInput = (selector, key) => {
        const element = document.querySelector(selector);
        if (!element) return;
        element.oninput = (event) => {
            updateClinicalDraft(patientId, (draft) => {
                draft[key] = event.target.value;
            });
        };
    };

    bindDraftInput('#clinical-fecha-nacimiento', 'fechaNacimiento');
    bindDraftInput('#clinical-phone', 'phone');
    bindDraftInput('#clinical-email', 'email');
    bindDraftInput('#clinical-obra-social', 'obraSocial');
    bindDraftInput('#clinical-credencial', 'credencial');
    bindDraftInput('#clinical-ficha-numero', 'fichaNumero');
    bindDraftInput('#clinical-domicilio', 'domicilio');
    bindDraftInput('#p-general-notes', 'notes');

    bindClinicalToothEvents(patientId);
    attachOdontogramToolbar(patientId);

    document.getElementById('btn-add-treatment')?.addEventListener('click', () => {
        openTreatmentModal(patientId);
    });

    document.getElementById('btn-add-clinical-image')?.addEventListener('click', () => {
        openClinicalImageModal(patientId);
    });
    document.getElementById('btn-add-clinical-pdf')?.addEventListener('click', () => {
        openClinicalPdfModal(patientId);
    });
}

function renderClinicalOdontogram(patientId) {
    const patient = getClinicalWorkingPatient(patientId);
    const wrapper = document.querySelector('.odontogram-wrapper');
    if (!patient || !wrapper) return;

    // Preservar el estado visible de dentición infantil si ya fue toggleado por el usuario
    const existingSection = document.getElementById('odonto-infantil-section');
    const infantilVisible = existingSection
        ? existingSection.style.display !== 'none'
        : ((calcAge(patient.fechaNacimiento) !== null && calcAge(patient.fechaNacimiento) < 13) || hasChildDentitionData(patient));

    wrapper.innerHTML = `
        <div class="flex flex-col items-center gap-5 min-w-max">
            <div class="w-full flex flex-col items-center gap-3">
                <div class="text-[10px] md:text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Dentición Adulta</div>
                <div class="flex gap-4 md:gap-8 justify-center min-w-max">
                    <div class="flex gap-[2px] md:gap-1"> ${drawTeethRow([18,17,16,15,14,13,12,11], patient.odontograma, true)} </div>
                    <div class="flex gap-[2px] md:gap-1 border-l-2 border-gray-300 pl-4 md:pl-8"> ${drawTeethRow([21,22,23,24,25,26,27,28], patient.odontograma, true)} </div>
                </div>
                <div class="odonto-jaw-gap"></div>
                <div class="flex gap-4 md:gap-8 justify-center min-w-max">
                    <div class="flex gap-[2px] md:gap-1"> ${drawTeethRow([48,47,46,45,44,43,42,41], patient.odontograma, false)} </div>
                    <div class="flex gap-[2px] md:gap-1 border-l-2 border-gray-300 pl-4 md:pl-8"> ${drawTeethRow([31,32,33,34,35,36,37,38], patient.odontograma, false)} </div>
                </div>
            </div>

            <button class="odonto-infantil-toggle" onclick="window.toggleInfantilSection()">
                <span class="odonto-infantil-toggle-line"></span>
                <span>Dentición Infantil</span>
                <i id="odonto-infantil-icon" class="fa-solid ${infantilVisible ? 'fa-chevron-up' : 'fa-chevron-down'}"></i>
                <span class="odonto-infantil-toggle-line"></span>
            </button>
            <div id="odonto-infantil-section" style="display:${infantilVisible ? 'flex' : 'none'};flex-direction:column;align-items:center;gap:12px;width:100%;">
                <div class="flex gap-4 md:gap-8 justify-center min-w-max">
                    <div class="flex gap-[2px] md:gap-1"> ${drawTeethRow([55,54,53,52,51], patient.odontograma, true)} </div>
                    <div class="flex gap-[2px] md:gap-1 border-l-2 border-gray-300 pl-4 md:pl-8"> ${drawTeethRow([61,62,63,64,65], patient.odontograma, true)} </div>
                </div>
                <div class="odonto-jaw-gap"></div>
                <div class="flex gap-4 md:gap-8 justify-center min-w-max">
                    <div class="flex gap-[2px] md:gap-1"> ${drawTeethRow([85,84,83,82,81], patient.odontograma, false)} </div>
                    <div class="flex gap-[2px] md:gap-1 border-l-2 border-gray-300 pl-4 md:pl-8"> ${drawTeethRow([71,72,73,74,75], patient.odontograma, false)} </div>
                </div>
            </div>
        </div>
    `;

    bindClinicalToothEvents(patientId);
}

window.savePatientNotes = async function(patientId) {
    return window.saveClinicalHistory(patientId);
};

window.savePatientDetails = async function(patientId) {
    if (!canEditClinicalHistoryUi()) {
        showAlert('Solo el profesional y el superadmin pueden modificar la historia clínica.', { title: 'Historia clínica', variant: 'error' });
        return;
    }
    return window.saveClinicalHistory(patientId);
};

window.changeOdontoProfessional = async function(patientId, professionalId) {
    const profId = professionalId ? Number(professionalId) : null;
    state.clinicalOdontoProfessionalId = profId;
    if (!profId) return;
    try {
        await syncPatientClinicalData(patientId, profId);
        setClinicalDraftFromPatient(DB.get('patients').find(p => p.id === patientId));
        await loadClinicalHistory(patientId, { skipUnsavedCheck: true, skipSync: true });
    } catch (error) {
        showAlert(error.message || 'No se pudo cargar el odontograma.', { title: 'Odontograma', variant: 'error' });
    }
};

window.saveClinicalHistory = async function(patientId) {
    if (!canEditClinicalHistoryUi()) {
        showAlert('Solo el profesional y el superadmin pueden modificar la historia clínica.', { title: 'Historia clínica', variant: 'error' });
        return;
    }

    const draft = getClinicalDraft(patientId);
    if (!draft) return;
    if (!draft.isDirty) {
        showToast('No hay cambios pendientes para guardar.', { type: 'success' });
        return;
    }

    // Usamos el paciente cacheado en localStorage (ya sincronizado con la API al cargar la vista)
    // o si no está, el draft como base
    const cachedPatient = DB.get('patients').find((item) => item.id === patientId) || {};
    const mergedValues = {
        ...cachedPatient,
        ...draft.data,
        odontograma: deepClone(draft.data.odontograma || {})
    };

    const odontoProfessionalId = getCurrentOdontoProfessionalId();

    try {
        await withAppLoading('Guardando historia clínica...', async () => {
            if (state.authToken) {
                await apiFetch(`/patients/${patientId}`, {
                    method: 'PUT',
                    body: JSON.stringify(buildPatientApiPayload(mergedValues))
                });
                await apiFetch(`/clinical-records/${patientId}`, {
                    method: 'PUT',
                    body: JSON.stringify({
                        professionalId: odontoProfessionalId,
                        summaryNotes: mergedValues.notes || '',
                        allergies: mergedValues.allergies || null,
                        medicalNotes: mergedValues.medicalNotes || null,
                        odontogramEntries: legacyOdontogramToEntries(mergedValues.odontograma || {})
                    })
                });
                await syncPatientClinicalData(patientId, odontoProfessionalId);
            } else {
                DB.update('patients', patientId, mergedValues);
            }
        });

        setClinicalDraftFromPatient(getClinicalWorkingPatient(patientId));
        if (state.clinicalDraft) state.clinicalDraft.isDirty = false;
        syncClinicalHistorySaveState();
        showToast('Historia clínica guardada.', { type: 'success' });
        await loadClinicalHistory(patientId, { skipUnsavedCheck: true, skipSync: !state.authToken });
    } catch (error) {
        showAlert(error.message || 'No se pudo guardar la historia clínica.', { title: 'Historia clínica', variant: 'error' });
    }
};

window.deleteUser = async function(userId) {
    if (!isSuperadmin()) {
        showAlert('Solo el superadmin puede eliminar usuarios.', { title: 'Usuarios', variant: 'error' });
        return;
    }
    if (!await showConfirm('¿Eliminar usuario?', { title: 'Eliminar usuario', confirmText: 'Eliminar' })) return;

    try {
        await deleteViaApiOrLocal({
            path: `/users/${userId}`,
            localTable: 'users',
            localId: userId
        });
        refreshCurrentView();
    } catch (error) {
        alert(error.message || 'No se pudo eliminar el usuario.');
    }
};

window.deleteTreatment = async function(patientId, treatmentId) {
    if (!canEditClinicalHistoryUi()) {
        showAlert('Solo el profesional y el superadmin pueden modificar la historia clínica.', { title: 'Historia clínica', variant: 'error' });
        return;
    }
    if (hasUnsavedClinicalDraft()) {
        showAlert('Primero guarda la historia clínica antes de eliminar tratamientos.', { title: 'Historia clínica', variant: 'warning' });
        return;
    }
    if(await showConfirm('¿Eliminar registro de tratamiento?', { title: 'Eliminar tratamiento', confirmText: 'Eliminar' })) {
        const p = DB.get('patients').find(pt => pt.id === patientId);
        if (!p) return;

        try {
            if (state.authToken && Number.isInteger(Number(treatmentId))) {
                await apiFetch(`/treatments/${treatmentId}`, { method: 'DELETE' });
                await syncPatientClinicalData(patientId, getCurrentOdontoProfessionalId());
            } else {
                const treatments = (p.treatments || []).filter((item, index) => (item.id ?? index) !== treatmentId);
                DB.update('patients', patientId, { treatments });
            }
        } catch (error) {
            showAlert(error.message || 'No se pudo eliminar el tratamiento.', { title: 'Historia clínica', variant: 'error' });
            return;
        }

        loadClinicalHistory(patientId);
    }
};

window.deleteClinicalImage = async function(patientId, imageId) {
    if (!canEditClinicalHistoryUi()) {
        showAlert('Solo el profesional y el superadmin pueden modificar la historia clínica.', { title: 'Historia clínica', variant: 'error' });
        return;
    }
    if (hasUnsavedClinicalDraft()) {
        showAlert('Primero guarda la historia clínica antes de eliminar imágenes clínicas.', { title: 'Historia clínica', variant: 'warning' });
        return;
    }
    if(await showConfirm('¿Eliminar imagen clínica?', { title: 'Eliminar imagen', confirmText: 'Eliminar' })) {
        const p = DB.get('patients').find(pt => pt.id === patientId);
        if (!p) return;

        try {
            if (state.authToken && Number.isInteger(Number(imageId))) {
                await apiFetch(`/clinical-images/${imageId}`, { method: 'DELETE' });
                await syncPatientClinicalData(patientId, getCurrentOdontoProfessionalId());
            } else {
                const images = (p.clinicalImages || []).filter((item, index) => (item.id ?? index) !== imageId);
                DB.update('patients', patientId, { clinicalImages: images });
            }
        } catch (error) {
            showAlert(error.message || 'No se pudo eliminar la imagen clínica.', { title: 'Historia clínica', variant: 'error' });
            return;
        }

        loadClinicalHistory(patientId);
    }
};

function openTreatmentModal(patientId) {
    if (!canEditClinicalHistoryUi()) {
        showAlert('Solo el profesional y el superadmin pueden modificar la historia clínica.', { title: 'Historia clínica', variant: 'error' });
        return;
    }
    if (hasUnsavedClinicalDraft()) {
        showAlert('Primero guarda la historia clínica antes de agregar tratamientos.', { title: 'Historia clínica', variant: 'warning' });
        return;
    }
    modalsContainer.innerHTML = `
        <div class="modal-overlay active">
            <div class="modal-content modal-content-treatment" onclick="event.stopPropagation()">
                <div class="modal-header">
                    <h3>Añadir Tratamiento a Ficha</h3>
                    <button class="btn-ghost" data-modal-close><i class="fa-solid fa-times"></i></button>
                </div>
                <form id="tx-history-form">
                    <div class="modal-body">
                        <div class="treatment-form-row treatment-form-row-3">
                            <div class="input-group flex-1"><label>Diente</label><input type="text" id="tx-diente" placeholder="Ej: 18"></div>
                            <div class="input-group flex-1"><label>Cara</label><input type="text" id="tx-cara" placeholder="M, D, V, P, O"></div>
                            <div class="input-group flex-1"><label>Sector</label><input type="text" id="tx-sector" placeholder="1-6"></div>
                        </div>
                        <div class="treatment-form-row treatment-form-row-2">
                            <div class="input-group flex-1"><label>Autorización</label><input type="text" id="tx-auth" placeholder="Nº Orden"></div>
                            <div class="input-group flex-1"><label>Código OS</label><input type="text" id="tx-codigo" placeholder="Ej: 01.01"></div>
                        </div>
                        <div class="input-group"><label>Observaciones</label><input type="text" id="tx-obs" placeholder="Detalles del procedimiento..." required></div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-ghost" onclick="closeModal()">Cancelar</button>
                        <button type="submit" class="btn btn-primary">Añadir a Tabla</button>
                    </div>
                </form>
            </div>
        </div>
    `;

    // ESC cierra el modal
    const _escHandler = (e) => {
        if (e.key !== 'Escape') return;
        closeModal();
    };
    document.addEventListener('keydown', _escHandler, { once: true });
    document.getElementById('tx-history-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const p = DB.get('patients').find(pt => pt.id === patientId);
        if(!p.treatments) p.treatments = [];

        const treatment = {
            id: Date.now(),
            diente: document.getElementById('tx-diente').value,
            cara: document.getElementById('tx-cara').value,
            sector: document.getElementById('tx-sector').value,
            autorizacion: document.getElementById('tx-auth').value,
            codigo: document.getElementById('tx-codigo').value,
            observaciones: document.getElementById('tx-obs').value,
            fecha: new Date().toLocaleDateString('es-AR'),
            firma: state.user?.fullName || state.user?.name || 'Usuario'
        };

        try {
            await withAppLoading('Guardando tratamiento...', async () => {
                if (state.authToken) {
                    await apiFetch('/treatments', {
                        method: 'POST',
                        body: JSON.stringify({
                            patientId,
                            professionalId: getCurrentOdontoProfessionalId(),
                            tooth: treatment.diente,
                            face: treatment.cara,
                            sector: treatment.sector,
                            authorizationNumber: treatment.autorizacion,
                            insuranceCode: treatment.codigo,
                            observations: treatment.observaciones,
                            performedAt: new Date().toISOString()
                        })
                    });
                    await syncPatientClinicalData(patientId, getCurrentOdontoProfessionalId());
                } else {
                    p.treatments.push(treatment);
                    DB.update('patients', patientId, { treatments: p.treatments });
                }
            });

            closeModal();
            loadClinicalHistory(patientId);
        } catch (error) {
            showAlert(error.message || 'No se pudo guardar el tratamiento.', { title: 'Historia clínica', variant: 'error' });
        }
    });
}

function openClinicalImageModal(patientId) {
    if (!canEditClinicalHistoryUi()) {
        showAlert('Solo el profesional y el superadmin pueden modificar la historia clínica.', { title: 'Historia clínica', variant: 'error' });
        return;
    }
    if (hasUnsavedClinicalDraft()) {
        showAlert('Primero guarda la historia clínica antes de agregar imágenes clínicas.', { title: 'Historia clínica', variant: 'warning' });
        return;
    }
    modalsContainer.innerHTML = `
        <div class="modal-overlay active">
            <div class="modal-content modal-content-patient" onclick="event.stopPropagation()">
                <div class="modal-header">
                    <h3>Agregar Imagen Clínica</h3>
                    <button class="btn-ghost" data-modal-close><i class="fa-solid fa-times"></i></button>
                </div>
                <form id="clinical-image-form">
                    <div class="modal-body">
                        <div class="input-group">
                            <label>Fecha</label>
                            <input type="date" id="clinical-image-date" value="${getTodayIsoLocal()}" required>
                        </div>
                        <div class="input-group">
                            <label>Descripción</label>
                            <input type="text" id="clinical-image-description" placeholder="Ej: Radiografía panorámica inicial" required>
                        </div>
                        <div class="input-group">
                            <label>Imágenes</label>
                            <input type="file" id="clinical-image-file" accept="image/*" multiple required>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-ghost" onclick="closeModal()">Cancelar</button>
                        <button type="submit" class="btn btn-primary">Guardar Imágenes</button>
                    </div>
                </form>
            </div>
        </div>
    `;

    // ESC cierra el modal
    const _escHandler = (e) => {
        if (e.key !== 'Escape') return;
        closeModal();
    };
    document.addEventListener('keydown', _escHandler, { once: true });
    document.getElementById('clinical-image-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const fileInput = document.getElementById('clinical-image-file');
        const files = Array.from(fileInput.files || []);

        if (files.length === 0) {
            alert('Selecciona al menos una imagen.');
            return;
        }

        const selectedDate = document.getElementById('clinical-image-date').value;
        const selectedDescription = document.getElementById('clinical-image-description').value.trim();

        Promise.all(files.map(file => new Promise((resolve, reject) => {
            const img = new Image();
            const objectUrl = URL.createObjectURL(file);
            img.onload = () => {
                const MAX_SIDE = 1600;
                const scale = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));
                const width  = Math.max(1, Math.round(img.width  * scale));
                const height = Math.max(1, Math.round(img.height * scale));
                const canvas = document.createElement('canvas');
                canvas.width  = width;
                canvas.height = height;
                canvas.getContext('2d').drawImage(img, 0, 0, width, height);
                URL.revokeObjectURL(objectUrl);
                let dataUrl = canvas.toDataURL('image/webp', 0.80);
                if (!dataUrl.startsWith('data:image/webp')) {
                    dataUrl = canvas.toDataURL('image/jpeg', 0.78);
                }
                resolve({
                    id: Date.now() + Math.floor(Math.random() * 1000),
                    date: selectedDate,
                    description: selectedDescription,
                    dataUrl
                });
            };
            img.onerror = reject;
            img.src = objectUrl;
        }))).then(async (newImages) => {
            const p = DB.get('patients').find(pt => pt.id === patientId);

            await withAppLoading('Guardando imágenes clínicas...', async () => {
                if (state.authToken) {
                    await apiFetch('/clinical-images', {
                        method: 'POST',
                        body: JSON.stringify({
                            patientId,
                            professionalId: getCurrentOdontoProfessionalId(),
                            images: newImages.map((image) => ({
                                imageUrl: image.dataUrl,
                                description: image.description,
                                takenAt: image.date ? image.date + 'T12:00:00' : null
                            }))
                        })
                    });
                    await syncPatientClinicalData(patientId, getCurrentOdontoProfessionalId());
                } else if (p) {
                    const images = (p.clinicalImages || []).slice();
                    images.push(...newImages);
                    DB.update('patients', patientId, { clinicalImages: images });
                }
            });

            closeModal();
            loadClinicalHistory(patientId);
        }).catch(() => {
            alert('No se pudieron cargar una o mas imagenes.');
        });
    });
}

function openClinicalPdfModal(patientId) {
    if (!canEditClinicalHistoryUi()) {
        showAlert('Solo el profesional y el superadmin pueden modificar la historia clínica.', { title: 'Historia clínica', variant: 'error' });
        return;
    }
    if (hasUnsavedClinicalDraft()) {
        showAlert('Primero guarda la historia clínica antes de agregar documentos.', { title: 'Historia clínica', variant: 'warning' });
        return;
    }

    modalsContainer.innerHTML = `
        <div class="modal-overlay active">
            <div class="modal-content modal-content-patient" onclick="event.stopPropagation()">
                <div class="modal-header">
                    <h3>Agregar Documentos PDF</h3>
                    <button class="btn-ghost" data-modal-close><i class="fa-solid fa-times"></i></button>
                </div>
                <form id="clinical-pdf-form">
                    <div class="modal-body">
                        <div class="input-group">
                            <label>Fecha</label>
                            <input type="date" id="clinical-pdf-date" value="${getTodayIsoLocal()}" required>
                        </div>
                        <div class="input-group">
                            <label>Descripción <span style="color:var(--gray-400);font-weight:400">(opcional, aplica a todos)</span></label>
                            <input type="text" id="clinical-pdf-description" placeholder="Ej: Consentimiento informado, Derivación, Análisis">
                        </div>
                        <div class="input-group">
                            <label>Archivos PDF</label>
                            <input type="file" id="clinical-pdf-file" accept="application/pdf" multiple required>
                            <p style="font-size:0.78rem;color:var(--gray-400);margin-top:4px">Podés seleccionar varios PDFs a la vez · Máx. 10 MB por archivo</p>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-ghost" onclick="closeModal()">Cancelar</button>
                        <button type="submit" class="btn btn-primary" id="clinical-pdf-submit"><i class="fa-solid fa-upload"></i> Subir PDF</button>
                    </div>
                </form>
            </div>
        </div>
    `;

    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); }, { once: true });

    document.getElementById('clinical-pdf-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const fileInput = document.getElementById('clinical-pdf-file');
        const files = Array.from(fileInput.files || []);
        if (!files.length) { alert('Seleccioná al menos un archivo PDF.'); return; }

        for (const f of files) {
            if (f.type !== 'application/pdf') { alert(`"${f.name}" no es un PDF.`); return; }
            if (f.size > 10 * 1024 * 1024) { alert(`"${f.name}" supera el límite de 10 MB.`); return; }
        }

        const selectedDate        = document.getElementById('clinical-pdf-date').value;
        const selectedDescription = document.getElementById('clinical-pdf-description').value.trim();
        const submitBtn           = document.getElementById('clinical-pdf-submit');
        if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Subiendo...'; }

        const readFileAsDataUrl = (f) => new Promise((resolve, reject) => {
            const r = new FileReader();
            r.onload  = () => resolve(r.result);
            r.onerror = reject;
            r.readAsDataURL(f);
        });

        try {
            const dataUrls = await Promise.all(files.map(readFileAsDataUrl));
            const images = dataUrls.map((dataUrl, i) => ({
                imageUrl:    dataUrl,
                mimeType:    'application/pdf',
                fileName:    files[i].name,
                description: selectedDescription || files[i].name,
                takenAt:     selectedDate ? selectedDate + 'T12:00:00' : null,
            }));

            await withAppLoading(`Guardando ${files.length > 1 ? files.length + ' documentos' : 'documento'} PDF...`, async () => {
                await apiFetch('/clinical-images', {
                    method: 'POST',
                    body: JSON.stringify({
                        patientId,
                        professionalId: getCurrentOdontoProfessionalId(),
                        images,
                    })
                });
                await syncPatientClinicalData(patientId, getCurrentOdontoProfessionalId());
            });
            closeModal();
            loadClinicalHistory(patientId);
        } catch (err) {
            alert(err.message || 'No se pudieron subir los documentos PDF.');
            if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = '<i class="fa-solid fa-upload"></i> Subir PDF'; }
        }
    });
}

