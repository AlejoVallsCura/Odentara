// =============================================================================
// nav-history.js — Historial de navegación interno y botón "volver"
// Depende de: state.js, ui.js (getPageTitle)
// Lo usan en runtime: router.js (loadView), clinical.js (loadClinicalHistory)
// =============================================================================

/**
 * La app es una SPA de una sola URL: nunca se llamó a history.pushState, así que
 * para el navegador toda la sesión es una única entrada. El "atrás" del navegador
 * —o el gesto de deslizar en el celular— sacaba al usuario de la app y lo dejaba
 * en el login, perdiendo lo que estuviera haciendo.
 *
 * Acá se lleva un historial propio de vistas y se atrapa el popstate mientras hay
 * sesión: el atrás del navegador pasa a comportarse como el atrás de la app.
 * Cuando no hay sesión no se toca nada, así el login sigue funcionando igual.
 */

const NAV_HISTORY_MAX = 40;
const NAV_HISTORY_MARK = { odentaraNav: 1 };

let _navHistory = [];
// Mientras se restaura una entrada, loadView vuelve a llamar a recordNavEntry.
// Sin este flag cada "volver" empujaba de nuevo la vista a la que se volvía y
// el historial nunca se acortaba.
let _navRestoring = false;
let _navPopstateBound = false;

/** Snapshot de lo que hace falta para volver a dibujar la vista actual. */
function _navCurrentEntry(viewId, title) {
    return {
        viewId,
        title: title || getPageTitle() || 'Odentara',
        billingSubView:    state.billingSubView,
        billingPatientId:  state.billingPatientId,
        settingsSubView:   state.settingsSubView,
        patientId:         state.currentPatientId || null,
    };
}

function _navSameEntry(a, b) {
    if (!a || !b) return false;
    return a.viewId === b.viewId
        && a.patientId === b.patientId
        && a.billingSubView === b.billingSubView
        && a.billingPatientId === b.billingPatientId
        && a.settingsSubView === b.settingsSubView;
}

/**
 * Registra la vista recién dibujada. La llaman loadView() y loadClinicalHistory()
 * al terminar bien; si la navegación se canceló (permisos, borrador sin guardar)
 * no se llama y el historial queda como estaba.
 */
function recordNavEntry(viewId, title) {
    if (_navRestoring) return;
    const entry = _navCurrentEntry(viewId, title);
    const top = _navHistory[_navHistory.length - 1];
    if (_navSameEntry(top, entry)) {
        // Misma vista redibujada (cambio de tema, refresco post-guardado): se
        // actualiza el título por si cambió, pero no se apila otra entrada.
        if (top) top.title = entry.title;
        syncNavBackButton();
        return;
    }
    _navHistory.push(entry);
    if (_navHistory.length > NAV_HISTORY_MAX) _navHistory.shift();
    syncNavBackButton();
}

function canNavigateBack() {
    return _navHistory.length > 1;
}

function clearNavHistory() {
    _navHistory = [];
    syncNavBackButton();
}

/**
 * Vuelve a la vista anterior. Pasa por loadView/loadClinicalHistory normales, así
 * que el chequeo de borrador clínico sin guardar sigue corriendo: si el usuario
 * cancela, la entrada ya salió del stack pero la vista no cambió, y se vuelve a
 * apilar sola en el próximo render. Es preferible a saltarse el aviso.
 */
async function navigateBack() {
    if (!canNavigateBack()) return false;
    _navHistory.pop();
    const target = _navHistory[_navHistory.length - 1];
    if (!target) { syncNavBackButton(); return false; }

    _navRestoring = true;
    try {
        if (target.viewId === 'patient-history' && target.patientId) {
            await loadClinicalHistory(target.patientId);
        } else {
            if (target.billingSubView)  state.billingSubView  = target.billingSubView;
            if (target.settingsSubView) state.settingsSubView = target.settingsSubView;
            state.billingPatientId = target.billingPatientId ?? null;
            await loadView(target.viewId, target.title);
        }
    } finally {
        _navRestoring = false;
        syncNavBackButton();
    }
    return true;
}

