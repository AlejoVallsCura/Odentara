// =============================================================================
// help-guide.js — Ayuda contextual: botón "?" + burbuja guiada por pantalla
// Depende de: state.js, ui.js, permissions.js, nav-history.js (dock flotante)
// =============================================================================

/**
 * Un botón "?" fijo que, según la pantalla en la que esté parado el usuario,
 * abre una burbuja que va señalando los controles de esa pantalla y explicando
 * para qué sirven.
 *
 * Los pasos se declaran acá y no en cada vista a propósito: las vistas se
 * redibujan enteras con innerHTML en cada navegación, así que cualquier estado
 * que guardaran se perdería. Cada paso apunta a un selector; si ese elemento no
 * existe —porque el rol no lo ve, o porque la lista está vacía— el paso se
 * saltea solo. De esa forma un profesional y una secretaria ven guías distintas
 * sin mantener dos textos.
 */

const HELP_STEP_GAP = 14;

// -----------------------------------------------------------------------------
// Contenido de las guías
// -----------------------------------------------------------------------------

const HELP_GUIDES = {
    dashboard: {
        title: 'Panel principal',
        steps: [
            { text: 'Este es tu panel de inicio. De un vistazo ves cómo viene el día: turnos, pacientes y números de la clínica.' },
            { sel: '.metrics-grid', title: 'Los números del día', text: 'Cada tarjeta resume un dato: turnos agendados, pacientes atendidos y movimientos de caja. Se actualizan solos.' },
            { sel: '#dashboard-date-filter', title: 'Cambiar de día', text: 'Elegí otra fecha para ver la agenda de ese día sin salir del panel.' },
            { sel: '.finished-apts-details', title: 'Turnos finalizados', text: 'Los turnos ya cerrados quedan plegados acá abajo para no ensuciar la lista. Tocá para desplegarlos.' },
            { sel: '#sidebar-nav', title: 'El menú', text: 'Desde el menú lateral entrás a Turnos, Pacientes, Facturación y Configuración. En el celular se abre con el botón de las tres rayas.' },
        ]
    },

    appointments: {
        title: 'Turnos',
        steps: [
            { text: 'Esta es la agenda de la clínica. Acá cargás turnos nuevos, los movés y les cambiás el estado.' },
            { sel: '#btn-add-apt', title: 'Cargar un turno nuevo', text: 'Este es el botón para agendar. Te pide paciente, profesional, fecha, hora y duración. Si el paciente todavía no existe, cargalo antes desde Pacientes.' },
            { sel: '.cal-view-switcher', title: 'Día, semana o mes', text: 'Cambiá cómo mirás la agenda: "Hoy" muestra el día en detalle, "Semana" los siete días y "Mes" el panorama completo.' },
            { sel: '#cal-prev', title: 'Moverte en el tiempo', text: 'Con las flechas de los costados avanzás o retrocedés un día, una semana o un mes, según la vista que tengas puesta.' },
            { sel: '.cal-legend', title: 'Filtrar por profesional', text: 'Cada profesional tiene su color. Tocá su nombre para ver solamente su agenda y volvé a tocarlo para ver todas.' },
            { sel: '#apt-sobreturno', title: 'Sobreturnos', text: 'Al cargar un turno podés marcarlo como sobreturno: entra aunque el horario ya esté ocupado y queda señalado en la agenda.' },
            { text: 'Tocando un turno ya cargado lo editás, lo cancelás o le cambiás el estado (confirmado, llegó, atendido).' },
        ]
    },

    patients: {
        title: 'Pacientes',
        steps: [
            { text: 'Este es el registro de pacientes. Desde acá entrás a la historia clínica y a la cuenta corriente de cada uno.' },
            { sel: '#search-patient', title: 'Buscar', text: 'Escribí nombre o DNI y la lista se filtra sola mientras tipeás.' },
            { sel: '#btn-add-patient, #btn-add-patient-empty', title: 'Paciente nuevo', text: 'Carga un paciente a mano. Nombre, DNI y teléfono son obligatorios; el resto lo podés completar después.' },
            { sel: '#btn-import-ia, #btn-import-ia-empty', title: 'Importar con IA', text: 'Si tenés los pacientes en papel o en fotos, subí las imágenes y la IA extrae los datos. Después revisás la tabla y confirmás antes de guardar.' },
            { sel: '#btn-import-patients, #btn-import-patients-empty', title: 'Importar desde Excel', text: 'Subí una planilla de Excel o CSV. Podés bajar la plantilla desde la misma ventana y vas a poder mapear cada columna antes de importar.' },
            { sel: '#btn-export-patients', title: 'Exportar', text: 'Descarga todo el padrón en Excel, por si necesitás una copia o llevarlo a otro lado.' },
            { sel: '.patient-actions .btn-view-history', title: 'Historia clínica', text: 'El ícono violeta abre la ficha del paciente: odontograma, tratamientos, antecedentes, recetas, presupuestos y archivos.' },
            { sel: '.patient-actions .btn-view-patient-billing', title: 'Cuenta corriente', text: 'El ícono verde de billetera te lleva a la cuenta corriente de ese paciente, con su saldo y todos sus movimientos.' },
            { sel: '.patient-actions .btn-edit-patient', title: 'Editar datos', text: 'El lápiz abre los datos personales para corregirlos.' },
            { sel: '.patient-actions .btn-whatsapp-patient', title: 'WhatsApp', text: 'Si el teléfono es válido, este botón abre un chat de WhatsApp con el paciente.' },
        ]
    },

    'patient-history': {
        title: 'Ficha del paciente',
        steps: [
            { text: 'Esta es la ficha completa del paciente. Todo lo clínico y lo administrativo vive acá, ordenado en pestañas.' },
            { sel: '[data-clinical-tab="clinico"]', title: 'Clínico', text: 'El odontograma y los tratamientos. Tocá una pieza para marcar su estado y cargá los tratamientos realizados.' },
            { sel: '[data-clinical-tab="antecedentes"]', title: 'Antecedentes', text: 'El cuestionario de salud: alergias, medicación y enfermedades previas. Se responde con Sí/No.' },
            { sel: '[data-clinical-tab="recetas"]', title: 'Recetas', text: 'Emitís recetas con el membrete de la clínica y quedan guardadas en el historial del paciente.' },
            { sel: '[data-clinical-tab="presupuestos"]', title: 'Presupuestos', text: 'Armás un presupuesto con los tratamientos a realizar. Cuando el paciente lo acepta, lo cargás como deuda en su cuenta corriente con un botón.' },
            { sel: '[data-clinical-tab="archivos"]', title: 'Archivos', text: 'Radiografías, fotos y estudios del paciente. Se suben desde acá y se ven en grande al tocarlos.' },
            { sel: '.cc-movs-details', title: 'Movimientos de la cuenta', text: 'Dentro de Presupuestos tenés un resumen de la cuenta corriente. Está plegado para no tapar el resto: tocá "Ver movimientos" para abrirlo.' },
            { text: 'Acordate de guardar antes de salir: si dejás cambios sin guardar, la app te va a avisar.' },
        ]
    },

    billing: {
        title: 'Facturación',
        steps: [
            { text: 'Acá se lleva la plata: los movimientos del día a día y la cuenta corriente de cada paciente.' },
            { sel: '[data-billing-view="movements"]', title: 'Últimos movimientos', text: 'La lista general de cargos y pagos de toda la clínica, ordenada por fecha.' },
            { sel: '[data-billing-view="accounts"]', title: 'Cuentas corrientes', text: 'El saldo paciente por paciente. Un mismo paciente puede tener saldos distintos según el profesional.' },
            { sel: '#btn-add-tx', title: 'Registrar un movimiento', text: 'Cargás un pago recibido (ingreso) o un cargo por tratamiento (deuda), eligiendo paciente, profesional, monto y moneda.' },
            { sel: '#billing-text-search', title: 'Buscar movimientos', text: 'Filtrá por paciente, DNI o descripción para encontrar un movimiento puntual.' },
            { sel: '#search-patient-billing-main, #patient-billing-picker-search', title: 'Abrir una cuenta', text: 'Escribí el nombre o DNI del paciente para abrir su cuenta corriente completa.' },
            { sel: '#btn-clear-patient-billing', title: 'Volver al listado', text: 'Este botón te saca de la cuenta del paciente y vuelve al listado general.' },
            { text: 'Los saldos se muestran separados por moneda: los pesos y los dólares nunca se suman entre sí.' },
        ]
    },

    professionals: {
        title: 'Horarios',
        steps: [
            { text: 'Acá se define en qué días y horarios atiende cada profesional. Es lo que determina qué turnos ofrece la agenda.' },
            { sel: '.prof-schedule-card', title: 'Cada profesional', text: 'Una tarjeta por profesional, con su color y su horario actual.' },
            { sel: '.btn-edit-schedule', title: 'Configurar horarios', text: 'Abrí la configuración para marcar los días que atiende, la hora de inicio y de fin, y la duración por turno.' },
            { text: 'Si un profesional no tiene horarios cargados, la agenda no va a ofrecer turnos con él.' },
        ]
    },

    settings: {
        title: 'Configuración',
        steps: [
            { text: 'Desde acá configurás la clínica y quiénes pueden entrar al sistema.' },
            { sel: '[data-settings-view="clinic-settings"]', title: 'Datos de la clínica', text: 'Nombre, logo, datos de contacto y el mensaje de confirmación que reciben los pacientes.' },
            { sel: '[data-settings-view="create-user"]', title: 'Crear usuario', text: 'Da de alta a alguien que va a entrar al sistema (secretaría, administración) y le asigna sus permisos.' },
            { sel: '[data-settings-view="create-professional"]', title: 'Crear profesional', text: 'Da de alta a un odontólogo. Después le cargás los horarios desde la sección de Horarios.' },
            { sel: '[data-settings-view="users-list"]', title: 'Usuarios existentes', text: 'Editás permisos, cambiás contraseñas o desactivás cuentas.' },
            { sel: '[data-settings-view="professionals-list"]', title: 'Profesionales existentes', text: 'Modificás los datos de cada profesional o lo das de baja.' },
            { sel: '.sidebar-theme-control', title: 'Modo oscuro', text: 'El interruptor del tema está al pie del menú lateral y se guarda por dispositivo.' },
        ]
    },
};

