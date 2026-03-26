// --- Navigation & State ---
const state = {
    user: null, 
    currentView: 'dashboard',
    sidebarOpen: true
};

// --- Database Setup ---
const defaultData = {
    users: [
        { id: 1, email: 'admin@odentara.com', name: 'Superadmin', role: 'superadmin', allowedProfessionals: [] },
        { id: 2, email: 'lopez@odentara.com', name: 'Dr. López', role: 'professional', allowedProfessionals: [1] }
    ],
    professionals: [
        { id: 1, name: 'Dr. López', schedule: { 
            1: {active: true, start: '08:00', end: '16:00'}, 2: {active: true, start: '08:00', end: '16:00'}, 
            3: {active: true, start: '08:00', end: '16:00'}, 4: {active: true, start: '08:00', end: '16:00'}, 
            5: {active: true, start: '08:00', end: '16:00'}, 6: {active: false, start: '08:00', end: '13:00'}, 
            0: {active: false, start: '08:00', end: '13:00'} 
        } },
        { id: 2, name: 'Dra. Martínez', schedule: { 
            1: {active: true, start: '09:00', end: '15:00'}, 2: {active: true, start: '09:00', end: '15:00'}, 
            3: {active: false, start: '09:00', end: '15:00'}, 4: {active: true, start: '09:00', end: '15:00'}, 
            5: {active: true, start: '09:00', end: '15:00'}, 6: {active: false, start: '', end: ''}, 
            0: {active: false, start: '', end: ''} 
        } }
    ],
    appointments: [
        { id: 1, patient: 'María Gómez', professionalId: 1, date: '2026-03-24', time: '10:00', duration: 60, status: 'confirmed', isOverbook: false },
        { id: 2, patient: 'Juan Pérez', professionalId: 2, date: '2026-03-24', time: '11:00', duration: 30, status: 'pending', isOverbook: false },
        { id: 3, patient: 'Carlos Ruiz', professionalId: 1, date: '2026-03-24', time: '10:15', duration: 15, status: 'confirmed', isOverbook: true }
    ],
    patients: [
        { id: 1, name: 'María Gómez', dni: '34567890', fechaNacimiento: '1994-09-19', obraSocial: 'Sancor 4000', credencial: '1826490/00', domicilio: 'Primitivo de la Reta 513 Piso 8 Of 2 Ciudad', fichaNumero: '001', email: 'maria@example.com', phone: '261-679-1598', lastVisit: '2026-02-10', notes: 'Alergia a la penicilina', odontograma: {}, treatments: [] },
        { id: 2, name: 'Juan Pérez', dni: '23456789', fechaNacimiento: '1985-05-12', obraSocial: 'OSDE 210', credencial: '12345678', domicilio: 'San Martin 123', fichaNumero: '002', email: 'juan@example.com', phone: '098-765-4321', lastVisit: '2026-03-01', notes: 'Sin antecedentes', odontograma: {}, treatments: [] }
    ],
    billing: [
        { id: 1, patientId: 2, professionalId: 2, type: 'income', amount: 12500, date: '2026-03-24', description: 'Consulta Dra. Martínez' },
        { id: 2, patientId: 1, professionalId: 1, type: 'debt', amount: 45000, date: '2026-03-20', description: 'Tratamiento conducto' }
    ]
};

const DB = {
    init() {
        if (!localStorage.getItem('odentara_db_v4')) {
            localStorage.setItem('odentara_db_v4', JSON.stringify(defaultData));
        }
    },
    get(table) {
        return JSON.parse(localStorage.getItem('odentara_db_v4'))[table] || [];
    },
    save(table, items) {
        const db = JSON.parse(localStorage.getItem('odentara_db_v4'));
        db[table] = items;
        localStorage.setItem('odentara_db_v4', JSON.stringify(db));
    },
    add(table, item) {
        const items = this.get(table);
        item.id = items.length > 0 ? Math.max(...items.map(i => i.id)) + 1 : 1;
        items.push(item);
        this.save(table, items);
    },
    update(table, id, data) {
        const items = this.get(table);
        const idx = items.findIndex(i => i.id === +id);
        if (idx !== -1) {
            items[idx] = { ...items[idx], ...data };
            this.save(table, items);
        }
    },
    delete(table, id) {
        let items = this.get(table);
        items = items.filter(i => i.id !== +id);
        this.save(table, items);
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
            { id: 'professionals', icon: 'fa-user-md', label: 'Horarios Médicos' },
            { id: 'patients', icon: 'fa-users', label: 'Pacientes & Historia' },
            { id: 'billing', icon: 'fa-file-invoice-dollar', label: 'Facturación' },
            { id: 'settings', icon: 'fa-cog', label: 'Configuración' }
        ]
    },
    admin: {
        name: 'Administrador',
        navItems: [
            { id: 'dashboard', icon: 'fa-chart-pie', label: 'Dashboard' },
            { id: 'patients', icon: 'fa-users', label: 'Directorio Pacientes' },
            { id: 'billing', icon: 'fa-file-invoice-dollar', label: 'Cuentas Corrientes' },
            { id: 'settings', icon: 'fa-cog', label: 'Configuración' }
        ]
    },
    professional: {
        name: 'Profesional',
        navItems: [
            { id: 'dashboard', icon: 'fa-chart-pie', label: 'Mi Panel' },
            { id: 'appointments', icon: 'fa-calendar-check', label: 'Mis Turnos' },
            { id: 'professionals', icon: 'fa-clock', label: 'Mis Horarios' },
            { id: 'patients', icon: 'fa-notes-medical', label: 'Historias Clínicas' }
        ]
    },
    secretary: {
        name: 'Secretaría',
        navItems: [
            { id: 'dashboard', icon: 'fa-chart-pie', label: 'Recepción' },
            { id: 'appointments', icon: 'fa-calendar-check', label: 'Gestión de Turnos' },
            { id: 'professionals', icon: 'fa-user-md', label: 'Agendas Médicas' },
            { id: 'patients', icon: 'fa-users', label: 'Registro de Pacientes' }
        ]
    }
};

// --- Initial DOM Elements ---
const views = { login: document.getElementById('login-view'), app: document.getElementById('app-view') };
const modalsContainer = document.getElementById('modals-container');
const mainContent = document.getElementById('main-content');
const pageTitle = document.getElementById('page-title');

