// =============================================================================
// dashboard.js — Vista de dashboard y contenido del panel
// =============================================================================

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

