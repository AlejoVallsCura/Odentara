// =============================================================================
// ui.js — Feedback visual, tema, branding y helpers de DOM
// Depende de: state.js (state, THEME_STORAGE_KEY), utils.js (repairMojibakeString, repairDomText)
// =============================================================================

// -----------------------------------------------------------------------------
// Raíces de feedback (se crean lazy al primer uso)
// -----------------------------------------------------------------------------

let feedbackToastRoot   = null;
let feedbackDialogRoot  = null;
let loadingOverlayRoot  = null;

// -----------------------------------------------------------------------------
// Tema (dark / light)
// -----------------------------------------------------------------------------

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
        const existing = document.querySelector('.sidebar-theme-btn[data-theme-toggle]');
        const btn      = existing || createThemeToggleButton('sidebar-theme-btn');
        const wrap     = document.createElement('div');
        wrap.className = 'sidebar-theme-control';
        const label    = document.createElement('span');
        label.className    = 'sidebar-theme-label';
        label.textContent  = 'Modo oscuro';
        wrap.append(label, btn);
        sidebarUserWrap.appendChild(wrap);
    }
}

function syncThemeToggleButtons() {
    const isDark = document.body.classList.contains('theme-dark');
    document.querySelectorAll('[data-theme-toggle]').forEach((btn) => {
        btn.classList.toggle('is-dark', isDark);
        btn.setAttribute('aria-label', isDark ? 'Activar modo claro' : 'Activar modo oscuro');
        btn.setAttribute('title',      isDark ? 'Activar modo claro' : 'Activar modo oscuro');
        btn.innerHTML = `<i class="fa-solid ${isDark ? 'fa-sun' : 'fa-moon'}"></i>`;
    });
}

function applyTheme(theme = 'light', persist = true) {
    const next = theme === 'dark' ? 'dark' : 'light';
    document.body.classList.toggle('theme-dark',  next === 'dark');
    document.body.classList.toggle('theme-light', next !== 'dark');
    document.documentElement.style.colorScheme = next;
    if (persist) localStorage.setItem(THEME_STORAGE_KEY, next);
    syncThemeToggleButtons();
}

function toggleTheme() {
    applyTheme(document.body.classList.contains('theme-dark') ? 'light' : 'dark');
}

// -----------------------------------------------------------------------------
// Loading overlay global
// -----------------------------------------------------------------------------

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
    const msgNode = overlay.querySelector('.app-loading-message');
    if (msgNode) msgNode.textContent = repairMojibakeString(String(message || 'Guardando cambios...'));
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

// -----------------------------------------------------------------------------
// Toast y Dialog
// -----------------------------------------------------------------------------

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

function showToast(message, options = {}) {
    const { type = 'info', duration = 3200 } = options;
    const { feedbackToastRoot } = ensureFeedbackUi();
    const icon  = type === 'success' ? 'fa-check' : type === 'error' ? 'fa-circle-exclamation' : 'fa-bell';
    const toast = document.createElement('div');
    toast.className = `feedback-toast feedback-toast-${type}`;
    toast.innerHTML = `
        <div class="feedback-toast-icon"><i class="fa-solid ${icon}"></i></div>
        <div class="feedback-toast-copy">${repairMojibakeString(String(message ?? ''))}</div>
    `;
    feedbackToastRoot.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('is-visible'));

    const remove = () => {
        toast.classList.remove('is-visible');
        window.setTimeout(() => toast.remove(), 180);
    };
    window.setTimeout(remove, duration);
    toast.addEventListener('click', remove);
}

