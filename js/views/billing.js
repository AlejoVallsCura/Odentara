// =============================================================================
// billing.js — Vista de cuentas corrientes y facturacion
// =============================================================================

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
