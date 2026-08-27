// =============================================================================
// platform-expenses.js — Gastos de la plataforma
// =============================================================================
//
// Lo que cuesta hacer funcionar Odentara: hosting, dominio, la API de IA, el
// contador. No son gastos de una clínica —de hecho `Expense` es la única tabla
// sin `clinicId`—, así que esto vive en el panel de plataforma y solo lo ve el
// administrador.
//
// Usa las clases `pa-*` del panel, no las de la app: son dos sistemas visuales
// distintos y mezclarlos deja campos blancos sobre fondo negro.

const GASTO_CATEGORIAS = [
    { valor: 'hosting',   label: 'Hosting' },
    { valor: 'dominio',   label: 'Dominio' },
    { valor: 'ia',        label: 'IA / APIs' },
    { valor: 'software',  label: 'Software' },
    { valor: 'marketing', label: 'Marketing' },
    { valor: 'contador',  label: 'Contador' },
    { valor: 'impuestos', label: 'Impuestos' },
    { valor: 'otros',     label: 'Otros' },
];

function etiquetaCategoriaGasto(valor) {
    return GASTO_CATEGORIAS.find(c => c.valor === valor)?.label || 'Otros';
}

function fechaCortaGasto(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('es-AR');
}

/**
 * Un bloque de balance por cada moneda.
 *
 * Nunca un total único: pesos y dólares no se suman. Con una sola moneda en uso
 * se ve un solo bloque y no molesta; en cuanto aparece un gasto en dólares, el
 * renglón existe aunque no haya ningún cobro en dólares — si no, ese gasto
 * quedaría invisible y el resultado se vería mejor de lo que es.
 */
function balanceGastosHtml(balance) {
    if (!balance || !balance.length) {
        return '<div class="pa-empty"><p>Todavía no hay cobros ni gastos registrados.</p></div>';
    }

    return `<div class="gasto-balance-grid">${balance.map(b => `
        <div class="gasto-balance-card">
            <div class="gasto-balance-moneda">${escapeHtml(b.moneda)}</div>
            <div class="gasto-balance-filas">
                <div><span>Cobrado</span><b class="positivo">${formatearMonto(b.ingresos, b.moneda)}</b></div>
                <div><span>Gastado</span><b class="negativo">${formatearMonto(b.gastos, b.moneda)}</b></div>
            </div>
            <div class="gasto-balance-neto ${b.neto < 0 ? 'en-rojo' : ''}">
                <span>Resultado</span>
                <b>${b.neto < 0 ? '-' : ''}${formatearMonto(Math.abs(b.neto), b.moneda)}</b>
            </div>
        </div>`).join('')}</div>`;
}

