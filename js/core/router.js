// =============================================================================
// router.js — DOM refs, sidebar, navegacion, loadView, renderSidebar
// Depende de: state.js, utils.js, ui.js, auth.js, db-local.js, helpers.js
// Llama en runtime: views (patients, billing, dashboard, etc.)
// =============================================================================

﻿

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

    // El control del timbre depende de QUIÉN entró, y ensureThemeControls solo
    // corre en el DOMContentLoaded —cuando todavía no hay sesión—. Sin esta
    // llamada el botón no aparecía nunca. Va acá y no allá porque también tiene
    // que reevaluarse al cambiar de clínica o al entrar otro usuario.
    ensureChimeControl();

    // Historial propio + ayuda contextual: se arman recién con sesión activa,
    // porque el atrás del navegador en el login tiene que seguir siendo el del
    // navegador.
    if (typeof clearNavHistory === 'function')    clearNavHistory();
    if (typeof armNavHistoryGuard === 'function') armNavHistoryGuard();
    if (typeof ensureHelpButton === 'function')   ensureHelpButton();

    if (isSelfPlatformAdmin()) {
        loadView('platform-clinics', 'Panel de Plataforma', { skipSync: true });
    } else {
        // Todos los roles aterrizan en Dashboard
        loadView('dashboard', 'Dashboard', { skipSync: true });
        startDashboardAutoRefresh();
    }
}


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


