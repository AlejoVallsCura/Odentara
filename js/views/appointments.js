// =============================================================================
// appointments.js — Vista de turnos, calendario, profesionales
// =============================================================================

function getAppointmentStatusMeta(status) {
    const normalized = normalizeAppointmentStatus(status);
    if (normalized === 'confirmed') return { key: normalized, label: 'Confirmado', badge: 'badge-success', color: '#10b981' };
    if (normalized === 'rescheduled') return { key: normalized, label: 'Reprogramado', badge: 'badge-purple', color: '#7c3aed' };
    if (normalized === 'cancelled') return { key: normalized, label: 'Cancelado', badge: 'badge-danger', color: '#ef4444' };
    if (normalized === 'sent') return { key: normalized, label: 'Enviado / Sin respuesta', badge: 'badge-info', color: '#3b82f6' };
    return { key: 'not_sent', label: 'Sin enviar', badge: 'badge-warning', color: '#f59e0b' };
}

function renderStatusDropdownHtml(aptId, statusMeta) {
    const opts = [
        { value: 'not_sent',    label: 'Sin enviar',   badge: 'badge-warning' },
        { value: 'sent',        label: 'Enviado',       badge: 'badge-info' },
        { value: 'confirmed',   label: 'Confirmado',    badge: 'badge-success' },
        { value: 'rescheduled', label: 'Reprogramado',  badge: 'badge-purple' },
        { value: 'cancelled',   label: 'Cancelado',     badge: 'badge-danger' }
    ];
    const optsHtml = opts.map(o =>
        `<button type="button" class="status-opt ${o.badge}${o.value === statusMeta.key ? ' is-current' : ''}" onclick="selectStatusOpt(this,${aptId},'${o.value}')">${o.label}</button>`
    ).join('');
    return `<div class="status-dropdown"><button type="button" class="status-dropdown-trigger ${statusMeta.badge}" onclick="toggleStatusDropdown(this)"><span>${statusMeta.label}</span><i class="fa-solid fa-chevron-down status-dropdown-chevron"></i></button><div class="status-dropdown-menu">${optsHtml}</div></div>`;
}

let _openStatusMenu = null; // { dropdown, menu, originalParent, close }

function _closeStatusMenu() {
    if (!_openStatusMenu) return;
    const { dropdown, menu, originalParent, close } = _openStatusMenu;
    // Null out first to prevent re-entrant calls
    _openStatusMenu = null;
    document.removeEventListener('click', close, true);
    dropdown.classList.remove('is-open');
    if (menu.parentNode === document.body) {
        document.body.removeChild(menu);
        // Only re-attach if originalParent is still in the document
        if (document.contains(originalParent)) {
            originalParent.appendChild(menu);
        }
    }
    menu.style.cssText = '';
}

window.toggleStatusDropdown = function(btn) {
    const dropdown = btn.closest('.status-dropdown');
    if (_openStatusMenu) {
        const wasThis = _openStatusMenu.dropdown === dropdown;
        _closeStatusMenu();
        if (wasThis) return; // toggle: cerrar si era el mismo
    }

    const menu = dropdown.querySelector('.status-dropdown-menu');
    if (!menu) return;

    const originalParent = menu.parentNode;
    const rect = btn.getBoundingClientRect();

    // Mover al body para escapar cualquier overflow/stacking context
    document.body.appendChild(menu);

    menu.style.cssText = `
        display: flex;
        flex-direction: column;
        position: fixed;
        top: ${rect.bottom + 5}px;
        left: ${rect.left}px;
        min-width: ${Math.max(rect.width, 160)}px;
        z-index: 99999;
    `;

    dropdown.classList.add('is-open');

    const close = (e) => {
        // Also close if dropdown was removed from document (page re-rendered)
        if (!document.contains(dropdown) || (!dropdown.contains(e.target) && !menu.contains(e.target))) {
            _closeStatusMenu();
        }
    };

    setTimeout(() => document.addEventListener('click', close, true), 10);
    _openStatusMenu = { dropdown, menu, originalParent, close };
};

window.selectStatusOpt = async function(btn, aptId, newStatus) {
    _closeStatusMenu();
    await updateAppointmentStatus(aptId, newStatus);
};

// ── Presencia en sala ──────────────────────────────────────────────────────
const PRESENCE_STATES = [
    { key: '',             label: 'Sin llegar',     icon: 'fa-circle-minus',    cls: 'presence-none'        },
    { key: 'waiting',      label: 'En sala',         icon: 'fa-couch',           cls: 'presence-waiting'     },
    { key: 'consulting',   label: 'En consultorio',  icon: 'fa-user-doctor',     cls: 'presence-consulting'  },
    { key: 'done',         label: 'Finalizado',      icon: 'fa-circle-check',    cls: 'presence-done'        },
];

function getPresenceState(aptId) {
    return localStorage.getItem(`apt_presence_${aptId}`) || '';
}

function renderPresenceBtnHtml(aptId) {
    const key   = getPresenceState(aptId);
    const state = PRESENCE_STATES.find(s => s.key === key) || PRESENCE_STATES[0];
    return `<button type="button" class="presence-btn ${state.cls}" onclick="cyclePresence(${aptId})" title="${state.label}"><i class="fa-solid ${state.icon}"></i><span>${state.label}</span></button>`;
}

window.cyclePresence = function(aptId) {
    const current = getPresenceState(aptId);
    const idx     = PRESENCE_STATES.findIndex(s => s.key === current);
    const next    = PRESENCE_STATES[(idx + 1) % PRESENCE_STATES.length];
    if (next.key === '') {
        localStorage.removeItem(`apt_presence_${aptId}`);
    } else {
        localStorage.setItem(`apt_presence_${aptId}`, next.key);
    }
    // Actualizar solo el botón sin re-renderizar toda la vista
    const btn = document.querySelector(`.presence-btn[onclick="cyclePresence(${aptId})"]`);
    if (btn) {
        PRESENCE_STATES.forEach(s => btn.classList.remove(s.cls));
        btn.classList.add(next.cls);
        btn.title = next.label;
        btn.innerHTML = `<i class="fa-solid ${next.icon}"></i><span>${next.label}</span>`;
    }
};
// ──────────────────────────────────────────────────────────────────────────