async function renderPlatformExpenses(container) {
    injectPlatformStyles();
    container.innerHTML = '<div class="pa-empty"><p>Cargando gastos…</p></div>';

    let datos;
    try {
        datos = await apiFetch('/platform/expenses');
    } catch (error) {
        container.innerHTML = renderPlatformShell('platform-expenses',
            '<div class="pa-empty"><i class="fa-solid fa-triangle-exclamation"></i><p>'
            + escapeHtml(error.message || 'No se pudieron cargar los gastos.') + '</p></div>');
        return;
    }

    const gastos = datos.expenses || [];
    const hoy = new Date().toISOString().slice(0, 10);

    const tabla = gastos.length
        ? `<div class="pa-table-wrap"><table class="pa-table">
                <thead><tr>
                    <th>Fecha</th><th>Descripción</th><th>Categoría</th><th>Monto</th><th></th>
                </tr></thead>
                <tbody>${gastos.map(g => `
                    <tr>
                        <td class="td-meta">${fechaCortaGasto(g.paidAt)}</td>
                        <td class="td-name">${escapeHtml(g.description)}
                            ${g.notes ? `<div class="td-meta">${escapeHtml(g.notes)}</div>` : ''}</td>
                        <td><span class="pa-badge pa-badge-inactive">${escapeHtml(etiquetaCategoriaGasto(g.category))}</span></td>
                        <td class="td-name">${formatearMonto(g.amount, g.currency)}</td>
                        <td class="td-actions">
                            <button type="button" class="pa-btn pa-btn-ghost pa-btn-icon" title="Borrar"
                                    data-borrar-gasto="${g.id}"><i class="fa-solid fa-trash"></i></button>
                        </td>
                    </tr>`).join('')}</tbody>
           </table></div>`
        : '<div class="pa-empty"><i class="fa-solid fa-receipt"></i><p>Todavía no cargaste ningún gasto.</p></div>';

    container.innerHTML = renderPlatformShell('platform-expenses', `
        <div class="pa-page-header">
            <div>
                <div class="pa-page-title">Gastos</div>
                <div class="pa-page-sub">Lo que cuesta hacer funcionar la plataforma, contra lo que cobrás.</div>
            </div>
        </div>

        <div class="backup-bloque">
            <div class="backup-bloque-titulo">Balance general</div>
            ${balanceGastosHtml(datos.balance)}
            <p class="backup-note">Cada moneda lleva su propia cuenta. Los importes en pesos y en dólares no se suman entre sí.</p>
        </div>

        <div class="backup-bloque">
            <div class="backup-bloque-titulo">Registrar un gasto</div>
            <form id="gasto-form" class="backup-form">
                <div class="backup-campo" style="flex:2 1 220px">
                    <label class="pa-label">Descripción</label>
                    <input type="text" id="gs-desc" class="pa-input" placeholder="Hosting Hostinger — agosto" required>
                </div>
                <div class="backup-campo">
                    <label class="pa-label">Categoría</label>
                    <select id="gs-categoria" class="pa-select">
                        ${GASTO_CATEGORIAS.map(c => `<option value="${c.valor}">${c.label}</option>`).join('')}
                    </select>
                </div>
                <div class="backup-campo backup-campo-chico">
                    <label class="pa-label">Monto</label>
                    <!-- type=text: con number, escribir "1500,50" deja el campo
                         inválido y su value viene vacío. El servidor acepta coma. -->
                    <input type="text" inputmode="decimal" id="gs-monto" class="pa-input" placeholder="0" required>
                </div>
                <div class="backup-campo backup-campo-chico">
                    <label class="pa-label">Moneda</label>
                    <select id="gs-moneda" class="pa-select">
                        ${MONEDAS.map(m => `<option value="${m.codigo}">${m.simbolo} ${m.codigo}</option>`).join('')}
                    </select>
                </div>
                <div class="backup-campo backup-campo-chico">
                    <label class="pa-label">Fecha</label>
                    <input type="date" id="gs-fecha" class="pa-input" value="${hoy}">
                </div>
                <button type="submit" class="pa-btn pa-btn-primary">
                    <i class="fa-solid fa-plus"></i> Agregar
                </button>
            </form>
        </div>

        <div class="backup-bloque">
            <div class="backup-bloque-titulo">Historial</div>
            ${tabla}
        </div>
    `);
}

async function guardarGasto() {
    const body = {
        description: document.getElementById('gs-desc')?.value.trim(),
        category:    document.getElementById('gs-categoria')?.value,
        amount:      document.getElementById('gs-monto')?.value.trim(),
        currency:    document.getElementById('gs-moneda')?.value,
        paidAt:      document.getElementById('gs-fecha')?.value || undefined,
    };

    try {
        await apiFetch('/platform/expenses', { method: 'POST', body: JSON.stringify(body) });
        showToast('Gasto registrado.', { type: 'success' });
        await loadView('platform-expenses', 'Gastos', { skipSync: true });
    } catch (error) {
        showAlert(error.message || 'No se pudo registrar el gasto.', { title: 'Gastos', variant: 'error' });
    }
}

async function borrarGasto(id) {
    const ok = await showConfirm('¿Borrar este gasto? No se puede deshacer.',
        { title: 'Borrar gasto', confirmText: 'Borrar', variant: 'danger' });
    if (!ok) return;

    try {
        await apiFetch(`/platform/expenses/${id}`, { method: 'DELETE' });
        showToast('Gasto borrado.', { type: 'success' });
        await loadView('platform-expenses', 'Gastos', { skipSync: true });
    } catch (error) {
        showAlert(error.message || 'No se pudo borrar el gasto.', { title: 'Gastos', variant: 'error' });
    }
}