/** Guía genérica cuando la pantalla todavía no tiene una propia. */
const HELP_GUIDE_FALLBACK = {
    title: 'Ayuda',
    steps: [
        { text: 'Todavía no hay una guía específica para esta pantalla.' },
        { sel: '#sidebar-nav', title: 'El menú', text: 'Desde el menú lateral llegás a todas las secciones del sistema.' },
        { sel: '#nav-back-bar', title: 'Volver', text: 'La flecha de arriba a la izquierda te devuelve a la pantalla anterior sin salir de la app. El atrás del navegador hace lo mismo.' },
    ]
};

function getHelpGuideForCurrentView() {
    const viewId = state.currentView || 'dashboard';
    if (String(viewId).startsWith('platform-')) {
        return {
            title: 'Panel de plataforma',
            steps: [
                { text: 'Este es el panel de administración de Odentara: clínicas, planes, avisos, backups y auditoría.' },
                { sel: '#sidebar-nav', title: 'Secciones', text: 'Cada ítem del menú es una sección del panel de plataforma.' },
            ]
        };
    }
    return HELP_GUIDES[viewId] || HELP_GUIDE_FALLBACK;
}

// -----------------------------------------------------------------------------
// Motor de la burbuja
// -----------------------------------------------------------------------------

const helpTour = {
    steps: [],
    index: 0,
    title: '',
    open: false,
};

