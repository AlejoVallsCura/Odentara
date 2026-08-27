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
        wrap.append(label, btn);
        sidebarUserWrap.appendChild(wrap);
    }

    // El texto del control lo pone syncThemeToggleButtons, que es el único que
    // sabe en qué tema estamos. ensureThemeControls puede correr después de
    // applyTheme (al construir el sidebar), así que se sincroniza acá también o
    // la etiqueta queda vacía hasta el primer cambio de tema.
    syncThemeToggleButtons();
    ensureChimeControl();
}

/**
 * Interruptor del aviso sonoro de llegada.
 *
 * Va al lado del control de tema y no en Configuración porque es de la misma
 * naturaleza: preferencia personal, por dispositivo, guardada en localStorage.
 * Lo de Configuración es de la clínica y lo comparten todos los usuarios.
 *
 * Solo aparece si el usuario resuelve a UN profesional concreto — es el único
 * caso en el que existe "mi paciente" y por lo tanto el único al que le suena.
 * Una secretaria, o un admin que no atiende, no ve el control.
 */
function ensureChimeControl() {
    const sidebarUserWrap = document.querySelector('.sidebar-user-wrap');
    if (!sidebarUserWrap) return;

    const existente = sidebarUserWrap.querySelector('.sidebar-chime-control');
    const corresponde = typeof profesionalDelUsuario === 'function' && !!profesionalDelUsuario();

    if (!corresponde) {
        existente?.remove();
        return;
    }
    if (existente) {
        syncChimeToggleButton();
        return;
    }

    const wrap = document.createElement('div');
    wrap.className = 'sidebar-theme-control sidebar-chime-control';

    const label = document.createElement('span');
    // Lleva sidebar-theme-label para heredar el estilo de la fila, y una clase
    // propia para poder distinguirla: syncThemeToggleButtons reescribe el texto
    // de todas las .sidebar-theme-label, y sin esto le pisaba "Aviso al llegar"
    // con "Modo oscuro" cada vez que se cambiaba de tema.
    label.className = 'sidebar-theme-label sidebar-chime-label';
    label.textContent = 'Aviso al llegar';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'theme-toggle-btn sidebar-theme-btn';
    btn.dataset.chimeToggle = 'true';
    btn.addEventListener('click', () => {
        const activar = !isPresenceChimeEnabled();
        setPresenceChimeEnabled(activar);
        syncChimeToggleButton();
        // El click es un gesto del usuario, que es justo lo que el navegador
        // exige para habilitar audio. Sonar acá cumple dos funciones: destraba
        // el AudioContext para los avisos que vengan después, y deja escuchar
        // el timbre para saber qué se está activando.
        if (activar) playPresenceChime();
    });

    wrap.append(label, btn);
    sidebarUserWrap.appendChild(wrap);
    syncChimeToggleButton();
}

function syncChimeToggleButton() {
    const btn = document.querySelector('[data-chime-toggle]');
    if (!btn) return;
    const activo = isPresenceChimeEnabled();
    const texto = activo ? 'Silenciar el aviso de llegada' : 'Activar el aviso de llegada';
    btn.classList.toggle('is-dark', activo);
    btn.setAttribute('aria-pressed', String(activo));
    btn.setAttribute('aria-label', texto);
    btn.setAttribute('title', texto);
    btn.innerHTML = `<i class="fa-solid ${activo ? 'fa-bell' : 'fa-bell-slash'}"></i>`;
}

function syncThemeToggleButtons() {
    const isDark = document.body.classList.contains('theme-dark');

    // La etiqueta nombra el modo al que se VA, no el que está activo: en claro
    // dice "Modo oscuro". Es la misma lógica que el aria-label de abajo, y la
    // que hace que el texto y el ícono cuenten lo mismo (en claro, luna).
    // Antes era el string fijo "Modo oscuro", que en tema oscuro mentía.
    const etiqueta = isDark ? 'Modo claro' : 'Modo oscuro';
    // Se excluye la etiqueta del timbre: comparte la clase de estilo pero su
    // texto es fijo y no tiene nada que ver con el tema.
    document.querySelectorAll('.sidebar-theme-label:not(.sidebar-chime-label)').forEach((el) => {
        el.textContent = etiqueta;
    });

    document.querySelectorAll('[data-theme-toggle]').forEach((btn) => {
        btn.classList.toggle('is-dark', isDark);
        btn.setAttribute('aria-label', `Activar ${etiqueta.toLowerCase()}`);
        btn.setAttribute('title',      `Activar ${etiqueta.toLowerCase()}`);
        btn.innerHTML = `<i class="fa-solid ${isDark ? 'fa-sun' : 'fa-moon'}"></i>`;
    });
}

/**
 * Cambia la marca del sidebar y del header móvil según el tema.
 *
 *   principal → tile violeta, diente blanco. Es el logo de marca, y el que se usa
 *               en modo claro: sobre el sidebar casi blanco el tile violeta se
 *               recorta con fuerza y es el mismo que ve la persona en el ícono
 *               instalado y en la pestaña, así que la marca es una sola.
 *   oscura    → tile #17171f, diente blanco. En modo oscuro el sidebar es #161b27,
 *               casi el mismo color, así que el tile desaparece y queda flotando
 *               solo el diente. Es el efecto buscado.
 *
 * Existen además las variantes `clara`, `mono` y `teal` que por ahora no se usan
 * en ningún lado. El teal (`teal2`) es solo de la landing y el login.
 */