// --- Events ---
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('login-form').addEventListener('submit', (e) => {
        e.preventDefault();
        login(document.getElementById('email').value, document.getElementById('role-select').value);
    });

    document.getElementById('logout-btn').addEventListener('click', logout);
    
    document.addEventListener('click', (e) => {
        if (e.target.matches('.modal-overlay') || e.target.closest('[data-modal-close]')) closeModal();
        
        // CRUD Routes
        if (e.target.closest('#btn-add-apt')) openAppointmentModal();
        if (e.target.closest('.btn-edit-apt')) openAppointmentModal(parseInt(e.target.closest('.btn-edit-apt').dataset.id));
        if (e.target.closest('.btn-delete-apt')) {
            if (confirm('¿Cancelar este turno?')) { DB.delete('appointments', e.target.closest('.btn-delete-apt').dataset.id); refreshCurrentView(); }
        }
        
        if (e.target.closest('#btn-add-patient')) openPatientModal();
        if (e.target.closest('.btn-edit-patient')) openPatientModal(parseInt(e.target.closest('.btn-edit-patient').dataset.id));
        if (e.target.closest('.btn-delete-patient')) {
            if (confirm('¿Eliminar paciente y su historial?')) { DB.delete('patients', e.target.closest('.btn-delete-patient').dataset.id); refreshCurrentView(); }
        }
        if (e.target.closest('.btn-view-history')) {
            loadClinicalHistory(parseInt(e.target.closest('.btn-view-history').dataset.id));
        }

        if (e.target.closest('#btn-add-tx')) openBillingModal();
        if (e.target.closest('.btn-delete-tx')) {
            if (confirm('¿Eliminar transacción?')) { DB.delete('billing', e.target.closest('.btn-delete-tx').dataset.id); refreshCurrentView(); }
        }
        
        if (e.target.closest('.btn-edit-schedule')) {
            openScheduleModal(parseInt(e.target.closest('.btn-edit-schedule').dataset.id));
        }
    });

    // Calendar navigation & filter
    document.addEventListener('click', (e2) => {
        if (e2.target.closest('#cal-prev')) {
            calendarState.weekOffset--;
            refreshCurrentView();
        }
        if (e2.target.closest('#cal-next')) {
            calendarState.weekOffset++;
            refreshCurrentView();
        }
        if (e2.target.closest('#cal-today')) {
            calendarState.weekOffset = 0;
            refreshCurrentView();
        }
    });
    document.addEventListener('change', (e2) => {
        if (e2.target.id === 'cal-all-profs') {
            const checked = e2.target.checked;
            Object.keys(calendarState.visibleProfs).forEach(id => { calendarState.visibleProfs[id] = checked; });
            refreshCurrentView();
        }
        if (e2.target.classList.contains('cal-prof-check')) {
            const id = parseInt(e2.target.dataset.id);
            calendarState.visibleProfs[id] = e2.target.checked;
            refreshCurrentView();
        }
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
    });

    document.addEventListener('submit', (e) => {
        if (e.target.id === 'new-user-form') {
            e.preventDefault();
            const role = document.getElementById('u-role').value;
            const email = document.getElementById('u-email').value;
            const selectedOptions = Array.from(document.getElementById('u-profs').selectedOptions).map(o => parseInt(o.value));
            DB.add('users', { email: email, name: email.split('@')[0], role: role, allowedProfessionals: selectedOptions });
            refreshCurrentView();
        }
    });
});

// --- Auth ---
function login(email, roleSelect) {
    const users = DB.get('users');
    let user = users.find(u => u.email === email);
    
    if (!user) {
        if (email === 'admin@odentara.com') { 
             user = { id: 1, email: 'admin@odentara.com', name: 'Superadmin', role: 'superadmin', allowedProfessionals: [] };
             DB.add('users', user);
        } else {
             alert('Usuario sin acceso o no encontrado en la base de datos (Usa: admin@odentara.com).');
             return;
        }
    }
    
    state.user = { ...user };
    document.getElementById('user-name').innerText = user.email;
    document.getElementById('user-role-display').innerText = roleConfig[user.role].name;
    document.getElementById('user-initials').innerText = user.name.substring(0, 2).toUpperCase();
    
    renderSidebar();
    
    views.login.classList.remove('active');
    setTimeout(() => {
        views.login.classList.add('hidden');
        views.app.classList.remove('hidden');
        setTimeout(() => views.app.classList.add('active'), 10);
        loadView('dashboard');
    }, 250);
}

function logout() {
    state.user = null;
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
    
    roleConfig[state.user.role].navItems.forEach(item => {
        const link = document.createElement('a');
        link.className = `nav-item ${item.id === state.currentView ? 'active' : ''}`;
        link.dataset.view = item.id;
        link.innerHTML = `<i class="fa-solid ${item.icon} w-5 text-center"></i> <span>${item.label}</span>`;
        
        link.addEventListener('click', (e) => {
            e.preventDefault();
            document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
            link.classList.add('active');
            loadView(item.id, item.label);
        });
        sidebarNav.appendChild(link);
    });
}

function refreshCurrentView() {
    loadView(state.currentView, pageTitle.innerText);
}

function loadView(viewId, title = 'Dashboard') {
    state.currentView = viewId;
    pageTitle.innerText = title;
    mainContent.innerHTML = '';
    
    const content = document.createElement('div');
    content.className = 'animate-fade-in';
    
    if (viewId === 'dashboard') content.innerHTML = renderDashboard();
    else if (viewId === 'appointments') content.innerHTML = renderAppointments();
    else if (viewId === 'professionals') content.innerHTML = renderProfessionals();
    else if (viewId === 'patients') content.innerHTML = renderPatients();
    else if (viewId === 'billing') content.innerHTML = renderBilling();
    else if (viewId === 'settings') content.innerHTML = renderSettings();
    else if (viewId === 'patient-history') content.innerHTML = ''; // Se inyecta después por loadClinicalHistory
    else content.innerHTML = renderPlaceholder(viewId);
    
    mainContent.appendChild(content);
}

function renderPlaceholder(viewId) {
    return `<div class="card p-12 text-center"><i class="fa-solid fa-tools text-4xl text-gray-300 mb-4"></i><h3 class="text-lg font-medium text-gray-700">Módulo ${viewId} en Construcción</h3></div>`;
}

// --- Helpers ---
function getProfName(id) {
    const p = DB.get('professionals').find(x => x.id === parseInt(id));
    return p ? p.name : 'Desconocido';
}

// --- Modal System & Forms ---
function closeModal() {
    modalsContainer.innerHTML = '';
}