function _helpResolveTarget(step) {
    if (!step.sel) return null;
    // Varios selectores separados por coma: se toma el primero visible, porque
    // las vistas tienen duplicados (ej: el botón del estado vacío y el del hero)
    // y solo uno de los dos está en pantalla.
    for (const sel of step.sel.split(',')) {
        const el = document.querySelector(sel.trim());
        if (el && el.offsetParent !== null) return el;
    }
    return null;
}

/** Los pasos con selector cuyo elemento no está en pantalla se descartan. */
function _helpUsableSteps(guide) {
    return (guide.steps || []).filter(step => !step.sel || _helpResolveTarget(step));
}

function ensureHelpLayer() {
    let layer = document.getElementById('help-guide-layer');
    if (layer) return layer;

    layer = document.createElement('div');
    layer.id = 'help-guide-layer';
    layer.className = 'help-guide-layer is-hidden';
    layer.innerHTML = `
        <div class="help-guide-backdrop" data-help-close></div>
        <div class="help-guide-spot" aria-hidden="true"></div>
        <div class="help-guide-bubble" role="dialog" aria-modal="true" aria-labelledby="help-guide-title">
            <div class="help-guide-arrow" aria-hidden="true"></div>
            <button type="button" class="help-guide-close" data-help-close aria-label="Cerrar ayuda">
                <i class="fa-solid fa-xmark"></i>
            </button>
            <span class="help-guide-eyebrow"></span>
            <h4 class="help-guide-title" id="help-guide-title"></h4>
            <p class="help-guide-text"></p>
            <div class="help-guide-foot">
                <div class="help-guide-dots"></div>
                <div class="help-guide-actions">
                    <button type="button" class="btn btn-ghost btn-sm help-guide-prev">Anterior</button>
                    <button type="button" class="btn btn-primary btn-sm help-guide-next">Siguiente</button>
                </div>
            </div>
        </div>`;
    document.body.appendChild(layer);

    layer.querySelectorAll('[data-help-close]').forEach(el => {
        el.addEventListener('click', closeHelpGuide);
    });
    layer.querySelector('.help-guide-prev').addEventListener('click', () => helpGuideStep(-1));
    layer.querySelector('.help-guide-next').addEventListener('click', () => helpGuideStep(1));

    document.addEventListener('keydown', (e) => {
        if (!helpTour.open) return;
        if (e.key === 'Escape')     { e.preventDefault(); closeHelpGuide(); }
        if (e.key === 'ArrowRight') { e.preventDefault(); helpGuideStep(1); }
        if (e.key === 'ArrowLeft')  { e.preventDefault(); helpGuideStep(-1); }
    });

    // Si la pantalla cambia de tamaño o el usuario scrollea, la burbuja tiene que
    // seguir al elemento que está señalando.
    const reposition = () => { if (helpTour.open) _helpPaintStep(); };
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);

    return layer;
}