window.updateAppointmentStatus = async function(aptId, nextStatus) {
    if (!canManageAppointmentStatusUi()) {
        showAlert('No tienes permisos para modificar la confirmación de los turnos.', { title: 'Turnos', variant: 'error' });
        return;
    }

    if (!nextStatus) return;
    const normalizedNextStatus = normalizeAppointmentStatus(nextStatus);

    try {
        if (state.authToken) {
            // Leer el turno actual desde la API para obtener status fresco
            const aptRes = await apiFetch(`/appointments/${aptId}`);
            const apt = aptRes.appointment;
            if (!apt) return;

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
            const apt = DB.get('appointments').find(item => item.id === aptId);
            if (!apt) return;
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

    try {
        if (state.authToken) {
            // Leer el turno desde la API para obtener el estado actual
            const aptRes = await apiFetch(`/appointments/${aptId}`);
            const apt = aptRes.appointment;
            if (!apt) return;
            const normalizedStatus = normalizeAppointmentStatus(apt.status);
            if (normalizedStatus !== 'not_sent') return;

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
            const apt = DB.get('appointments').find(item => item.id === aptId);
            if (!apt) return;
            const normalizedStatus = normalizeAppointmentStatus(apt.status);
            if (normalizedStatus !== 'not_sent') return;
            DB.update('appointments', aptId, { status: 'sent' });
        }
    } catch (error) {
        showAlert(error.message || 'No se pudo actualizar el estado del turno.', { title: 'Turnos', variant: 'error' });
        return;
    }
    if (state.currentView === 'dashboard' || state.currentView === 'appointments') refreshCurrentView();
};

window.sendWhatsAppMessage = async function(aptId) {
    if (!canSendAppointmentWhatsappUi()) {
        showAlert('No tienes permisos para enviar confirmaciones por WhatsApp.', { title: 'Turnos', variant: 'error' });
        return;
    }
    const aptLocal = DB.get('appointments').find(a => a.id === aptId);
    const patient  = getPatientByAppointment(aptLocal);
    const link     = getWhatsAppLink(patient, aptLocal);
    if (!link) return;

    // Abrir WhatsApp primero
    window.open(link, '_blank', 'noopener,noreferrer');

    // Confirmar si se pudo enviar
    setTimeout(async () => {
        const sent = await showConfirm(
            '¿Pudiste enviar el mensaje de confirmación al paciente?',
            {
                title: 'Confirmar envío por WhatsApp',
                variant: 'success',
                confirmText: 'Sí, lo envié',
                cancelText: 'Todavía no'
            }
        );
        if (sent) await markAppointmentAsSent(aptId);
    }, 400);
};

window._cancelEditUser = function() {
    state.editingUserId = null;
    state.settingsSubView = 'create-user';
    refreshCurrentView();
};

window._cancelEditProf = function() {
    state.editingProfId = null;
    state.settingsSubView = 'create-professional';
    refreshCurrentView();
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
                    <button type="button" class="modal-close-x" onclick="closeModal()" aria-label="Cerrar"><i class="fa-solid fa-xmark"></i></button>
                </div>
                <div class="modal-body">
                    <div class="apt-view-info-grid">
                        <div class="apt-view-row"><strong>Paciente</strong><span>${escapeHtml(apt.patient)}</span></div>
                        <div class="apt-view-row"><strong>Teléfono</strong><span>${escapeHtml(patient?.phone || '—')}</span></div>
                        <div class="apt-view-row"><strong>Profesional</strong><span>${escapeHtml(prof?.name || '—')}</span></div>
                        <div class="apt-view-row"><strong>Fecha</strong><span>${normalizeDateLabel(parseLocalIsoDate(apt.date).toLocaleDateString('es-AR', { weekday:'long', day:'numeric', month:'long', year:'numeric' }))}</span></div>
                        <div class="apt-view-row"><strong>Hora</strong><span>${apt.time} · ${apt.duration} min</span></div>
                        <div class="apt-view-row"><strong>Estado</strong><span class="badge ${statusMeta.badge}">${statusMeta.label}</span></div>
                        ${apt.notes ? `<div class="apt-view-row apt-view-row-full"><strong>Motivo</strong><span>${escapeHtml(apt.notes)}</span></div>` : ''}
                    </div>
                </div>
                <div class="modal-footer">
                    ${patient && canViewClinicalHistoryUi() ? `<button type="button" class="btn btn-secondary" onclick="closeModal(); loadClinicalHistory(${patient.id})">Historia Clínica</button>` : ''}
                    ${canEditCalendar() && apt.status !== 'cancelled' ? `<button type="button" class="btn btn-cancel-apt" onclick="closeModal(); _confirmCancelApt(${aptId})"><i class="fa-solid fa-ban"></i> Cancelar turno</button>` : ''}
                    ${canEditCalendar() ? `<button type="button" class="btn btn-primary" onclick="openAppointmentModal(${aptId})">Editar turno</button>` : ''}
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
        alert("Atención: Necesitas crear al menos un paciente en el directorio antes de agendar un turno.");
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
                            <label>Profesional *</label>
                            <select id="apt-professional" required>
                                ${!apt ? '<option value="">— Seleccionar profesional —</option>' : ''}
                                ${professionals.map(p => `<option value="${p.id}" ${apt && apt.professionalId === p.id ? 'selected':''}>${escapeHtml(p.name)}</option>`).join('')}
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
                            <label>Duración</label>
                            <select id="apt-duration">
                                <option value="30" ${!apt || apt.duration===30?'selected':''}>30 minutos</option>
                                <option value="60" ${apt && apt.duration===60?'selected':''}>60 minutos (1 hora)</option>
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

    // ESC cierra el modal de turno
    const _aptEscHandler = (e) => {
        if (e.key !== 'Escape') return;
        closeModal();
    };
    document.addEventListener('keydown', _aptEscHandler, { once: true });

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
        
        const currentDur = parseInt(durSelect.value) || (apt ? apt.duration : 30);
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
            alert('No se pueden sacar turnos para días anteriores.');
            return;
        }

        if (isTodayDate(selectedDate) && !isOverbook && selectedMinutes !== null && selectedMinutes < getCurrentMinutes()) {
            alert('Ese horario ya pasó. Para horarios pasados del día de hoy solo se permiten sobreturnos.');
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
            alert('Selecciona un paciente válido.');
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

function buildSchedTimePicker(id, value) {
    const [hStr, mStr] = (value || '08:00').split(':');
    const selH = parseInt(hStr) || 0;
    const selM = parseInt(mStr) || 0;
    const hours   = Array.from({length: 24}, (_, i) => `<button type="button" class="stp-item${i === selH ? ' is-sel' : ''}" data-val="${i}">${String(i).padStart(2,'0')}</button>`).join('');
    const minutes = Array.from({length: 60}, (_, i) => `<button type="button" class="stp-item${i === selM ? ' is-sel' : ''}" data-val="${i}">${String(i).padStart(2,'0')}</button>`).join('');
    return `<div class="stp-wrap" data-id="${id}">
        <input type="hidden" id="${id}" value="${String(selH).padStart(2,'0')}:${String(selM).padStart(2,'0')}">
        <button type="button" class="stp-trigger">${String(selH).padStart(2,'0')}:${String(selM).padStart(2,'0')}</button>
        <div class="stp-dropdown" hidden>
            <div class="stp-cols">
                <div class="stp-col-wrap"><div class="stp-col-label">HH</div><div class="stp-col" data-unit="h">${hours}</div></div>
                <div class="stp-sep">:</div>
                <div class="stp-col-wrap"><div class="stp-col-label">MM</div><div class="stp-col" data-unit="m">${minutes}</div></div>
            </div>
            <button type="button" class="stp-confirm">Listo</button>
        </div>
    </div>`;
}

function initSchedTimePickers() {
    document.querySelectorAll('.stp-wrap').forEach(wrap => {
        const id = wrap.dataset.id;
        const hidden = document.getElementById(id);
        const trigger = wrap.querySelector('.stp-trigger');
        const dropdown = wrap.querySelector('.stp-dropdown');

        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = !dropdown.hidden;
            document.querySelectorAll('.stp-dropdown').forEach(d => { d.hidden = true; });
            if (isOpen) return;
            dropdown.hidden = false;
            // Scroll to selected items
            dropdown.querySelectorAll('.stp-col').forEach(col => {
                const sel = col.querySelector('.is-sel');
                if (sel) { col.scrollTop = sel.offsetTop - col.clientHeight / 2 + sel.clientHeight / 2; }
            });
        });

        wrap.querySelector('.stp-col[data-unit="h"]').addEventListener('click', (e) => {
            const btn = e.target.closest('.stp-item');
            if (!btn) return;
            e.stopPropagation();
            wrap.querySelectorAll('.stp-col[data-unit="h"] .stp-item').forEach(b => b.classList.remove('is-sel'));
            btn.classList.add('is-sel');
            const [, m] = hidden.value.split(':');
            hidden.value = `${String(btn.dataset.val).padStart(2,'0')}:${m}`;
            trigger.textContent = hidden.value;
        });

        wrap.querySelector('.stp-col[data-unit="m"]').addEventListener('click', (e) => {
            const btn = e.target.closest('.stp-item');
            if (!btn) return;
            e.stopPropagation();
            wrap.querySelectorAll('.stp-col[data-unit="m"] .stp-item').forEach(b => b.classList.remove('is-sel'));
            btn.classList.add('is-sel');
            const [h] = hidden.value.split(':');
            hidden.value = `${h}:${String(btn.dataset.val).padStart(2,'0')}`;
            trigger.textContent = hidden.value;
        });

        wrap.querySelector('.stp-confirm').addEventListener('click', (e) => {
            e.stopPropagation();
            dropdown.hidden = true;
        });
    });
}

function openScheduleModal(profId) {
    if (!canAccessProfessional(profId)) return;
    const prof = DB.get('professionals').find(x => x.id === profId);
    
    const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    
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
                        ${buildSchedTimePicker(`sch-start-${i}`, d.start)}
                    </div>
                    <div class="schedule-time-separator">a</div>
                    <div class="schedule-time-field">
                        <span class="schedule-time-caption">Hasta</span>
                        ${buildSchedTimePicker(`sch-end-${i}`, d.end)}
                    </div>
                </div>
            </div>
        `;
    }

    modalsContainer.innerHTML = `
        <div class="modal-overlay active">
            <div class="modal-content modal-content-schedule w-auto max-w-2xl" onclick="event.stopPropagation()">
                <div class="modal-header">
                    <h3>Horarios Diarios de ${escapeHtml(prof.name)}</h3>
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
    initSchedTimePickers();
    // ESC cierra el modal
    const _escHandler = (e) => {
        if (e.key !== 'Escape') return;
        closeModal();
    };
    document.addEventListener('keydown', _escHandler, { once: true });
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
        // Validar cada día activo
        for (let i = 0; i < 7; i++) {
            if (!newSched[i].active) continue;
            const start = newSched[i].start;
            const end = newSched[i].end;

            // Convertir a minutos
            const [sh, sm] = start.split(':').map(Number);
            const [eh, em] = end.split(':').map(Number);
            const startMins = sh * 60 + sm;
            const endMins = eh * 60 + em;

            const days = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];

            if (startMins >= endMins) {
                alert(`${days[i]}: el horario de inicio debe ser antes que el de fin.`);
                return;
            }
            if (endMins - startMins < 30) {
                alert(`${days[i]}: el horario mínimo de atención es 30 minutos.`);
                return;
            }
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

// --- Calendar State ---
const calendarState = {
    currentDate: getTodayIsoLocal(),
    viewMode: 'day', // 'day', 'week', 'month'
    visibleProfs: {},
    nowIndicatorTimer: null
};

function startNowIndicator() {
    if (calendarState.nowIndicatorTimer) {
        clearInterval(calendarState.nowIndicatorTimer);
        calendarState.nowIndicatorTimer = null;
    }
    const lineEl   = document.getElementById('cal-now-line');
    const gutterEl = document.getElementById('cal-now-gutter');
    const timeEl   = document.getElementById('cal-now-time');
    if (!lineEl) return;

    const startMin  = parseFloat(lineEl.dataset.startMin);
    const pxPerMin  = parseFloat(lineEl.dataset.pxPerMin);
    const topOffset = parseFloat(lineEl.dataset.topOffset);
    const endMin    = parseFloat(lineEl.dataset.endMin);

    function update() {
        const now   = new Date();
        const nowMin = now.getHours() * 60 + now.getMinutes();
        // Hide if outside the visible range
        const visible = nowMin >= startMin && nowMin <= endMin;
        const display = visible ? '' : 'none';
        lineEl.style.display   = display;
        if (gutterEl) gutterEl.style.display = display;
        if (!visible) return;
        const top = (nowMin - startMin) * pxPerMin + topOffset;
        lineEl.style.top   = top + 'px';
        if (gutterEl) gutterEl.style.top = top + 'px';
        if (timeEl) {
            timeEl.textContent = String(now.getHours()).padStart(2,'0') + ':' + String(now.getMinutes()).padStart(2,'0');
        }
    }
    update();
    calendarState.nowIndicatorTimer = setInterval(update, 10000);
}

function stopNowIndicator() {
    if (calendarState.nowIndicatorTimer) {
        clearInterval(calendarState.nowIndicatorTimer);
        calendarState.nowIndicatorTimer = null;
    }
}

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
    { bg: '#14b8a6', text: '#ffffff' },
    { bg: '#8b5cf6', text: '#ffffff' },
    { bg: '#f97316', text: '#ffffff' },
    { bg: '#3b82f6', text: '#ffffff' },
    { bg: '#eab308', text: '#111827' },
    { bg: '#ec4899', text: '#ffffff' },
    { bg: '#10b981', text: '#ffffff' },
];

/**
 * Devuelve '#111827' (negro) o '#ffffff' (blanco) según la luminancia del color
 * de fondo, usando la fórmula WCAG para garantizar contraste legible.
 */
function getContrastTextColor(hex) {
    const h = String(hex || '').replace('#', '');
    if (h.length < 6) return '#ffffff';
    const r = parseInt(h.slice(0, 2), 16) / 255;
    const g = parseInt(h.slice(2, 4), 16) / 255;
    const b = parseInt(h.slice(4, 6), 16) / 255;
    const toLinear = c => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    const L = 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
    return L > 0.179 ? '#111827' : '#ffffff';
}

function getProfColor(profId) {
    const profs = DB.get('professionals');
    const clinicSettings = getClinicSettings();
    const customColorMap = clinicSettings.professionalColors || {};
    const idx = profs.findIndex(p => p.id === profId);
    const paletteColor = PROF_COLORS[(idx >= 0 ? idx : 0) % PROF_COLORS.length] || { bg: '#6b7280', text: '#ffffff' };
    // Solo usar color personalizado si fue explícitamente asignado en configuración
    const customColor = customColorMap[String(profId)];
    const bg = customColor ? normalizeHexColor(customColor, paletteColor.bg) : paletteColor.bg;
    // Calcular texto con contraste automático para colores personalizados
    const text = customColor ? getContrastTextColor(bg) : paletteColor.text;
    return { bg, text };
}

function getAppointmentVisual(apt) {
    const profColor = getProfColor(apt.professionalId);
    const status = normalizeAppointmentStatus(apt.status);

    if (status === 'cancelled') {
        return {
            bg: '#fef2f2',
            text: '#b91c1c',
            border: '#fca5a5',
            accent: '#ef4444',
            cancelled: true
        };
    }

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
    // Con un solo profesional no hay nada que filtrar — ocultar la barra
    if (!professionals || professionals.length <= 1) return '';
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
                        <span class="cal-legend-chip" style="background:${color.bg}; color:${color.text};">${escapeHtml(p.name)}</span>
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
        <article class="cal-mobile-card ${apt.isOverbook ? 'is-overbook' : ''} ${visual.cancelled ? 'is-cancelled' : ''}" style="border-left-color:${visual.border}">
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
            <div class="cal-mobile-card-name ${visual.cancelled ? 'cal-apt-name-cancelled' : ''}">${escapeHtml(apt.patient)}</div>
            <div class="cal-mobile-card-prof">${getProfName(apt.professionalId)}</div>
            <div class="cal-mobile-card-actions">
                ${patient && canViewClinicalHistoryUi() ? `<button class="btn btn-ghost btn-sm" onclick="loadClinicalHistory(${patient.id})">Historia</button>` : ''}
                <button class="btn btn-secondary btn-sm" onclick="openAppointmentViewModal(${apt.id})">Ver</button>
                ${canManageAppointmentsUi() ? `<button class="btn btn-primary btn-sm" onclick="openAppointmentModal(${apt.id})">Editar</button>` : ''}
            </div>
        </article>
    `;
}

function renderAppointmentsCompact(professionals, allApts, currentDate, canEdit) {
    const legendHtml = renderCalendarFilterLegend(professionals, { horizontal: true, compact: true });
    const toolbar = renderCalendarToolbar(
        parseLocalIsoDate(currentDate).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
        canEdit
    );
    const selectedProfessionalId = getSelectedCalendarProfessionalId(professionals);
    const selectedProfessionalColor = selectedProfessionalId
        ? getProfColor(selectedProfessionalId)
        : { bg: '#64748b', text: '#ffffff' };

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
                    <header class="cal-mobile-section-header">${escapeHtml(prof.name)}</header>
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
            const countLabel = formatAppointmentCountLabel(dayApts.length);
            return `
                <section class="cal-mobile-section" data-calendar-date="${iso}" style="cursor:pointer;">
                    <header class="cal-mobile-section-header">${normalizeDateLabel(day.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' }))}</header>
                    <div class="cal-mobile-list">
                        ${dayApts.length
                            ? `<div class="cal-mobile-count" style="background:${selectedProfessionalColor.bg}; color:${selectedProfessionalColor.text};">${countLabel}</div>`
                            : '<div class="cal-mobile-empty">Sin turnos.</div>'}
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
                <section class="cal-mobile-section" data-calendar-date="${dateStr}" style="cursor:pointer;">
                    <header class="cal-mobile-section-header">${normalizeDateLabel(parseLocalIsoDate(dateStr).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' }))}</header>
                    <div class="cal-mobile-list">
                        <div class="cal-mobile-count" style="background:${selectedProfessionalColor.bg}; color:${selectedProfessionalColor.text};">${formatAppointmentCountLabel(items.length)}</div>
                    </div>
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

// ── Acciones de turno: toggle al hacer clic ────────────────────────────────
function toggleAptActions(event, aptId) {
    event.stopPropagation();

    // Si hay popup abierto (mismo u otro turno) → cerrarlo
    const existing = document.getElementById('cal-apt-popup');
    if (existing) {
        existing.remove();
        // Si era el mismo turno → solo cerrar (toggle)
        if (existing.dataset.aptId === String(aptId)) return;
    }

    const block = event.currentTarget;
    const apt = getAccessibleAppointments().find(a => a.id === aptId);
    if (!apt) return;

    const patient = getPatientByAppointment(apt);
    const canEdit = canEditCalendar();

    const prof = DB.get('professionals').find(p => p.id === apt.professionalId);
    const profName = prof ? prof.name : null;
    const isCancelled = apt.status === 'cancelled';
    const duration = apt.isOverbook ? 15 : apt.duration;

    // Calcular hora de fin
    const [ah, am] = apt.time.split(':').map(Number);
    const endMin = ah * 60 + am + duration;
    const endTime = `${String(Math.floor(endMin / 60)).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}`;

    const statusBadge = isCancelled
        ? `<span class="cal-apt-popup-badge cal-apt-popup-badge-cancelled"><i class="fa-solid fa-ban"></i> Cancelado</span>`
        : apt.isOverbook
            ? `<span class="cal-apt-popup-badge cal-apt-popup-badge-overbook"><i class="fa-solid fa-bolt"></i> Sobreturno</span>`
            : '';

    const popup = document.createElement('div');
    popup.id = 'cal-apt-popup';
    popup.className = 'cal-apt-popup';
    popup.dataset.aptId = aptId;
    popup.setAttribute('role', 'menu');
    popup.innerHTML = `
        <div class="cal-apt-popup-info">
            <div class="cal-apt-popup-patient">${escapeHtml(apt.patient)}</div>
            ${statusBadge}
            <div class="cal-apt-popup-row"><i class="fa-solid fa-clock"></i> ${apt.time} – ${endTime} <span class="cal-apt-popup-dur">${duration} min</span></div>
            ${profName ? `<div class="cal-apt-popup-row"><i class="fa-solid fa-user-doctor"></i> ${escapeHtml(profName)}</div>` : ''}
            ${apt.notes ? `<div class="cal-apt-popup-notes"><i class="fa-solid fa-note-sticky"></i> ${escapeHtml(apt.notes)}</div>` : ''}
        </div>
        <div class="cal-apt-popup-divider"></div>
        <button class="cal-apt-popup-btn" onclick="closeCalAptPopup()">
            <i class="fa-solid fa-xmark"></i> Cerrar
        </button>
        ${patient && canViewClinicalHistoryUi() ? `
        <button class="cal-apt-popup-btn" onclick="closeCalAptPopup(); loadClinicalHistory(${patient.id})">
            <i class="fa-solid fa-notes-medical"></i> Historia Clínica
        </button>` : ''}
        ${canEdit && !isCancelled ? `
        <button class="cal-apt-popup-btn" onclick="closeCalAptPopup(); openAppointmentModal(${aptId})">
            <i class="fa-solid fa-pen"></i> Editar turno
        </button>
        <button class="cal-apt-popup-btn cal-apt-popup-btn-danger" onclick="closeCalAptPopup(); _confirmCancelApt(${aptId})">
            <i class="fa-solid fa-ban"></i> Cancelar turno
        </button>` : ''}
    `;

    // Insertar off-screen para medir
    popup.style.visibility = 'hidden';
    document.body.appendChild(popup);

    const rect = block.getBoundingClientRect();
    const pw = popup.offsetWidth || 190;
    const ph = popup.offsetHeight || 160;
    const gap = 8;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // Preferir a la derecha del bloque, alineado arriba
    let left = rect.right + gap;
    let top  = rect.top;

    // Si se va de pantalla a la derecha → mostrar a la izquierda
    if (left + pw > vw - gap) left = rect.left - pw - gap;
    left = Math.max(gap, left);
    // Si se va de pantalla abajo → subir
    if (top + ph > vh - gap) top = vh - ph - gap;
    top = Math.max(gap, top);

    popup.style.left        = `${left}px`;
    popup.style.top         = `${top}px`;
    popup.style.visibility  = '';

    // Cerrar al hacer click fuera
    const onOutside = (e) => {
        if (!document.getElementById('cal-apt-popup')?.contains(e.target)) {
            closeCalAptPopup();
            document.removeEventListener('click', onOutside);
        }
    };
    setTimeout(() => document.addEventListener('click', onOutside), 0);
}

function closeCalAptPopup() {
    const popup = document.getElementById('cal-apt-popup');
    if (popup) { popup.remove(); return true; }
    return false;
}

// Mantener por compatibilidad (ya no se usa activamente)
function closeAptActions() { closeCalAptPopup(); }

async function _confirmCancelApt(aptId) {
    const apt = getAccessibleAppointments().find(a => a.id === aptId);
    if (!apt) return;
    if (await showConfirm('¿Cancelar este turno?', { title: 'Cancelar turno', confirmText: 'Sí, cancelar' })) {
        try {
            if (state.authToken) {
                // PATCH status → 'cancelled' (el turno queda visible en rojo en el calendario)
                await apiFetch(`/appointments/${aptId}`, {
                    method: 'PATCH',
                    body: JSON.stringify({ status: 'cancelled' }),
                });
                await syncBackendSnapshotToLocalDb();
            } else {
                // Offline: actualizar en la base local
                DB.update('appointments', aptId, { status: 'cancelled' });
            }
            refreshCurrentView();
        } catch (err) {
            alert(err.message || 'No se pudo cancelar el turno.');
        }
    }
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
    closeCalAptPopup(); // cerrar popup si quedó abierto de una vista anterior
    const professionals = getAccessibleProfessionals();
    const selectedProfessionalId = ensureSingleCalendarProfessional(professionals);

    const allApts = getAccessibleAppointments();
    const currentDate = calendarState.currentDate;
    const canEdit = canManageAppointmentsUi();

    if (isCompactAppointmentsLayout()) {
        return renderAppointmentsCompact(professionals, allApts, currentDate, canEdit);
    }

    // For day view: columns per professional
    if (calendarState.viewMode === 'day') {
        const activeProfessional = professionals.find((p) => p.id === selectedProfessionalId) || professionals[0] || null;
        if (!activeProfessional) {
            return `
                <div class="cal-wrapper">
                    ${renderCalendarToolbar(normalizeDateLabel(parseLocalIsoDate(currentDate).toLocaleDateString('es-AR', {weekday:'long', day:'numeric', month:'long', year:'numeric'})), canEdit)}
                    <div class="card p-6 text-center text-gray-500">No hay profesionales disponibles para mostrar esta agenda.</div>
                </div>
            `;
        }

        // Rango horario dinámico según schedule del profesional ese día
        const daySchedule = getProfessionalDaySchedule(activeProfessional.id, currentDate);
        const profWorksToday = !!daySchedule;
        const CAL_PAD_MINS = 10; // margen visual antes y después del horario
        let calStartMin = CAL_START_HOUR * 60;
        let calEndMin   = CAL_END_HOUR   * 60;
        if (daySchedule) {
            const [sh, sm] = daySchedule.start.split(':').map(Number);
            const [eh, em] = daySchedule.end.split(':').map(Number);
            calStartMin = Math.max(0, sh * 60 + sm - CAL_PAD_MINS);
            calEndMin   = eh * 60 + em + CAL_PAD_MINS;
        }
        const calTotalMins   = calEndMin - calStartMin;
        const CAL_TOP_OFFSET = 8; // px de margen superior para que el primer label no quede cortado
        const calTotalHeight = calTotalMins * CAL_PX_PER_MIN + CAL_TOP_OFFSET;
        // hora entera más cercana hacia abajo/arriba para las etiquetas
        const calLabelStart = Math.floor(calStartMin / 60);
        const calLabelEnd   = Math.ceil(calEndMin   / 60);

        // Mensaje si no trabaja hoy
        if (!profWorksToday) {
            const dateLabel = normalizeDateLabel(parseLocalIsoDate(currentDate).toLocaleDateString('es-AR', {weekday:'long', day:'numeric', month:'long'}));
            const profColor = getProfColor(activeProfessional.id);
            const legendHtml = renderCalendarFilterLegend(professionals, { horizontal: true, compact: true });
            return `
            <div class="cal-wrapper">
                ${renderCalendarToolbar(normalizeDateLabel(parseLocalIsoDate(currentDate).toLocaleDateString('es-AR', {weekday:'long', day:'numeric', month:'long', year:'numeric'})), canEdit)}
                ${legendHtml}
                <div class="cal-no-work-card">
                    <div class="cal-no-work-icon" style="background:${profColor.bg}22; color:${profColor.bg};">
                        <i class="fa-solid fa-calendar-xmark"></i>
                    </div>
                    <div class="cal-no-work-body">
                        <h4><span style="color:${profColor.bg}">${activeProfessional.name}</span> no trabaja este día</h4>
                        <p>${dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1)} no tiene horario configurado.</p>
                    </div>
                </div>
            </div>`;
        }

        // Build time labels (left gutter)
        let timeLabelsHtml = '';
        for (let h = calLabelStart; h <= calLabelEnd; h++) {
            const top = (h * 60 - calStartMin) * CAL_PX_PER_MIN + CAL_TOP_OFFSET;
            timeLabelsHtml += `<div class="cal-hour-label" style="top:${top}px">${String(h).padStart(2,'0')}:00</div>`;
        }

        // Build horizontal hour lines
        let linesHtml = '';
        for (let h = calLabelStart; h <= calLabelEnd; h++) {
            const top = (h * 60 - calStartMin) * CAL_PX_PER_MIN + CAL_TOP_OFFSET;
            linesHtml += `<div class="cal-h-line" style="top:${top}px"></div>`;
            if (h < calLabelEnd) {
                linesHtml += `<div class="cal-h-line cal-h-half" style="top:${top + 60 * CAL_PX_PER_MIN / 2}px"></div>`;
            }
        }

        // Now indicator — only shown when viewing today
        const isViewingToday = currentDate === getTodayIsoLocal();
        let nowLineHtml   = '';
        let nowGutterHtml = '';
        if (isViewingToday) {
            const nowDate  = new Date();
            const nowMin   = nowDate.getHours() * 60 + nowDate.getMinutes();
            const nowTop   = (nowMin - calStartMin) * CAL_PX_PER_MIN + CAL_TOP_OFFSET;
            const nowHH    = String(nowDate.getHours()).padStart(2,'0');
            const nowMM    = String(nowDate.getMinutes()).padStart(2,'0');
            const dataAttrs = `data-start-min="${calStartMin}" data-end-min="${calEndMin}" data-px-per-min="${CAL_PX_PER_MIN}" data-top-offset="${CAL_TOP_OFFSET}"`;
            const hidden    = (nowMin < calStartMin || nowMin > calEndMin) ? 'style="display:none"' : `style="top:${nowTop}px"`;
            nowLineHtml = `<div id="cal-now-line" class="cal-now-line" ${dataAttrs} ${hidden}><div class="cal-now-dot"></div></div>`;
            nowGutterHtml = `<div id="cal-now-gutter" class="cal-now-gutter" ${dataAttrs} ${hidden}></div>`;
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
                const offsetMin = startMin - calStartMin;
                const duration = apt.isOverbook ? 15 : apt.duration;
                const topPx = offsetMin * CAL_PX_PER_MIN + CAL_TOP_OFFSET;
                const heightPx = Math.max(duration * CAL_PX_PER_MIN, 28);
                const visual = getAppointmentVisual(apt);
                const blockClasses = `cal-apt-block ${apt.isOverbook ? 'cal-apt-overbook' : ''} ${visual.cancelled ? 'cal-apt-cancelled' : ''}`;
                const blockStyle = apt.isOverbook
                    ? `background:${visual.bg}; color:${visual.text}; border-left:4px solid ${visual.border}; top:${topPx}px; height:${heightPx}px; cursor:pointer; z-index:20;`
                    : `background:${visual.bg}; color:${visual.text}; border-left:4px solid ${visual.border}; top:${topPx}px; height:${heightPx}px; cursor:pointer;`;

                return `<div class="${blockClasses}"
                    style="${blockStyle}"
                    onclick="openAppointmentViewModal(${apt.id})">
                    <div class="cal-apt-content">
                        <span class="cal-apt-name ${visual.cancelled ? 'cal-apt-name-cancelled' : ''}">${escapeHtml(apt.patient)}</span>
                        <span class="cal-apt-meta">${apt.time} · ${duration}min${visual.cancelled ? ' · Cancelado' : apt.isOverbook ? ' · Sobreturno' : ''}</span>
                    </div>
                </div>`;
            }).join('');

            profCols += `
            <div class="cal-prof-col">
                <div class="cal-prof-header">
                    <div style="display:flex;flex-direction:column;align-items:center;gap:0.15rem;">
                        <span class="cal-prof-name">${escapeHtml(p.name)}</span>
                        <span class="cal-prof-schedule-badge">${daySchedule.start} – ${daySchedule.end}</span>
                    </div>
                </div>
                <div class="cal-prof-body" style="height:${calTotalHeight}px; position:relative;">
                    ${linesHtml}
                    ${aptBlocks}
                    ${nowLineHtml}
                </div>
            </div>`;
        });

        // Sidebar legend
        const legendHtml = renderCalendarFilterLegend(professionals, { horizontal: true, compact: true });

        return `
        <div class="cal-wrapper">
            ${renderCalendarToolbar(normalizeDateLabel(parseLocalIsoDate(currentDate).toLocaleDateString('es-AR', {weekday:'long', day:'numeric', month:'long', year:'numeric'})), canEdit)}
            ${legendHtml}
            <div class="cal-scroll-wrap cal-scroll-wrap-day">
                <div class="cal-grid-day">
                    <!-- Gutter -->
                    <div class="cal-gutter-col">
                        <div class="cal-gutter-header"></div>
                        <div class="cal-gutter-body" style="height:${calTotalHeight}px; position:relative;">
                            ${timeLabelsHtml}
                            ${nowGutterHtml}
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

        const weekSelectedProf = professionals.find(p => p.id === selectedProfessionalId) || null;

        let dayCols = '';
        days.forEach(d => {
            const iso = formatDateToLocalIso(d);
            const isToday = iso === getTodayIsoLocal();
            const dayName = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'][d.getDay()];
            const dayNum = d.getDate();

            // ¿Trabaja el profesional seleccionado este día?
            const profScheduleDay = weekSelectedProf ? getProfessionalDaySchedule(weekSelectedProf.id, iso) : null;
            const profWorksDay = !!profScheduleDay;

            const dayApts = allApts.filter(a => a.date === iso && calendarState.visibleProfs[a.professionalId]);
            const countLabel = formatAppointmentCountLabel(dayApts.length);

            let summaryContent;
            if (!profWorksDay && weekSelectedProf) {
                summaryContent = `<div class="cal-month-no-work"><i class="fa-solid fa-moon"></i><span>No trabaja</span></div>`;
            } else if (dayApts.length) {
                summaryContent = `<button type="button" class="cal-month-summary-card" data-calendar-date="${iso}" style="background:${selectedProfessionalColor.bg}; color:${selectedProfessionalColor.text}; border-color:${selectedProfessionalColor.bg};">
                        <span class="cal-month-summary-label">${countLabel}</span>
                   </button>`;
            } else {
                summaryContent = `<div class="cal-month-dayempty">Sin turnos</div>`;
            }

            const schedLabel = profScheduleDay ? `<div class="cal-week-sched-line">${profScheduleDay.start}–${profScheduleDay.end}</div>` : '';
            dayCols += `
            <div class="cal-month-cell${!profWorksDay && weekSelectedProf ? ' cal-month-cell-no-work' : ''}" data-calendar-date="${iso}" style="cursor:pointer;">
                <button type="button" class="cal-month-dayhead cal-week-dayhead ${isToday ? 'is-today' : ''}" data-calendar-date="${iso}">
                    <span class="cal-week-dayname">${dayName}</span>
                    <span class="cal-month-daynum">${dayNum}</span>
                </button>
                <div class="cal-month-daybody">
                    ${schedLabel}
                    ${summaryContent}
                </div>
            </div>`;
        });

        const legendHtml = renderCalendarFilterLegend(professionals, { horizontal: true, compact: true });

        return `
        <div class="cal-wrapper">
            ${renderCalendarToolbar(`${normalizeDateLabel(days[0].toLocaleDateString('es-AR',{day:'numeric',month:'short'}))} – ${normalizeDateLabel(days[6].toLocaleDateString('es-AR',{day:'numeric',month:'short',year:'numeric'}))}`, canEdit)}

            <div class="cal-month-layout">
                ${legendHtml}
                <div class="cal-scroll-wrap cal-scroll-wrap-month">
                    <div class="cal-month-board">
                        <div class="cal-month-grid cal-week-grid">
                            ${dayCols}
                        </div>
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
            let monthProfWorks = true; // default: fuera del mes actual no aplica

            if (dayNum > 0 && dayNum <= daysInMonth) {
                isCurrentMonth = true;
                cellDate = new Date(year, month, dayNum);
                const iso = formatDateToLocalIso(cellDate);
                const isToday = iso === getTodayIsoLocal();
                let dayApts = allApts.filter(a => a.date === iso && calendarState.visibleProfs[a.professionalId]);
                dayApts = dayApts.sort((a,b)=>a.time.localeCompare(b.time));
                const countLabel = formatAppointmentCountLabel(dayApts.length);

                const monthProfSched = selectedProfessionalId ? getProfessionalDaySchedule(selectedProfessionalId, iso) : null;
                monthProfWorks = !selectedProfessionalId || !!monthProfSched;

                let summaryContent;
                if (!monthProfWorks) {
                    summaryContent = `<div class="cal-month-no-work"><i class="fa-solid fa-moon"></i><span>No trabaja</span></div>`;
                } else if (dayApts.length) {
                    summaryContent = `<button type="button" class="cal-month-summary-card" data-calendar-date="${iso}" style="background:${selectedProfessionalColor.bg}; color:${selectedProfessionalColor.text}; border-color:${selectedProfessionalColor.bg};">
                            <span class="cal-month-summary-label">${countLabel}</span>
                       </button>`;
                } else {
                    summaryContent = `<div class="cal-month-dayempty">Sin turnos</div>`;
                }

                content = `
                    <button type="button" class="cal-month-dayhead ${isToday ? 'is-today' : ''}" data-calendar-date="${iso}">
                        <span class="cal-month-daynum">${dayNum}</span>
                    </button>
                    <div class="cal-month-daybody">
                        ${summaryContent}
                    </div>
                `;
            }

            cells += `<div class="cal-month-cell ${isCurrentMonth ? '' : 'is-outside-month'}${isCurrentMonth && !monthProfWorks ? ' cal-month-cell-no-work' : ''}"${isCurrentMonth && cellDate ? ` data-calendar-date="${formatDateToLocalIso(cellDate)}" style="cursor:pointer;"` : ''}>${content}</div>`;
        }

        const monthName = normalizeDateLabel(date.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' }));

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
                            <div class="cal-month-weekday">Mié</div>
                            <div class="cal-month-weekday">Jue</div>
                            <div class="cal-month-weekday">Vie</div>
                            <div class="cal-month-weekday">Sáb</div>
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
        <div class="prof-schedule-list">
            ${profs.length === 0 ? `
                <div class="prof-schedule-empty">
                    <i class="fa-solid fa-user-doctor"></i>
                    <span>No hay profesionales disponibles</span>
                </div>
            ` : profs.map((p, idx) => {
                const profColor = getProfColor(p.id);
                const initials = (p.name || '').split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
                return `
                <div class="prof-schedule-card">
                    <div class="prof-schedule-avatar" style="background:${profColor.bg}22; color:${profColor.bg}; border: 2px solid ${profColor.bg}44;">
                        ${initials || '<i class="fa-solid fa-user-doctor"></i>'}
                    </div>
                    <div class="prof-schedule-info">
                        <span class="prof-schedule-name">${escapeHtml(p.name)}</span>
                        ${p.specialty ? `<span class="prof-schedule-specialty">${escapeHtml(p.specialty)}</span>` : ''}
                    </div>
                    ${canAccessProfessional(p.id) ? `
                    <button class="btn btn-secondary btn-sm btn-edit-schedule prof-schedule-btn" data-id="${p.id}" aria-label="Configurar horarios de ${escapeHtml(p.name)}" title="Configurar horarios">
                        <i class="fa-solid fa-clock"></i>
                        <span>Horarios</span>
                    </button>` : ''}
                </div>`;
            }).join('')}
        </div>
        <p class="schedules-hint mt-4 text-sm text-gray-500 ml-1"><i class="fa-solid fa-circle-info mr-1 text-primary-400"></i> Los turnos solo se asignan dentro del horario activo configurado para cada día.</p>
    `;
}