function openAppointmentModal(editId = null) {
    const apt = editId ? DB.get('appointments').find(a => a.id === editId) : null;
    const patients = DB.get('patients');
    const allProfs = DB.get('professionals');
    const allowed = state.user.allowedProfessionals || [];
    const professionals = allowed.length > 0 ? allProfs.filter(p => allowed.includes(p.id)) : allProfs;
    
    if (patients.length === 0) {
        alert("Atención: Necesitas crear al menos un paciente en el directorio antes de agendar un turno.");
        return;
    }
    
    modalsContainer.innerHTML = `
        <div class="modal-overlay active">
            <div class="modal-content" onclick="event.stopPropagation()">
                <div class="modal-header">
                    <h3>${editId ? 'Editar Turno' : 'Nuevo Turno'}</h3>
                    <button class="btn-ghost" data-modal-close><i class="fa-solid fa-times"></i></button>
                </div>
                <form id="apt-form">
                    <div class="modal-body">
                        <div class="input-group">
                            <label>Paciente (Solo pacientes registrados)</label>
                            <select id="apt-patient" required>
                                ${patients.map(p => `<option value="${p.name}" ${apt && apt.patient === p.name ? 'selected':''}>${p.name} (DNI ${p.dni})</option>`).join('')}
                            </select>
                        </div>
                        <div class="input-group">
                            <label>Profesional</label>
                            <select id="apt-professional" required>
                                ${professionals.map(p => `<option value="${p.id}" ${apt && apt.professionalId === p.id ? 'selected':''}>${p.name}</option>`).join('')}
                            </select>
                        </div>
                        <div class="flex gap-4">
                            <div class="input-group flex-1"><label>Fecha</label><input type="date" id="apt-date" value="${apt ? apt.date : new Date().toISOString().split('T')[0]}" required></div>
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
                                <option value="30" ${apt && apt.duration===30?'selected':''}>30 minutos</option>
                                <option value="60" ${!apt || apt.duration===60?'selected':''}>60 minutos (1 hora)</option>
                                <option value="90" ${apt && apt.duration===90?'selected':''}>90 minutos (1.5 horas)</option>
                                <option value="120" ${apt && apt.duration===120?'selected':''}>120 minutos (2 horas)</option>
                            </select>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-ghost" data-modal-close>Cancelar</button>
                        <button type="submit" class="btn btn-primary">Guardar</button>
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
        
        const prof = DB.get('professionals').find(p => p.id === profId);
        if(!prof || !dateStr) return;
        const [year, month, dayStr] = dateStr.split('-');
        const dateObj = new Date(year, month - 1, dayStr);
        const dayOfWeek = dateObj.getDay();
        const daySchedule = prof.schedule[dayOfWeek];
        if (!daySchedule || !daySchedule.active) return;
        
        const [eh, em] = daySchedule.end.split(':').map(Number);
        const endMin = eh * 60 + em;
        
        const [th, tm] = timeVal.split(':').map(Number);
        const tMin = th * 60 + tm;
        
        const existingApts = DB.get('appointments').filter(a => a.professionalId === profId && a.date === dateStr && !a.isOverbook && a.id !== editId);
        
        let maxDuration = endMin - tMin;
        
        // Find next appointment start time after tMin
        for (let a of existingApts) {
            const [ah, am] = a.time.split(':').map(Number);
            const s = ah * 60 + am;
            if (s >= tMin) {
                const possibleDuration = s - tMin;
                if (possibleDuration < maxDuration) {
                    maxDuration = possibleDuration;
                }
            }
        }
        
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
        
        const prof = DB.get('professionals').find(p => p.id === profId);
        if(!prof || !dateStr) {
            timeSelect.innerHTML = '<option value="">-</option>';
            timeSelect.disabled = true;
            return;
        }
        
        const [year, month, dayStr] = dateStr.split('-');
        const dateObj = new Date(year, month - 1, dayStr);
        const dayOfWeek = dateObj.getDay();
        const daySchedule = prof.schedule[dayOfWeek];
        
        if (!daySchedule || !daySchedule.active) {
            timeSelect.innerHTML = '<option value="">No atiende en esta fecha</option>';
            timeSelect.disabled = true;
            renderDurationOptions();
            return;
        }
        
        const [sh, sm] = daySchedule.start.split(':').map(Number);
        const [eh, em] = daySchedule.end.split(':').map(Number);
        
        const startMinBase = sh * 60 + sm;
        const endMin = eh * 60 + em;
        
        const existingApts = DB.get('appointments').filter(a => a.professionalId === profId && a.date === dateStr && a.id !== editId);
        const intervals = existingApts.map(a => {
            const [ah, am] = a.time.split(':').map(Number);
            const s = ah * 60 + am;
            return { start: s, end: s + a.duration, isOverbook: a.isOverbook };
        });
        
        const normalIntervals = intervals.filter(i => !i.isOverbook);
        const overbookIntervals = intervals.filter(i => i.isOverbook);
        
        let foundSelected = false;
        const minDuration = isOverbook ? 15 : 30; // Assuming minimum valid normal duration is 30 mins
        
        for (let t = startMinBase; t + minDuration <= endMin; t += 15) {
            let overlap = false;
            const pStart = t;
            const pEndMin = t + minDuration;
            
            if (!isOverbook) {
                overlap = normalIntervals.some(i => pStart < i.end && pEndMin > i.start);
            } else {
                overlap = overbookIntervals.some(i => pStart < i.end && pEndMin > i.start);
            }
            
            if (!overlap) {
                const h = Math.floor(t / 60).toString().padStart(2, '0');
                const m = (t % 60).toString().padStart(2, '0');
                const val = `${h}:${m}`;
                const isSelected = apt && apt.time === val;
                if(isSelected) foundSelected = true;
                timeSelect.innerHTML += `<option value="${val}" ${isSelected ? 'selected' : ''}>${val}</option>`;
            }
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
    
    document.getElementById('apt-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const data = {
            patient: document.getElementById('apt-patient').value,
            professionalId: parseInt(profSelect.value),
            date: document.getElementById('apt-date').value,
            time: timeSelect.value,
            duration: sCheck.checked ? 15 : parseInt(durSelect.value),
            isOverbook: sCheck.checked,
            status: 'confirmed'
        };
        if (editId) DB.update('appointments', editId, data);
        else DB.add('appointments', data);
        closeModal(); refreshCurrentView();
    });
}

function openScheduleModal(profId) {
    const prof = DB.get('professionals').find(x => x.id === profId);
    
    const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    
    let daysHtml = '';
    for(let i=0; i<7; i++) {
        const d = prof.schedule[i] || { active: false, start: '08:00', end: '16:00' };
        daysHtml += `
            <div class="flex items-center gap-4 mb-2 p-2 border-b">
                <div class="w-28">
                    <label class="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" id="sch-active-${i}" ${d.active ? 'checked' : ''} class="w-4 h-4 text-primary-600 rounded">
                        <span class="font-semibold text-sm">${days[i]}</span>
                    </label>
                </div>
                <div class="flex-1 flex gap-2">
                    <input type="time" id="sch-start-${i}" value="${d.start}" class="form-input text-sm px-2 py-1 h-8">
                    <span class="text-gray-500 self-center">a</span>
                    <input type="time" id="sch-end-${i}" value="${d.end}" class="form-input text-sm px-2 py-1 h-8">
                </div>
            </div>
        `;
    }

    modalsContainer.innerHTML = `
        <div class="modal-overlay active">
            <div class="modal-content w-auto max-w-2xl" onclick="event.stopPropagation()">
                <div class="modal-header">
                    <h3>Horarios Diarios de ${prof.name}</h3>
                    <button class="btn-ghost" data-modal-close><i class="fa-solid fa-times"></i></button>
                </div>
                <form id="schedule-form">
                    <div class="modal-body max-h-[60vh] overflow-y-auto">
                        <p class="text-sm text-gray-600 mb-4">Selecciona qué días trabaja el profesional y su horario de entrada/salida.</p>
                        ${daysHtml}
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-ghost" data-modal-close>Cancelar</button>
                        <button type="submit" class="btn btn-primary">Actualizar Agenda</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    document.getElementById('schedule-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const newSched = {};
        for(let i=0; i<7; i++) {
            newSched[i] = {
                active: document.getElementById(`sch-active-${i}`).checked,
                start: document.getElementById(`sch-start-${i}`).value,
                end: document.getElementById(`sch-end-${i}`).value
            };
        }
        DB.update('professionals', profId, { schedule: newSched });
        closeModal(); refreshCurrentView();
    });
}

function openPatientModal(editId = null) {
    const p = editId ? DB.get('patients').find(x => x.id === editId) : null;
    modalsContainer.innerHTML = `
        <div class="modal-overlay active">
            <div class="modal-content" onclick="event.stopPropagation()">
                <div class="modal-header">
                    <h3>${editId ? 'Editar Paciente' : 'Nuevo Paciente'}</h3>
                    <button class="btn-ghost" data-modal-close><i class="fa-solid fa-times"></i></button>
                </div>
                <form id="patient-form">
                    <div class="modal-body">
                        <div class="input-group"><label>Nombre y Apellido *</label><input type="text" id="p-name" value="${p?p.name:''}" required></div>
                        <div class="flex gap-4">
                            <div class="input-group flex-1"><label>DNI *</label><input type="text" id="p-dni" value="${p?p.dni||'':''}" required></div>
                            <div class="input-group flex-1"><label>Teléfono (Celular) *</label><input type="text" id="p-phone" value="${p?p.phone||'':''}" required></div>
                        </div>
                        <div class="flex gap-4">
                            <div class="input-group flex-1"><label>Fecha de Nacimiento</label><input type="date" id="p-nacimiento" value="${p?p.fechaNacimiento||'':''}"></div>
                            <div class="input-group flex-1"><label>Email</label><input type="email" id="p-email" value="${p?p.email||'':''}"></div>
                        </div>
                        <div class="input-group"><label>Domicilio</label><input type="text" id="p-domicilio" value="${p?p.domicilio||'':''}"></div>
                        <div class="flex gap-4">
                            <div class="input-group flex-1"><label>Obra Social / Plan</label><input type="text" id="p-obrasocial" value="${p?p.obraSocial||'':''}"></div>
                            <div class="input-group flex-1"><label>Credencial</label><input type="text" id="p-credencial" value="${p?p.credencial||'':''}"></div>
                            <div class="input-group flex-1"><label>Ficha Nº</label><input type="text" id="p-ficha" value="${p?p.fichaNumero||'':''}"></div>
                        </div>
                        <div class="input-group"><label>Observaciones Médicas / Alergias</label><input type="text" id="p-notes" value="${p?p.notes||'':''}"></div>
                    </div>
                    <div class="modal-footer"><button type="submit" class="btn btn-primary">Guardar Paciente</button></div>
                </form>
            </div>
        </div>
    `;
    document.getElementById('patient-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const data = {
            name: document.getElementById('p-name').value,
            dni: document.getElementById('p-dni').value,
            email: document.getElementById('p-email').value,
            phone: document.getElementById('p-phone').value,
            fechaNacimiento: document.getElementById('p-nacimiento').value,
            domicilio: document.getElementById('p-domicilio').value,
            obraSocial: document.getElementById('p-obrasocial').value,
            credencial: document.getElementById('p-credencial').value,
            fichaNumero: document.getElementById('p-ficha').value,
            notes: document.getElementById('p-notes').value,
            lastVisit: p ? p.lastVisit : new Date().toISOString().split('T')[0],
            odontograma: p ? p.odontograma : {},
            treatments: p ? p.treatments : []
        };
        if (editId) DB.update('patients', editId, data); else DB.add('patients', data);
        closeModal(); refreshCurrentView();
    });
}