// --- Navigation ---
function renderSidebar() {
    const sidebarNav = document.getElementById('sidebar-nav');
    sidebarNav.innerHTML = '';

    // ── Banner "Volver a plataforma" cuando se está impersonando ─────────────
    const platformBackup = localStorage.getItem(PLATFORM_AUTH_BACKUP_KEY);
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
            { id: 'platform-plans',   icon: 'fa-layer-group', label: 'Planes' },
            { id: 'platform-announcements', icon: 'fa-bullhorn', label: 'Avisos' },
            { id: 'platform-backups', icon: 'fa-database', label: 'Backups' },
            { id: 'platform-expenses', icon: 'fa-receipt',   label: 'Gastos' },
            { id: 'platform-stats',   icon: 'fa-chart-bar',  label: 'Estadísticas' },
            { id: 'platform-audit',   icon: 'fa-clipboard-list', label: 'Auditoría' },
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
            // Misma lista que usa la pantalla de Configuracion, ya filtrada por
            // permisos. Antes acá había una copia escrita a mano y un set de
            // "solo admin" en paralelo: al agregar una seccion nueva quedaba
            // visible en la pantalla pero sin entrada en el menu.
            getSettingsSections().forEach(sub => {
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
    // La historia clínica no se re-renderiza con loadView: esa rama deja el
    // contenedor vacío a propósito porque el contenido lo inyecta
    // loadClinicalHistory, que necesita saber qué paciente está abierto. Pasar
    // por loadView acá dejaba la pantalla en blanco con solo el sidebar —se veía
    // al cambiar de tema estando dentro de una ficha, que es el caso que llama a
    // refreshCurrentView sin haber navegado.
    if (state.currentView === 'patient-history' && state.currentPatientId) {
        loadClinicalHistory(state.currentPatientId, { skipUnsavedCheck: true, skipSync: true });
        return;
    }
    // skipSync: true porque las mutaciones que llaman a refreshCurrentView ya hicieron su propio sync
    loadView(state.currentView, getPageTitle(), { skipUnsavedCheck: true, skipSync: true });
}

// Normalizes locale date strings to consistent sentence case.
// On Windows, toLocaleDateString('es-AR') returns title-cased strings
// like "Jueves, 14 De Mayo De 2026". This converts to "Jueves, 14 de mayo de 2026".

/**
 * Devuelve la sesión de Ultra Admin cuando se navega a una vista de plataforma.
 *
 * Al entrar a una clínica (login-as), la sesión de plataforma se guarda en
 * `odentara_platform_auth_backup` y la activa pasa a ser la del usuario de
 * clínica. Las vistas de plataforma necesitan la primera: el backend autoriza
 * por la columna `isPlatformAdmin` del usuario, no por su rol.
 *
 * Solo restaura si el backup dice `isPlatformAdmin`, así que un backup viejo o
 * manipulado no sirve para escalar: el servidor revalida contra la base en cada
 * pedido y un token de clínica seguiría dando 403.
 */
function restaurarSesionDePlataforma(viewId) {
    if (!String(viewId || '').startsWith('platform-')) return;
    if (isSelfPlatformAdmin()) return;

    const backup = localStorage.getItem(PLATFORM_AUTH_BACKUP_KEY);
    if (!backup) return;

    try {
        const auth = JSON.parse(backup);
        if (auth?.token && auth?.user?.isPlatformAdmin) {
            localStorage.setItem('odentara_auth_v1', backup);
            state.user = mapApiUserToLegacyUser(auth.user);
            state.authToken = auth.token;
            localStorage.removeItem(PLATFORM_AUTH_BACKUP_KEY);
        }
    } catch (_) { /* backup ilegible: se sigue con la sesión actual */ }
}

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
    // Limpiar indicador de hora actual si se cambia de vista
    if (typeof stopNowIndicator === 'function') stopNowIndicator();
    // Cerrar cualquier menú de estado abierto antes de limpiar el DOM
    _closeStatusMenu();
    if (typeof resetHelpGuideForView === 'function') resetHelpGuideForView();
    mainContent.innerHTML = '';
    syncSidebarLayout();

    // Volver a la sesión de plataforma antes de pedirle datos a la API.
    //
    // Esto vivía adentro de la rama de `platform-clinics` únicamente, así que
    // las otras cinco vistas de plataforma —avisos, planes, suscripciones,
    // estadísticas, auditoría— se dibujaban pero pedían con el token del usuario
    // de clínica, y el backend contestaba 403 "Acceso restringido a
    // administradores de plataforma". El panel entero funcionaba solo si antes
    // se pasaba por Clínicas.
    //
    // Además va ANTES del sync, no después: el sync usa el token, y con el
    // equivocado traía o fallaba con los datos de la clínica impersonada.
    restaurarSesionDePlataforma(viewId);

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
        applyPlatformTheme(true);
        content.innerHTML = '<div style="height:100%;background:#0f1117"></div>';
        mainContent.appendChild(content);
        renderPlatformClinics(content);
        if (typeof recordNavEntry === 'function') recordNavEntry(viewId, title);
        return true;
    } else if (viewId === 'platform-announcements') {
        applyPlatformTheme(true);
        content.innerHTML = '<div style="height:100%;background:#0f1117"></div>';
        mainContent.appendChild(content);
        renderPlatformAnnouncements(content);
        if (typeof recordNavEntry === 'function') recordNavEntry(viewId, title);
        return true;
    } else if (viewId === 'platform-backups') {
        applyPlatformTheme(true);
        content.innerHTML = '<div style="height:100%;background:#0f1117"></div>';
        mainContent.appendChild(content);
        renderPlatformBackups(content);
        if (typeof recordNavEntry === 'function') recordNavEntry(viewId, title);
        return true;
    } else if (viewId === 'platform-plans') {
        applyPlatformTheme(true);
        content.innerHTML = '<div style="height:100%;background:#0f1117"></div>';
        mainContent.appendChild(content);
        renderPlatformPlans(content);
        if (typeof recordNavEntry === 'function') recordNavEntry(viewId, title);
        return true;
    } else if (viewId === 'platform-subscriptions') {
        applyPlatformTheme(true);
        content.innerHTML = '<div style="height:100%;background:#0f1117"></div>';
        mainContent.appendChild(content);
        renderPlatformSubscriptions(content);
        if (typeof recordNavEntry === 'function') recordNavEntry(viewId, title);
        return true;
    } else if (viewId === 'platform-expenses') {
        applyPlatformTheme(true);
        content.innerHTML = '<div style="height:100%;background:#0f1117"></div>';
        mainContent.appendChild(content);
        renderPlatformExpenses(content);
        if (typeof recordNavEntry === 'function') recordNavEntry(viewId, title);
        return true;
    } else if (viewId === 'platform-stats') {
        applyPlatformTheme(true);
        content.innerHTML = '<div style="height:100%;background:#0f1117"></div>';
        mainContent.appendChild(content);
        renderPlatformStats(content);
        if (typeof recordNavEntry === 'function') recordNavEntry(viewId, title);
        return true;
    } else if (viewId === 'platform-audit') {
        applyPlatformTheme(true);
        content.innerHTML = '<div style="height:100%;background:#0f1117"></div>';
        mainContent.appendChild(content);
        renderPlatformAudit(content);
        if (typeof recordNavEntry === 'function') recordNavEntry(viewId, title);
        return true;
    } else {
        applyPlatformTheme(false);
    }

    if (viewId === 'dashboard') content.innerHTML = renderDashboard();
    else if (viewId === 'appointments') {
        try { content.innerHTML = renderAppointments(); }
        catch(e) { console.error('[renderAppointments]', e); content.innerHTML = `<div class="card p-6" style="color:var(--danger)"><b>Error al renderizar turnos:</b> ${escapeHtml(e.message)}</div>`; }
    }
    else if (viewId === 'professionals') content.innerHTML = renderProfessionals();
    else if (viewId === 'patients') content.innerHTML = renderPatients();
    else if (viewId === 'billing') content.innerHTML = renderBilling();
    else if (viewId === 'settings') content.innerHTML = renderSettingsSubpages();
    else if (viewId === 'patient-history') content.innerHTML = ''; // Se inyecta después por loadClinicalHistory
    else content.innerHTML = renderPlaceholder(viewId);

    mainContent.appendChild(content);
    // Iniciar indicador de hora actual DESPUÉS del appendChild, cuando el DOM ya está disponible
    if (viewId === 'appointments' && typeof startNowIndicator === 'function') startNowIndicator();
    // La vista previa del mensaje se calcula recién con el DOM montado; si no,
    // la sección se abre con el recuadro vacío hasta que alguien toque una tecla.
    if (viewId === 'settings' && typeof actualizarVistaPreviaMensaje === 'function') {
        actualizarVistaPreviaMensaje();
    }
    renderSidebar();
    if (typeof recordNavEntry === 'function') recordNavEntry(viewId, title);
    return true;
}


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





