// =============================================================================
// platform-backups.js — Backups desde el panel de plataforma
// =============================================================================
//
// El backup es de TODA la base, no de una clínica: todas comparten esquema y
// archivo, y restaurar afecta a todas por igual. Por eso vive en el panel de
// plataforma y no en la configuración de cada clínica.
//
// Usa las clases `pa-*` que define el propio panel (pa-btn, pa-input, pa-table,
// pa-badge…) y no las de la app. Son dos sistemas visuales distintos: el panel
// es oscuro y compacto, la app es clara. Mezclarlos deja títulos oscuros sobre
// fondo oscuro y campos blancos en una pantalla negra.

const BACKUP_FRECUENCIAS = [
    { valor: 'daily',    label: 'Todos los días' },
    { valor: 'weekdays', label: 'Lunes a viernes' },
    { valor: 'weekly',   label: 'Una vez por semana' },
];

const BACKUP_DIAS = [
    { valor: 1, label: 'Lunes' },     { valor: 2, label: 'Martes' },
    { valor: 3, label: 'Miércoles' }, { valor: 4, label: 'Jueves' },
    { valor: 5, label: 'Viernes' },   { valor: 6, label: 'Sábado' },
    { valor: 7, label: 'Domingo' },
];

function formatearBytesBackup(bytes) {
    if (bytes === null || bytes === undefined) return '—';
    if (bytes < 1024) return bytes + ' B';
    const unidades = ['KB', 'MB', 'GB'];
    let valor = bytes / 1024;
    let i = 0;
    while (valor >= 1024 && i < unidades.length - 1) { valor /= 1024; i += 1; }
    return valor.toFixed(2) + ' ' + unidades[i];
}

/**
 * Fecha y hora de un backup, en reloj de 24.
 *
 * `hour12` va explícito porque toLocaleString('es-AR') devuelve las 13:20 como
 * "01:20:00" —formato de 12 y sin AM/PM—, así que un backup de la una de la
 * mañana y uno de la una de la tarde se veían idénticos. Justo en la pantalla
 * donde se diagnostica por qué falla el backup nocturno.
 */
function formatearFechaBackup(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('es-AR', { hour12: false });
}

function filaBackupHtml(b) {
    const estado = b.status === 'ok'
        ? '<span class="pa-badge pa-badge-active">Completado</span>'
        : b.status === 'error'
            ? '<span class="pa-badge backup-badge-error">Falló</span>'
            : '<span class="pa-badge pa-badge-inactive">En curso</span>';

    // El botón de descarga solo aparece si el archivo sigue en disco. Un
    // registro "ok" cuyo archivo borró la retención no se puede bajar, y
    // ofrecerlo sería prometer algo que no existe.
    const descarga = b.disponible
        ? '<button type="button" class="pa-btn pa-btn-ghost pa-btn-icon" data-descargar-backup="'
          + escapeHtml(b.fileName) + '" title="Descargar"><i class="fa-solid fa-download"></i></button>'
        : '<span class="td-meta">no disponible</span>';

    const filaError = (b.status === 'error' && b.error)
        ? `<tr class="backup-fila-error"><td colspan="6">${escapeHtml(b.error)}</td></tr>`
        : '';

    return `
        <tr>
            <td class="td-name">${formatearFechaBackup(b.startedAt)}</td>
            <td class="td-meta">${b.trigger === 'scheduled' ? 'Automático' : 'Manual'}</td>
            <td>${estado}</td>
            <td class="td-meta">${b.totalRows != null ? b.totalRows.toLocaleString('es-AR') : '—'}</td>
            <td class="td-meta">${formatearBytesBackup(b.bytes)}</td>
            <td class="td-actions">${descarga}</td>
        </tr>
        ${filaError}
    `;
}