function openHelpGuide() {
    const guide = getHelpGuideForCurrentView();
    const steps = _helpUsableSteps(guide);
    if (!steps.length) {
        showToast('No hay ayuda disponible para esta pantalla.');
        return;
    }
    helpTour.steps = steps;
    helpTour.index = 0;
    helpTour.title = guide.title || 'Ayuda';
    helpTour.open  = true;

    const layer = ensureHelpLayer();
    layer.classList.remove('is-hidden');
    document.body.classList.add('help-guide-open');
    _helpPaintStep();
}

function closeHelpGuide() {
    helpTour.open = false;
    document.getElementById('help-guide-layer')?.classList.add('is-hidden');
    document.body.classList.remove('help-guide-open');
    document.querySelector('.help-guide-target')?.classList.remove('help-guide-target');
}

function helpGuideStep(delta) {
    const next = helpTour.index + delta;
    if (next < 0) return;
    if (next >= helpTour.steps.length) { closeHelpGuide(); return; }
    helpTour.index = next;
    _helpPaintStep();
}

function _helpPaintStep() {
    const layer = document.getElementById('help-guide-layer');
    if (!layer) return;
    const step   = helpTour.steps[helpTour.index];
    if (!step) { closeHelpGuide(); return; }

    const bubble = layer.querySelector('.help-guide-bubble');
    const spot   = layer.querySelector('.help-guide-spot');
    const total  = helpTour.steps.length;

    layer.querySelector('.help-guide-eyebrow').textContent = `${helpTour.title} · ${helpTour.index + 1} de ${total}`;
    layer.querySelector('.help-guide-title').textContent   = step.title || helpTour.title;
    layer.querySelector('.help-guide-text').textContent    = step.text || '';
    layer.querySelector('.help-guide-prev').disabled       = helpTour.index === 0;
    layer.querySelector('.help-guide-next').textContent    = helpTour.index === total - 1 ? 'Entendido' : 'Siguiente';
    layer.querySelector('.help-guide-dots').innerHTML =
        helpTour.steps.map((_, i) => `<span class="help-guide-dot ${i === helpTour.index ? 'is-active' : ''}"></span>`).join('');

    document.querySelector('.help-guide-target')?.classList.remove('help-guide-target');

    const target = _helpResolveTarget(step);
    if (!target) {
        // Paso sin elemento: burbuja centrada y sin recorte.
        spot.classList.add('is-hidden');
        bubble.classList.add('is-centered');
        bubble.style.top = '';
        bubble.style.left = '';
        layer.querySelector('.help-guide-arrow').style.display = 'none';
        return;
    }

    target.classList.add('help-guide-target');

    // Se pinta ya, con la posición actual, y se vuelve a pintar una vez que el
    // scroll suave terminó. Antes esto vivía dentro de un requestAnimationFrame
    // y nada más: en una pestaña que el navegador no está pintando, ese callback
    // no llega nunca y el foco se quedaba sin dibujar.
    _helpAnchorTo(target, spot, bubble, layer.querySelector('.help-guide-arrow'));
    _helpScrollIntoView(target, bubble);
    setTimeout(() => {
        if (!helpTour.open) return;
        if (helpTour.steps[helpTour.index] !== step) return;
        _helpAnchorTo(target, spot, bubble, layer.querySelector('.help-guide-arrow'));
    }, 260);
}