function openBillingModal() {
    const patients = DB.get('patients');
    const allProfs = DB.get('professionals');
    const allowed = state.user.allowedProfessionals || [];
    const professionals = allowed.length > 0 ? allProfs.filter(p => allowed.includes(p.id)) : allProfs;

    if (patients.length === 0) { alert("Debes crear pacientes primero en el directorio."); return; }

    modalsContainer.innerHTML = `
        <div class="modal-overlay active">
            <div class="modal-content" onclick="event.stopPropagation()">
                <div class="modal-header">
                    <h3>Nueva Transacción</h3>
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
                            <label>Profesional Asignado a la Transacción</label>
                            <select id="tx-prof" required>
                                ${professionals.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
                            </select>
                        </div>
                        <div class="input-group"><label>Tipo de Registro</label><select id="tx-type" required><option value="income">Abono / Pago recibido (Ingreso)</option><option value="debt">Cargo por Tratamiento (Deuda)</option></select></div>
                        <div class="input-group"><label>Monto ($)</label><input type="number" id="tx-amount" min="1" required></div>
                        <div class="input-group"><label>Concepto / Descripción</label><input type="text" id="tx-desc" required placeholder="Ej: Tratamiento conducto, Pago parcial..."></div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-ghost" data-modal-close>Cancelar</button>
                        <button type="submit" class="btn btn-primary">Registrar en Cuenta Corriente</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    document.getElementById('tx-form').addEventListener('submit', (e) => {
        e.preventDefault();
        DB.add('billing', {
            patientId: parseInt(document.getElementById('tx-patient').value),
            professionalId: parseInt(document.getElementById('tx-prof').value),
            type: document.getElementById('tx-type').value,
            amount: parseFloat(document.getElementById('tx-amount').value),
            description: document.getElementById('tx-desc').value,
            date: new Date().toISOString().split('T')[0]
        });
        closeModal(); refreshCurrentView();
    });
}

// --- Views Rendering ---
function renderDashboard() {
    const apts = DB.get('appointments');
    const patients = DB.get('patients');
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
                                <td>${apt.patient} ${apt.isOverbook ? '<span class="badge badge-purple text-xs ml-2">Sobreturno</span>' : ''}</td>
                                <td><span class="badge ${apt.status === 'confirmed' ? 'badge-success' : 'badge-warning'}">${apt.status}</span></td>
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
    weekOffset: 0,
    visibleProfs: {}
};

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

// Calendar constants
const CAL_START_HOUR = 8;   // 8:00
const CAL_END_HOUR   = 20;  // 20:00
const CAL_TOTAL_MINS = (CAL_END_HOUR - CAL_START_HOUR) * 60; // 720 min
const CAL_PX_PER_MIN = 2;   // Each minute = 2px → 1 hour = 120px
const CAL_TOTAL_HEIGHT = CAL_TOTAL_MINS * CAL_PX_PER_MIN;    // 1440px

function renderAppointments() {
    const allProfs = DB.get('professionals');
    const allowed = state.user.allowedProfessionals || [];
    const professionals = allowed.length > 0 ? allProfs.filter(p => allowed.includes(p.id)) : allProfs;

    professionals.forEach(p => {
        if (calendarState.visibleProfs[p.id] === undefined) calendarState.visibleProfs[p.id] = true;
    });

    const allApts = DB.get('appointments');
    const days = getWeekDays(calendarState.weekOffset);
    const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const today = new Date().toISOString().split('T')[0];
    const canEdit = ['secretary', 'superadmin', 'admin'].includes(state.user.role);

    // --- Build time labels (left gutter) ---
    let timeLabelsHtml = '';
    for (let h = CAL_START_HOUR; h <= CAL_END_HOUR; h++) {
        const top = (h - CAL_START_HOUR) * 60 * CAL_PX_PER_MIN;
        timeLabelsHtml += `<div class="cal-hour-label" style="top:${top}px">${String(h).padStart(2,'0')}:00</div>`;
    }

    // --- Build horizontal hour lines (background) ---
    let linesHtml = '';
    for (let h = CAL_START_HOUR; h <= CAL_END_HOUR; h++) {
        const top = (h - CAL_START_HOUR) * 60 * CAL_PX_PER_MIN;
        linesHtml += `<div class="cal-h-line" style="top:${top}px"></div>`;
        if (h < CAL_END_HOUR) {
            linesHtml += `<div class="cal-h-line cal-h-half" style="top:${top + 60 * CAL_PX_PER_MIN / 2}px"></div>`;
        }
    }

    // --- Build day columns ---
    let dayCols = '';
    days.forEach(d => {
        const iso = d.toISOString().split('T')[0];
        const isToday = iso === today;
        const dayLabel = dayNames[d.getDay()];
        const dayNum = d.getDate();

        // Get appointments for this day that are visible
        const dayApts = allApts.filter(a =>
            a.date === iso && calendarState.visibleProfs[a.professionalId]
        );

        // Build appointment blocks with absolute positioning
        const aptBlocks = dayApts.map(apt => {
            const color = getProfColor(apt.professionalId);
            const profName = getProfName(apt.professionalId);
            const [ah, am] = apt.time.split(':').map(Number);
            const startMin = ah * 60 + am;
            const offsetMin = startMin - CAL_START_HOUR * 60;
            const duration = apt.isOverbook ? 15 : apt.duration;

            const topPx = offsetMin * CAL_PX_PER_MIN;
            const heightPx = Math.max(duration * CAL_PX_PER_MIN, 28); // min 28px

            return `<div class="cal-apt-block" 
                style="background:${color.bg}; color:${color.text}; top:${topPx}px; height:${heightPx}px;"
                title="${apt.patient} — ${profName} (${apt.duration}min)">
                <span class="cal-apt-name">${apt.patient}</span>
                <span class="cal-apt-meta">${profName.split(' ').pop()} · ${apt.time}</span>
                ${canEdit ? `<div class="cal-apt-actions">
                    <button class="cal-apt-btn btn-edit-apt" data-id="${apt.id}" title="Editar"><i class="fa-solid fa-pen"></i></button>
                    <button class="cal-apt-btn btn-delete-apt" data-id="${apt.id}" title="Cancelar"><i class="fa-solid fa-times"></i></button>
                </div>` : ''}
            </div>`;
        }).join('');

        dayCols += `
        <div class="cal-day-col">
            <div class="cal-day-header ${isToday ? 'cal-today-header' : ''}">
                <span class="cal-day-name">${dayLabel}</span>
                <span class="cal-day-number ${isToday ? 'cal-today-badge' : ''}">${dayNum}</span>
            </div>
            <div class="cal-day-body" style="height:${CAL_TOTAL_HEIGHT}px">
                ${aptBlocks}
            </div>
        </div>`;
    });

    // --- Sidebar legend ---
    const legendHtml = `
        <div class="cal-legend">
            <div class="cal-legend-title">Profesionales</div>
            <label class="cal-legend-item">
                <input type="checkbox" id="cal-all-profs" ${professionals.every(p => calendarState.visibleProfs[p.id]) ? 'checked' : ''}>
                <span class="cal-legend-chip" style="background:#e5e7eb; color:#374151;">Todos</span>
            </label>
            ${professionals.map(p => {
                const color = getProfColor(p.id);
                return `<label class="cal-legend-item">
                    <input type="checkbox" class="cal-prof-check" data-id="${p.id}" ${calendarState.visibleProfs[p.id] ? 'checked' : ''}>
                    <span class="cal-legend-chip" style="background:${color.bg}; color:${color.text};">${p.name}</span>
                </label>`;
            }).join('')}
        </div>`;

    return `
    <div class="cal-wrapper">
        <!-- Toolbar -->
        <div class="cal-toolbar card mb-4 flex justify-between items-center flex-wrap gap-2">
            <div class="flex items-center gap-3">
                <button class="btn btn-ghost btn-sm" id="cal-prev"><i class="fa-solid fa-chevron-left"></i></button>
                <span class="font-semibold text-gray-700 text-sm">
                    ${days[0].toLocaleDateString('es-AR',{day:'numeric',month:'short'})} – ${days[6].toLocaleDateString('es-AR',{day:'numeric',month:'short',year:'numeric'})}
                </span>
                <button class="btn btn-ghost btn-sm" id="cal-next"><i class="fa-solid fa-chevron-right"></i></button>
                <button class="btn btn-secondary btn-sm" id="cal-today">Hoy</button>
            </div>
            ${canEdit ? '<button class="btn btn-primary btn-sm" id="btn-add-apt"><i class="fa-solid fa-plus"></i> Nuevo Turno</button>' : ''}
        </div>

        <div class="cal-layout">
            <!-- Calendar grid -->
            <div class="cal-scroll-wrap">
                <div class="cal-grid-v2">
                    <!-- Gutter + day columns header combined -->
                    <div class="cal-gutter-col">
                        <div class="cal-gutter-header"></div>
                        <div class="cal-gutter-body" style="height:${CAL_TOTAL_HEIGHT}px; position:relative;">
                            ${linesHtml}
                            ${timeLabelsHtml}
                        </div>
                    </div>
                    <!-- Day columns -->
                    ${dayCols}
                </div>
            </div>
            <!-- Sidebar -->
            ${legendHtml}
        </div>
    </div>`;
}


function renderProfessionals() {
    const profs = DB.get('professionals');
    return `
        <div class="card mb-6 flex justify-between items-center">
            <h3 class="font-semibold px-2">Configuración de Horarios de Atención</h3>
        </div>
        <div class="table-container shadow-sm">
            <table class="w-full text-left">
                <thead><tr><th>Profesional</th><th>Acciones</th></tr></thead>
                <tbody>
                    ${profs.map(p => `
                        <tr>
                            <td class="font-medium flex items-center gap-3">
                                <div class="w-8 h-8 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-bold text-xs"><i class="fa-solid fa-user-md"></i></div>
                                ${p.name}
                            </td>
                            <td>
                                ${['superadmin', 'secretary', 'professional'].includes(state.user.role) ? `
                                <button class="btn btn-secondary btn-sm btn-edit-schedule" data-id="${p.id}"><i class="fa-solid fa-clock mr-1"></i> Configurar Horarios por Día</button>
                                ` : ''}
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
        <div class="mt-4 text-sm text-gray-500 ml-2"><i class="fa-solid fa-info-circle mr-1 text-primary-500"></i> Los turnos solo se podrán asignar según el horario activo configurado para cada día de la semana.</div>
    `;
}

function renderPatients() {
    const patients = DB.get('patients').sort((a,b)=>a.name.localeCompare(b.name));
    return `
        <div class="card mb-6 flex justify-between items-center">
            <h3 class="font-semibold px-2">Directorio Médico</h3>
            ${['superadmin', 'secretary', 'admin'].includes(state.user.role) ? 
            '<button class="btn btn-primary" id="btn-add-patient"><i class="fa-solid fa-user-plus"></i> Nuevo Paciente</button>' : ''}
        </div>
        <input type="search" id="search-patient" placeholder="Buscar pacientes por nombre o DNI..." class="form-input mb-4 w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 text-sm">
        <div class="table-container shadow-sm">
            <table class="w-full text-left" id="patients-table">
                <thead><tr><th>Paciente</th><th>Contacto</th><th>DNI</th><th>Notas Médicas</th><th>Acciones</th></tr></thead>
                <tbody>
                    ${patients.map(p => `
                        <tr>
                            <td class="font-medium flex items-center gap-3">
                                <div class="w-8 h-8 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-bold text-xs">${p.name.substring(0,2).toUpperCase()}</div>
                                ${p.name}
                            </td>
                            <td>
                                <span class="block text-sm text-gray-600"><i class="fa-solid fa-phone mr-1"></i> ${p.phone}</span>
                                <span class="block text-xs text-gray-400"><i class="fa-solid fa-envelope mr-1"></i> ${p.email || 'Sin email'}</span>
                            </td>
                            <td class="text-sm font-semibold">${p.dni}</td>
                            <td class="text-xs text-gray-600">${p.notes || '-'}</td>
                            <td>
                                <div class="flex gap-2">
                                ${['superadmin', 'secretary'].includes(state.user.role) ? `
                                    <button class="btn btn-ghost p-1 btn-view-history" data-id="${p.id}" title="Historia Clínica"><i class="fa-solid fa-file-medical text-purple-600"></i></button>
                                    <button class="btn btn-ghost p-1 btn-edit-patient" data-id="${p.id}"><i class="fa-solid fa-pen text-primary-600"></i></button>
                                    <button class="btn btn-ghost p-1 btn-delete-patient" data-id="${p.id}"><i class="fa-solid fa-trash text-danger"></i></button>
                                ` : '<button class="btn btn-secondary btn-sm btn-view-history" data-id="'+p.id+'"><i class="fa-solid fa-eye"></i> Historia</button>'}
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
    const allowed = state.user.allowedProfessionals || [];
    const allTxs = DB.get('billing');
    const txs = allowed.length > 0 ? allTxs.filter(t => allowed.includes(t.professionalId)) : allTxs;
    const patients = DB.get('patients');
    
    const ingresos = txs.filter(t=>t.type==='income').reduce((sum,t)=>sum+t.amount,0);
    const deudas = txs.filter(t=>t.type==='debt').reduce((sum,t)=>sum+t.amount,0);
    
    // Calculate per-patient balances
    const patientBalances = patients.map(p => {
        const pTx = txs.filter(t => t.patientId === p.id);
        const pDeuda = pTx.filter(t => t.type==='debt').reduce((sum,t)=>sum+t.amount,0);
        const pPagado = pTx.filter(t => t.type==='income').reduce((sum,t)=>sum+t.amount,0);
        return { name: p.name, dni: p.dni, deuda: pDeuda, pagado: pPagado, balance: pDeuda - pPagado };
    }).filter(p => p.deuda > 0 || p.pagado > 0);
    
    return `
        <div class="metrics-grid">
            <div class="card metric-card">
                <div class="metric-icon metric-green"><i class="fa-solid fa-arrow-trend-up"></i></div>
                <div class="metric-info"><h3>Total Recaudado</h3><p>$${ingresos.toLocaleString()}</p></div>
            </div>
            <div class="card metric-card">
                <div class="metric-icon metric-red"><i class="fa-solid fa-arrow-trend-down"></i></div>
                <div class="metric-info"><h3>Cargos Emitidos</h3><p>$${deudas.toLocaleString()}</p></div>
            </div>
        </div>
        
        <div class="card mt-6 mb-6">
            <h3 class="font-semibold px-2 mb-4 text-primary-900 border-b pb-2">Estado de Cuentas por Paciente (Cuentas Corrientes)</h3>
            <div class="table-container shadow-sm border border-gray-100">
                <table class="w-full text-left bg-white">
                    <thead class="bg-gray-50 text-gray-600"><tr><th>Paciente</th><th>DNI</th><th>Cargos Generados</th><th>Pagos Realizados</th><th>Saldo Pendiente</th></tr></thead>
                    <tbody>
                        ${patientBalances.map(pb => `
                            <tr>
                                <td class="font-bold">${pb.name}</td>
                                <td class="text-sm text-gray-500">${pb.dni}</td>
                                <td>$${pb.deuda.toLocaleString()}</td>
                                <td class="text-success font-semibold">$${pb.pagado.toLocaleString()}</td>
                                <td>
                                    ${pb.balance > 0 
                                      ? `<span class="badge badge-warning text-xs">Debe $${pb.balance.toLocaleString()}</span>` 
                                      : `<span class="badge badge-success text-xs">Al día ${pb.balance < 0 ? `(A favor: $${Math.abs(pb.balance).toLocaleString()})` : ''}</span>`}
                                </td>
                            </tr>
                        `).join('')}
                        ${patientBalances.length === 0 ? '<tr><td colspan="5" class="text-center py-4 text-gray-400">No hay cuentas corrientes activas.</td></tr>' : ''}
                    </tbody>
                </table>
            </div>
        </div>
        
        <div class="card mb-4 flex justify-between items-center">
            <h3 class="font-semibold px-2">Historial Detallado de Transacciones</h3>
            ${['admin', 'superadmin'].includes(state.user.role) ? 
            '<button class="btn btn-primary" id="btn-add-tx"><i class="fa-solid fa-plus"></i> Registrar Movimiento</button>' : ''}
        </div>
        
        <div class="table-container shadow-sm">
            <table class="w-full text-left">
                <thead><tr><th>Fecha</th><th>Paciente</th><th>Tipo</th><th>Concepto</th><th>Monto</th><th>Acción</th></tr></thead>
                <tbody>
                    ${txs.sort((a,b)=>b.id - a.id).map(t => {
                        const pName = patients.find(p=>p.id === t.patientId)?.name || 'Desconocido';
                        return `
                        <tr>
                            <td class="text-sm text-gray-500">${t.date}</td>
                            <td class="font-medium">${pName}</td>
                            <td><span class="badge ${t.type==='income'?'badge-success':'badge-warning'}">${t.type==='income'?'Ingreso':'Cargo / Deuda'}</span></td>
                            <td class="text-gray-700">${t.description}</td>
                            <td class="font-bold ${t.type==='income'?'text-success':'text-warning'}">$${t.amount.toLocaleString()}</td>
                            <td>
                                ${['superadmin', 'admin'].includes(state.user.role) ? 
                                `<button class="btn btn-ghost text-danger p-1 btn-delete-tx" data-id="${t.id}"><i class="fa-solid fa-trash"></i></button>` : ''}
                            </td>
                        </tr>
                        `;
                    }).join('')}
                    ${txs.length===0?'<tr><td colspan="6" class="text-center py-6 text-gray-500">No hay transacciones registradas</td></tr>':''}
                </tbody>
            </table>
        </div>
    `;
}

function renderSettings() {
    const users = DB.get('users');
    const profs = DB.get('professionals');
    const isSuper = state.user.role === 'superadmin';
    
    let userManagementHtml = '';
    if (isSuper) {
        userManagementHtml = `
            <div class="mt-8 border-t pt-6">
                <h4 class="font-bold text-lg mb-4"><i class="fa-solid fa-users-cog"></i> Gestión de Accesos (Solo Superadmin)</h4>
                <div class="table-container shadow-sm mb-6 max-h-60 overflow-y-auto">
                    <table class="w-full text-left text-sm">
                        <thead class="bg-gray-50"><tr><th>Email</th><th>Rol</th><th>Profesionales Asignados</th><th>Acción</th></tr></thead>
                        <tbody>
                            ${users.map(u => `
                                <tr>
                                    <td class="font-medium">${u.email}</td>
                                    <td><span class="badge ${u.role==='superadmin'?'badge-purple':'badge-info'}">${u.role}</span></td>
                                    <td class="text-xs">${u.allowedProfessionals && u.allowedProfessionals.length > 0 ? u.allowedProfessionals.map(id => getProfName(id)).join(', ') : 'Acceso Ilimitado (Todos)'}</td>
                                    <td>${u.id !== state.user.id ? `<button class="btn btn-ghost text-danger p-1" onclick="if(confirm('¿Eliminar usuario?')){ DB.delete('users', ${u.id}); document.querySelector('[data-view=settings]').click(); }"><i class="fa-solid fa-trash"></i></button>` : '-'}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
                
                <form id="new-user-form" class="bg-gray-50 p-4 rounded border">
                    <h5 class="font-semibold mb-3">Crear Nuevo Acceso de Usuario</h5>
                    <div class="flex gap-4 flex-wrap">
                        <div class="input-group flex-1 min-w-[200px]"><label>Email de Usuario (Login)</label><input type="email" id="u-email" required></div>
                        <div class="input-group flex-1 min-w-[200px]">
                            <label>Rol de Permisos</label>
                            <select id="u-role" required>
                                <option value="admin">Administrador (Cobros, Directorio)</option>
                                <option value="secretary">Secretaría (Turnos, Directorio)</option>
                                <option value="professional">Profesional (Sus turnos e historias)</option>
                            </select>
                        </div>
                        <div class="input-group w-full">
                            <label>Filtro de Profesionales (Mantén presionado Ctrl/Cmd para seleccionar varios)</label>
                            <select id="u-profs" multiple class="h-24 p-2">
                                ${profs.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
                            </select>
                            <p class="text-xs text-gray-500 mt-1">Si NO seleccionas ninguno, el usuario podrá ver/editar agendas y cajas de todos los profesionales.</p>
                        </div>
                    </div>
                    <button type="submit" class="btn btn-primary mt-2"><i class="fa-solid fa-user-check"></i> Autorizar Usuario</button>
                </form>
            </div>
        `;
    }

    return `<div class="card p-8">
        <h3 class="text-xl font-bold mb-4">Configuración de Odentara.app</h3>
        <p class="text-gray-600 mb-6">Administración general del área de negocio y reinicios de sistema.</p>
        <button class="btn btn-danger" onclick="if(confirm('¿Borrar Base de Datos local? Ojo, esto eliminará pacientes, transacciones y turnos.')) { localStorage.removeItem('odentara_db_v4'); window.location.reload(); }">
            <i class="fa-solid fa-triangle-exclamation"></i> Reiniciar App (Wipe)
        </button>
        ${userManagementHtml}
    </div>`;
}

// --- Ficha Clínica y Odontograma ---

function loadClinicalHistory(patientId) {
    state.currentView = 'patient-history';
    state.currentPatientId = patientId;
    pageTitle.innerText = 'Ficha Odontológica';
    mainContent.innerHTML = '';
    
    const content = document.createElement('div');
    content.className = 'animate-fade-in';
    content.innerHTML = renderClinicalHistory(patientId);
    mainContent.appendChild(content);
    
    attachClinicalHistoryEvents(patientId);
}

function drawTeethRow(teethArray, patientOdontograma) {
    if(!patientOdontograma) patientOdontograma = {};
    return teethArray.map(id => {
        const toothData = patientOdontograma[id] || {};
        const isAbsent = toothData.estado === 'ausente';
        
        let facesHtml = '';
        if(isAbsent) {
            facesHtml = `<line x1="0" y1="0" x2="100" y2="100" stroke="#ef4444" stroke-width="8"></line>
                         <line x1="100" y1="0" x2="0" y2="100" stroke="#ef4444" stroke-width="8"></line>`;
        } else {
            const getColor = (f) => {
                if(toothData[f] === 'caries') return '#ef4444'; 
                if(toothData[f] === 'restaurado') return '#3b82f6';
                return 'white';
            };
            facesHtml = `
                <polygon points="0,0 100,0 75,25 25,25" class="tooth-face cursor-pointer hover:opacity-80 transition-opacity" data-tooth="${id}" data-face="top" fill="${getColor('top')}" stroke="#94a3b8" stroke-width="2"></polygon>
                <polygon points="100,0 100,100 75,75 75,25" class="tooth-face cursor-pointer hover:opacity-80 transition-opacity" data-tooth="${id}" data-face="right" fill="${getColor('right')}" stroke="#94a3b8" stroke-width="2"></polygon>
                <polygon points="100,100 0,100 25,75 75,75" class="tooth-face cursor-pointer hover:opacity-80 transition-opacity" data-tooth="${id}" data-face="bottom" fill="${getColor('bottom')}" stroke="#94a3b8" stroke-width="2"></polygon>
                <polygon points="0,100 0,0 25,25 25,75" class="tooth-face cursor-pointer hover:opacity-80 transition-opacity" data-tooth="${id}" data-face="left" fill="${getColor('left')}" stroke="#94a3b8" stroke-width="2"></polygon>
                <rect x="25" y="25" width="50" height="50" class="tooth-face cursor-pointer hover:opacity-80 transition-opacity" data-tooth="${id}" data-face="center" fill="${getColor('center')}" stroke="#94a3b8" stroke-width="2"></rect>
            `;
        }

        return `
        <div class="flex flex-col items-center">
            <span class="text-[10px] font-bold text-gray-700 w-full text-center hover:bg-red-100 cursor-pointer rounded" title="Doble clic para marcar Ausente" ondblclick="toggleAbsent(${state.currentPatientId}, ${id})">${id}</span>
            <div class="relative w-8 h-8 md:w-10 md:h-10">
                <svg viewBox="0 0 100 100" class="w-full h-full drop-shadow-sm">
                    ${facesHtml}
                </svg>
            </div>
        </div>
        `;
    }).join('');
}

function renderClinicalHistory(patientId) {
    const patient = DB.get('patients').find(p => p.id === patientId);
    if(!patient) return '<p>Paciente no encontrado</p>';

    let age = '-';
    if(patient.fechaNacimiento) {
        const diff = Date.now() - new Date(patient.fechaNacimiento).getTime();
        age = Math.abs(new Date(diff).getUTCFullYear() - 1970);
    }

    return `
    <div class="bg-white shadow-md rounded-lg max-w-5xl mx-auto overflow-hidden border border-gray-200" style="font-family: Arial, sans-serif;">
        <!-- Cabecera estilo Recetario -->
        <div class="flex flex-col md:flex-row justify-between items-center p-6 border-b-2 border-primary-800 bg-primary-50">
            <div class="flex items-center gap-4 mb-4 md:mb-0">
                <i class="fa-solid fa-tooth text-4xl text-primary-800"></i>
                <div>
                    <h2 class="text-xl md:text-2xl font-black text-gray-900 tracking-tight uppercase">Circulo Odontológico</h2>
                    <p class="text-sm font-semibold text-primary-700">Ficha Clínica Odontológica</p>
                </div>
            </div>
            <div class="text-right text-sm">
                <p class="text-lg font-bold text-gray-800">${patient.name}</p>
                <p class="text-gray-600">DNI: <span class="font-medium">${patient.dni}</span></p>
            </div>
        </div>
        
        <div class="p-6">
            <!-- Datos del Paciente -->
            <div class="grid grid-cols-2 md:grid-cols-4 gap-y-3 gap-x-6 text-sm mb-10 pb-6 border-b border-dashed border-gray-300">
                <div class="col-span-2 md:col-span-4 flex flex-wrap gap-x-8 gap-y-3 bg-gray-50 p-3 rounded">
                    <div><strong class="text-gray-600 uppercase text-xs">Obra Social / Plan:</strong><br><span class="font-medium text-base">${patient.obraSocial || '-'}</span></div>
                    <div><strong class="text-gray-600 uppercase text-xs">Credencial:</strong><br><span class="font-medium text-base">${patient.credencial || '-'}</span></div>
                    <div class="ml-auto"><strong class="text-gray-600 uppercase text-xs">Ficha Nº:</strong><br><span class="font-mono text-lg font-bold text-primary-700">${patient.fichaNumero || '-'}</span></div>
                </div>
                <div><strong class="text-gray-600 uppercase text-xs">Nacimiento:</strong><br>${patient.fechaNacimiento ? patient.fechaNacimiento.split('-').reverse().join('/') : '-'}</div>
                <div><strong class="text-gray-600 uppercase text-xs">Edad:</strong><br>${age} años</div>
                <div class="col-span-2"><strong class="text-gray-600 uppercase text-xs">Teléfono:</strong><br>${patient.phone || '-'}</div>
                <div class="col-span-2 md:col-span-4"><strong class="text-gray-600 uppercase text-xs">Domicilio:</strong><br>${patient.domicilio || '-'}</div>
            </div>

            <!-- ODONTOGRAMA -->
            <div class="mb-10">
                <div class="flex items-center justify-between mb-4">
                    <h3 class="font-black text-gray-800 uppercase tracking-widest text-sm bg-gray-100 py-1 px-3 rounded inline-block border-l-4 border-primary-600">Odontograma Inicial</h3>
                    <div class="flex gap-4 text-[10px] md:text-xs">
                        <div class="flex items-center gap-1"><div class="w-3 h-3 border border-gray-400 bg-white"></div> Sano</div>
                        <div class="flex items-center gap-1"><div class="w-3 h-3 border border-gray-400 bg-red-500"></div> Caries</div>
                        <div class="flex items-center gap-1"><div class="w-3 h-3 border border-gray-400 bg-blue-500"></div> Restauración</div>
                        <div class="flex items-center gap-1"><div class="w-3 h-3 border-2 border-red-500 flex items-center justify-center font-bold text-[8px] bg-white text-red-500">X</div> Ausente</div>
                    </div>
                </div>
                
                <p class="text-[10px] text-gray-400 mb-2 text-center w-full">Haz clic en cada cara para ciclar estado (Sano -> Caries -> Restaurado). Doble clic en el NÚMERO para marcar ausente.</p>
                <div class="flex flex-col items-center gap-6 overflow-x-auto pb-4">
                    <!-- Permanentes Superior -->
                    <div class="flex gap-4 md:gap-8 justify-center min-w-max">
                        <div class="flex gap-[2px] md:gap-1"> ${drawTeethRow([18,17,16,15,14,13,12,11], patient.odontograma)} </div>
                        <div class="flex gap-[2px] md:gap-1 border-l-2 border-gray-300 pl-4 md:pl-8"> ${drawTeethRow([21,22,23,24,25,26,27,28], patient.odontograma)} </div>
                    </div>
                    <!-- Deciduos Superior -->
                    <div class="flex gap-4 md:gap-8 justify-center min-w-max">
                        <div class="flex gap-[2px] md:gap-1"> ${drawTeethRow([55,54,53,52,51], patient.odontograma)} </div>
                        <div class="flex gap-[2px] md:gap-1 border-l-2 border-gray-300 pl-4 md:pl-8"> ${drawTeethRow([61,62,63,64,65], patient.odontograma)} </div>
                    </div>
                    <hr class="w-full max-w-2xl border-gray-300">
                    <!-- Deciduos Inferior -->
                    <div class="flex gap-4 md:gap-8 justify-center min-w-max">
                        <div class="flex gap-[2px] md:gap-1"> ${drawTeethRow([85,84,83,82,81], patient.odontograma)} </div>
                        <div class="flex gap-[2px] md:gap-1 border-l-2 border-gray-300 pl-4 md:pl-8"> ${drawTeethRow([71,72,73,74,75], patient.odontograma)} </div>
                    </div>
                    <!-- Permanentes Inferior -->
                    <div class="flex gap-4 md:gap-8 justify-center min-w-max">
                        <div class="flex gap-[2px] md:gap-1"> ${drawTeethRow([48,47,46,45,44,43,42,41], patient.odontograma)} </div>
                        <div class="flex gap-[2px] md:gap-1 border-l-2 border-gray-300 pl-4 md:pl-8"> ${drawTeethRow([31,32,33,34,35,36,37,38], patient.odontograma)} </div>
                    </div>
                </div>
            </div>

            <!-- TRATAMIENTOS -->
            <div class="mb-4">
                <div class="flex justify-between items-center bg-gray-100 py-1 px-3 rounded border-l-4 border-primary-600 mb-4">
                    <h3 class="font-black text-gray-800 uppercase tracking-widest text-sm">Registro de Tratamientos</h3>
                    <button class="btn btn-primary btn-sm whitespace-nowrap" id="btn-add-treatment"><i class="fa-solid fa-plus"></i> Añadir Fila</button>
                </div>
                <div class="table-container shadow-sm border border-gray-300 overflow-visible">
                    <table class="w-full text-left text-xs md:text-sm" id="treatments-table">
                        <thead class="bg-gray-50 border-b border-gray-300"><tr>
                            <th class="py-2 px-3">Diente</th><th class="py-2 px-3">Cara</th><th class="py-2 px-3">Sector</th>
                            <th class="py-2 px-3">Autorización</th><th class="py-2 px-3">Código</th><th class="py-2 px-3">Fecha / Firma</th><th class="py-2 px-3">Observaciones</th><th class="py-2 px-3"></th>
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
                                    <td class="py-2 px-3">
                                    ${state.user.role !== 'secretary' ? `
                                        <button class="btn-ghost text-red-400 hover:text-red-600 p-1" onclick="deleteTreatment(${patientId}, ${idx})"><i class="fa-solid fa-times"></i></button>
                                    ` : ''}
                                    </td>
                                </tr>
                            `).join('')}
                            ${!(patient.treatments||[]).length ? '<tr><td colspan="8" class="text-center py-4 text-gray-400 italic">No hay tratamientos registrados en la ficha.</td></tr>' : ''}
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- NOTAS -->
            <div class="mt-8 bg-yellow-50 p-4 border border-yellow-200 rounded-lg">
                <h3 class="font-bold text-yellow-800 mb-2 uppercase text-xs"><i class="fa-solid fa-notes-medical"></i> Observaciones Generales y Alergias</h3>
                <textarea id="p-general-notes" class="form-input w-full h-20 p-2 text-sm bg-transparent border-yellow-300 focus:border-yellow-500 focus:ring-yellow-500 rounded">${patient.notes || ''}</textarea>
                <div class="text-right mt-2"><button class="btn btn-secondary btn-sm bg-yellow-100 text-yellow-800 border-yellow-300 hover:bg-yellow-200" onclick="savePatientNotes(${patientId})">Guardar Notas</button></div>
            </div>
        </div>
    </div>
    `;
}

function attachClinicalHistoryEvents(patientId) {
    if(state.user.role === 'secretary') return; // Read Only for clinical charting

    document.querySelectorAll('.tooth-face').forEach(face => {
        face.addEventListener('click', (e) => {
            const tooth = e.target.dataset.tooth;
            const faceName = e.target.dataset.face;
            
            const p = DB.get('patients').find(pt => pt.id === patientId);
            if(!p.odontograma) p.odontograma = {};
            if(!p.odontograma[tooth]) p.odontograma[tooth] = {};
            
            if(p.odontograma[tooth].estado === 'ausente') return; // Cannot edit faces of absent teeth

            let current = p.odontograma[tooth][faceName] || 'sano';
            let next = 'sano';
            if(current === 'sano') next = 'caries';
            else if(current === 'caries') next = 'restaurado';
            
            p.odontograma[tooth][faceName] = next;
            DB.update('patients', patientId, { odontograma: p.odontograma });
            
            // Re-render
            loadClinicalHistory(patientId);
        });
    });

    document.getElementById('btn-add-treatment')?.addEventListener('click', () => {
        openTreatmentModal(patientId);
    });
}

window.toggleAbsent = function(patientId, toothId) {
    if(state.user.role === 'secretary') return;
    const p = DB.get('patients').find(pt => pt.id === patientId);
    if(!p.odontograma) p.odontograma = {};
    if(!p.odontograma[toothId]) p.odontograma[toothId] = {};
    
    p.odontograma[toothId].estado = p.odontograma[toothId].estado === 'ausente' ? 'sano' : 'ausente';
    DB.update('patients', patientId, { odontograma: p.odontograma });
    loadClinicalHistory(patientId);
};

window.savePatientNotes = function(patientId) {
    const notes = document.getElementById('p-general-notes').value;
    DB.update('patients', patientId, { notes: notes });
    alert('Notas guardadas');
};

window.deleteTreatment = function(patientId, index) {
    if(confirm('¿Eliminar registro de tratamiento?')) {
        const p = DB.get('patients').find(pt => pt.id === patientId);
        p.treatments.splice(index, 1);
        DB.update('patients', patientId, { treatments: p.treatments });
        loadClinicalHistory(patientId);
    }
};

function openTreatmentModal(patientId) {
    modalsContainer.innerHTML = `
        <div class="modal-overlay active">
            <div class="modal-content" onclick="event.stopPropagation()">
                <div class="modal-header">
                    <h3>Añadir Tratamiento a Ficha</h3>
                    <button class="btn-ghost" data-modal-close><i class="fa-solid fa-times"></i></button>
                </div>
                <form id="tx-history-form">
                    <div class="modal-body">
                        <div class="flex gap-4">
                            <div class="input-group flex-1"><label>Diente</label><input type="text" id="tx-diente" placeholder="Ej: 18"></div>
                            <div class="input-group flex-1"><label>Cara</label><input type="text" id="tx-cara" placeholder="M, D, V, P, O"></div>
                            <div class="input-group flex-1"><label>Sector</label><input type="text" id="tx-sector" placeholder="1-6"></div>
                        </div>
                        <div class="flex gap-4">
                            <div class="input-group flex-1"><label>Autorización</label><input type="text" id="tx-auth" placeholder="Nº Orden"></div>
                            <div class="input-group flex-1"><label>Código OS</label><input type="text" id="tx-codigo" placeholder="Ej: 01.01"></div>
                        </div>
                        <div class="input-group"><label>Observaciones</label><input type="text" id="tx-obs" placeholder="Detalles del procedimiento..." required></div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-ghost" data-modal-close>Cancelar</button>
                        <button type="submit" class="btn btn-primary">Añadir a Tabla</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    
    document.getElementById('tx-history-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const p = DB.get('patients').find(pt => pt.id === patientId);
        if(!p.treatments) p.treatments = [];
        
        p.treatments.push({
            diente: document.getElementById('tx-diente').value,
            cara: document.getElementById('tx-cara').value,
            sector: document.getElementById('tx-sector').value,
            autorizacion: document.getElementById('tx-auth').value,
            codigo: document.getElementById('tx-codigo').value,
            observaciones: document.getElementById('tx-obs').value,
            fecha: new Date().toLocaleDateString('es-AR'),
            firma: state.user.name // Automatically sign with the current user's name
        });
        
        DB.update('patients', patientId, { treatments: p.treatments });
        closeModal();
        loadClinicalHistory(patientId);
    });
}