function showDialog(message, options = {}) {
    const {
        title       = 'Odentara',
        variant     = 'info',
        confirmText = 'Aceptar',
        cancelText  = null,
        dismissible = true
    } = options;

    const { feedbackDialogRoot } = ensureFeedbackUi();
    const prev    = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overlay = document.createElement('div');
    overlay.className = 'feedback-dialog-overlay';

    const icon = variant === 'danger' ? 'fa-trash'
               : variant === 'error'  ? 'fa-circle-exclamation'
               : variant === 'success'? 'fa-check'
               : 'fa-bell';

    overlay.innerHTML = `
        <div class="feedback-dialog feedback-dialog-${variant}" role="dialog" aria-modal="true" aria-label="${repairMojibakeString(title)}">
            <div class="feedback-dialog-badge"><i class="fa-solid ${icon}"></i></div>
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
        const confirmBtn = overlay.querySelector('.feedback-dialog-confirm');
        const cancelBtn  = overlay.querySelector('.feedback-dialog-cancel');

        requestAnimationFrame(() => (cancelBtn || confirmBtn)?.focus?.({ preventScroll: true }));

        const cleanup = (result) => {
            overlay.classList.remove('is-visible');
            document.removeEventListener('keydown', onKeyDown);
            window.setTimeout(() => { overlay.remove(); prev?.focus?.({ preventScroll: true }); resolve(result); }, 180);
        };

        const onKeyDown = (e) => {
            if (e.key === 'Escape' && dismissible) { e.preventDefault(); e.stopPropagation(); cleanup(false); return; }
            if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); cleanup(cancelBtn ? false : true); }
        };

        document.addEventListener('keydown', onKeyDown);
        confirmBtn?.addEventListener('click', () => cleanup(true));
        cancelBtn?.addEventListener('click',  () => cleanup(false));
        if (dismissible) overlay.addEventListener('click', (e) => { if (e.target === overlay) cleanup(false); });
    });
}

function showAlert(message, options = {}) {
    return showDialog(message, {
        title:       options.title       || 'Odentara',
        variant:     options.variant     || 'info',
        confirmText: options.confirmText || 'Aceptar',
        dismissible: true,
        html:        options.html        || false,
    });
}

function showConfirm(message, options = {}) {
    return showDialog(message, {
        title:       options.title       || 'Confirmar acción',
        variant:     options.variant     || 'danger',
        confirmText: options.confirmText || 'Confirmar',
        cancelText:  options.cancelText  || 'Cancelar',
        dismissible: true,
    });
}

// -----------------------------------------------------------------------------
// Auto-repair de mojibake en el DOM y overrides de window.alert/confirm
// -----------------------------------------------------------------------------

function setupMojibakeAutoRepair() {
    const nativeConfirm = window.confirm.bind(window);
    window.alert      = (msg) => showAlert(msg);
    window.confirm    = (msg) => nativeConfirm(repairMojibakeString(String(msg ?? '')));
    window.appAlert   = showAlert;
    window.appConfirm = showConfirm;
    window.appToast   = showToast;

    const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            mutation.addedNodes.forEach((node) => {
                if (node.nodeType === Node.TEXT_NODE) {
                    const repaired = repairMojibakeString(node.nodeValue);
                    if (repaired !== node.nodeValue) node.nodeValue = repaired;
                    return;
                }
                if (node.nodeType === Node.ELEMENT_NODE) repairDomText(node);
            });
        }
    });

    observer.observe(document.body, { childList: true, subtree: true });
    repairDomText(document.body);
}

// -----------------------------------------------------------------------------
// Branding y título de página
// -----------------------------------------------------------------------------

function applyClinicBranding() {
    const clinicName = getClinicDisplayName();
    document.querySelectorAll('.app-brand-copy h1, .mobile-header-brand-text > span:first-child')
        .forEach((node) => { if (node) node.textContent = 'Odentara'; });
    document.querySelectorAll('.logo-container h2')
        .forEach((node) => { if (node) node.textContent = 'Odentara.app'; });
    document.querySelectorAll('.app-brand-subtitle')
        .forEach((node) => { if (node) node.textContent = clinicName; });
    document.title = 'Odentara';
}

function setElementText(id, value) {
    const el = document.getElementById(id);
    if (el) el.innerText = value;
}

function setPageTitle(title) {
    const el = document.getElementById('page-title');
    if (el) el.innerText = title;
}

function getPageTitle() {
    const el = document.getElementById('page-title');
    return el ? el.innerText : '';
}