function syncBrandLogos() {
    const isDark = document.body.classList.contains('theme-dark');
    // La versión acompaña a la del CSS/JS de index.html. Sin ella, el servidor
    // cachea las imágenes 7 días y un logo nuevo no le llega a quien ya entró.
    const src = `/icons/logo-${isDark ? 'oscura' : 'principal'}-128.png?v=20260827e`;
    document.querySelectorAll('[data-brand-logo]').forEach((img) => {
        if (img.getAttribute('src') !== src) img.setAttribute('src', src);
    });
}

function applyTheme(theme = 'light', persist = true) {
    const next = theme === 'dark' ? 'dark' : 'light';
    document.body.classList.toggle('theme-dark',  next === 'dark');
    document.body.classList.toggle('theme-light', next !== 'dark');
    document.documentElement.style.colorScheme = next;
    if (persist) localStorage.setItem(THEME_STORAGE_KEY, next);
    syncThemeToggleButtons();
    syncBrandLogos();
}

function toggleTheme() {
    applyTheme(document.body.classList.contains('theme-dark') ? 'light' : 'dark');
    // Varias vistas (dashboard, turnos) calculan colores en JS leyendo el tema
    // al momento de renderizar y los dejan como estilo inline — por ejemplo el
    // fondo de cada fila de turno, que se mezcla con el color del profesional.
    // Al cambiar de tema esos inline quedan con los colores del tema anterior
    // hasta que se navega a otra pantalla, así que hay que re-renderizar.
    if (typeof refreshCurrentView === 'function' && state?.currentView) {
        refreshCurrentView();
    }
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

// Cambia el texto del overlay sin tocar el contador de cargas — para tareas
// largas que reportan progreso mientras avanzan (ej: la lectura de fotos con
// IA, que va tanda por tanda). Usar setAppLoading para esto lo rompería: cada
// llamada suma al contador y el overlay nunca se cerraría.
function updateAppLoadingMessage(message) {
    const msgNode = ensureLoadingOverlay().querySelector('.app-loading-message');
    if (msgNode) msgNode.textContent = repairMojibakeString(String(message || ''));
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

// Tipos válidos de toast. La lista es cerrada porque `type` se interpola en el
// className: un valor libre podría inyectar clases ajenas al componente.
const _TOAST_TYPES = new Set(['info', 'success', 'error', 'warning']);

/**
 * @param {string} message  Se escapa SIEMPRE, salvo que se pase `html: true`.
 * @param {object|string} options  Acepta `'error'` suelto además de `{type}`.
 */
function showToast(message, options = {}) {
    // Diecisiete llamadas pasaban el tipo como string suelto —showToast(msg, 'error')—
    // en vez de {type:'error'}. El destructuring las dejaba en el estilo por defecto,
    // así que un error se veía igual que una confirmación. Se acepta la forma corta
    // en vez de corregir cada call site: son muchos y el riesgo de olvidar uno es peor.
    const opts = typeof options === 'string' ? { type: options } : (options || {});
    const rawType = opts.type || 'info';
    const type = _TOAST_TYPES.has(rawType) ? rawType : 'info';
    const duration = opts.duration ?? 3200;

    const { feedbackToastRoot } = ensureFeedbackUi();
    const icon  = type === 'success' ? 'fa-check' : type === 'error' ? 'fa-circle-exclamation' : 'fa-bell';
    const toast = document.createElement('div');
    toast.className = `feedback-toast feedback-toast-${type}`;
    // El mensaje va escapado por defecto. Muchos toasts muestran el nombre de un
    // paciente o el `error.message` que devolvió el servidor, y hasta acá eso
    // entraba al DOM como markup: repairMojibakeString arregla acentos, no escapa.
    toast.innerHTML = `
        <div class="feedback-toast-icon"><i class="fa-solid ${icon}"></i></div>
        <div class="feedback-toast-copy">${opts.html ? (message ?? '') : escapeHtml(message)}</div>
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

    // Todo lo interpolado va escapado. `message` es el que importa —los diálogos
    // arman frases con el nombre del paciente o del profesional, y window.alert
    // está redirigido acá, así que cualquier alert() viejo también entraba como
    // markup—, pero el título y los textos de botón se escapan igual: son baratos
    // de escapar y nada garantiza que mañana no lleven un dato de usuario.
    overlay.innerHTML = `
        <div class="feedback-dialog feedback-dialog-${variant}" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}">
            <div class="feedback-dialog-badge"><i class="fa-solid ${icon}"></i></div>
            <div class="feedback-dialog-copy">
                <p class="feedback-dialog-eyebrow">${escapeHtml(title)}</p>
                <p class="feedback-dialog-message">${options.html ? (message ?? '') : escapeHtml(message)}</p>
            </div>
            <div class="feedback-dialog-actions">
                ${cancelText ? `<button type="button" class="btn btn-ghost feedback-dialog-cancel">${escapeHtml(cancelText)}</button>` : ''}
                <button type="button" class="btn btn-primary feedback-dialog-confirm">${escapeHtml(confirmText)}</button>
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