/** Recorta el foco sobre el elemento y acomoda la burbuja a su lado. */
function _helpAnchorTo(target, spot, bubble, arrow) {
    const r = target.getBoundingClientRect();
    const pad = 8;
    spot.classList.remove('is-hidden');
    spot.style.top    = `${r.top - pad}px`;
    spot.style.left   = `${r.left - pad}px`;
    spot.style.width  = `${r.width + pad * 2}px`;
    spot.style.height = `${r.height + pad * 2}px`;
    _helpPlaceBubble(bubble, arrow, r);
}

/**
 * Acerca el elemento señalado si quedó fuera del area util.
 *
 * En pantallas angostas la burbuja se ancla al pie, asi que la franja que ocupa
 * cuenta como "fuera de vista": sin esto, un boton que estaba abajo de todo
 * quedaba resaltado justo debajo de la burbuja que lo explicaba.
 */
function _helpScrollIntoView(el, bubble) {
    const esAngosta = window.innerWidth <= 640;
    const reservaAbajo = esAngosta && bubble
        ? bubble.offsetHeight + 36
        : 70;
    const r = el.getBoundingClientRect();
    const fueraDeVista = r.top < 70 || r.bottom > window.innerHeight - reservaAbajo;
    if (!fueraDeVista) return;
    try { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
    catch (_) { el.scrollIntoView(); }
}

/**
 * Ubica la burbuja al lado del elemento señalado.
 *
 * En pantallas angostas no se intenta: la burbuja se ancla al pie, ocupando el
 * ancho disponible. Encajarla al costado de un botón en un celular terminaba en
 * una caja de dos palabras por renglón.
 */
function _helpPlaceBubble(bubble, arrow, rect) {
    const esAngosta = window.innerWidth <= 640;
    if (esAngosta) {
        bubble.classList.add('is-centered');
        bubble.style.top = '';
        bubble.style.left = '';
        arrow.style.display = 'none';
        return;
    }

    bubble.classList.remove('is-centered');
    arrow.style.display = '';

    const bw = bubble.offsetWidth;
    const bh = bubble.offsetHeight;
    const margen = 12;

    const espacioAbajo  = window.innerHeight - rect.bottom;
    const ponerAbajo    = espacioAbajo >= bh + HELP_STEP_GAP || rect.top < bh + HELP_STEP_GAP;

    let top  = ponerAbajo ? rect.bottom + HELP_STEP_GAP : rect.top - bh - HELP_STEP_GAP;
    let left = rect.left + rect.width / 2 - bw / 2;

    left = Math.max(margen, Math.min(left, window.innerWidth - bw - margen));
    top  = Math.max(margen, Math.min(top, window.innerHeight - bh - margen));

    bubble.style.top  = `${top}px`;
    bubble.style.left = `${left}px`;

    // La flecha apunta al centro del elemento, clampeada para no salirse del
    // borde redondeado de la burbuja.
    const centroX = rect.left + rect.width / 2 - left;
    arrow.style.left = `${Math.max(18, Math.min(centroX, bw - 18))}px`;
    arrow.classList.toggle('is-up', ponerAbajo);
    arrow.classList.toggle('is-down', !ponerAbajo);
}

// -----------------------------------------------------------------------------
// Botón flotante
// -----------------------------------------------------------------------------

function ensureHelpButton() {
    const dock = ensureFloatingDock();
    let btn = document.getElementById('help-guide-fab');
    if (!btn) {
        btn = document.createElement('button');
        btn.type = 'button';
        btn.id = 'help-guide-fab';
        btn.className = 'odentara-fab odentara-fab-help';
        btn.setAttribute('aria-label', 'Ayuda de esta pantalla');
        btn.setAttribute('title', 'Ayuda de esta pantalla');
        btn.innerHTML = '<i class="fa-solid fa-question"></i>';
        btn.addEventListener('click', openHelpGuide);
        dock.appendChild(btn);
    }
    return btn;
}

/** El tour queda atado a la pantalla que se estaba mirando: al navegar, se cierra. */
function resetHelpGuideForView() {
    if (helpTour.open) closeHelpGuide();
}

window.openHelpGuide  = openHelpGuide;
window.closeHelpGuide = closeHelpGuide;