// -----------------------------------------------------------------------------
// Botón flotante
// -----------------------------------------------------------------------------

/** Contenedor compartido con el botón de ayuda: los dos se apilan abajo a la derecha. */
function ensureFloatingDock() {
    let dock = document.getElementById('odentara-fab-dock');
    if (!dock) {
        dock = document.createElement('div');
        dock.id = 'odentara-fab-dock';
        dock.className = 'odentara-fab-dock';
        document.body.appendChild(dock);
    }
    return dock;
}

/**
 * El "volver" va arriba a la izquierda del contenido, que es donde la gente lo
 * busca. No flota por encima: es una barra propia dentro de <main>, justo antes
 * de #main-content, así que cuando no hay a dónde volver desaparece sin dejar
 * hueco y sin taparle nada a la vista de abajo.
 *
 * Va acá y no en el header porque el header solo existe en móvil —en escritorio
 * está en display:none y el sidebar hace su trabajo—, y el botón tiene que
 * aparecer en los dos.
 */
function ensureNavBackButton() {
    let bar = document.getElementById('nav-back-bar');
    if (bar) { syncNavBackButton(); return bar.querySelector('.nav-back-btn'); }

    const main = document.querySelector('#app-view main');
    const contenido = document.getElementById('main-content');
    if (!main || !contenido) return null;

    bar = document.createElement('div');
    bar.id = 'nav-back-bar';
    bar.className = 'nav-back-bar';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'nav-back-btn';
    btn.setAttribute('aria-label', 'Volver a la pantalla anterior');
    btn.innerHTML = '<i class="fa-solid fa-arrow-left"></i><span>Volver</span>';
    btn.addEventListener('click', () => { navigateBack(); });

    bar.appendChild(btn);
    main.insertBefore(bar, contenido);
    syncNavBackButton();
    return btn;
}

/**
 * El panel de plataforma no lleva boton de volver.
 *
 * Tiene su propio menu lateral y es un mundo aparte del de la clinica: la barra
 * clara del "volver" quedaba flotando arriba de un panel oscuro a pantalla
 * completa, y ademas ofrecia salir a una vista de la app desde adentro del
 * panel, que no es un movimiento que tenga sentido ahi.
 */
function esVistaDePlataforma() {
    return String(state.currentView || '').startsWith('platform-');
}

function syncNavBackButton() {
    const bar = document.getElementById('nav-back-bar');
    if (!bar) return;
    bar.classList.toggle('is-hidden', !canNavigateBack() || !state.user || esVistaDePlataforma());
    // El texto dice a dónde se vuelve: "Volver" a secas obliga a acordarse de
    // dónde venías, y en una app con seis secciones eso no es obvio.
    const anterior = _navHistory[_navHistory.length - 2];
    const etiqueta = bar.querySelector('.nav-back-btn span');
    if (etiqueta) etiqueta.textContent = anterior?.title ? `Volver a ${anterior.title}` : 'Volver';
}

/**
 * Atrapa el atrás del navegador.
 *
 * Se mantiene siempre una entrada "de más" en el historial del navegador: cada
 * vez que el usuario vuelve, se consume esa entrada y se empuja otra. Así el
 * atrás nunca llega a la carga inicial de la página —que era lo que devolvía al
 * login— y en cambio retrocede dentro de la app.
 */
function initNavHistoryGuard() {
    if (_navPopstateBound) return;
    _navPopstateBound = true;
    window.addEventListener('popstate', () => {
        // Sin sesión (login, reset de contraseña) el navegador manda: no se
        // rearma nada para no dejar al usuario encerrado en la pantalla.
        if (!state.user) return;
        try { history.pushState(NAV_HISTORY_MARK, ''); } catch (_) { /* no crítico */ }
        navigateBack();
    });
}

/** Se llama al entrar a la app, una vez que ya hay sesión. */
function armNavHistoryGuard() {
    initNavHistoryGuard();
    try { history.pushState(NAV_HISTORY_MARK, ''); } catch (_) { /* no crítico */ }
    ensureNavBackButton();
}

window.navigateBack   = navigateBack;
window.recordNavEntry = recordNavEntry;