async function renderPlatformBackups(container) {
    container.innerHTML = '<div class="pa-empty"><p>Cargando backups…</p></div>';

    let datos;
    try {
        datos = await apiFetch('/platform/backups');
    } catch (error) {
        container.innerHTML = renderPlatformShell('platform-backups',
            '<div class="pa-empty"><i class="fa-solid fa-triangle-exclamation"></i><p>'
            + escapeHtml(error.message || 'No se pudo cargar el historial.') + '</p></div>');
        return;
    }

    const cfg = datos.schedule || {};
    const backups = datos.backups || [];
    const horaActual = String(cfg.hour ?? 3).padStart(2, '0') + ':' + String(cfg.minute ?? 0).padStart(2, '0');

    const tabla = backups.length
        ? `<div class="pa-table-wrap"><table class="pa-table">
                <thead><tr>
                    <th>Fecha</th><th>Origen</th><th>Estado</th><th>Filas</th><th>Tamaño</th><th></th>
                </tr></thead>
                <tbody>${backups.map(filaBackupHtml).join('')}</tbody>
           </table></div>`
        : '<div class="pa-empty"><i class="fa-solid fa-database"></i><p>Todavía no hay backups. Creá el primero con el botón de arriba.</p></div>';

    // El aviso va arriba de todo, antes que cualquier otra cosa. Una fila roja
    // perdida en el historial no alcanza: así se descubrió tarde que el backup
    // automático del 25/8 había fallado.
    const alerta = datos.alerta
        ? `<div class="backup-alerta backup-alerta-${datos.alerta.nivel === 'error' ? 'error' : 'aviso'}">
               <i class="fa-solid ${datos.alerta.nivel === 'error' ? 'fa-circle-exclamation' : 'fa-triangle-exclamation'}"></i>
               <span>${escapeHtml(datos.alerta.mensaje)}</span>
           </div>`
        : '';

    container.innerHTML = renderPlatformShell('platform-backups', `
        ${alerta}
        <div class="pa-page-header">
            <div>
                <div class="pa-page-title">Backups</div>
                <div class="pa-page-sub">Copia completa de la base. Incluye todas las clínicas.</div>
            </div>
            <button type="button" class="pa-btn pa-btn-primary" id="btn-backup-ahora">
                <i class="fa-solid fa-database"></i> Crear backup ahora
            </button>
        </div>

        <div class="backup-bloque">
            <div class="backup-bloque-titulo">Backup automático</div>
            <form id="backup-schedule-form" class="backup-form">
                <label class="backup-check">
                    <input type="checkbox" id="bk-enabled" ${cfg.enabled ? 'checked' : ''}>
                    <span>Activado</span>
                </label>
                <div class="backup-campo">
                    <label class="pa-label">Frecuencia</label>
                    <select id="bk-frequency" class="pa-select">
                        ${BACKUP_FRECUENCIAS.map((f) =>
                            `<option value="${f.valor}" ${cfg.frequency === f.valor ? 'selected' : ''}>${f.label}</option>`
                        ).join('')}
                    </select>
                </div>
                <div class="backup-campo" id="bk-weekday-wrap">
                    <label class="pa-label">Día</label>
                    <select id="bk-weekday" class="pa-select">
                        ${BACKUP_DIAS.map((d) =>
                            `<option value="${d.valor}" ${Number(cfg.weekday) === d.valor ? 'selected' : ''}>${d.label}</option>`
                        ).join('')}
                    </select>
                </div>
                <div class="backup-campo backup-campo-chico">
                    <label class="pa-label">Hora</label>
                    <input type="time" id="bk-time" class="pa-input" value="${horaActual}">
                </div>
                <div class="backup-campo backup-campo-chico">
                    <label class="pa-label">Conservar</label>
                    <input type="number" id="bk-keep" class="pa-input" min="2" max="60" value="${cfg.keepLast ?? 10}">
                </div>
                <button type="submit" class="pa-btn pa-btn-ghost">Guardar programación</button>
            </form>
            <p class="backup-note">Horario de Argentina. Al superar la cantidad a conservar, los más viejos se borran solos.</p>
        </div>

        <div class="backup-bloque">
            <div class="backup-bloque-titulo">Historial</div>
            <p class="backup-note">Los archivos viven en <code>${escapeHtml(datos.carpeta || '')}</code>, fuera de la carpeta que sirve la web.</p>
            ${tabla}
            <p class="backup-note backup-note-strong">
                Un backup no está verificado hasta que se prueba restaurándolo. Bajalo y corré
                <code>npm run backup:verify</code> en tu máquina antes de confiar en él para un deploy.
            </p>
        </div>
    `);

    ajustarVisibilidadDiaBackup();
}

/**
 * El selector de día solo tiene sentido con frecuencia semanal. Mostrarlo
 * siempre invita a configurarlo y a creer que se está aplicando.
 */
function ajustarVisibilidadDiaBackup() {
    const freq = document.getElementById('bk-frequency');
    const wrap = document.getElementById('bk-weekday-wrap');
    if (freq && wrap) wrap.style.display = freq.value === 'weekly' ? '' : 'none';
}

async function crearBackupAhora() {
    const confirmado = await showConfirm(
        'Se va a generar una copia completa de la base ahora mismo. Puede tardar unos segundos.',
        { title: 'Crear backup', confirmText: 'Crear', variant: 'success' }
    );
    if (!confirmado) return;

    try {
        const res = await withAppLoading('Creando backup...', () =>
            apiFetch('/platform/backups', { method: 'POST' })
        );
        showToast(res.message || 'Backup creado.', { type: 'success' });
        await loadView('platform-backups', 'Backups', { skipSync: true });
    } catch (error) {
        showAlert(error.message || 'No se pudo crear el backup.', { title: 'Backups', variant: 'error' });
    }
}

async function guardarProgramacionBackup() {
    const partes = String(document.getElementById('bk-time')?.value || '03:00').split(':');

    try {
        const res = await apiFetch('/platform/backups/schedule', {
            method: 'PUT',
            body: JSON.stringify({
                enabled:   document.getElementById('bk-enabled')?.checked || false,
                frequency: document.getElementById('bk-frequency')?.value,
                hour:      Number(partes[0]),
                minute:    Number(partes[1]),
                weekday:   Number(document.getElementById('bk-weekday')?.value),
                keepLast:  Number(document.getElementById('bk-keep')?.value),
            }),
        });
        showToast(res.message || 'Programación guardada.', { type: 'success' });
    } catch (error) {
        showAlert(error.message || 'No se pudo guardar la programación.', { title: 'Backups', variant: 'error' });
    }
}

/**
 * Descarga en dos pasos: se pide un permiso de vida corta con el token de
 * sesión y recién ahí se navega. Hace falta porque una descarga por navegación
 * del navegador no lleva el header Authorization.
 */
async function descargarBackup(archivo) {
    try {
        const res = await apiFetch(
            `/platform/backups/${encodeURIComponent(archivo)}/download-token`,
            { method: 'POST' }
        );
        window.location.href = res.url;
    } catch (error) {
        showAlert(error.message || 'No se pudo preparar la descarga.', { title: 'Backups', variant: 'error' });
    }
}
