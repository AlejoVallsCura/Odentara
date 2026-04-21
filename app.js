// --- Navigation & State ---
const state = {
    user: null, 
    authToken: null,
    currentView: 'dashboard',
    sidebarOpen: true,
    settingsSubView: 'create-user',
    billingSubView: 'movements',
    billingPatientId: null,
    dashboardDate: null,
    clinicalDraft: null,
    loadingCount: 0,
    clinicalImageViewer: null
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
const AUTH_STORAGE_KEY = 'odentara_auth_v1';
const THEME_STORAGE_KEY = 'odentara_theme_v1';
const BUSINESS_TIME_ZONE = 'America/Buenos_Aires';

const MOJIBAKE_REPAIRS = [
    ['ContraseÃ±a', 'Contraseña'],
    ['ContraseÃƒÂ±a', 'Contraseña'],
    ['contraseÃ±a', 'contraseña'],
    ['contraseÃƒÂ±a', 'contraseña'],
    ['Centro odontolÃ³gico', 'Centro odontológico'],
    ['Centro odontolÃƒÂ³gico', 'Centro odontológico'],
    ['Cerrar sesiÃ³n', 'Cerrar sesión'],
    ['Cerrar sesiÃƒÂ³n', 'Cerrar sesión'],
    ['Horarios MÃ©dicos', 'Horarios Médicos'],
    ['Horarios MÃƒÂ©dicos', 'Horarios Médicos'],
    ['FacturaciÃ³n', 'Facturación'],
    ['FacturaciÃƒÂ³n', 'Facturación'],
    ['ConfiguraciÃ³n', 'Configuración'],
    ['ConfiguraciÃƒÂ³n', 'Configuración'],
    ['Historias ClÃ­nicas', 'Historias Clínicas'],
    ['Historias ClÃƒÂ­nicas', 'Historias Clínicas'],
    ['RecepciÃ³n', 'Recepción'],
    ['RecepciÃƒÂ³n', 'Recepción'],
    ['GestiÃ³n de Turnos', 'Gestión de Turnos'],
    ['GestiÃƒÂ³n de Turnos', 'Gestión de Turnos'],
    ['Agendas MÃ©dicas', 'Agendas Médicas'],
    ['Agendas MÃƒÂ©dicas', 'Agendas Médicas'],
    ['SecretarÃ­a', 'Secretaría'],
    ['SecretarÃƒÂ­a', 'Secretaría'],
    ['Completa email y contraseÃ±a.', 'Completa email y contraseña.'],
    ['Completa email y contraseÃƒÂ±a.', 'Completa email y contraseña.'],
    ['No se pudo iniciar sesiÃ³n.', 'No se pudo iniciar sesión.'],
    ['No se pudo iniciar sesiÃƒÂ³n.', 'No se pudo iniciar sesión.'],
    ['Se inyecta despuÃ©s', 'Se inyecta después'],
    ['Se inyecta despuÃƒÂ©s', 'Se inyecta después'],
    ['MÃ³dulo', 'Módulo'],
    ['MÃƒÂ³dulo', 'Módulo'],
    ['TelÃ©fono', 'Teléfono'],
    ['TelÃƒÂ©fono', 'Teléfono'],
    ['Tel�fono', 'Teléfono'],
    ['M�dicas', 'Médicas'],
    ['Cl�nica', 'Clínica'],
    ['AcciÃƒÂ³n', 'Acción'],
    ['AcciÃƒÆ’Ã‚Â³n', 'Acción'],
    ['AcciÃ³n', 'Acción'],
    ['OdontologÃ­a', 'Odontología'],
    ['OdontologÃƒÂ­a', 'Odontología'],
    ['odontolÃ³gica', 'odontológica'],
    ['odontolÃƒÂ³gica', 'odontológica'],
    ['odontolÃ³gico', 'odontológico'],
    ['odontolÃƒÂ³gico', 'odontológico'],
    ['AtenciÃ³n', 'Atención'],
    ['AtenciÃƒÂ³n', 'Atención'],
    ['dÃ­as', 'días'],
    ['dÃƒÂ­as', 'días'],
    ['dÃ­a', 'día'],
    ['dÃƒÂ­a', 'día'],
    ['pasÃ³', 'pasó'],
    ['pasÃƒÂ³', 'pasó'],
    ['vÃ¡lido', 'válido'],
    ['vÃƒÂ¡lido', 'válido'],
    ['MiÃ©rcoles', 'Miércoles'],
    ['MiÃƒÂ©rcoles', 'Miércoles'],
    ['SÃ¡bado', 'Sábado'],
    ['SÃƒÂ¡bado', 'Sábado'],
    ['MiÃ©', 'Mié'],
    ['MiÃƒÂ©', 'Mié'],
    ['SÃ¡b', 'Sáb'],
    ['SÃƒÂ¡b', 'Sáb'],
    ['quÃ©', 'qué'],
    ['quÃƒÂ©', 'qué'],
    ['PrÃ³ximos Turnos', 'Próximos Turnos'],
    ['PrÃƒÂ³ximos Turnos', 'Próximos Turnos'],
    ['DÃ­a', 'Día'],
    ['DÃƒÂ­a', 'Día'],
    ['D�a', 'Día'],
    ['TransacciÃ³n', 'Transacción'],
    ['TransacciÃƒÂ³n', 'Transacción'],
    ['DescripciÃ³n', 'Descripción'],
    ['DescripciÃƒÂ³n', 'Descripción'],
    ['DescripciÃ³n', 'Descripción'],
    ['MÃ©dicas', 'Médicas'],
    ['MÃƒÂ©dicas', 'Médicas'],
    ['MÃ©dico', 'Médico'],
    ['MÃƒÂ©dico', 'Médico'],
    ['ClÃ­nica', 'Clínica'],
    ['ClÃƒÂ­nica', 'Clínica'],
    ['clÃ­nica', 'clínica'],
    ['clÃƒÂ­nica', 'clínica'],
    ['Ficha OdontolÃ³gica', 'Ficha Odontológica'],
    ['Ficha OdontolÃƒÂ³gica', 'Ficha Odontológica'],
    ['aÃ±os', 'años'],
    ['aÃƒÂ±os', 'años'],
    ['NÂ°', 'N°'],
    ['NÂº', 'Nº'],
    ['N�', 'N°'],
    ['Circulo OdontolÃ³gico', 'Círculo Odontológico'],
    ['CÃ­rculo OdontolÃ³gico', 'Círculo Odontológico'],
    ['Circulo OdontolÃƒÂ³gico', 'Círculo Odontológico'],
    ['CÃƒÂ­rculo OdontolÃƒÂ³gico', 'Círculo Odontológico'],
    ['Ficha ClÃ­nica OdontolÃ³gica', 'Ficha Clínica Odontológica'],
    ['Ficha ClÃƒÂ­nica OdontolÃƒÂ³gica', 'Ficha Clínica Odontológica'],
    ['RestauraciÃ³n', 'Restauración'],
    ['RestauraciÃƒÂ³n', 'Restauración'],
    ['AÃ±adir', 'Añadir'],
    ['AÃƒÂ±adir', 'Añadir'],
    ['AutorizaciÃ³n', 'Autorización'],
    ['AutorizaciÃƒÂ³n', 'Autorización'],
    ['CÃ³digo', 'Código'],
    ['CÃƒÂ³digo', 'Código'],
    ['vacÃ­o', 'vacío'],
    ['vacÃƒÂ­o', 'vacío'],
    ['podrÃ¡n', 'podrán'],
    ['podrÃƒÂ¡n', 'podrán'],
    ['segÃºn', 'según'],
    ['segÃƒÂºn', 'según'],
    ['LÃ³pez', 'López'],
    ['LÃƒÂ³pez', 'López'],
    ['MartÃ­nez', 'Martínez'],
    ['MartÃƒÂ­nez', 'Martínez'],
    ['GÃ³mez', 'Gómez'],
    ['GÃƒÂ³mez', 'Gómez'],
    ['MarÃ­a', 'María'],
    ['MarÃƒÂ­a', 'María'],
    ['PÃ©rez', 'Pérez'],
    ['PÃƒÂ©rez', 'Pérez'],
    ['SÃ¡nchez', 'Sánchez'],
    ['SÃƒÂ¡nchez', 'Sánchez'],
    ['RamÃ­rez', 'Ramírez'],
    ['RamÃƒÂ­rez', 'Ramírez'],
    ['SofÃ­a', 'Sofía'],
    ['SofÃƒÂ­a', 'Sofía'],
    ['MartÃ­n', 'Martín'],
    ['MartÃƒÂ­n', 'Martín'],
    ['Ãlvarez', 'Álvarez'],
    ['ÃƒÂlvarez', 'Álvarez'],
    ['LucÃ­a', 'Lucía'],
    ['LucÃƒÂ­a', 'Lucía'],
    ['FernÃ¡ndez', 'Fernández'],
    ['FernÃƒÂ¡ndez', 'Fernández'],
    ['MedifÃ©', 'Medifé'],
    ['MedifÃƒÂ©', 'Medifé'],
    ['CÃ³rdoba', 'Córdoba'],
    ['CÃƒÂ³rdoba', 'Córdoba'],
    ['EstrÃ©s', 'Estrés'],
    ['EstrÃƒÂ©s', 'Estrés'],
    ['DiabÃ©tico', 'Diabético'],
    ['DiabÃƒÂ©tico', 'Diabético'],
    ['Especialidad', 'Especialidad'],
    ['DuraciÃ³n', 'Duración'],
    ['DuraciÃƒÂ³n', 'Duración'],
    ['Observaciones M�dicas / Alergias', 'Observaciones Médicas / Alergias'],
    ['Historia ClÃ­nica', 'Historia Clínica'],
    ['Historia ClÃƒÂ­nica', 'Historia Clínica'],
    ['ConstrucciÃ³n', 'Construcción'],
    ['ConstrucciÃƒÂ³n', 'Construcción'],
    ['Ã±', 'ñ'],
    ['ÃƒÂ±', 'ñ'],
    ['Ã¡', 'á'],
    ['ÃƒÂ¡', 'á'],
    ['Ã©', 'é'],
    ['ÃƒÂ©', 'é'],
    ['Ã­', 'í'],
    ['ÃƒÂ­', 'í'],
    ['Ã³', 'ó'],
    ['ÃƒÂ³', 'ó'],
    ['Ãº', 'ú'],
    ['ÃƒÂº', 'ú'],
    ['Ã', 'Á'],
    ['ÃƒÂ', 'Á'],
    ['Ã‰', 'É'],
    ['Ãƒâ€°', 'É'],
    ['Ã', 'Í'],
    ['ÃƒÂ', 'Í'],
    ['Ã“', 'Ó'],
    ['Ãƒâ€œ', 'Ó'],
    ['Ãš', 'Ú'],
    ['ÃƒÅ¡', 'Ú'],
    ['Â¿', '¿'],
    ['Â¡', '¡'],
    ['Â·', '·'],
    ['â†’', '→'],
    ['â€“', '–'],
    ['�', '']
];

function repairMojibakeString(value) {
    if (typeof value !== 'string' || !value) return value;
    let repaired = value;
    for (let pass = 0; pass < 4; pass += 1) {
        let changedInPass = false;
        for (const [from, to] of MOJIBAKE_REPAIRS) {
            if (repaired.includes(from)) {
                repaired = repaired.split(from).join(to);
                changedInPass = true;
            }
        }
        if (!changedInPass) break;
    }
    repaired = repaired
        .replace(/\?\s*Eliminar/g, '¿Eliminar')
        .replace(/^\?/, '¿')
        .replace(/\s+\?/g, '?');
    return repaired;
}

function repairDomText(root = document.body) {
    if (!root) return;

    const textWalker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let textNode = textWalker.nextNode();
    while (textNode) {
        const repaired = repairMojibakeString(textNode.nodeValue);
        if (repaired !== textNode.nodeValue) {
            textNode.nodeValue = repaired;
        }
        textNode = textWalker.nextNode();
    }

    root.querySelectorAll?.('*').forEach((element) => {
        ['title', 'placeholder', 'aria-label', 'value'].forEach((attr) => {
            if (!element.hasAttribute(attr)) return;
            const current = element.getAttribute(attr);
            const repaired = repairMojibakeString(current);
            if (repaired !== current) {
                element.setAttribute(attr, repaired);
            }
        });
    });
}

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
                <p class="feedback-dialog-message">${repairMojibakeString(String(message ?? ''))}</p>
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
        dismissible: true
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
const defaultData = {
    users: [
        { id: 1, email: 'admin@odentara.com', name: 'Superadmin Odentara', roles: ['superadmin'], allowedProfessionals: [] },
        { id: 2, email: 'lopez@odentara.com', name: 'Dr. LÃ³pez', roles: ['professional'], allowedProfessionals: [1] },
        { id: 3, email: 'secretaria@odentara.com', name: 'SecretarÃ­a General', roles: ['secretary'], allowedProfessionals: [] },
        { id: 4, email: 'administracion@odentara.com', name: 'Administrador General', roles: ['admin'], allowedProfessionals: [] }
    ],
    professionals: [
        { id: 1, name: 'Dr. LÃ³pez', schedule: { 
            1: {active: true, start: '08:00', end: '16:00'}, 2: {active: true, start: '08:00', end: '16:00'}, 
            3: {active: true, start: '08:00', end: '16:00'}, 4: {active: true, start: '08:00', end: '16:00'}, 
            5: {active: true, start: '08:00', end: '16:00'}, 6: {active: false, start: '08:00', end: '13:00'}, 
            0: {active: false, start: '08:00', end: '13:00'} 
        } },
        { id: 2, name: 'Dra. MartÃ­nez', schedule: { 
            1: {active: true, start: '09:00', end: '15:00'}, 2: {active: true, start: '09:00', end: '15:00'}, 
            3: {active: false, start: '09:00', end: '15:00'}, 4: {active: true, start: '09:00', end: '15:00'}, 
            5: {active: true, start: '09:00', end: '15:00'}, 6: {active: false, start: '', end: ''}, 
            0: {active: false, start: '', end: ''} 
        } },
        { id: 3, name: 'Dr. Carlos GÃ³mez', schedule: { 
            1: {active: true, start: '10:00', end: '18:00'}, 2: {active: true, start: '10:00', end: '18:00'}, 
            3: {active: true, start: '10:00', end: '18:00'}, 4: {active: true, start: '10:00', end: '18:00'}, 
            5: {active: true, start: '10:00', end: '18:00'}, 6: {active: false, start: '', end: ''}, 
            0: {active: false, start: '', end: ''} 
        } }
    ],
    appointments: [
        { id: 1, patient: 'MarÃ­a GÃ³mez', professionalId: 1, date: '2026-03-24', time: '10:00', duration: 60, status: 'confirmed', isOverbook: false },
        { id: 2, patient: 'Juan PÃ©rez', professionalId: 2, date: '2026-03-24', time: '11:00', duration: 30, status: 'sent', isOverbook: false },
        { id: 3, patient: 'Carlos Ruiz', professionalId: 1, date: '2026-03-24', time: '10:15', duration: 15, status: 'confirmed', isOverbook: true },
        { id: 4, patient: 'Laura SÃ¡nchez', professionalId: 3, date: '2026-03-24', time: '09:30', duration: 60, status: 'confirmed', isOverbook: false },
        { id: 5, patient: 'Diego RamÃ­rez', professionalId: 2, date: '2026-03-24', time: '12:00', duration: 45, status: 'not_sent', isOverbook: false },
        { id: 6, patient: 'SofÃ­a DÃ­az', professionalId: 1, date: '2026-03-24', time: '13:30', duration: 30, status: 'cancelled', isOverbook: false },
        { id: 7, patient: 'MartÃ­n Torres', professionalId: 3, date: '2026-03-24', time: '14:00', duration: 60, status: 'confirmed', isOverbook: false },
        { id: 8, patient: 'Karina LÃ³pez', professionalId: 2, date: '2026-03-24', time: '15:30', duration: 30, status: 'sent', isOverbook: false },
        { id: 9, patient: 'Facundo Vega', professionalId: 1, date: '2026-03-24', time: '16:30', duration: 60, status: 'not_sent', isOverbook: false },
        { id: 10, patient: 'Vanesa Ruiz', professionalId: 3, date: '2026-03-24', time: '17:45', duration: 30, status: 'confirmed', isOverbook: false },
        { id: 11, patient: 'Martina GÃ³mez', professionalId: 1, date: '2026-03-25', time: '09:00', duration: 45, status: 'confirmed', isOverbook: false },
        { id: 12, patient: 'Bruno Ãlvarez', professionalId: 2, date: '2026-03-25', time: '10:30', duration: 60, status: 'sent', isOverbook: false },
        { id: 13, patient: 'LucÃ­a FernÃ¡ndez', professionalId: 3, date: '2026-03-25', time: '11:45', duration: 30, status: 'not_sent', isOverbook: false }
    ],
    patients: [
        { id: 1, name: 'MarÃ­a GÃ³mez', dni: '34567890', fechaNacimiento: '1994-09-19', obraSocial: 'Sancor 4000', credencial: '1826490/00', domicilio: 'Primitivo de la Reta 513 Piso 8 Of 2 Ciudad', fichaNumero: '001', email: 'maria@example.com', phone: '261-679-1598', lastVisit: '2026-02-10', notes: 'Alergia a la penicilina', odontograma: {}, treatments: [] },
        { id: 2, name: 'Juan PÃ©rez', dni: '23456789', fechaNacimiento: '1985-05-12', obraSocial: 'OSDE 210', credencial: '12345678', domicilio: 'San Martin 123', fichaNumero: '002', email: 'juan@example.com', phone: '098-765-4321', lastVisit: '2026-03-01', notes: 'Sin antecedentes', odontograma: {}, treatments: [] },
        { id: 3, name: 'Laura SÃ¡nchez', dni: '45678901', fechaNacimiento: '1990-04-20', obraSocial: 'OSDE 310', credencial: '98765432', domicilio: 'Av. Libertador 1234', fichaNumero: '003', email: 'laura@example.com', phone: '261-111-2222', lastVisit: '2026-03-22', notes: '', odontograma: {}, treatments: [] },
        { id: 4, name: 'Diego RamÃ­rez', dni: '56789012', fechaNacimiento: '1988-08-05', obraSocial: 'SWISS MEDICAL', credencial: '11122334', domicilio: 'Calle Falsa 123', fichaNumero: '004', email: 'diego@example.com', phone: '261-333-4444', lastVisit: '2026-02-05', notes: 'Control de ortodoncia', odontograma: {}, treatments: [] },
        { id: 5, name: 'SofÃ­a DÃ­az', dni: '67890123', fechaNacimiento: '1995-12-01', obraSocial: 'Galeno', credencial: '22233445', domicilio: 'Calle Real 56', fichaNumero: '005', email: 'sofia@example.com', phone: '261-555-6666', lastVisit: '2026-01-16', notes: '', odontograma: {}, treatments: [] },
        { id: 6, name: 'MartÃ­n Torres', dni: '78901234', fechaNacimiento: '1979-03-30', obraSocial: 'MedifÃ©', credencial: '33344556', domicilio: 'Calle Luna 90', fichaNumero: '006', email: 'martin@example.com', phone: '261-777-8888', lastVisit: '2026-04-01', notes: 'DiabÃ©tico', odontograma: {}, treatments: [] },
        { id: 7, name: 'Karina LÃ³pez', dni: '89012345', fechaNacimiento: '1982-07-11', obraSocial: 'OSDE', credencial: '44455667', domicilio: 'Av. Mayo 321', fichaNumero: '007', email: 'karina@example.com', phone: '261-999-0000', lastVisit: '2026-03-10', notes: '', odontograma: {}, treatments: [] },
        { id: 8, name: 'Facundo Vega', dni: '90123456', fechaNacimiento: '1987-02-18', obraSocial: 'Swiss Medical', credencial: '55566778', domicilio: 'Calle Sol 18', fichaNumero: '008', email: 'facundo@example.com', phone: '261-101-2020', lastVisit: '2026-02-20', notes: 'Bleeding gums', odontograma: {}, treatments: [] },
        { id: 9, name: 'Vanesa Ruiz', dni: '01234567', fechaNacimiento: '1993-11-09', obraSocial: 'Galeno', credencial: '66677889', domicilio: 'Calle Mar 89', fichaNumero: '009', email: 'vanesa@example.com', phone: '261-303-4040', lastVisit: '2026-03-19', notes: '', odontograma: {}, treatments: [] },
        { id: 10, name: 'Martina GÃ³mez', dni: '11223344', fechaNacimiento: '2000-06-12', obraSocial: 'Sancor 4000', credencial: '77788990', domicilio: 'Calle Estrella 25', fichaNumero: '010', email: 'martina@example.com', phone: '261-505-6060', lastVisit: '2026-03-24', notes: '', odontograma: {}, treatments: [] },
        { id: 11, name: 'Bruno Ãlvarez', dni: '22334455', fechaNacimiento: '1975-09-27', obraSocial: 'OSDE', credencial: '88899001', domicilio: 'Av. CÃ³rdoba 101', fichaNumero: '011', email: 'bruno@example.com', phone: '261-707-8080', lastVisit: '2026-03-05', notes: '', odontograma: {}, treatments: [] },
        { id: 12, name: 'LucÃ­a FernÃ¡ndez', dni: '33445566', fechaNacimiento: '1998-01-14', obraSocial: 'MedifÃ©', credencial: '99900112', domicilio: 'Calle Internal 42', fichaNumero: '012', email: 'lucia@example.com', phone: '261-909-0101', lastVisit: '2026-03-28', notes: 'EstrÃ©s dental', odontograma: {}, treatments: [] }
    ],
    billing: [
        { id: 1, patientId: 2, professionalId: 2, type: 'income', amount: 12500, date: '2026-03-24', description: 'Consulta Dra. MartÃ­nez' },
        { id: 2, patientId: 1, professionalId: 1, type: 'debt', amount: 45000, date: '2026-03-20', description: 'Tratamiento conducto' }
    ]
};

const DB = {
    getRaw(table) {
        return JSON.parse(localStorage.getItem('odentara_db_v6'))[table] || [];
    },
    init() {
        if (!localStorage.getItem('odentara_db_v6')) {
            localStorage.setItem('odentara_db_v6', JSON.stringify(defaultData));
        }
        this.ensureSeedData();
    },
    ensureSeedData() {
        const db = JSON.parse(localStorage.getItem('odentara_db_v6'));
        if (!db) return;

        const mergeBy = (currentItems = [], seedItems = [], getKey) => {
            const merged = [...currentItems];
            const existingKeys = new Set(currentItems.map(item => getKey(item)));
            let nextId = currentItems.length > 0
                ? Math.max(...currentItems.map(item => item.id || 0)) + 1
                : 1;

            seedItems.forEach(seedItem => {
                const key = getKey(seedItem);
                if (!existingKeys.has(key)) {
                    merged.push({ ...seedItem, id: nextId++ });
                    existingKeys.add(key);
                }
            });

            return merged;
        };

        db.users = mergeBy(db.users, defaultData.users, item => item.email);
        db.professionals = mergeBy(db.professionals, defaultData.professionals, item => item.name);
        db.patients = mergeBy(db.patients, defaultData.patients, item => item.dni);

        localStorage.setItem('odentara_db_v6', JSON.stringify(db));
    },
    get(table) {
        return this.getRaw(table).filter(item => !item?.deletedAt);
    },
    save(table, items) {
        const db = JSON.parse(localStorage.getItem('odentara_db_v6'));
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

// --- Role Configurations ---
const roleConfig = {
    superadmin: {
        name: 'Superadmin',
        navItems: [
            { id: 'dashboard', icon: 'fa-chart-pie', label: 'Dashboard' },
            { id: 'appointments', icon: 'fa-calendar-check', label: 'Turnos' },
            { id: 'professionals', icon: 'fa-user-md', label: 'Horarios MÃ©dicos' },
            { id: 'patients', icon: 'fa-users', label: 'Pacientes & Historia' },
            { id: 'billing', icon: 'fa-file-invoice-dollar', label: 'FacturaciÃ³n' },
            { id: 'settings', icon: 'fa-cog', label: 'ConfiguraciÃ³n' }
        ]
    },
    admin: {
        name: 'Administrador',
        navItems: [
            { id: 'dashboard', icon: 'fa-chart-pie', label: 'Dashboard' },
            { id: 'patients', icon: 'fa-users', label: 'Directorio Pacientes' },
            { id: 'billing', icon: 'fa-file-invoice-dollar', label: 'Cuentas Corrientes' },
            { id: 'settings', icon: 'fa-cog', label: 'ConfiguraciÃ³n' }
        ]
    },
    professional: {
        name: 'Profesional',
        navItems: [
            { id: 'dashboard', icon: 'fa-chart-pie', label: 'Mi Panel' },
            { id: 'appointments', icon: 'fa-calendar-check', label: 'Mis Turnos' },
            { id: 'professionals', icon: 'fa-clock', label: 'Mis Horarios' },
            { id: 'patients', icon: 'fa-notes-medical', label: 'Historias ClÃ­nicas' }
        ]
    },
    secretary: {
        name: 'SecretarÃ­a',
        navItems: [
            { id: 'dashboard', icon: 'fa-chart-pie', label: 'RecepciÃ³n' },
            { id: 'appointments', icon: 'fa-calendar-check', label: 'GestiÃ³n de Turnos' },
            { id: 'professionals', icon: 'fa-user-md', label: 'Agendas MÃ©dicas' },
            { id: 'patients', icon: 'fa-users', label: 'Registro de Pacientes' }
        ]
    }
};

// --- Initial DOM Elements ---
const views = { login: document.getElementById('login-view'), app: document.getElementById('app-view') };
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

function normalizeIdentityEmail(email = '') {
    return String(email)
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
}

function normalizeDni(dni = '') {
    return String(dni).replace(/\D/g, '');
}

function normalizePatientName(name = '') {
    return String(name)
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ');
}

function mapApiUserToLegacyUser(apiUser = {}) {
    const displayName = apiUser.fullName || apiUser.name || apiUser.email || 'Usuario';
    return {
        id: apiUser.id,
        email: apiUser.email,
        name: displayName,
        fullName: apiUser.fullName || displayName,
        roles: Array.isArray(apiUser.roles) ? apiUser.roles : [],
        allowedProfessionals: Array.isArray(apiUser.allowedProfessionalIds) ? apiUser.allowedProfessionalIds : [],
        assignedProfessionalId: apiUser.assignedProfessionalId || null,
        assignedProfessionalName: apiUser.assignedProfessionalName || null,
        active: apiUser.active !== false
    };
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

function validatePatientForm(form, editId = null) {
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

    const duplicatedByName = DB.get('patients').find((patient) =>
        normalizePatientName(patient.name) === normalizedName && patient.id !== editId
    );

    if (duplicatedByName) {
        return fail('name', 'Ya existe un paciente cargado con ese nombre.', 'Ya existe un paciente cargado con ese nombre.');
    }

    const duplicatedByDni = DB.get('patients').find((patient) =>
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

function applyAuthenticatedUiState() {
    if (!state.user) return;
    state.dashboardDate = getTodayIsoLocal();
    const roleLabel = state.user.roles.map(r => roleConfig[r]?.name || r).join(' + ');
    const sourceName = state.user.name || state.user.fullName || state.user.email || 'Usuario';
    const initials = sourceName.substring(0, 2).toUpperCase();
    setElementText('user-name', sourceName);
    setElementText('user-role-display', roleLabel);
    setElementText('user-initials', initials);
    renderSidebar();
    setSidebarOpen(!isMobileLayout());
    views.login.classList.remove('active');
    views.login.classList.add('hidden');
    views.app.classList.remove('hidden');
    views.app.classList.add('active');
    loadView('dashboard');
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
        firstName: professional.fullName,
        specialty: professional.specialty || '',
        email: professional.email || '',
        phone: professional.phone || '',
        color: professional.color || '#6366f1',
        status: professional.active ? 'activo' : 'inactivo',
        active: professional.active,
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
        notes: patient.clinicalRecord?.summaryNotes || patient.clinicalRecord?.medicalNotes || '',
        allergies: patient.clinicalRecord?.allergies || '',
        medicalNotes: patient.clinicalRecord?.medicalNotes || '',
        odontograma: {},
        treatments: [],
        clinicalImages: []
    };
}

function mapApiTreatmentToLegacy(treatment = {}) {
    return {
        id: treatment.id,
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
        id: image.id,
        date: image.takenAt
            ? formatDateToLocalIso(new Date(image.takenAt))
            : image.createdAt
                ? formatDateToLocalIso(new Date(image.createdAt))
                : '',
        description: image.description || '',
        dataUrl: image.imageUrl || ''
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

function deepClone(value) {
    return JSON.parse(JSON.stringify(value));
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
        L: 'center'
    };
    const statusMap = {
        healthy: 'sano',
        caries: 'caries',
        restored: 'restaurado',
        absent: 'ausente'
    };

    entries.forEach((entry) => {
        const toothNumber = String(entry.toothNumber || '');
        if (!toothNumber) return;
        if (!odontograma[toothNumber]) odontograma[toothNumber] = {};

        const status = statusMap[entry.status] || 'sano';
        if (status === 'ausente') {
            odontograma[toothNumber] = { estado: 'ausente' };
            return;
        }

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
        sano: 'healthy',
        caries: 'caries',
        restaurado: 'restored',
        ausente: 'absent'
    };

    Object.entries(odontograma || {}).forEach(([toothNumber, toothData]) => {
        if (!toothData || typeof toothData !== 'object') return;

        if (toothData.estado === 'ausente') {
            entries.push({
                toothNumber: String(toothNumber),
                face: null,
                status: statusMap.ausente
            });
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

async function syncPatientClinicalData(patientId) {
    const patient = DB.get('patients').find((item) => item.id === patientId);
    if (!state.authToken) return patient;

    const [patientRes, treatmentsRes, imagesRes, clinicalRecordRes] = await Promise.all([
        apiFetch(`/patients/${patientId}`),
        apiFetch(`/treatments?patientId=${patientId}`),
        apiFetch(`/clinical-images?patientId=${patientId}`),
        apiFetch(`/clinical-records/${patientId}`)
    ]);

    const mappedPatient = mapApiPatientToLegacy(patientRes.patient || {});
    const record = clinicalRecordRes.record || patientRes.patient?.clinicalRecord || null;
    const mergedPatient = {
        ...(patient || {}),
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
        allowedProfessionals: user.allowedProfessionalIds || []
    };
}

async function syncBackendSnapshotToLocalDb() {
    const [professionalsRes, patientsRes, appointmentsRes, billingRes, usersRes] = await Promise.allSettled([
        apiFetch('/professionals'),
        apiFetch('/patients'),
        apiFetch('/appointments'),
        apiFetch('/billing'),
        apiFetch('/users')
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
        DB.save('users', (usersRes.value.users || []).map(mapApiUserToSettings));
    }
}

async function tryRestoreSession() {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return;

    try {
        const saved = JSON.parse(raw);
        if (!saved?.token) return;
        state.authToken = saved.token;
        const me = await apiFetch('/auth/me');
        saveAuthSession(saved.token, me.user);
        await syncBackendSnapshotToLocalDb();
        applyAuthenticatedUiState();
    } catch (_error) {
        clearAuthSession();
    }
}

function getPatientOptionLabel(patient) {
    return `${patient.name} | DNI ${patient.dni}`;
}

function getBusinessNowParts() {
    const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: BUSINESS_TIME_ZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23'
    });

    const parts = formatter.formatToParts(new Date());
    const values = Object.fromEntries(parts.map(part => [part.type, part.value]));

    return {
        year: Number(values.year),
        month: Number(values.month),
        day: Number(values.day),
        hour: Number(values.hour),
        minute: Number(values.minute)
    };
}

function getTodayIsoLocal() {
    const now = getBusinessNowParts();
    return `${String(now.year).padStart(4, '0')}-${String(now.month).padStart(2, '0')}-${String(now.day).padStart(2, '0')}`;
}

function formatDateToLocalIso(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function parseLocalIsoDate(dateStr) {
    if (!dateStr) return new Date();
    const [year, month, day] = String(dateStr).split('-').map(Number);
    return new Date(year, (month || 1) - 1, day || 1);
}

function timeToMinutes(timeStr = '') {
    const [hours, minutes] = timeStr.split(':').map(Number);
    if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
    return (hours * 60) + minutes;
}

function getCurrentMinutes() {
    const now = getBusinessNowParts();
    return (now.hour * 60) + now.minute;
}

function isPastDate(dateStr) {
    return Boolean(dateStr) && dateStr < getTodayIsoLocal();
}

function isTodayDate(dateStr) {
    return Boolean(dateStr) && dateStr === getTodayIsoLocal();
}

// --- Events ---
document.addEventListener('DOMContentLoaded', () => {
    ensureThemeControls();
    applyTheme(getStoredTheme(), false);
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

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (isAppLoading()) return;
        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;
        const submitBtn = e.target.querySelector('button[type="submit"]');
        if (submitBtn) submitBtn.disabled = true;
        try {
            await withAppLoading('Iniciando sesión...', async () => {
                await login(email, password);
            });
        } finally {
            if (submitBtn) submitBtn.disabled = false;
        }
    });

    document.getElementById('logout-btn').addEventListener('click', logout);
    sidebarToggle?.addEventListener('click', () => setSidebarOpen(!state.sidebarOpen));
    sidebarBackdrop?.addEventListener('click', () => setSidebarOpen(false));
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
        
        if (e.target.closest('#btn-add-patient')) openPatientModal();
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

        if (e.target.closest('#btn-add-tx')) openBillingModal();
        if (e.target.closest('#btn-open-patient-billing')) openPatientBillingPicker();
        if (e.target.closest('#btn-clear-patient-billing')) clearPatientBillingFilter();
        if (e.target.closest('.btn-delete-tx')) {
            const txId = parseInt(e.target.closest('.btn-delete-tx').dataset.id);
            const tx = DB.get('billing').find(item => item.id === txId);
            if (tx && canAccessProfessional(tx.professionalId) && await showConfirm('¿Eliminar transacción?', { title: 'Eliminar transacción', confirmText: 'Eliminar' })) {
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

    document.addEventListener('input', (e) => {
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
            refreshCurrentView();
        }
    });

    document.addEventListener('click', (e) => {
        const billingButton = e.target.closest('[data-billing-view]');
        if (billingButton) {
            state.billingSubView = billingButton.dataset.billingView;
            refreshCurrentView();
        }
    });

    document.addEventListener('submit', async (e) => {
        if (e.target.id === 'new-user-form') {
            e.preventDefault();
            const name = document.getElementById('u-name').value.trim();
            const email = document.getElementById('u-email').value.trim();
            const password = document.getElementById('u-password').value;
            const type = document.getElementById('u-type').value;

            if (!name || !email || !password || !type) {
                alert('Completa nombre, email, contraseña y tipo de usuario.');
                return;
            }

            if (password.length < 6) {
                alert('La contraseña debe tener al menos 6 caracteres.');
                return;
            }

            const roleNodes = Array.from(document.querySelectorAll('input[name="u-role"]:checked'));
            const roles = roleNodes.map(r => r.value);
            if (roles.length === 0) {
                alert('Selecciona al menos un rol de permisos.');
                return;
            }

            const profNodes = Array.from(document.querySelectorAll('input[name="u-profs"]:checked'));
            const selectedProfessionals = profNodes.length > 0 ? profNodes.map(p => parseInt(p.value)) : [];

            try {
                await withAppLoading('Guardando usuario...', async () => {
                    if (state.authToken) {
                        await apiFetch('/users', {
                            method: 'POST',
                            body: JSON.stringify({
                                fullName: name,
                                email,
                                password,
                                type,
                                roles,
                                allowedProfessionalIds: selectedProfessionals
                            })
                        });
                        await syncBackendSnapshotToLocalDb();
                    } else {
                        DB.add('users', {
                            name,
                            email,
                            password,
                            type,
                            roles,
                            allowedProfessionals: selectedProfessionals
                        });
                    }
                });

                e.target.reset();
                showToast('Usuario creado correctamente.', { type: 'success' });
            } catch (error) {
                alert(error.message || 'No se pudo crear el usuario.');
            }

            refreshCurrentView();
        }

        if (e.target.id === 'new-prof-form') {
            e.preventDefault();
            const name = document.getElementById('p-name').value.trim();
            const lastName = document.getElementById('p-lastname').value.trim();
            const specialty = document.getElementById('p-specialty').value.trim();
            const phone = document.getElementById('p-phone').value.trim();
            const email = document.getElementById('p-email').value.trim();
            const status = document.getElementById('p-status').value;

            if (!name || !lastName || !specialty) {
                alert('Nombre, apellido y especialidad son obligatorios para un profesional.');
                return;
            }

            try {
                await withAppLoading('Guardando profesional...', async () => {
                    if (state.authToken) {
                        await apiFetch('/professionals', {
                            method: 'POST',
                            body: JSON.stringify({
                                fullName: `${name} ${lastName}`.trim(),
                                specialty,
                                phone,
                                email,
                                active: (status || 'activo') === 'activo'
                            })
                        });
                        await syncBackendSnapshotToLocalDb();
                    } else {
                        DB.add('professionals', {
                            name: `${name} ${lastName}`,
                            firstName: name,
                            lastName,
                            specialty,
                            phone,
                            email,
                            status: status || 'activo',
                            schedule: {
                                1: {active: true, start: '08:00', end: '16:00'},
                                2: {active: true, start: '08:00', end: '16:00'},
                                3: {active: true, start: '08:00', end: '16:00'},
                                4: {active: true, start: '08:00', end: '16:00'},
                                5: {active: true, start: '08:00', end: '16:00'},
                                6: {active: false, start: '', end: ''},
                                0: {active: false, start: '', end: ''}
                            }
                        });
                    }
                });

                e.target.reset();
                refreshCurrentView();
            } catch (error) {
                alert(error.message || 'No se pudo crear el profesional.');
            }
        }
    });

    window.addEventListener('beforeunload', (event) => {
        if (!hasUnsavedClinicalDraft()) return;
        event.preventDefault();
        event.returnValue = '';
    });

    withAppLoading('Iniciando sesión...', async () => {
        await tryRestoreSession();
    });
});

// --- Auth ---
async function login(email, password) {
    const normalizedEmail = normalizeIdentityEmail(email);
    if (!normalizedEmail || !password) {
        alert('Completa email y contraseÃ±a.');
        return;
    }

    try {
        const result = await apiFetch('/auth/login', {
            method: 'POST',
            body: JSON.stringify({
                email: normalizedEmail,
                password
            })
        });

        saveAuthSession(result.token, result.user);
        await syncBackendSnapshotToLocalDb();
        applyAuthenticatedUiState();
    } catch (error) {
        const message = error.status === 0
            ? 'No se pudo conectar con el servidor de Odentara. Verifica que el sitio y la API esten publicados correctamente e intenta nuevamente.'
            : (error.payload?.error || error.message || 'No se pudo iniciar sesión.');
        showAlert(message, { title: 'Error de inicio de sesión', variant: 'error' });
    }
}

function logout() {
    clearAuthSession();
    state.dashboardDate = null;
    setSidebarOpen(false);
    views.app.classList.remove('active');
    setTimeout(() => {
        views.app.classList.add('hidden');
        views.login.classList.remove('hidden');
        setTimeout(() => views.login.classList.add('active'), 10);
    }, 250);
}

// --- Navigation ---
function renderSidebar() {
    const sidebarNav = document.getElementById('sidebar-nav');
    sidebarNav.innerHTML = '';

    const SETTINGS_SUB_ITEMS = [
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
    const navItems = new Map();
    state.user.roles.forEach(role => {
        if (roleConfig[role]) {
            roleConfig[role].navItems.forEach(item => {
                navItems.set(item.id, item);
            });
        }
    });

    Array.from(navItems.values()).forEach(item => {
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
            SETTINGS_SUB_ITEMS.forEach(sub => {
                const subLink = document.createElement('a');
                subLink.className = `nav-sub-item ${sub.id === state.settingsSubView ? 'active' : ''}`;
                subLink.dataset.settingsView = sub.id;
                subLink.innerHTML = `<i class="fa-solid ${sub.icon}"></i><span>${sub.label}</span>`;
                sidebarNav.appendChild(subLink);
            });
        }

        if (item.id === 'billing' && state.currentView === 'billing') {
            BILLING_SUB_ITEMS.forEach(sub => {
                const subLink = document.createElement('a');
                subLink.className = `nav-sub-item ${sub.id === state.billingSubView ? 'active' : ''}`;
                subLink.dataset.billingView = sub.id;
                subLink.innerHTML = `<i class="fa-solid ${sub.icon}"></i><span>${sub.label}</span>`;
                sidebarNav.appendChild(subLink);
            });
        }
    });
}

function refreshCurrentView() {
    loadView(state.currentView, getPageTitle(), { skipUnsavedCheck: true });
}

function formatDashboardDateLabel(dateStr) {
    if (!dateStr) return '';
    const date = parseLocalIsoDate(dateStr);
    return date.toLocaleDateString('es-AR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long'
    });
}

async function loadView(viewId, title = 'Dashboard', options = {}) {
    if (!options.skipUnsavedCheck && viewId !== 'patient-history' && !(await confirmClinicalDraftExit())) {
        renderSidebar();
        return false;
    }

    state.currentView = viewId;
    setPageTitle(title);
    mainContent.innerHTML = '';
    syncSidebarLayout();
    
    const content = document.createElement('div');
    content.className = 'animate-fade-in';
    
    if (viewId === 'dashboard') content.innerHTML = renderDashboard();
    else if (viewId === 'appointments') content.innerHTML = renderAppointments();
    else if (viewId === 'professionals') content.innerHTML = renderProfessionals();
    else if (viewId === 'patients') content.innerHTML = renderPatients();
    else if (viewId === 'billing') content.innerHTML = renderBilling();
    else if (viewId === 'settings') content.innerHTML = renderSettingsSubpages();
    else if (viewId === 'patient-history') content.innerHTML = ''; // Se inyecta despuÃ©s por loadClinicalHistory
    else content.innerHTML = renderPlaceholder(viewId);
    
    mainContent.appendChild(content);
    renderSidebar();
    return true;
}

function renderPlaceholder(viewId) {
    return `<div class="card p-12 text-center"><i class="fa-solid fa-tools text-4xl text-gray-300 mb-4"></i><h3 class="text-lg font-medium text-gray-700">MÃ³dulo ${viewId} en ConstrucciÃ³n</h3></div>`;
}

// --- Helpers ---
function getProfName(id) {
    const p = DB.get('professionals').find(x => x.id === parseInt(id));
    return p ? p.name : 'Desconocido';
}

function getPatientByAppointment(apt) {
    return DB.get('patients').find(p => p.name === apt.patient) || null;
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
    if (!canManagePatientBillingUi() || !canAccessPatient(patientId)) {
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
    if (isSuperadmin()) {
        return DB.get('patients').map(p => p.id);
    }

    const ids = new Set();
    getAccessibleAppointments().forEach(apt => {
        const patient = getPatientByAppointment(apt);
        if (patient) ids.add(patient.id);
    });

    DB.get('billing')
        .filter(tx => canAccessProfessional(tx.professionalId))
        .forEach(tx => ids.add(tx.patientId));

    return Array.from(ids);
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

    const apt = DB.get('appointments').find(item => item.id === aptId);
    if (!apt || !nextStatus) return;

    const normalizedNextStatus = normalizeAppointmentStatus(nextStatus);

    try {
        if (state.authToken) {
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

    const apt = DB.get('appointments').find(item => item.id === aptId);
    if (!apt) return;
    const normalizedStatus = normalizeAppointmentStatus(apt.status);
    if (normalizedStatus === 'not_sent') {
        try {
            if (state.authToken) {
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
                DB.update('appointments', aptId, { status: 'sent' });
            }
        } catch (error) {
            showAlert(error.message || 'No se pudo actualizar el estado del turno.', { title: 'Turnos', variant: 'error' });
            return;
        }
        if (state.currentView === 'dashboard' || state.currentView === 'appointments') refreshCurrentView();
    }
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

window.openClinicalImageViewer = function(patientId, imageId) {
    const images = getClinicalImagesForPatient(patientId);
    if (!images.length) return;

    const imageIndex = Math.max(0, images.findIndex((image, index) => (image.id ?? index) === imageId));
    state.clinicalImageViewer = { patientId, index: imageIndex < 0 ? 0 : imageIndex };
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
    const label = image.description || 'Imagen clínica';
    const dateLabel = image.date ? image.date.split('-').reverse().join('/') : 'Sin fecha';

    modalsContainer.innerHTML = `
        <div class="modal-overlay active clinical-image-viewer-overlay">
            <div class="clinical-image-viewer" onclick="event.stopPropagation()">
                <button type="button" class="clinical-image-viewer-close" data-modal-close aria-label="Cerrar visor">
                    <i class="fa-solid fa-xmark"></i>
                </button>
                <div class="clinical-image-viewer-main">
                    <button type="button" class="clinical-image-viewer-nav prev" onclick="stepClinicalImageViewer(-1)" aria-label="Imagen anterior">
                        <i class="fa-solid fa-chevron-left"></i>
                    </button>
                    <figure class="clinical-image-viewer-figure">
                        <img src="${image.dataUrl}" alt="${label}" class="clinical-image-viewer-img">
                    </figure>
                    <button type="button" class="clinical-image-viewer-nav next" onclick="stepClinicalImageViewer(1)" aria-label="Imagen siguiente">
                        <i class="fa-solid fa-chevron-right"></i>
                    </button>
                </div>
                <div class="clinical-image-viewer-footer">
                    <div>
                        <div class="clinical-image-viewer-date">${dateLabel}</div>
                        <div class="clinical-image-viewer-title">${label}</div>
                    </div>
                    <div class="clinical-image-viewer-counter">${safeIndex + 1} / ${images.length}</div>
                </div>
            </div>
        </div>
    `;
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
                </div>
                <div class="modal-body">
                    <div class="grid grid-cols-2 gap-4 mb-4">
                        <div><strong>Paciente:</strong> ${apt.patient}</div>
                        <div><strong>Tel�fono:</strong> ${patient ? patient.phone : 'N/A'}</div>
                        <div><strong>Profesional:</strong> ${prof ? prof.name : 'N/A'}</div>
                        <div><strong>Especialidad:</strong> OdontologÃ­a</div>
                        <div><strong>Fecha:</strong> ${parseLocalIsoDate(apt.date).toLocaleDateString('es-AR')}</div>
                        <div><strong>Hora:</strong> ${apt.time} (${apt.duration} min)</div>
                        <div><strong>Estado:</strong> <span class="badge ${statusMeta.badge}">${statusMeta.label}</span></div>
                        <div><strong>Motivo:</strong> Consulta odontolÃ³gica</div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-ghost" onclick="closeModal()">Cerrar</button>
                    ${patient && canViewClinicalHistoryUi() ? `<button type="button" class="btn btn-secondary" onclick="closeModal(); loadClinicalHistory(${patient.id})">Historia Clinica</button>` : ''}
                    <button type="button" class="btn btn-secondary" onclick="openAppointmentModal(${aptId})">Editar</button>
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
        alert("AtenciÃ³n: Necesitas crear al menos un paciente en el directorio antes de agendar un turno.");
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
                            <label>Profesional</label>
                            <select id="apt-professional" required>
                                ${professionals.map(p => `<option value="${p.id}" ${apt && apt.professionalId === p.id ? 'selected':''}>${p.name}</option>`).join('')}
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
                            <label>DuraciÃ³n</label>
                            <select id="apt-duration">
                                <option value="30" ${apt && apt.duration===30?'selected':''}>30 minutos</option>
                                <option value="60" ${!apt || apt.duration===60?'selected':''}>60 minutos (1 hora)</option>
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
        
        const currentDur = parseInt(durSelect.value) || (apt ? apt.duration : 60);
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
            alert('No se pueden sacar turnos para dÃ­as anteriores.');
            return;
        }

        if (isTodayDate(selectedDate) && !isOverbook && selectedMinutes !== null && selectedMinutes < getCurrentMinutes()) {
            alert('Ese horario ya pasÃ³. Para horarios pasados del dÃ­a de hoy solo se permiten sobreturnos.');
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
            alert('Selecciona un paciente vÃ¡lido.');
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

function openScheduleModal(profId) {
    if (!canAccessProfessional(profId)) return;
    const prof = DB.get('professionals').find(x => x.id === profId);
    
    const days = ['Domingo', 'Lunes', 'Martes', 'MiÃ©rcoles', 'Jueves', 'Viernes', 'SÃ¡bado'];
    
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
                        <input type="time" id="sch-start-${i}" value="${d.start}" class="form-input schedule-time-input">
                    </div>
                    <div class="schedule-time-separator">a</div>
                    <div class="schedule-time-field">
                        <span class="schedule-time-caption">Hasta</span>
                        <input type="time" id="sch-end-${i}" value="${d.end}" class="form-input schedule-time-input">
                    </div>
                </div>
            </div>
        `;
    }

    modalsContainer.innerHTML = `
        <div class="modal-overlay active">
            <div class="modal-content modal-content-schedule w-auto max-w-2xl" onclick="event.stopPropagation()">
                <div class="modal-header">
                    <h3>Horarios Diarios de ${prof.name}</h3>
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
                        <div class="input-group"><label>Nombre y Apellido *</label><input type="text" id="p-name" value="${p?p.name:''}" required></div>
                        <div class="patient-form-row patient-form-row-2">
                            <div class="input-group flex-1"><label>DNI *</label><input type="text" id="p-dni" value="${p?p.dni||'':''}" required></div>
                            <div class="input-group flex-1"><label>Tel�fono (Celular) *</label><input type="text" id="p-phone" value="${p?p.phone||'':''}" required></div>
                        </div>
                        <div class="patient-form-row patient-form-row-2">
                            <div class="input-group flex-1"><label>Fecha de Nacimiento</label><input type="date" id="p-nacimiento" value="${p?p.fechaNacimiento||'':''}"></div>
                            <div class="input-group flex-1"><label>Email</label><input type="email" id="p-email" value="${p?p.email||'':''}"></div>
                        </div>
                        <div class="input-group"><label>Domicilio</label><input type="text" id="p-domicilio" value="${p?p.domicilio||'':''}"></div>
                        <div class="patient-form-row patient-form-row-3">
                            <div class="input-group flex-1"><label>Obra Social / Plan</label><input type="text" id="p-obrasocial" value="${p?p.obraSocial||'':''}"></div>
                            <div class="input-group flex-1"><label>Credencial</label><input type="text" id="p-credencial" value="${p?p.credencial||'':''}"></div>
                            <div class="input-group flex-1"><label>Ficha N�</label><input type="text" id="p-ficha" value="${p?p.fichaNumero||'':''}"></div>
                        </div>
                        <div class="input-group"><label>Observaciones M�dicas / Alergias</label><input type="text" id="p-notes" value="${p?p.notes||'':''}"></div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-ghost" onclick="closeModal()">Cancelar</button>
                        <button type="submit" class="btn btn-primary">Guardar Paciente</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    const patientForm = document.getElementById('patient-form');

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
        const validation = validatePatientForm(patientForm, editId);
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
                    if (editId) {
                        await apiFetch(`/patients/${editId}`, {
                            method: 'PUT',
                            body: JSON.stringify(payload)
                        });
                    } else {
                        await apiFetch('/patients', {
                            method: 'POST',
                            body: JSON.stringify(payload)
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

function openBillingModal() {
    const patients = getAccessiblePatients();
    const professionals = getAccessibleProfessionals();

    if (patients.length === 0) { alert("Debes crear pacientes primero en el directorio."); return; }

    modalsContainer.innerHTML = `
        <div class="modal-overlay active">
            <div class="modal-content modal-content-billing" onclick="event.stopPropagation()">
                <div class="modal-header">
                    <h3>Nueva TransacciÃ³n</h3>
                    <button class="btn-ghost" data-modal-close><i class="fa-solid fa-times"></i></button>
                </div>
                <form id="tx-form">
                    <div class="modal-body">
                        <div class="input-group">
                            <label>Paciente</label>
                            <select id="tx-patient" required>
                                ${patients.map(p => `<option value="${p.id}">${p.name} (DNI ${p.dni})</option>`).join('')}
                            </select>
                        </div>
                        <div class="input-group">
                            <label>Profesional Asignado a la TransacciÃ³n</label>
                            <select id="tx-prof" required>
                                ${professionals.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
                            </select>
                        </div>
                        <div class="input-group"><label>Tipo de Registro</label><select id="tx-type" required><option value="income">Abono / Pago recibido (Ingreso)</option><option value="debt">Cargo por Tratamiento (Deuda)</option></select></div>
                        <div class="input-group"><label>Monto ($)</label><input type="number" id="tx-amount" min="1" required></div>
                        <div class="input-group"><label>Concepto / DescripciÃ³n</label><input type="text" id="tx-desc" required placeholder="Ej: Tratamiento conducto, Pago parcial..."></div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-ghost" onclick="closeModal()">Cancelar</button>
                        <button type="submit" class="btn btn-primary">Registrar en Cuenta Corriente</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    document.getElementById('tx-form').addEventListener('submit', async (e) => {
        e.preventDefault();
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
    if (!canManagePatientBillingUi()) {
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
            return patientName.includes(normalizedQuery) || patientDni.includes(normalizedDniQuery);
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
                <h3>PrÃ³ximos Turnos</h3>
            </div>
            <div class="overflow-x-auto">
                <table class="w-full text-left">
                    <thead><tr><th>Hora</th><th>Paciente</th><th>Estado</th></tr></thead>
                    <tbody>
                        ${apts.sort((a,b)=>a.time.localeCompare(b.time)).slice(0, 5).map(apt => `
                            <tr class="${apt.isOverbook?'tr-sobreturno':''}">
                                <td><span class="font-semibold">${apt.time}</span> <span class="text-xs text-gray-500">(${apt.duration}m)</span></td>
                                <td>${apt.patient} ${apt.isOverbook ? '<span class="badge badge-purple text-xs ml-2">Sobreturno</span>' : ''}</td>
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
    { bg: '#14b8a6', text: '#fff' },
    { bg: '#8b5cf6', text: '#fff' },
    { bg: '#f97316', text: '#fff' },
    { bg: '#3b82f6', text: '#fff' },
    { bg: '#eab308', text: '#fff' },
    { bg: '#ec4899', text: '#fff' },
    { bg: '#10b981', text: '#fff' },
];

function getProfColor(profId) {
    const profs = DB.get('professionals');
    const idx = profs.findIndex(p => p.id === profId);
    return PROF_COLORS[idx % PROF_COLORS.length] || { bg: '#6b7280', text: '#fff' };
}

function getAppointmentVisual(apt) {
    const profColor = getProfColor(apt.professionalId);

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
                        <span class="cal-legend-chip" style="background:${color.bg}; color:${color.text};">${p.name}</span>
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
        <article class="cal-mobile-card ${apt.isOverbook ? 'is-overbook' : ''}" style="border-left-color:${visual.border}">
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
            <div class="cal-mobile-card-name">${apt.patient}</div>
            <div class="cal-mobile-card-prof">${getProfName(apt.professionalId)}</div>
            <div class="cal-mobile-card-actions">
                ${patient && canViewClinicalHistoryUi() ? `<button class="btn btn-ghost btn-sm" onclick="loadClinicalHistory(${patient.id})">Historia</button>` : ''}
                <button class="btn btn-secondary btn-sm" onclick="openAppointmentViewModal(${apt.id})">Ver</button>
                ${state.user.roles.some(r => ['secretary', 'superadmin', 'admin'].includes(r)) ? `<button class="btn btn-primary btn-sm" onclick="openAppointmentModal(${apt.id})">Editar</button>` : ''}
            </div>
        </article>
    `;
}

function renderAppointmentsCompact(professionals, allApts, currentDate, canEdit) {
    const legendHtml = renderCalendarFilterLegend(professionals);
    const toolbar = renderCalendarToolbar(
        parseLocalIsoDate(currentDate).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
        canEdit
    );

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
                    <header class="cal-mobile-section-header">${prof.name}</header>
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
            return `
                <section class="cal-mobile-section">
                    <header class="cal-mobile-section-header">${day.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}</header>
                    <div class="cal-mobile-list">
                        ${dayApts.length ? dayApts.map(renderAppointmentCompactCard).join('') : '<div class="cal-mobile-empty">Sin turnos.</div>'}
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
                <section class="cal-mobile-section">
                    <header class="cal-mobile-section-header">${parseLocalIsoDate(dateStr).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}</header>
                    <div class="cal-mobile-list">${items.map(renderAppointmentCompactCard).join('')}</div>
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
    const professionals = getAccessibleProfessionals();
    const selectedProfessionalId = ensureSingleCalendarProfessional(professionals);

    const allApts = getAccessibleAppointments();
    const currentDate = calendarState.currentDate;
    const canEdit = state.user.roles.some(r => ['secretary', 'superadmin', 'admin'].includes(r));

    if (isCompactAppointmentsLayout()) {
        return renderAppointmentsCompact(professionals, allApts, currentDate, canEdit);
    }

    // For day view: columns per professional
    if (calendarState.viewMode === 'day') {
        const activeProfessional = professionals.find((p) => p.id === selectedProfessionalId) || professionals[0] || null;
        if (!activeProfessional) {
            return `
                <div class="cal-wrapper">
                    ${renderCalendarToolbar(parseLocalIsoDate(currentDate).toLocaleDateString('es-AR', {weekday:'long', day:'numeric', month:'long', year:'numeric'}), canEdit)}
                    <div class="card p-6 text-center text-gray-500">No hay profesionales disponibles para mostrar esta agenda.</div>
                </div>
            `;
        }

        // Build time labels (left gutter)
        let timeLabelsHtml = '';
        for (let h = CAL_START_HOUR; h <= CAL_END_HOUR; h++) {
            const top = (h - CAL_START_HOUR) * 60 * CAL_PX_PER_MIN;
            timeLabelsHtml += `<div class="cal-hour-label" style="top:${top}px">${String(h).padStart(2,'0')}:00</div>`;
        }

        // Build horizontal hour lines
        let linesHtml = '';
        for (let h = CAL_START_HOUR; h <= CAL_END_HOUR; h++) {
            const top = (h - CAL_START_HOUR) * 60 * CAL_PX_PER_MIN;
            linesHtml += `<div class="cal-h-line" style="top:${top}px"></div>`;
            if (h < CAL_END_HOUR) {
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
                const offsetMin = startMin - CAL_START_HOUR * 60;
                const duration = apt.isOverbook ? 15 : apt.duration;
                const topPx = offsetMin * CAL_PX_PER_MIN;
                const heightPx = Math.max(duration * CAL_PX_PER_MIN, 28);
                const visual = getAppointmentVisual(apt);
                const blockClasses = `cal-apt-block ${apt.isOverbook ? 'cal-apt-overbook' : ''}`;
                const blockStyle = apt.isOverbook
                    ? `background:${visual.bg}; color:${visual.text}; border-left:4px solid ${visual.border}; top:${topPx}px; height:${heightPx}px; cursor:pointer; z-index:20;`
                    : `background:${visual.bg}; color:${visual.text}; border-left:4px solid ${visual.border}; top:${topPx}px; height:${heightPx}px; cursor:pointer;`;

                return `<div class="${blockClasses}" 
                    style="${blockStyle}"
                    onclick="openAppointmentViewModal(${apt.id})">
                    <div class="cal-apt-content">
                        <span class="cal-apt-name">${apt.patient}</span>
                        <span class="cal-apt-meta">${apt.time} - ${duration}min</span>
                        ${apt.isOverbook ? '<span class="cal-apt-tag">Sobreturno</span>' : ''}
                    </div>
                    ${canEdit ? `<div class="cal-apt-actions">
                        ${patient && canViewClinicalHistoryUi() ? `<button class="cal-apt-btn btn-view-history-inline" data-id="${patient.id}" title="Historia clinica" onclick="event.stopPropagation(); loadClinicalHistory(${patient.id})"><i class="fa-solid fa-notes-medical"></i></button>` : ''}
                        <button class="cal-apt-btn btn-edit-apt" data-id="${apt.id}" title="Editar"><i class="fa-solid fa-pen"></i></button>
                        <button class="cal-apt-btn btn-delete-apt" data-id="${apt.id}" title="Cancelar"><i class="fa-solid fa-times"></i></button>
                    </div>` : `${patient && canViewClinicalHistoryUi() ? `<div class="cal-apt-actions cal-apt-actions-readonly">
                        <button class="cal-apt-btn btn-view-history-inline" data-id="${patient.id}" title="Historia clinica" onclick="event.stopPropagation(); loadClinicalHistory(${patient.id})"><i class="fa-solid fa-notes-medical"></i></button>
                    </div>` : ''}`}
                </div>`;
            }).join('');

            profCols += `
            <div class="cal-prof-col">
                <div class="cal-prof-header">
                    <span class="cal-prof-name">${p.name}</span>
                </div>
                <div class="cal-prof-body" style="height:${CAL_TOTAL_HEIGHT}px; position:relative;">
                    ${linesHtml}
                    ${aptBlocks}
                </div>
            </div>`;
        });

        // Sidebar legend
        const legendHtml = renderCalendarFilterLegend(professionals, { horizontal: true, compact: true });

        return `
        <div class="cal-wrapper">
            ${renderCalendarToolbar(parseLocalIsoDate(currentDate).toLocaleDateString('es-AR', {weekday:'long', day:'numeric', month:'long', year:'numeric'}), canEdit)}
            ${legendHtml}
            <div class="cal-scroll-wrap cal-scroll-wrap-day">
                <div class="cal-grid-day">
                    <!-- Gutter -->
                    <div class="cal-gutter-col">
                        <div class="cal-gutter-header"></div>
                        <div class="cal-gutter-body" style="height:${CAL_TOTAL_HEIGHT}px; position:relative;">
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

        let dayCols = '';
        days.forEach(d => {
            const iso = formatDateToLocalIso(d);
            const isToday = iso === getTodayIsoLocal();
            const dayName = ['Dom', 'Lun', 'Mar', 'MiÃ©', 'Jue', 'Vie', 'SÃ¡b'][d.getDay()];
            const dayNum = d.getDate();

            const dayApts = allApts.filter(a => a.date === iso && calendarState.visibleProfs[a.professionalId]);
            const countLabel = formatAppointmentCountLabel(dayApts.length);

            const summaryCard = dayApts.length
                ? `<button type="button" class="cal-day-summary-card" data-calendar-date="${iso}" style="background:${selectedProfessionalColor.bg}; color:${selectedProfessionalColor.text}; border-color:${selectedProfessionalColor.bg};">
                        <span class="cal-day-summary-label">${countLabel}</span>
                   </button>`
                : '<div class="cal-day-summary-empty">Sin turnos</div>';

            dayCols += `
            <div class="cal-day-col">
                <button type="button" class="cal-day-header ${isToday ? 'cal-today-header' : ''}" data-calendar-date="${iso}">
                    <span class="cal-day-name">${dayName}</span>
                    <span class="cal-day-number ${isToday ? 'cal-today-badge' : ''}">${dayNum}</span>
                </button>
                <div class="cal-day-body" style="height:600px; padding:0.9rem 0.5rem 0.5rem; overflow-y:auto;">
                    ${summaryCard}
                </div>
            </div>`;
        });

        const legendHtml = renderCalendarFilterLegend(professionals, { horizontal: true, compact: true });

        return `
        <div class="cal-wrapper">
            ${renderCalendarToolbar(`${days[0].toLocaleDateString('es-AR',{day:'numeric',month:'short'})} â€“ ${days[6].toLocaleDateString('es-AR',{day:'numeric',month:'short',year:'numeric'})}`, canEdit)}

            <div class="cal-month-layout">
                ${legendHtml}
                <div class="cal-scroll-wrap">
                    <div class="cal-grid-v2">
                        ${dayCols}
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

            if (dayNum > 0 && dayNum <= daysInMonth) {
                isCurrentMonth = true;
                cellDate = new Date(year, month, dayNum);
                const iso = formatDateToLocalIso(cellDate);
                const isToday = iso === getTodayIsoLocal();
                let dayApts = allApts.filter(a => a.date === iso && calendarState.visibleProfs[a.professionalId]);
                dayApts = dayApts.sort((a,b)=>a.time.localeCompare(b.time));
                const countLabel = formatAppointmentCountLabel(dayApts.length);

                const summaryContent = dayApts.length
                    ? `<button type="button" class="cal-month-summary-card" data-calendar-date="${iso}" style="background:${selectedProfessionalColor.bg}; color:${selectedProfessionalColor.text}; border-color:${selectedProfessionalColor.bg};">
                            <span class="cal-month-summary-label">${countLabel}</span>
                       </button>`
                    : '<div class="cal-month-dayempty">Sin turnos</div>';

                content = `
                    <button type="button" class="cal-month-dayhead ${isToday ? 'is-today' : ''}" data-calendar-date="${iso}">
                        <span class="cal-month-daynum">${dayNum}</span>
                    </button>
                    <div class="cal-month-daybody">
                        ${summaryContent}
                    </div>
                `;
            }

            cells += `<div class="cal-month-cell ${isCurrentMonth ? '' : 'is-outside-month'}">${content}</div>`;
        }

        const monthName = date.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });

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
                            <div class="cal-month-weekday">MiÃ©</div>
                            <div class="cal-month-weekday">Jue</div>
                            <div class="cal-month-weekday">Vie</div>
                            <div class="cal-month-weekday">SÃ¡b</div>
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
        <div class="table-container table-container-schedules shadow-sm">
            <table class="w-full text-left table-agenda-professionals">
                <thead><tr><th>Profesional</th><th class="table-actions-head">Acciones</th></tr></thead>
                <tbody>
                    ${profs.map(p => `
                        <tr>
                            <td class="font-medium table-prof-name-cell" data-label="Profesional">
                                <div class="w-8 h-8 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-bold text-xs"><i class="fa-solid fa-user-md"></i></div>
                                ${p.name}
                            </td>
                            <td data-label="Acciones" class="table-actions-cell">
                                ${canAccessProfessional(p.id) ? `
                                <button class="btn btn-secondary btn-sm btn-edit-schedule btn-schedule-mobile" data-id="${p.id}" aria-label="Configurar horarios de ${p.name}" title="Configurar horarios de ${p.name}"><i class="fa-solid fa-clock"></i><span class="btn-label">Configurar Horarios por Día</span></button>
                                ` : ''}
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
        <div class="schedules-hint mt-4 text-sm text-gray-500 ml-2"><i class="fa-solid fa-info-circle mr-1 text-primary-500"></i> Los turnos solo se podrán asignar según el horario activo configurado para cada día de la semana.</div>
    `;
}

function renderPatients() {
    const patients = getAccessiblePatients().sort((a,b)=>a.name.localeCompare(b.name));
    return `
        <div class="card mb-6 section-hero-card section-hero-inline">
            <div class="section-hero-copy">
                <span class="section-eyebrow">Pacientes</span>
                <h3 class="section-title">Registro de Pacientes</h3>
                <p class="section-subtitle">Visualiza, edita y administra los datos base de cada paciente.</p>
            </div>
            ${state.user.roles.some(r => ['superadmin', 'secretary', 'admin'].includes(r)) ? 
            '<button class="btn btn-primary" id="btn-add-patient"><i class="fa-solid fa-user-plus"></i> Nuevo Paciente</button>' : ''}
        </div>
        <div class="patient-search-shell mb-4">
            <input type="search" id="search-patient" placeholder="Buscar pacientes por nombre o DNI..." class="form-input w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 text-sm">
        </div>
        <div class="table-container table-container-patients shadow-sm">
            <table class="w-full text-left" id="patients-table">
                <thead><tr><th>Paciente</th><th>Contacto</th><th>DNI</th><th>Notas MÃ©dicas</th><th>Acciones</th></tr></thead>
                <tbody>
                    ${patients.map(p => `
                        <tr>
                            <td class="font-medium flex items-center gap-3" data-label="Paciente">
                                <div class="w-8 h-8 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-bold text-xs">${p.name.substring(0,2).toUpperCase()}</div>
                                ${p.name}
                            </td>
                            <td data-label="Contacto">
                                <span class="block text-sm text-gray-600"><i class="fa-solid fa-phone mr-1"></i> ${p.phone}</span>
                                <span class="block text-xs text-gray-400"><i class="fa-solid fa-envelope mr-1"></i> ${p.email || 'Sin email'}</span>
                            </td>
                            <td class="text-sm font-semibold" data-label="DNI">${p.dni}</td>
                            <td class="text-xs text-gray-600" data-label="Notas MÃ©dicas">${p.notes || '-'}</td>
                            <td data-label="Acciones" class="table-actions-cell">
                                <div class="flex gap-2 patient-actions">
                                ${state.user.roles.some(r => ['superadmin', 'secretary'].includes(r)) ? `
                                    ${canViewClinicalHistoryUi() ? `<button class="btn btn-ghost p-1 btn-view-history" data-id="${p.id}" title="Historia ClÃ­nica"><i class="fa-solid fa-file-medical text-purple-600"></i></button>` : ''}
                                    <button class="btn btn-ghost p-1 btn-edit-patient" data-id="${p.id}"><i class="fa-solid fa-pen text-primary-600"></i></button>
                                    ${isSuperadmin() ? `<button class="btn btn-ghost p-1 btn-delete-patient" data-id="${p.id}"><i class="fa-solid fa-trash text-danger"></i></button>` : ''}
                                ` : `${canViewClinicalHistoryUi() ? '<button class="btn btn-secondary btn-sm btn-view-history" data-id="'+p.id+'"><i class="fa-solid fa-eye"></i> Historia</button>' : ''}`}
                                ${canManagePatientBillingUi() ? `<button class="btn btn-ghost p-1 btn-view-patient-billing" data-id="${p.id}" title="Cuenta Corriente"><i class="fa-solid fa-wallet text-emerald-600"></i></button>` : ''}
                                </div>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

function renderBilling() {
    const txs = DB.get('billing').filter(t => canAccessProfessional(t.professionalId));
    const patients = getAccessiblePatients().sort((a,b)=>a.name.localeCompare(b.name));
    const professionals = getAccessibleProfessionals();
    const today = getTodayIsoLocal();
    const billingSections = [
        { id: 'movements', label: 'Últimos movimientos', icon: 'fa-clock-rotate-left', description: 'Movimientos diarios y registro reciente.' },
        { id: 'accounts', label: 'Cuentas corrientes por paciente', icon: 'fa-wallet', description: 'Saldo individual de cada paciente por profesional.' }
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
    const selectedPatientTransactionsByProfessional = selectedPatientId
        ? selectedAccount.byProfessional.map((item) => {
            const movements = filteredTxs
                .filter((entry) => entry.professionalId === item.professionalId)
                .sort((a, b) => {
                    const dateCompare = coerceAppointmentDate(b.date).localeCompare(coerceAppointmentDate(a.date));
                    return dateCompare || (b.id - a.id);
                });
            return {
                ...item,
                movementCount: movements.length,
                lastMovementDate: movements[0]?.date || null,
                movements
            };
        })
        : [];
    
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
                    <button class="btn btn-secondary" id="btn-clear-patient-billing"><i class="fa-solid fa-arrow-left"></i> Volver a la vista general</button>
                </div>
            </div>
            <div class="mt-4 text-sm text-gray-500">
                La cuenta corriente se muestra separada por profesional. Un mismo paciente puede deber, estar al día o tener saldo a favor según cada profesional.
            </div>
            <div class="billing-patient-professional-details mt-4">
                ${selectedPatientTransactionsByProfessional.map((item) => `
                    <article class="billing-patient-professional-card">
                        <div class="billing-patient-professional-card-top">
                            <div>
                                <h4>${item.professionalName}</h4>
                                <p>${item.movementCount} movimiento${item.movementCount === 1 ? '' : 's'}${item.lastMovementDate ? ` · Último registro ${item.lastMovementDate}` : ''}</p>
                            </div>
                            <div>
                                ${item.balance > 0
                                    ? `<span class="badge badge-warning text-xs">Debe $${item.balance.toLocaleString()}</span>`
                                    : item.balance < 0
                                        ? `<span class="badge badge-success text-xs">A favor $${Math.abs(item.balance).toLocaleString()}</span>`
                                        : `<span class="badge badge-gray text-xs">Al día</span>`}
                            </div>
                        </div>
                        <div class="billing-patient-professional-metrics">
                            <div><span>Cargos</span><strong>$${item.deuda.toLocaleString()}</strong></div>
                            <div><span>Pagos / Ingresos</span><strong>$${item.pagado.toLocaleString()}</strong></div>
                            <div><span>Saldo actual</span><strong>${item.balance > 0 ? `-$${item.balance.toLocaleString()}` : item.balance < 0 ? `+$${Math.abs(item.balance).toLocaleString()}` : '$0'}</strong></div>
                        </div>
                    </article>
                `).join('')}
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
        </div>
    ` : '';

    const movementsContent = `
        <div class="metrics-grid">
            <div class="card metric-card">
                <div class="metric-icon metric-green"><i class="fa-solid fa-arrow-trend-up"></i></div>
                <div class="metric-info">
                    <h3>${selectedAccount?.patient ? 'Recaudado Hoy del Paciente' : 'Total Recaudado Hoy'}</h3>
                    <p>$${ingresos.toLocaleString()}</p>
                </div>
            </div>
            <div class="card metric-card">
                <div class="metric-icon metric-red"><i class="fa-solid fa-arrow-trend-down"></i></div>
                <div class="metric-info">
                    <h3>${selectedAccount?.patient ? 'Cargos de Hoy del Paciente' : 'Cargos Emitidos Hoy'}</h3>
                    <p>$${deudas.toLocaleString()}</p>
                </div>
            </div>
        </div>
        
        <div class="card mb-4 mt-6 section-hero-card section-hero-inline section-hero-compact">
            <div class="section-hero-copy">
                <span class="section-eyebrow">Movimientos</span>
                <h3 class="section-title section-title-sm">${selectedAccount?.patient ? `Movimientos de ${selectedAccount.patient.name}` : 'Últimos Movimientos'}</h3>
                <p class="section-subtitle">${selectedAccount?.patient ? 'Historial completo de cargos, pagos e ingresos del paciente, detallado por profesional.' : 'Movimientos del día y últimos registros de cuenta corriente cargados en el sistema.'}</p>
            </div>
            ${state.user.roles.some(r => ['admin', 'superadmin'].includes(r)) ? 
            '<button class="btn btn-primary" id="btn-add-tx"><i class="fa-solid fa-plus"></i> Registrar Movimiento</button>' : ''}
        </div>
        
        <div class="table-container shadow-sm">
            <table class="w-full text-left">
                <thead><tr><th>Fecha</th>${selectedAccount?.patient ? '' : '<th>Paciente</th>'}<th>Profesional</th><th>Tipo</th><th>Concepto</th><th>Detalle</th><th>Monto</th><th>Acción</th></tr></thead>
                <tbody>
                    ${filteredTxs.sort((a,b)=>b.id - a.id).map(t => {
                        const pName = patients.find(p=>p.id === t.patientId)?.name || 'Desconocido';
                        const professionalName = professionals.find(p=>p.id === t.professionalId)?.name || 'Sin profesional';
                        const isPositiveMovement = ['income', 'payment'].includes(t.type);
                        const typeLabel = t.type === 'debt'
                            ? 'Cargo / Deuda'
                            : t.type === 'payment'
                                ? 'Pago'
                                : 'Ingreso';
                        return `
                        <tr>
                            <td class="text-sm text-gray-500">${t.date}</td>
                            ${selectedAccount?.patient ? '' : `<td class="font-medium">${pName}</td>`}
                            <td class="text-sm text-gray-600">${professionalName}</td>
                            <td><span class="badge ${isPositiveMovement ? 'badge-success' : 'badge-warning'}">${typeLabel}</span></td>
                            <td class="text-gray-700">${t.description || 'Sin descripción'}</td>
                            <td class="text-sm text-gray-500">
                                ${t.type === 'debt'
                                    ? 'Cargo generado a la cuenta corriente'
                                    : t.type === 'payment'
                                        ? 'Pago imputado a la deuda del paciente'
                                        : 'Ingreso acreditado a favor del profesional'}
                            </td>
                            <td class="font-bold ${isPositiveMovement ? 'text-success' : 'text-warning'}">$${t.amount.toLocaleString()}</td>
                            <td>
                                ${state.user.roles.some(r => ['superadmin', 'admin'].includes(r)) ? 
                                `<button class="btn btn-ghost text-danger p-1 btn-delete-tx" data-id="${t.id}"><i class="fa-solid fa-trash"></i></button>` : ''}
                            </td>
                        </tr>
                        `;
                    }).join('')}
                    ${filteredTxs.length===0?`<tr><td colspan="${selectedAccount?.patient ? '7' : '8'}" class="text-center py-6 text-gray-500">${selectedAccount?.patient ? 'Este paciente todavía no tiene movimientos registrados.' : 'No hay transacciones registradas'}</td></tr>`:''}
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
                ${canManagePatientBillingUi() ? `
                <div class="flex gap-2 flex-wrap">
                    <button class="btn btn-secondary" id="btn-open-patient-billing"><i class="fa-solid fa-wallet"></i> Buscar paciente</button>
                </div>
                ` : ''}
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
    const todaysOpenApts = todaysApts.filter(apt => {
        if (!isBlockingAppointmentStatus(apt.status)) return false;
        const [hours, minutes] = apt.time.split(':').map(Number);
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0, 0);
        const duration = apt.isOverbook ? 15 : (apt.duration || 0);
        const end = new Date(start.getTime() + duration * 60000);
        return end > now;
    });
    const currentRunningApts = todaysApts.filter(apt => {
        if (!isBlockingAppointmentStatus(apt.status)) return false;
        const [hours, minutes] = apt.time.split(':').map(Number);
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0, 0);
        const duration = apt.isOverbook ? 15 : (apt.duration || 0);
        const end = new Date(start.getTime() + duration * 60000);
        return start <= now && end > now;
    });
    const patientsTodayCount = new Set(todaysOpenApts.map(apt => apt.patient)).size;
    const activeTurnsCount = currentRunningApts.length;
    const activeOverbooksCount = currentRunningApts.filter(apt => apt.isOverbook).length;
    const selectedLabel = formatDashboardDateLabel(selectedDate);
    const selectedTitle = selectedDate === getTodayIsoLocal() ? 'Turnos de Hoy' : 'Turnos Programados';
    const canManageStatus = canManageAppointmentStatusUi();
    const canUseWhatsapp = canSendAppointmentWhatsappUi();

    return `
        <div class="metrics-grid">
            <div class="card metric-card">
                <div class="metric-icon metric-blue"><i class="fa-solid fa-users"></i></div>
                <div class="metric-info"><h3>Pacientes de Hoy</h3><p>${patientsTodayCount}</p></div>
            </div>
            <div class="card metric-card">
                <div class="metric-icon metric-green"><i class="fa-solid fa-calendar-check"></i></div>
                <div class="metric-info"><h3>Turnos Activos</h3><p>${activeTurnsCount}</p></div>
            </div>
            <div class="card metric-card">
                <div class="metric-icon metric-purple"><i class="fa-solid fa-bolt" style="color:var(--purple)"></i></div>
                <div class="metric-info"><h3>Sobreturnos</h3><p>${activeOverbooksCount}</p></div>
            </div>
        </div>

        <div class="table-container shadow-sm mt-6 border border-gray-200">
            <div class="table-header">
                <div>
                    <h3>${selectedTitle}</h3>
                    <p class="dashboard-date-label">${selectedLabel}</p>
                </div>
                <div class="dashboard-date-filter-wrap">
                    <label for="dashboard-date-filter" class="dashboard-date-filter-label">Fecha</label>
                    <input type="date" id="dashboard-date-filter" class="dashboard-date-filter" value="${selectedDate}">
                </div>
            </div>
            <div class="overflow-x-auto">
                <table class="w-full text-left">
                    <thead><tr><th>Hora</th><th>Paciente</th><th>Profesional</th><th>Confirmacion</th><th>Whatsapp</th></tr></thead>
                    <tbody>
                        ${selectedDateApts.map(apt => {
                            const patient = getPatientByAppointment(apt);
                            const whatsappLink = getWhatsAppLink(patient, apt);
                            const statusMeta = getAppointmentStatusMeta(apt.status);
                            return `
                                <tr class="${apt.isOverbook ? 'tr-sobreturno' : ''}">
                                    <td><span class="font-semibold">${apt.time}</span> <span class="text-xs text-gray-500">(${apt.duration}m)</span></td>
                                    <td>${apt.patient} ${apt.isOverbook ? '<span class="badge badge-purple text-xs ml-2">Sobreturno</span>' : ''}</td>
                                    <td>${getProfName(apt.professionalId)}</td>
                                    <td>
                                        ${canManageStatus ? `
                                            <select class="dashboard-status-select ${statusMeta.badge}" onchange="updateAppointmentStatus(${apt.id}, this.value)">
                                                <option value="not_sent" ${statusMeta.key === 'not_sent' ? 'selected' : ''}>Sin enviar</option>
                                                <option value="sent" ${statusMeta.key === 'sent' ? 'selected' : ''}>Enviado</option>
                                                <option value="confirmed" ${statusMeta.key === 'confirmed' ? 'selected' : ''}>Confirmado</option>
                                                <option value="rescheduled" ${statusMeta.key === 'rescheduled' ? 'selected' : ''}>Reprogramado</option>
                                                <option value="cancelled" ${statusMeta.key === 'cancelled' ? 'selected' : ''}>Cancelado</option>
                                            </select>
                                        ` : `<span class="badge ${statusMeta.badge}">${statusMeta.label}</span>`}
                                    </td>
                                    <td>${canUseWhatsapp ? (whatsappLink ? `<a class="btn btn-secondary btn-sm dashboard-wa-btn" href="${whatsappLink}" target="_blank" rel="noopener noreferrer" onclick="markAppointmentAsSent(${apt.id})"><i class="fa-brands fa-whatsapp"></i> Enviar</a>` : '<span class="text-xs text-gray-400">Sin telefono</span>') : '<span class="text-xs text-gray-400">Sin acceso</span>'}</td>
                                </tr>
                            `;
                        }).join('')}
                        ${selectedDateApts.length === 0 ? '<tr><td colspan="5" class="text-center py-6 text-gray-500">No hay turnos para la fecha seleccionada.</td></tr>' : ''}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

function renderSettingsSubpages() {
    const users = DB.get('users');
    const profs = DB.get('professionals');
    const isSuper = state.user.roles.includes('superadmin');
    const canManageSettings = state.user.roles.some(role => ['superadmin', 'admin'].includes(role));

    if (!canManageSettings) {
        return `
            <div class="settings-card">
                <h3>Acceso denegado</h3>
                <p>Solo los usuarios con rol superadmin o admin pueden gestionar la configuraciÃƒÂ³n.</p>
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
                <td class="table-name"><strong>${u.name || 'Sin nombre'}</strong><br><span class="subtle">${u.email || '-'}</span></td>
                <td>${u.type || '-'}</td>
                <td>${roles}</td>
                <td>${profNames}</td>
                <td class="text-center">${isSuper ? `<button class="btn btn-ghost btn-sm" onclick="deleteUser(${u.id})"><i class="fa-solid fa-trash text-danger"></i></button>` : '<span class="text-xs text-gray-400">Solo lectura</span>'}</td>
            </tr>`;
    }).join('');

    const profesionalRows = profs.map(p => {
        const statusLabel = p.status === 'activo'
            ? `<span class="badge badge-success">Activo</span>`
            : `<span class="badge badge-gray">Inactivo</span>`;
        return `
            <tr class="hover-row">
                <td class="table-name">${p.name}</td>
                <td>${p.lastName || '-'}</td>
                <td>${p.specialty || '-'}</td>
                <td>${p.phone || '-'}</td>
                <td>${p.email || '-'}</td>
                <td>${statusLabel}</td>
                <td class="text-center"><button class="btn btn-secondary btn-sm" onclick="viewProfessionalCalendar(${p.id})">Ver Calendario</button></td>
            </tr>`;
    }).join('');

    const settingsSections = [
        ...(canManageSettings ? [{ id: 'create-user', label: 'Crear usuario', icon: 'fa-user-plus', description: 'Alta de nuevos usuarios y permisos.' }] : []),
        { id: 'create-professional', label: 'Crear profesional', icon: 'fa-user-doctor', description: 'Registro de profesionales y datos base.' },
        ...(canManageSettings ? [{ id: 'users-list', label: 'Usuarios existentes', icon: 'fa-users-gear', description: 'Listado de usuarios y accesos asignados.' }] : []),
        { id: 'professionals-list', label: 'Profesionales existentes', icon: 'fa-address-card', description: 'Vista de profesionales y acceso al calendario.' }
    ];

    const activeSection = settingsSections.some(section => section.id === state.settingsSubView)
        ? state.settingsSubView
        : (settingsSections[0]?.id || 'create-professional');
    state.settingsSubView = activeSection;

    const settingsContent = {
        'create-user': canManageSettings ? `
            <section class="settings-card settings-panel-card">
                <header>
                    <div>
                        <h3>Crear Nuevo Usuario</h3>
                        <p class="subtext">Campos obligatorios: Nombre completo, Email, Contraseña y Tipo de usuario.</p>
                    </div>
                </header>
                <form id="new-user-form" class="settings-form-row columns-1">
                    <div class="input-group"><label>Nombre completo *</label><input type="text" id="u-name" required></div>
                    <div class="input-group"><label>Email *</label><input type="email" id="u-email" required></div>
                    <div class="input-group"><label>Contraseña *</label><input type="password" id="u-password" minlength="6" required></div>
                    <div class="input-group"><label>Tipo de usuario *</label><select id="u-type" required><option value="">Seleccionar...</option><option value="administrador">Administrador</option><option value="secretario">Secretario</option><option value="profesional">Profesional</option></select></div>

                    <div class="settings-subsection">
                        <h4>Roles de Permisos</h4>
                        <p class="subtext">Selecciona uno o varios roles.</p>
                        <div class="settings-list settings-list-static">
                            <div class="checkbox-group"><input type="checkbox" name="u-role" value="administrador"><label>Administrador</label></div>
                            <div class="checkbox-group"><input type="checkbox" name="u-role" value="secretario"><label>Secretario</label></div>
                            <div class="checkbox-group"><input type="checkbox" name="u-role" value="profesional"><label>Profesional</label></div>
                            ${isSuper ? '<div class="checkbox-group"><input type="checkbox" name="u-role" value="superadmin"><label>Superadmin</label></div>' : ''}
                        </div>
                    </div>

                    <div class="settings-subsection">
                        <h4>Asignar Profesionales (opcional)</h4>
                        <p class="subtext">Se puede dejar vacÃƒÂ­o; acceso completo si no se selecciona ninguno.</p>
                        <div class="settings-list settings-list-static">
                            ${profs.map(p => `<div class="checkbox-group"><input type="checkbox" name="u-profs" value="${p.id}"><label>${p.name}</label></div>`).join('')}
                        </div>
                    </div>
                    <button type="submit" class="btn btn-primary">Guardar Usuario</button>
                </form>
            </section>
        ` : '',
        'create-professional': `
            <section class="settings-card settings-panel-card">
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
                    <div class="input-group"><label>TelÃƒÂ©fono</label><input type="text" id="p-phone"></div>
                    <div class="input-group"><label>Email</label><input type="email" id="p-email"></div>
                    <div class="input-group"><label>Estado</label><select id="p-status"><option value="activo">Activo</option><option value="inactivo">Inactivo</option></select></div>
                    <button type="submit" class="btn btn-primary">Guardar Profesional</button>
                </form>
            </section>
        `,
        'users-list': canManageSettings ? `
            <section class="settings-card settings-panel-card">
                <header><h3>Usuarios Existentes</h3></header>
                <div class="table-container overflow-x-auto">
                    <table class="table-modern table-compact">
                        <thead>
                            <tr>
                                <th>Nombre / Email</th>
                                <th>Tipo</th>
                                <th>Roles</th>
                                <th>Profesionales</th>
                                <th>AcciÃƒÂ³n</th>
                            </tr>
                        </thead>
                        <tbody>${userRows || `<tr><td colspan="5" class="text-gray-500">No hay usuarios registrados</td></tr>`}</tbody>
                    </table>
                </div>
            </section>
        ` : '',
        'professionals-list': `
            <section class="settings-card settings-panel-card">
                <header><h3>Profesionales Existentes</h3></header>
                <div class="table-container overflow-x-auto">
                    <table class="table-modern table-compact">
                        <thead>
                            <tr>
                                <th>Nombre</th>
                                <th>Apellido</th>
                                <th>Especialidad</th>
                                <th>TelÃƒÂ©fono</th>
                                <th>Email</th>
                                <th>Estado</th>
                                <th>AcciÃƒÂ³n</th>
                            </tr>
                        </thead>
                        <tbody>${profesionalRows || `<tr><td colspan="7" class="text-gray-500">No hay profesionales registrados</td></tr>`}</tbody>
                    </table>
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
    const canManageSettings = state.user.roles.some(role => ['superadmin', 'admin'].includes(role));

    if (!canManageSettings) {
        return `
            <div class="settings-card">
                <h3>Acceso denegado</h3>
                <p>Solo los usuarios con rol superadmin o admin pueden gestionar la configuraciÃ³n.</p>
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
                <td class="table-name"><strong>${u.name || 'Sin nombre'}</strong><br><span class="subtle">${u.email || '-'}</span></td>
                <td>${u.type || '-'}</td>
                <td>${roles}</td>
                <td>${profNames}</td>
                <td class="text-center">${isSuper ? `<button class="btn btn-ghost btn-sm" onclick="deleteUser(${u.id})"><i class="fa-solid fa-trash text-danger"></i></button>` : '<span class="text-xs text-gray-400">Solo lectura</span>'}</td>
            </tr>`;
    }).join('');

    const profesionalRows = profs.map(p => {
        const statusLabel = p.status === 'activo'
            ? `<span class="badge badge-success">Activo</span>`
            : `<span class="badge badge-gray">Inactivo</span>`;
        return `
            <tr class="hover-row">
                <td class="table-name">${p.name}</td>
                <td>${p.lastName || '-'}</td>
                <td>${p.specialty || '-'}</td>
                <td>${p.phone || '-'}</td>
                <td>${p.email || '-'}</td>
                <td>${statusLabel}</td>
                <td class="text-center"><button class="btn btn-secondary btn-sm" onclick="viewProfessionalCalendar(${p.id})">Ver Calendario</button></td>
            </tr>`;
    }).join('');

    return `
    <div class="settings-area">
        <div class="settings-top-grid">
            <section class="settings-card">
                <header>
                    <div>
                        <h3>Crear Nuevo Usuario</h3>
                        <p class="subtext">Campos obligatorios: Nombre completo, Email, Contraseña y Tipo de usuario.</p>
                    </div>
                </header>
                <form id="new-user-form" class="settings-form-row columns-1">
                    <div class="input-group"><label>Nombre completo *</label><input type="text" id="u-name" required></div>
                    <div class="input-group"><label>Email *</label><input type="email" id="u-email" required></div>
                    <div class="input-group"><label>Contraseña *</label><input type="password" id="u-password" minlength="6" required></div>
                    <div class="input-group"><label>Tipo de usuario *</label><select id="u-type" required><option value="">Seleccionar...</option><option value="administrador">Administrador</option><option value="secretario">Secretario</option><option value="profesional">Profesional</option></select></div>

                    <div class="settings-subsection">
                        <h4>Roles de Permisos</h4>
                        <p class="subtext">Selecciona uno o varios roles.</p>
                        <div class="checkbox-group"><input type="checkbox" name="u-role" value="administrador"><label>Administrador</label></div>
                        <div class="checkbox-group"><input type="checkbox" name="u-role" value="secretario"><label>Secretario</label></div>
                        <div class="checkbox-group"><input type="checkbox" name="u-role" value="profesional"><label>Profesional</label></div>
                        ${isSuper ? '<div class="checkbox-group"><input type="checkbox" name="u-role" value="superadmin"><label>Superadmin</label></div>' : ''}
                    </div>

                    <div class="settings-subsection">
                        <h4>Asignar Profesionales (opcional)</h4>
                        <p class="subtext">Se puede dejar vacÃ­o; acceso completo si no se selecciona ninguno.</p>
                        <div class="settings-list settings-list-static">
                            ${profs.map(p => `<div class="checkbox-group"><input type="checkbox" name="u-profs" value="${p.id}"><label>${p.name}</label></div>`).join('')}
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
                    <div class="input-group"><label>TelÃ©fono</label><input type="text" id="p-phone"></div>
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
                                <th>AcciÃ³n</th>
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
                                <th>TelÃ©fono</th>
                                <th>Email</th>
                                <th>Estado</th>
                                <th>AcciÃ³n</th>
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
    pageTitle.innerText = 'Ficha OdontolÃ³gica';
    mainContent.innerHTML = '<div class="card p-6 text-center text-gray-500">Cargando historia clínica...</div>';
    
    try {
        if (!options.skipSync) {
            await syncPatientClinicalData(patientId);
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
                <div class="clinical-static-value">${age} aÃ±os</div>
            </div>
            <div class="clinical-info-item clinical-info-item-compact">
                <strong class="text-gray-600 uppercase text-xs">Telefono</strong>
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
                <strong class="text-gray-600 uppercase text-xs">Ficha NÂ°</strong>
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
let odontogramTool = { color: 'rojo', treatment: null };

function drawTeethRow(teethArray, patientOdontograma) {
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
        let extraOverlay = '';

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
                ${baseFaces(false)}
                <rect x="36" y="18" width="28" height="64" rx="14" fill="${ic}" stroke="white" stroke-width="2"/>
                <line x1="50" y1="26" x2="50" y2="74" stroke="white" stroke-width="2.5" stroke-dasharray="4,4"/>
                <rect x="0" y="0" width="100" height="100" class="tooth-face cursor-pointer" data-tooth="${id}" data-face="center" fill="transparent" stroke="none"/>
            `;
        } else if(estado === 'corona') {
            const cc = tColor === 'azul' ? '#2563eb' : '#dc2626';
            facesHtml = `
                <rect x="2" y="2" width="96" height="96" fill="${BG}" stroke="${S}" stroke-width="2.5"/>
                ${baseFaces(false)}
                <rect x="22" y="55" width="56" height="22" rx="4" fill="${cc}" stroke="white" stroke-width="1.5"/>
                <polygon points="22,55 36,30 50,45 64,30 78,55" fill="${cc}" stroke="white" stroke-width="1.5"/>
                <rect x="0" y="0" width="100" height="100" class="tooth-face cursor-pointer" data-tooth="${id}" data-face="center" fill="transparent" stroke="none"/>
            `;
        } else if(estado === 'endodoncia') {
            const ec = tColor === 'azul' ? '#2563eb' : '#dc2626';
            facesHtml = `
                <rect x="2" y="2" width="96" height="96" fill="${BG}" stroke="${S}" stroke-width="2.5"/>
                ${baseFaces(false)}
                <circle cx="50" cy="50" r="24" fill="${ec}" stroke="${S}" stroke-width="2"/>
                <line x1="50" y1="26" x2="50" y2="74" stroke="white" stroke-width="3"/>
                <line x1="38" y1="34" x2="62" y2="34" stroke="white" stroke-width="2.5"/>
                <line x1="35" y1="50" x2="65" y2="50" stroke="white" stroke-width="2.5"/>
                <line x1="38" y1="66" x2="62" y2="66" stroke="white" stroke-width="2.5"/>
                <rect x="0" y="0" width="100" height="100" class="tooth-face cursor-pointer" data-tooth="${id}" data-face="center" fill="transparent" stroke="none"/>
            `;
        } else if(estado === 'ortodoncia') {
            const oc = tColor === 'azul' ? '#2563eb' : '#dc2626';
            facesHtml = `
                <rect x="2" y="2" width="96" height="96" fill="${BG}" stroke="${S}" stroke-width="2.5"/>
                ${baseFaces(false)}
                <rect x="30" y="42" width="40" height="16" rx="3" fill="${oc}" stroke="white" stroke-width="1.5"/>
                <line x1="2" y1="50" x2="98" y2="50" stroke="${oc}" stroke-width="4"/>
                <rect x="0" y="0" width="100" height="100" class="tooth-face cursor-pointer" data-tooth="${id}" data-face="center" fill="transparent" stroke="none"/>
            `;
        } else if(estado === 'sello') {
            const sc = tColor === 'azul' ? '#2563eb' : '#dc2626';
            facesHtml = `
                <rect x="2" y="2" width="96" height="96" fill="${BG}" stroke="${S}" stroke-width="2.5"/>
                ${baseFaces(false)}
                <circle cx="50" cy="50" r="18" fill="${sc}" opacity="0.85" stroke="white" stroke-width="2"/>
                <circle cx="50" cy="50" r="10" fill="white" opacity="0.5"/>
                <rect x="0" y="0" width="100" height="100" class="tooth-face cursor-pointer" data-tooth="${id}" data-face="center" fill="transparent" stroke="none"/>
            `;
        } else {
            facesHtml = `
                <rect x="2" y="2" width="96" height="96" fill="${BG}" stroke="${S}" stroke-width="2.5"/>
                ${baseFaces(true)}
            `;
        }

        return `
        <div class="flex flex-col items-center tooth-box" data-tooth="${id}">
            <span class="text-[9px] md:text-[11px] font-bold text-gray-600 w-full text-center leading-tight">${id}</span>
            <div class="relative" style="width:48px;height:48px;">
                <svg viewBox="0 0 100 100" class="w-full h-full" style="filter:drop-shadow(0 1px 2px rgba(0,0,0,.12));">
                    ${facesHtml}
                </svg>
            </div>
        </div>
        `;
    }).join('');
}

function renderClinicalHistory(patientId) {
    const patient = getClinicalWorkingPatient(patientId);
    if(!patient) return '<p>Paciente no encontrado</p>';
    const clinicalImages = (patient.clinicalImages || []).slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    const canEditClinical = canEditClinicalHistoryUi();
    const draft = getClinicalDraft(patientId);

    let age = '-';
    if(patient.fechaNacimiento) {
        const diff = Date.now() - new Date(patient.fechaNacimiento).getTime();
        age = Math.abs(new Date(diff).getUTCFullYear() - 1970);
    }

    return `
    <div class="clinical-history-card bg-white rounded-xl max-w-5xl mx-auto overflow-hidden" style="font-family: Arial, sans-serif;">
        <!-- Cabecera estilo Recetario -->
        <div class="flex flex-col md:flex-row justify-between items-center p-6 border-b-2 border-primary-800 bg-primary-50">
            <div class="flex items-center gap-4 mb-4 md:mb-0">
                <img src="favicon.svg" alt="Odentara" class="clinical-brand-logo">
                <div>
                    <h2 class="text-xl md:text-2xl font-black text-gray-900 tracking-tight uppercase">Circulo OdontolÃ³gico</h2>
                    <p class="text-sm font-semibold text-primary-700">Ficha ClÃ­nica OdontolÃ³gica</p>
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
                    <div><strong class="text-gray-600 uppercase text-xs">Ficha NÂ°</strong><div class="text-base font-semibold text-primary-700">${patient.fichaNumero || '-'}</div></div>
                </div>
                <div class="clinical-info-item"><strong class="text-gray-600 uppercase text-xs">Nacimiento</strong><div>${patient.fechaNacimiento ? patient.fechaNacimiento.split('-').reverse().join('/') : '-'}</div></div>
                <div class="clinical-info-item"><strong class="text-gray-600 uppercase text-xs">Edad</strong><div>${age} aÃ±os</div></div>
                <div class="clinical-info-item"><strong class="text-gray-600 uppercase text-xs">TelÃ©fono</strong><div>${patient.phone || '-'}</div></div>
                <div class="clinical-info-item col-span-full"><strong class="text-gray-600 uppercase text-xs">Domicilio</strong><div>${patient.domicilio || '-'}</div></div>
            </div>

            <!-- ODONTOGRAMA -->
            <div class="mb-10 clinical-odontogram-block">
                <div class="odontogram-header mb-4 clinical-odontogram-section">
                    <h3 class="font-black text-gray-800 uppercase tracking-widest text-sm bg-gray-100 py-1 px-3 rounded inline-block border-l-4 border-primary-600">Odontograma Inicial</h3>
                </div>
                
                <div class="odontogram-wrapper overflow-x-auto pb-4">
                    <div class="flex flex-col items-center gap-5 min-w-max">
                        <div class="w-full flex flex-col items-center gap-3">
                            <div class="text-[10px] md:text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Dentición Adulta</div>
                            <div class="flex gap-4 md:gap-8 justify-center min-w-max">
                                <div class="flex gap-[2px] md:gap-1"> ${drawTeethRow([18,17,16,15,14,13,12,11], patient.odontograma)} </div>
                                <div class="flex gap-[2px] md:gap-1 border-l-2 border-gray-300 pl-4 md:pl-8"> ${drawTeethRow([21,22,23,24,25,26,27,28], patient.odontograma)} </div>
                            </div>
                            <div class="flex gap-4 md:gap-8 justify-center min-w-max">
                                <div class="flex gap-[2px] md:gap-1"> ${drawTeethRow([48,47,46,45,44,43,42,41], patient.odontograma)} </div>
                                <div class="flex gap-[2px] md:gap-1 border-l-2 border-gray-300 pl-4 md:pl-8"> ${drawTeethRow([31,32,33,34,35,36,37,38], patient.odontograma)} </div>
                            </div>
                        </div>

                        <div class="w-full max-w-4xl border-t border-dashed border-gray-300"></div>

                        <div class="w-full flex flex-col items-center gap-3">
                            <div class="text-[10px] md:text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Dentición Infantil</div>
                            <div class="flex gap-4 md:gap-8 justify-center min-w-max">
                                <div class="flex gap-[2px] md:gap-1"> ${drawTeethRow([55,54,53,52,51], patient.odontograma)} </div>
                                <div class="flex gap-[2px] md:gap-1 border-l-2 border-gray-300 pl-4 md:pl-8"> ${drawTeethRow([61,62,63,64,65], patient.odontograma)} </div>
                            </div>
                            <div class="flex gap-4 md:gap-8 justify-center min-w-max">
                                <div class="flex gap-[2px] md:gap-1"> ${drawTeethRow([85,84,83,82,81], patient.odontograma)} </div>
                                <div class="flex gap-[2px] md:gap-1 border-l-2 border-gray-300 pl-4 md:pl-8"> ${drawTeethRow([71,72,73,74,75], patient.odontograma)} </div>
                            </div>
                        </div>
                    </div>
                </div>
                ${canEditClinical ? `
                <div class="odontogram-toolbar print-hidden" id="odontogram-toolbar">
                    <div class="odonto-color-group">
                        <button class="odonto-color-btn odonto-rojo is-active" data-color="rojo" title="Rojo – Caries / Problema">
                            <svg viewBox="0 0 32 32" width="22" height="22"><circle cx="16" cy="16" r="12" fill="#ef4444"/><circle cx="16" cy="16" r="7" fill="white" opacity=".4"/></svg>
                        </button>
                        <button class="odonto-color-btn odonto-azul" data-color="azul" title="Azul – Restaurado / Tratado">
                            <svg viewBox="0 0 32 32" width="22" height="10"><rect x="2" y="10" width="28" height="12" rx="2" fill="#2563eb"/></svg>
                        </button>
                    </div>
                    <div class="odonto-treat-group">
                        <button class="odonto-treat-btn is-active" data-treatment="" title="Libre – aplica a la cara tocada">
                            <svg viewBox="0 0 32 32" width="28" height="28"><rect x="1" y="1" width="30" height="30" fill="#f2e8e8" stroke="#b0a0a0" stroke-width="1.5" rx="1"/><polygon points="1,1 31,1 16,16" fill="rgba(0,0,0,.07)" stroke="#b0a0a0" stroke-width="1"/><polygon points="31,1 31,31 16,16" fill="rgba(0,0,0,.07)" stroke="#b0a0a0" stroke-width="1"/><polygon points="31,31 1,31 16,16" fill="rgba(0,0,0,.07)" stroke="#b0a0a0" stroke-width="1"/><polygon points="1,31 1,1 16,16" fill="rgba(0,0,0,.07)" stroke="#b0a0a0" stroke-width="1"/><circle cx="16" cy="16" r="8" fill="#f2e8e8" stroke="#b0a0a0" stroke-width="1.5"/></svg>
                        </button>
                        <button class="odonto-treat-btn" data-treatment="ausente" title="Extracción / Ausente">
                            <svg viewBox="0 0 32 32" width="28" height="28"><rect x="1" y="1" width="30" height="30" fill="#f2e8e8" stroke="#b0a0a0" stroke-width="1.5" rx="1"/><polygon points="1,1 31,1 16,16" fill="rgba(0,0,0,.05)" stroke="#b0a0a0" stroke-width="1"/><polygon points="31,1 31,31 16,16" fill="rgba(0,0,0,.05)" stroke="#b0a0a0" stroke-width="1"/><polygon points="31,31 1,31 16,16" fill="rgba(0,0,0,.05)" stroke="#b0a0a0" stroke-width="1"/><polygon points="1,31 1,1 16,16" fill="rgba(0,0,0,.05)" stroke="#b0a0a0" stroke-width="1"/><circle cx="16" cy="16" r="8" fill="#f2e8e8" stroke="#b0a0a0" stroke-width="1"/><line x1="6" y1="6" x2="26" y2="26" stroke="#dc2626" stroke-width="5" stroke-linecap="round"/><line x1="26" y1="6" x2="6" y2="26" stroke="#dc2626" stroke-width="5" stroke-linecap="round"/></svg>
                        </button>
                        <button class="odonto-treat-btn" data-treatment="endodoncia" title="Endodoncia / Tratamiento de conducto">
                            <svg viewBox="0 0 32 32" width="28" height="28"><rect x="1" y="1" width="30" height="30" fill="#f2e8e8" stroke="#b0a0a0" stroke-width="1.5" rx="1"/><polygon points="1,1 31,1 16,16" fill="rgba(0,0,0,.05)" stroke="#b0a0a0" stroke-width="1"/><polygon points="31,1 31,31 16,16" fill="rgba(0,0,0,.05)" stroke="#b0a0a0" stroke-width="1"/><polygon points="31,31 1,31 16,16" fill="rgba(0,0,0,.05)" stroke="#b0a0a0" stroke-width="1"/><polygon points="1,31 1,1 16,16" fill="rgba(0,0,0,.05)" stroke="#b0a0a0" stroke-width="1"/><circle cx="16" cy="16" r="8" fill="#f59e0b" stroke="#b0a0a0" stroke-width="1"/><line x1="16" y1="8" x2="16" y2="24" stroke="white" stroke-width="2"/><line x1="12" y1="12" x2="20" y2="12" stroke="white" stroke-width="1.5"/><line x1="11" y1="16" x2="21" y2="16" stroke="white" stroke-width="1.5"/><line x1="12" y1="20" x2="20" y2="20" stroke="white" stroke-width="1.5"/></svg>
                        </button>
                        <button class="odonto-treat-btn" data-treatment="implante" title="Implante">
                            <svg viewBox="0 0 32 32" width="28" height="28"><rect x="1" y="1" width="30" height="30" fill="#f2e8e8" stroke="#b0a0a0" stroke-width="1.5" rx="1"/><polygon points="1,1 31,1 16,16" fill="rgba(0,0,0,.05)" stroke="#b0a0a0" stroke-width="1"/><polygon points="31,1 31,31 16,16" fill="rgba(0,0,0,.05)" stroke="#b0a0a0" stroke-width="1"/><polygon points="31,31 1,31 16,16" fill="rgba(0,0,0,.05)" stroke="#b0a0a0" stroke-width="1"/><polygon points="1,31 1,1 16,16" fill="rgba(0,0,0,.05)" stroke="#b0a0a0" stroke-width="1"/><rect x="11" y="6" width="10" height="20" rx="5" fill="#1d4ed8" stroke="white" stroke-width="1.5"/><line x1="16" y1="9" x2="16" y2="23" stroke="white" stroke-width="1.5" stroke-dasharray="2,2"/></svg>
                        </button>
                        <button class="odonto-treat-btn" data-treatment="corona" title="Corona">
                            <svg viewBox="0 0 32 32" width="28" height="28"><rect x="1" y="1" width="30" height="30" fill="#f2e8e8" stroke="#b0a0a0" stroke-width="1.5" rx="1"/><polygon points="1,1 31,1 16,16" fill="rgba(0,0,0,.05)" stroke="#b0a0a0" stroke-width="1"/><polygon points="31,1 31,31 16,16" fill="rgba(0,0,0,.05)" stroke="#b0a0a0" stroke-width="1"/><polygon points="31,31 1,31 16,16" fill="rgba(0,0,0,.05)" stroke="#b0a0a0" stroke-width="1"/><polygon points="1,31 1,1 16,16" fill="rgba(0,0,0,.05)" stroke="#b0a0a0" stroke-width="1"/><rect x="8" y="18" width="16" height="8" rx="2" fill="#7c3aed" stroke="white" stroke-width="1.2"/><polygon points="8,18 12,9 16,14 20,9 24,18" fill="#7c3aed" stroke="white" stroke-width="1.2"/></svg>
                        </button>
                        <button class="odonto-treat-btn" data-treatment="ortodoncia" title="Ortodoncia / Brackets">
                            <svg viewBox="0 0 32 32" width="28" height="28"><rect x="1" y="1" width="30" height="30" fill="#f2e8e8" stroke="#b0a0a0" stroke-width="1.5" rx="1"/><polygon points="1,1 31,1 16,16" fill="rgba(0,0,0,.05)" stroke="#b0a0a0" stroke-width="1"/><polygon points="31,1 31,31 16,16" fill="rgba(0,0,0,.05)" stroke="#b0a0a0" stroke-width="1"/><polygon points="31,31 1,31 16,16" fill="rgba(0,0,0,.05)" stroke="#b0a0a0" stroke-width="1"/><polygon points="1,31 1,1 16,16" fill="rgba(0,0,0,.05)" stroke="#b0a0a0" stroke-width="1"/><rect x="10" y="13" width="12" height="6" rx="1.5" fill="#2563eb" stroke="white" stroke-width="1"/><line x1="1" y1="16" x2="31" y2="16" stroke="#2563eb" stroke-width="3"/></svg>
                        </button>
                        <button class="odonto-treat-btn" data-treatment="sello" title="Sellante / Fluoruro">
                            <svg viewBox="0 0 32 32" width="28" height="28"><rect x="1" y="1" width="30" height="30" fill="#f2e8e8" stroke="#b0a0a0" stroke-width="1.5" rx="1"/><polygon points="1,1 31,1 16,16" fill="rgba(0,0,0,.05)" stroke="#b0a0a0" stroke-width="1"/><polygon points="31,1 31,31 16,16" fill="rgba(0,0,0,.05)" stroke="#b0a0a0" stroke-width="1"/><polygon points="31,31 1,31 16,16" fill="rgba(0,0,0,.05)" stroke="#b0a0a0" stroke-width="1"/><polygon points="1,31 1,1 16,16" fill="rgba(0,0,0,.05)" stroke="#b0a0a0" stroke-width="1"/><circle cx="16" cy="16" r="8" fill="#10b981" opacity=".85" stroke="white" stroke-width="1.5"/><circle cx="16" cy="16" r="4" fill="white" opacity=".5"/></svg>
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
            <div class="mb-4">
                    <div class="treatments-header bg-gray-100 py-1 px-3 rounded border-l-4 border-primary-600 mb-4">
                        <h3 class="font-black text-gray-800 uppercase tracking-widest text-sm">Registro de Tratamientos</h3>
                    ${canEditClinical ? '<button class="btn btn-primary btn-sm whitespace-nowrap print-hidden" id="btn-add-treatment"><i class="fa-solid fa-plus"></i> AÃ±adir Fila</button>' : ''}
                </div>
                <div class="table-container shadow-sm border border-gray-300 overflow-visible">
                    <table class="w-full text-left text-xs md:text-sm" id="treatments-table">
                        <thead class="bg-gray-50 border-b border-gray-300"><tr>
                            <th class="py-2 px-3">Diente</th><th class="py-2 px-3">Cara</th><th class="py-2 px-3">Sector</th>
                            <th class="py-2 px-3">AutorizaciÃ³n</th><th class="py-2 px-3">CÃ³digo</th><th class="py-2 px-3">Fecha / Firma</th><th class="py-2 px-3">Observaciones</th><th class="py-2 px-3 print-hidden"></th>
                        </tr></thead>
                        <tbody>
                            ${(patient.treatments||[]).map((t, idx) => `
                                <tr class="border-b border-gray-100 hover:bg-gray-50">
                                    <td class="py-2 px-3 font-bold">${t.diente}</td>
                                    <td class="py-2 px-3">${t.cara}</td>
                                    <td class="py-2 px-3">${t.sector}</td>
                                    <td class="py-2 px-3">${t.autorizacion}</td>
                                    <td class="py-2 px-3 font-mono">${t.codigo}</td>
                                    <td class="py-2 px-3">${t.fecha}<br><span class="text-[10px] text-gray-500 font-medium">${t.firma}</span></td>
                                    <td class="py-2 px-3 text-gray-600">${t.observaciones}</td>
                                    <td class="py-2 px-3 print-hidden">
                                    ${canEditClinical ? `
                                        <button class="btn-ghost text-red-400 hover:text-red-600 p-1" onclick="deleteTreatment(${patientId}, ${t.id ?? idx})"><i class="fa-solid fa-times"></i></button>
                                    ` : ''}
                                    </td>
                                </tr>
                            `).join('')}
                            ${!(patient.treatments||[]).length ? '<tr><td colspan="8" class="text-center py-4 text-gray-400 italic">No hay tratamientos registrados en la ficha.</td></tr>' : ''}
                        </tbody>
                    </table>
                </div>
            </div>

            <div class="mb-4 print-hidden">
                <div class="treatments-header bg-gray-100 py-1 px-3 rounded border-l-4 border-primary-600 mb-4">
                    <h3 class="font-black text-gray-800 uppercase tracking-widest text-sm">Imagenes Clinicas</h3>
                    ${canEditClinical ? '<button class="btn btn-primary btn-sm whitespace-nowrap" id="btn-add-clinical-image"><i class="fa-solid fa-image"></i> Agregar Imagen</button>' : ''}
                </div>
                <div class="clinical-images-shell">
                    <div class="clinical-images-grid">
                    ${clinicalImages.map((image, idx) => `
                        <article class="clinical-image-card">
                            <div class="clinical-image-actions">
                                <button type="button" class="clinical-image-action-btn clinical-image-action-view" onclick="openClinicalImageViewer(${patientId}, ${image.id ?? idx})" aria-label="Ver imagen clínica ampliada">
                                    <i class="fa-solid fa-expand"></i>
                                    <span>Ver</span>
                                </button>
                                ${canEditClinical ? `
                                <button type="button" class="clinical-image-action-btn clinical-image-action-delete" onclick="deleteClinicalImage(${patientId}, ${image.id ?? idx})" aria-label="Eliminar imagen clínica">
                                    <i class="fa-solid fa-trash"></i>
                                    <span>Eliminar</span>
                                </button>
                                ` : ''}
                            </div>
                            <button type="button" class="clinical-image-preview-button" onclick="openClinicalImageViewer(${patientId}, ${image.id ?? idx})" aria-label="Ver imagen clínica ampliada">
                                <img src="${image.dataUrl}" alt="${image.description || 'Imagen clinica'}" class="clinical-image-preview" onerror="this.style.display='none'; this.closest('.clinical-image-card')?.querySelector('.clinical-image-body')?.classList.add('clinical-image-body--error'); this.closest('.clinical-image-card')?.classList.add('clinical-image-card--broken');">
                            </button>
                            <div class="clinical-image-body">
                                <div class="clinical-image-meta">
                                    <div class="clinical-image-date">${image.date ? image.date.split('-').reverse().join('/') : 'Sin fecha'}</div>
                                    <button type="button" class="clinical-image-inline-link" onclick="openClinicalImageViewer(${patientId}, ${image.id ?? idx})">
                                        Abrir
                                    </button>
                                </div>
                                <p class="clinical-image-description">${image.description || 'Sin descripcion'}</p>
                                <p class="clinical-image-error">La imagen guardada está incompleta. Vuelve a cargarla.</p>
                            </div>
                        </article>
                    `).join('')}
                    ${clinicalImages.length === 0 ? '<div class="clinical-image-empty">Todavia no hay imagenes cargadas en la historia clinica.</div>' : ''}
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

            // LIMPIAR mode
            if (odontogramTool.clearing) {
                delete draft.data.odontograma[tooth];
                odontogramTool.clearing = false;
                document.getElementById('btn-odonto-clear')?.classList.remove('is-clearing');
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

function attachOdontogramToolbar(patientId) {
    const toolbar = document.getElementById('odontogram-toolbar');
    if (!toolbar) return;

    toolbar.querySelectorAll('.odonto-color-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            toolbar.querySelectorAll('.odonto-color-btn').forEach(b => b.classList.remove('is-active'));
            btn.classList.add('is-active');
            odontogramTool.color = btn.dataset.color;
        });
    });

    toolbar.querySelectorAll('.odonto-treat-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const already = btn.classList.contains('is-active');
            toolbar.querySelectorAll('.odonto-treat-btn').forEach(b => b.classList.remove('is-active'));
            if (!already) {
                btn.classList.add('is-active');
                odontogramTool.treatment = btn.dataset.treatment;
            } else {
                odontogramTool.treatment = null;
            }
        });
    });
}

window.clearOdontogramTooth = function(patientId) {
    odontogramTool.clearing = !odontogramTool.clearing;
    const btn = document.getElementById('btn-odonto-clear');
    btn?.classList.toggle('is-clearing', odontogramTool.clearing);
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
}

function renderClinicalOdontogram(patientId) {
    const patient = getClinicalWorkingPatient(patientId);
    const wrapper = document.querySelector('.odontogram-wrapper');
    if (!patient || !wrapper) return;

    wrapper.innerHTML = `
        <div class="flex flex-col items-center gap-5 min-w-max">
            <div class="w-full flex flex-col items-center gap-3">
                <div class="text-[10px] md:text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Dentición Adulta</div>
                <div class="flex gap-4 md:gap-8 justify-center min-w-max">
                    <div class="flex gap-[2px] md:gap-1"> ${drawTeethRow([18,17,16,15,14,13,12,11], patient.odontograma)} </div>
                    <div class="flex gap-[2px] md:gap-1 border-l-2 border-gray-300 pl-4 md:pl-8"> ${drawTeethRow([21,22,23,24,25,26,27,28], patient.odontograma)} </div>
                </div>
                <div class="flex gap-4 md:gap-8 justify-center min-w-max">
                    <div class="flex gap-[2px] md:gap-1"> ${drawTeethRow([48,47,46,45,44,43,42,41], patient.odontograma)} </div>
                    <div class="flex gap-[2px] md:gap-1 border-l-2 border-gray-300 pl-4 md:pl-8"> ${drawTeethRow([31,32,33,34,35,36,37,38], patient.odontograma)} </div>
                </div>
            </div>

            <div class="w-full max-w-4xl border-t border-dashed border-gray-300"></div>

            <div class="w-full flex flex-col items-center gap-3">
                <div class="text-[10px] md:text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Dentición Infantil</div>
                <div class="flex gap-4 md:gap-8 justify-center min-w-max">
                    <div class="flex gap-[2px] md:gap-1"> ${drawTeethRow([55,54,53,52,51], patient.odontograma)} </div>
                    <div class="flex gap-[2px] md:gap-1 border-l-2 border-gray-300 pl-4 md:pl-8"> ${drawTeethRow([61,62,63,64,65], patient.odontograma)} </div>
                </div>
                <div class="flex gap-4 md:gap-8 justify-center min-w-max">
                    <div class="flex gap-[2px] md:gap-1"> ${drawTeethRow([85,84,83,82,81], patient.odontograma)} </div>
                    <div class="flex gap-[2px] md:gap-1 border-l-2 border-gray-300 pl-4 md:pl-8"> ${drawTeethRow([71,72,73,74,75], patient.odontograma)} </div>
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

window.saveClinicalHistory = async function(patientId) {
    if (!canEditClinicalHistoryUi()) {
        showAlert('Solo el profesional y el superadmin pueden modificar la historia clínica.', { title: 'Historia clínica', variant: 'error' });
        return;
    }

    const patient = DB.get('patients').find((item) => item.id === patientId);
    const draft = getClinicalDraft(patientId);
    if (!patient || !draft) return;
    if (!draft.isDirty) {
        showToast('No hay cambios pendientes para guardar.', { type: 'success' });
        return;
    }

    const mergedValues = {
        ...patient,
        ...draft.data,
        odontograma: deepClone(draft.data.odontograma || {})
    };

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
                        summaryNotes: mergedValues.notes || '',
                        allergies: mergedValues.allergies || null,
                        medicalNotes: mergedValues.medicalNotes || null,
                        odontogramEntries: legacyOdontogramToEntries(mergedValues.odontograma || {})
                    })
                });
                await syncPatientClinicalData(patientId);
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
        showAlert('Solo el superadmin puede gestionar usuarios.', { title: 'Usuarios', variant: 'error' });
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
                await syncPatientClinicalData(patientId);
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
                await syncPatientClinicalData(patientId);
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
                    <h3>AÃ±adir Tratamiento a Ficha</h3>
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
                            <div class="input-group flex-1"><label>AutorizaciÃ³n</label><input type="text" id="tx-auth" placeholder="NÂº Orden"></div>
                            <div class="input-group flex-1"><label>CÃ³digo OS</label><input type="text" id="tx-codigo" placeholder="Ej: 01.01"></div>
                        </div>
                        <div class="input-group"><label>Observaciones</label><input type="text" id="tx-obs" placeholder="Detalles del procedimiento..." required></div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-ghost" onclick="closeModal()">Cancelar</button>
                        <button type="submit" class="btn btn-primary">AÃ±adir a Tabla</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    
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
                            professionalId: state.user?.assignedProfessionalId || null,
                            tooth: treatment.diente,
                            face: treatment.cara,
                            sector: treatment.sector,
                            authorizationNumber: treatment.autorizacion,
                            insuranceCode: treatment.codigo,
                            observations: treatment.observaciones,
                            performedAt: new Date().toISOString()
                        })
                    });
                    await syncPatientClinicalData(patientId);
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
                    <h3>Agregar Imagen Clinica</h3>
                    <button class="btn-ghost" data-modal-close><i class="fa-solid fa-times"></i></button>
                </div>
                <form id="clinical-image-form">
                    <div class="modal-body">
                        <div class="input-group">
                            <label>Fecha</label>
                            <input type="date" id="clinical-image-date" value="${getTodayIsoLocal()}" required>
                        </div>
                        <div class="input-group">
                            <label>Descripcion</label>
                            <input type="text" id="clinical-image-description" placeholder="Ej: Radiografia panoramica inicial" required>
                        </div>
                        <div class="input-group">
                            <label>Imagenes</label>
                            <input type="file" id="clinical-image-file" accept="image/*" multiple required>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-ghost" onclick="closeModal()">Cancelar</button>
                        <button type="submit" class="btn btn-primary">Guardar Imagenes</button>
                    </div>
                </form>
            </div>
        </div>
    `;

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
            const reader = new FileReader();
            reader.onload = () => resolve({
                id: Date.now() + Math.floor(Math.random() * 1000),
                date: selectedDate,
                description: selectedDescription,
                dataUrl: reader.result
            });
            reader.onerror = reject;
            reader.readAsDataURL(file);
        }))).then(async (newImages) => {
            const p = DB.get('patients').find(pt => pt.id === patientId);

            await withAppLoading('Guardando imágenes clínicas...', async () => {
                if (state.authToken) {
                    await apiFetch('/clinical-images', {
                        method: 'POST',
                        body: JSON.stringify({
                            patientId,
                            images: newImages.map((image) => ({
                                imageUrl: image.dataUrl,
                                description: image.description,
                                takenAt: image.date
                            }))
                        })
                    });
                    await syncPatientClinicalData(patientId);
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


