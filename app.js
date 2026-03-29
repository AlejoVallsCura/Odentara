// --- Navigation & State ---
const state = {
    user: null, 
    currentView: 'dashboard',
    sidebarOpen: true
};

// --- Database Setup ---
const defaultData = {
    users: [
        { id: 1, email: 'admin@odentara.com', name: 'Superadmin', roles: ['superadmin'], allowedProfessionals: [] },
        { id: 2, email: 'lopez@odentara.com', name: 'Dr. López', roles: ['professional'], allowedProfessionals: [1] },
        { id: 3, email: 'pepe@gmail.com', name: 'Pepe Secretario', roles: ['admin', 'secretary'], allowedProfessionals: [1, 2] }
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
        } },
        { id: 3, name: 'Dr. Carlos Gómez', schedule: { 
            1: {active: true, start: '10:00', end: '18:00'}, 2: {active: true, start: '10:00', end: '18:00'}, 
            3: {active: true, start: '10:00', end: '18:00'}, 4: {active: true, start: '10:00', end: '18:00'}, 
            5: {active: true, start: '10:00', end: '18:00'}, 6: {active: false, start: '', end: ''}, 
            0: {active: false, start: '', end: ''} 
        } }
    ],
    appointments: [
        { id: 1, patient: 'María Gómez', professionalId: 1, date: '2026-03-24', time: '10:00', duration: 60, status: 'confirmed', isOverbook: false },
        { id: 2, patient: 'Juan Pérez', professionalId: 2, date: '2026-03-24', time: '11:00', duration: 30, status: 'pending', isOverbook: false },
        { id: 3, patient: 'Carlos Ruiz', professionalId: 1, date: '2026-03-24', time: '10:15', duration: 15, status: 'confirmed', isOverbook: true },
        { id: 4, patient: 'Laura Sánchez', professionalId: 3, date: '2026-03-24', time: '09:30', duration: 60, status: 'confirmed', isOverbook: false },
        { id: 5, patient: 'Diego Ramírez', professionalId: 2, date: '2026-03-24', time: '12:00', duration: 45, status: 'pending', isOverbook: false },
        { id: 6, patient: 'Sofía Díaz', professionalId: 1, date: '2026-03-24', time: '13:30', duration: 30, status: 'cancelled', isOverbook: false },
        { id: 7, patient: 'Martín Torres', professionalId: 3, date: '2026-03-24', time: '14:00', duration: 60, status: 'confirmed', isOverbook: false },
        { id: 8, patient: 'Karina López', professionalId: 2, date: '2026-03-24', time: '15:30', duration: 30, status: 'in progress', isOverbook: false },
        { id: 9, patient: 'Facundo Vega', professionalId: 1, date: '2026-03-24', time: '16:30', duration: 60, status: 'pending', isOverbook: false },
        { id: 10, patient: 'Vanesa Ruiz', professionalId: 3, date: '2026-03-24', time: '17:45', duration: 30, status: 'confirmed', isOverbook: false },
        { id: 11, patient: 'Martina Gómez', professionalId: 1, date: '2026-03-25', time: '09:00', duration: 45, status: 'confirmed', isOverbook: false },
        { id: 12, patient: 'Bruno Álvarez', professionalId: 2, date: '2026-03-25', time: '10:30', duration: 60, status: 'pending', isOverbook: false },
        { id: 13, patient: 'Lucía Fernández', professionalId: 3, date: '2026-03-25', time: '11:45', duration: 30, status: 'confirmed', isOverbook: false }
    ],
    patients: [
        { id: 1, name: 'María Gómez', dni: '34567890', fechaNacimiento: '1994-09-19', obraSocial: 'Sancor 4000', credencial: '1826490/00', domicilio: 'Primitivo de la Reta 513 Piso 8 Of 2 Ciudad', fichaNumero: '001', email: 'maria@example.com', phone: '261-679-1598', lastVisit: '2026-02-10', notes: 'Alergia a la penicilina', odontograma: {}, treatments: [] },
        { id: 2, name: 'Juan Pérez', dni: '23456789', fechaNacimiento: '1985-05-12', obraSocial: 'OSDE 210', credencial: '12345678', domicilio: 'San Martin 123', fichaNumero: '002', email: 'juan@example.com', phone: '098-765-4321', lastVisit: '2026-03-01', notes: 'Sin antecedentes', odontograma: {}, treatments: [] },
        { id: 3, name: 'Laura Sánchez', dni: '45678901', fechaNacimiento: '1990-04-20', obraSocial: 'OSDE 310', credencial: '98765432', domicilio: 'Av. Libertador 1234', fichaNumero: '003', email: 'laura@example.com', phone: '261-111-2222', lastVisit: '2026-03-22', notes: '', odontograma: {}, treatments: [] },
        { id: 4, name: 'Diego Ramírez', dni: '56789012', fechaNacimiento: '1988-08-05', obraSocial: 'SWISS MEDICAL', credencial: '11122334', domicilio: 'Calle Falsa 123', fichaNumero: '004', email: 'diego@example.com', phone: '261-333-4444', lastVisit: '2026-02-05', notes: 'Control de ortodoncia', odontograma: {}, treatments: [] },
        { id: 5, name: 'Sofía Díaz', dni: '67890123', fechaNacimiento: '1995-12-01', obraSocial: 'Galeno', credencial: '22233445', domicilio: 'Calle Real 56', fichaNumero: '005', email: 'sofia@example.com', phone: '261-555-6666', lastVisit: '2026-01-16', notes: '', odontograma: {}, treatments: [] },
        { id: 6, name: 'Martín Torres', dni: '78901234', fechaNacimiento: '1979-03-30', obraSocial: 'Medifé', credencial: '33344556', domicilio: 'Calle Luna 90', fichaNumero: '006', email: 'martin@example.com', phone: '261-777-8888', lastVisit: '2026-04-01', notes: 'Diabético', odontograma: {}, treatments: [] },
        { id: 7, name: 'Karina López', dni: '89012345', fechaNacimiento: '1982-07-11', obraSocial: 'OSDE', credencial: '44455667', domicilio: 'Av. Mayo 321', fichaNumero: '007', email: 'karina@example.com', phone: '261-999-0000', lastVisit: '2026-03-10', notes: '', odontograma: {}, treatments: [] },
        { id: 8, name: 'Facundo Vega', dni: '90123456', fechaNacimiento: '1987-02-18', obraSocial: 'Swiss Medical', credencial: '55566778', domicilio: 'Calle Sol 18', fichaNumero: '008', email: 'facundo@example.com', phone: '261-101-2020', lastVisit: '2026-02-20', notes: 'Bleeding gums', odontograma: {}, treatments: [] },
        { id: 9, name: 'Vanesa Ruiz', dni: '01234567', fechaNacimiento: '1993-11-09', obraSocial: 'Galeno', credencial: '66677889', domicilio: 'Calle Mar 89', fichaNumero: '009', email: 'vanesa@example.com', phone: '261-303-4040', lastVisit: '2026-03-19', notes: '', odontograma: {}, treatments: [] },
        { id: 10, name: 'Martina Gómez', dni: '11223344', fechaNacimiento: '2000-06-12', obraSocial: 'Sancor 4000', credencial: '77788990', domicilio: 'Calle Estrella 25', fichaNumero: '010', email: 'martina@example.com', phone: '261-505-6060', lastVisit: '2026-03-24', notes: '', odontograma: {}, treatments: [] },
        { id: 11, name: 'Bruno Álvarez', dni: '22334455', fechaNacimiento: '1975-09-27', obraSocial: 'OSDE', credencial: '88899001', domicilio: 'Av. Córdoba 101', fichaNumero: '011', email: 'bruno@example.com', phone: '261-707-8080', lastVisit: '2026-03-05', notes: '', odontograma: {}, treatments: [] },
        { id: 12, name: 'Lucía Fernández', dni: '33445566', fechaNacimiento: '1998-01-14', obraSocial: 'Medifé', credencial: '99900112', domicilio: 'Calle Internal 42', fichaNumero: '012', email: 'lucia@example.com', phone: '261-909-0101', lastVisit: '2026-03-28', notes: 'Estrés dental', odontograma: {}, treatments: [] }
    ],
    billing: [
        { id: 1, patientId: 2, professionalId: 2, type: 'income', amount: 12500, date: '2026-03-24', description: 'Consulta Dra. Martínez' },
        { id: 2, patientId: 1, professionalId: 1, type: 'debt', amount: 45000, date: '2026-03-20', description: 'Tratamiento conducto' }
    ]
};

const DB = {
    init() {
        if (!localStorage.getItem('odentara_db_v6')) {
            localStorage.setItem('odentara_db_v6', JSON.stringify(defaultData));
        }
    },
    get(table) {
        return JSON.parse(localStorage.getItem('odentara_db_v6'))[table] || [];
    },
    save(table, items) {
        const db = JSON.parse(localStorage.getItem('odentara_db_v6'));
        db[table] = items;
        localStorage.setItem('odentara_db_v6', JSON.stringify(db));
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
        const email = document.getElementById('email').value.trim();
        const role = document.getElementById('login-role').value;
        login(email, role);
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
            const date = new Date(calendarState.currentDate);
            if (calendarState.viewMode === 'day') {
                date.setDate(date.getDate() - 1);
            } else if (calendarState.viewMode === 'week') {
                date.setDate(date.getDate() - 7);
            }
            calendarState.currentDate = date.toISOString().split('T')[0];
            refreshCurrentView();
        }
        if (e2.target.closest('#cal-next')) {
            const date = new Date(calendarState.currentDate);
            if (calendarState.viewMode === 'day') {
                date.setDate(date.getDate() + 1);
            } else if (calendarState.viewMode === 'week') {
                date.setDate(date.getDate() + 7);
            }
            calendarState.currentDate = date.toISOString().split('T')[0];
            refreshCurrentView();
        }
        if (e2.target.closest('#cal-today')) {
            calendarState.currentDate = new Date().toISOString().split('T')[0];
            refreshCurrentView();
        }
        if (e2.target.closest('#cal-view-day')) {
            calendarState.viewMode = 'day';
            refreshCurrentView();
        }
        if (e2.target.closest('#cal-view-week')) {
            calendarState.viewMode = 'week';
            refreshCurrentView();
        }
        if (e2.target.closest('#cal-view-month')) {
            calendarState.viewMode = 'month';
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
            const name = document.getElementById('u-name').value.trim();
            const email = document.getElementById('u-email').value.trim();
            const type = document.getElementById('u-type').value;

            if (!name || !email || !type) {
                alert('Completa nombre, email y tipo de usuario.');
                return;
            }

            const roleNodes = Array.from(document.querySelectorAll('input[name="u-role"]:checked'));
            const roles = roleNodes.map(r => r.value);
            if (roles.length === 0) {
                alert('Selecciona al menos un rol de permisos.');
                return;
            }

            const profNodes = Array.from(document.querySelectorAll('input[name="u-profs"]:checked'));
            const selectedProfessionals = profNodes.length > 0 ? profNodes.map(p => parseInt(p.value)) : [];

            DB.add('users', {
                name,
                email,
                type,
                roles,
                allowedProfessionals: selectedProfessionals
            });
            refreshCurrentView();
        }

        if (e.target.id === 'new-prof-form') {
            e.preventDefault();
            const name = document.getElementById('p-name').value.trim();
            const lastName = document.getElementById('p-lastname').value.trim();
            const specialty = document.getElementById('p-specialty').value.trim();
            const phone = document.getElementById('p-phone').value.trim();
            const email = document.getElementById('p-email').value.trim();
            const status = document.getElementById('p-status').value;

            if (!name || !lastName || !specialty) {
                alert('Nombre, apellido y especialidad son obligatorios para un profesional.');
                return;
            }

            DB.add('professionals', {
                name: `${name} ${lastName}`,
                firstName: name,
                lastName,
                specialty,
                phone,
                email,
                status: status || 'activo',
                schedule: {
                    1: {active: true, start: '08:00', end: '16:00'},
                    2: {active: true, start: '08:00', end: '16:00'},
                    3: {active: true, start: '08:00', end: '16:00'},
                    4: {active: true, start: '08:00', end: '16:00'},
                    5: {active: true, start: '08:00', end: '16:00'},
                    6: {active: false, start: '', end: ''},
                    0: {active: false, start: '', end: ''}
                }
            });

            refreshCurrentView();
        }
    });
});

// --- Auth ---
function login(email, selectedRole) {
    console.log('Login attempt for:', email, 'as', selectedRole);
    const users = DB.get('users');
    let user = users.find(u => u.email === email);
    
    if (!user) {
        console.log('Creating new user with role', selectedRole);
        user = { id: users.length + 1, email: email, name: email.split('@')[0], roles: [selectedRole], allowedProfessionals: [] };
        DB.add('users', user);
    } else if (!user.roles.includes(selectedRole)) {
        // Para testing: si el mismo email escoge otro rol, lo agregamos como rol adicional.
        user.roles.push(selectedRole);
        DB.update('users', user.id, { roles: user.roles });
    }
    
    state.user = { ...user };
    document.getElementById('user-name').innerText = user.name;
    document.getElementById('user-role-display').innerText = user.roles.map(r => roleConfig[r]?.name || r).join(' + ');
    document.getElementById('user-initials').innerText = user.name.substring(0, 2).toUpperCase();
    
    renderSidebar();
    
    // Simple transition
    views.login.classList.remove('active');
    views.login.classList.add('hidden');
    views.app.classList.remove('hidden');
    views.app.classList.add('active');
    loadView('dashboard');
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
    
    // Collect unique navItems from all user roles
    const navItems = new Map();
    state.user.roles.forEach(role => {
        if (roleConfig[role]) {
            roleConfig[role].navItems.forEach(item => {
                navItems.set(item.id, item);
            });
        }
    });
    
    Array.from(navItems.values()).forEach(item => {
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

function viewProfessionalCalendar(profId) {
    const profs = DB.get('professionals');
    profs.forEach(p => {
        calendarState.visibleProfs[p.id] = p.id === profId;
    });
    loadView('appointments');
}

// --- Modal System & Forms ---
function closeModal() {
    modalsContainer.innerHTML = '';
}

function openAppointmentViewModal(aptId) {
    const apt = DB.get('appointments').find(a => a.id === aptId);
    if (!apt) return;

    const patient = DB.get('patients').find(p => p.name === apt.patient);
    const prof = DB.get('professionals').find(p => p.id === apt.professionalId);

    modalsContainer.innerHTML = `
        <div class="modal-overlay active">
            <div class="modal-content" onclick="event.stopPropagation()">
                <div class="modal-header">
                    <h3>Detalles del Turno</h3>
                    <button class="btn-ghost" data-modal-close><i class="fa-solid fa-times"></i></button>
                </div>
                <div class="modal-body">
                    <div class="grid grid-cols-2 gap-4 mb-4">
                        <div><strong>Paciente:</strong> ${apt.patient}</div>
                        <div><strong>Teléfono:</strong> ${patient ? patient.phone : 'N/A'}</div>
                        <div><strong>Profesional:</strong> ${prof ? prof.name : 'N/A'}</div>
                        <div><strong>Especialidad:</strong> Odontología</div>
                        <div><strong>Fecha:</strong> ${new Date(apt.date).toLocaleDateString('es-AR')}</div>
                        <div><strong>Hora:</strong> ${apt.time} (${apt.duration} min)</div>
                        <div><strong>Estado:</strong> <span class="badge badge-${apt.status === 'confirmed' ? 'success' : apt.status === 'pending' ? 'warning' : apt.status === 'cancelled' ? 'danger' : 'info'}">${apt.status}</span></div>
                        <div><strong>Motivo:</strong> Consulta odontológica</div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-ghost" data-modal-close>Cerrar</button>
                    <button type="button" class="btn btn-secondary" onclick="openAppointmentModal(${aptId})">Editar</button>
                    <button type="button" class="btn btn-primary">Iniciar Cita</button>
                </div>
            </div>
        </div>
    `;
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
    currentDate: new Date().toISOString().split('T')[0],
    viewMode: 'day', // 'day', 'week', 'month'
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
    const currentDate = calendarState.currentDate;
    const canEdit = state.user.roles.some(r => ['secretary', 'superadmin', 'admin'].includes(r));

    // For day view: columns per professional
    if (calendarState.viewMode === 'day') {
        // Build time labels (left gutter)
        let timeLabelsHtml = '';
        for (let h = CAL_START_HOUR; h <= CAL_END_HOUR; h++) {
            const top = (h - CAL_START_HOUR) * 60 * CAL_PX_PER_MIN;
            timeLabelsHtml += `<div class="cal-hour-label" style="top:${top}px">${String(h).padStart(2,'0')}:00</div>`;
        }

        // Build horizontal hour lines
        let linesHtml = '';
        for (let h = CAL_START_HOUR; h <= CAL_END_HOUR; h++) {
            const top = (h - CAL_START_HOUR) * 60 * CAL_PX_PER_MIN;
            linesHtml += `<div class="cal-h-line" style="top:${top}px"></div>`;
            if (h < CAL_END_HOUR) {
                linesHtml += `<div class="cal-h-line cal-h-half" style="top:${top + 60 * CAL_PX_PER_MIN / 2}px"></div>`;
            }
        }

        // Build professional columns
        let profCols = '';
        professionals.filter(p => calendarState.visibleProfs[p.id]).forEach(p => {
            const color = getProfColor(p.id);
            const dayApts = allApts.filter(a => a.date === currentDate && a.professionalId === p.id);

            // Build appointment blocks
            const aptBlocks = dayApts.map(apt => {
                const [ah, am] = apt.time.split(':').map(Number);
                const startMin = ah * 60 + am;
                const offsetMin = startMin - CAL_START_HOUR * 60;
                const duration = apt.isOverbook ? 15 : apt.duration;

                const topPx = offsetMin * CAL_PX_PER_MIN;
                const heightPx = Math.max(duration * CAL_PX_PER_MIN, 28);

                let statusColor = '#10b981'; // green confirmed
                if (apt.status === 'cancelled') statusColor = '#ef4444'; // red
                else if (apt.status === 'pending') statusColor = '#f59e0b'; // yellow
                else if (apt.status === 'completed') statusColor = '#6b7280'; // gray

                return `<div class="cal-apt-block" 
                    style="background:${statusColor}; color:#fff; top:${topPx}px; height:${heightPx}px; cursor:pointer;"
                    onclick="openAppointmentViewModal(${apt.id})">
                    <span class="cal-apt-name">${apt.patient}</span>
                    <span class="cal-apt-meta">${apt.time} - ${duration}min</span>
                    ${canEdit ? `<div class="cal-apt-actions">
                        <button class="cal-apt-btn btn-edit-apt" data-id="${apt.id}" title="Editar"><i class="fa-solid fa-pen"></i></button>
                        <button class="cal-apt-btn btn-delete-apt" data-id="${apt.id}" title="Cancelar"><i class="fa-solid fa-times"></i></button>
                    </div>` : ''}
                </div>`;
            }).join('');

            profCols += `
            <div class="cal-prof-col">
                <div class="cal-prof-header">
                    <span class="cal-prof-name">${p.name}</span>
                </div>
                <div class="cal-prof-body" style="height:${CAL_TOTAL_HEIGHT}px; position:relative;">
                    ${linesHtml}
                    ${aptBlocks}
                </div>
            </div>`;
        });

        // Sidebar legend
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
                    <span class="font-semibold text-gray-700 text-sm" id="cal-date-display">${new Date(currentDate).toLocaleDateString('es-AR', {weekday:'long', day:'numeric', month:'long', year:'numeric'})}</span>
                    <button class="btn btn-ghost btn-sm" id="cal-next"><i class="fa-solid fa-chevron-right"></i></button>
                    <button class="btn btn-secondary btn-sm" id="cal-today">Hoy</button>
                </div>
                <div class="flex items-center gap-2">
                    <button class="btn btn-ghost btn-sm ${calendarState.viewMode === 'day' ? 'active' : ''}" id="cal-view-day">Día</button>
                    <button class="btn btn-ghost btn-sm ${calendarState.viewMode === 'week' ? 'active' : ''}" id="cal-view-week">Semana</button>
                    <button class="btn btn-ghost btn-sm ${calendarState.viewMode === 'month' ? 'active' : ''}" id="cal-view-month">Mes</button>
                </div>
                ${canEdit ? '<button class="btn btn-primary btn-sm" id="btn-add-apt"><i class="fa-solid fa-plus"></i> Nuevo Turno</button>' : ''}
            </div>

            <div class="cal-layout">
                <!-- Calendar grid -->
                <div class="cal-scroll-wrap">
                    <div class="cal-grid-day">
                        <!-- Gutter -->
                        <div class="cal-gutter-col">
                            <div class="cal-gutter-header"></div>
                            <div class="cal-gutter-body" style="height:${CAL_TOTAL_HEIGHT}px; position:relative;">
                                ${timeLabelsHtml}
                            </div>
                        </div>
                        <!-- Professional columns -->
                        ${profCols}
                    </div>
                </div>
                <!-- Sidebar -->
                ${legendHtml}
            </div>
        </div>`;
    } else if (calendarState.viewMode === 'week') {
        // Week view: days as columns, appointments listed per day
        const startOfWeek = new Date(currentDate);
        startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay()); // Sunday
        const days = [];
        for (let i = 0; i < 7; i++) {
            const d = new Date(startOfWeek);
            d.setDate(startOfWeek.getDate() + i);
            days.push(d);
        }

        let dayCols = '';
        days.forEach(d => {
            const iso = d.toISOString().split('T')[0];
            const isToday = iso === new Date().toISOString().split('T')[0];
            const dayName = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'][d.getDay()];
            const dayNum = d.getDate();

            const dayApts = allApts.filter(a => a.date === iso && calendarState.visibleProfs[a.professionalId]);

            const aptList = dayApts.map(apt => {
                const profName = getProfName(apt.professionalId);
                let statusColor = '#10b981';
                if (apt.status === 'cancelled') statusColor = '#ef4444';
                else if (apt.status === 'pending') statusColor = '#f59e0b';
                else if (apt.status === 'completed') statusColor = '#6b7280';

                return `<div class="cal-week-apt" style="background:${statusColor};" onclick="openAppointmentViewModal(${apt.id})">
                    <div class="cal-week-apt-name">${apt.patient}</div>
                    <div class="cal-week-apt-meta">${profName} · ${apt.time}</div>
                </div>`;
            }).join('');

            dayCols += `
            <div class="cal-day-col">
                <div class="cal-day-header ${isToday ? 'cal-today-header' : ''}">
                    <span class="cal-day-name">${dayName}</span>
                    <span class="cal-day-number ${isToday ? 'cal-today-badge' : ''}">${dayNum}</span>
                </div>
                <div class="cal-day-body" style="height:600px; padding:0.5rem; overflow-y:auto;">
                    ${aptList || '<div class="text-gray-400 text-sm">Sin turnos</div>'}
                </div>
            </div>`;
        });

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
            <div class="cal-toolbar card mb-4 flex justify-between items-center flex-wrap gap-2">
                <div class="flex items-center gap-3">
                    <button class="btn btn-ghost btn-sm" id="cal-prev"><i class="fa-solid fa-chevron-left"></i></button>
                    <span class="font-semibold text-gray-700 text-sm">
                        ${days[0].toLocaleDateString('es-AR',{day:'numeric',month:'short'})} – ${days[6].toLocaleDateString('es-AR',{day:'numeric',month:'short',year:'numeric'})}
                    </span>
                    <button class="btn btn-ghost btn-sm" id="cal-next"><i class="fa-solid fa-chevron-right"></i></button>
                    <button class="btn btn-secondary btn-sm" id="cal-today">Hoy</button>
                </div>
                <div class="flex items-center gap-2">
                    <button class="btn btn-ghost btn-sm ${calendarState.viewMode === 'day' ? 'active' : ''}" id="cal-view-day">Día</button>
                    <button class="btn btn-ghost btn-sm ${calendarState.viewMode === 'week' ? 'active' : ''}" id="cal-view-week">Semana</button>
                    <button class="btn btn-ghost btn-sm ${calendarState.viewMode === 'month' ? 'active' : ''}" id="cal-view-month">Mes</button>
                </div>
                ${canEdit ? '<button class="btn btn-primary btn-sm" id="btn-add-apt"><i class="fa-solid fa-plus"></i> Nuevo Turno</button>' : ''}
            </div>

            <div class="cal-layout">
                <div class="cal-scroll-wrap">
                    <div class="cal-grid-v2">
                        ${dayCols}
                    </div>
                </div>
                ${legendHtml}
            </div>
        </div>`;
    } else if (calendarState.viewMode === 'month') {
        const date = new Date(currentDate);
        const month = date.getMonth();
        const year = date.getFullYear();
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
            let content = '<div class="text-gray-400 text-xs">&nbsp;</div>';

            if (dayNum > 0 && dayNum <= daysInMonth) {
                isCurrentMonth = true;
                cellDate = new Date(year, month, dayNum);
                const iso = cellDate.toISOString().split('T')[0];
                let dayApts = allApts.filter(a => a.date === iso && calendarState.visibleProfs[a.professionalId]);
                dayApts = dayApts.sort((a,b)=>a.time.localeCompare(b.time));

                const aptList = dayApts.map(apt => {
                    const profName = getProfName(apt.professionalId);
                    let statusColor = '#10b981';
                    if (apt.status === 'cancelled') statusColor = '#ef4444';
                    else if (apt.status === 'pending') statusColor = '#f59e0b';
                    else if (apt.status === 'completed') statusColor = '#6b7280';
                    return `<div class="cal-month-apt" style="border-left:4px solid ${statusColor};" onclick="openAppointmentViewModal(${apt.id})">
                        <span class="text-xs font-semibold">${apt.time}</span>
                        <span class="text-xs">${apt.patient} (${profName})</span>
                    </div>`;
                }).join('');

                content = `<div class="cal-month-daynum ${isCurrentMonth ? '' : 'text-gray-400'}">${dayNum}</div>${aptList || '<div class="text-gray-400 text-xs">Sin turnos</div>'}`;
            }

            cells += `<div class="cal-month-cell ${isCurrentMonth ? '' : 'text-gray-400'}">${content}</div>`;
        }

        const monthName = date.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });

        const legendHtml = `
            <div class="cal-legend">...`;
        // Reuse legend same as week/day
        const legend = `
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
            <div class="cal-toolbar card mb-4 flex justify-between items-center flex-wrap gap-2">
                <div class="flex items-center gap-3">
                    <button class="btn btn-ghost btn-sm" id="cal-prev"><i class="fa-solid fa-chevron-left"></i></button>
                    <span class="font-semibold text-gray-700 text-sm" id="cal-date-display">${monthName}</span>
                    <button class="btn btn-ghost btn-sm" id="cal-next"><i class="fa-solid fa-chevron-right"></i></button>
                    <button class="btn btn-secondary btn-sm" id="cal-today">Hoy</button>
                </div>
                <div class="flex items-center gap-2">
                    <button class="btn btn-ghost btn-sm ${calendarState.viewMode === 'day' ? 'active' : ''}" id="cal-view-day">Día</button>
                    <button class="btn btn-ghost btn-sm ${calendarState.viewMode === 'week' ? 'active' : ''}" id="cal-view-week">Semana</button>
                    <button class="btn btn-ghost btn-sm ${calendarState.viewMode === 'month' ? 'active' : ''}" id="cal-view-month">Mes</button>
                </div>
                ${canEdit ? '<button class="btn btn-primary btn-sm" id="btn-add-apt"><i class="fa-solid fa-plus"></i> Nuevo Turno</button>' : ''}
            </div>

            <div class="cal-layout">
                <div class="cal-scroll-wrap">
                    <div class="cal-month-grid">
                        <div class="cal-month-row-header">Dom</div><div class="cal-month-row-header">Lun</div><div class="cal-month-row-header">Mar</div><div class="cal-month-row-header">Mié</div><div class="cal-month-row-header">Jue</div><div class="cal-month-row-header">Vie</div><div class="cal-month-row-header">Sáb</div>
                        ${cells}
                    </div>
                </div>
                ${legend}
            </div>
        </div>`;
    }
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
                                ${state.user.roles.some(r => ['superadmin', 'secretary', 'professional'].includes(r)) ? `
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
            ${state.user.roles.some(r => ['superadmin', 'secretary', 'admin'].includes(r)) ? 
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
                                ${state.user.roles.some(r => ['superadmin', 'secretary'].includes(r)) ? `
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
            ${state.user.roles.some(r => ['admin', 'superadmin'].includes(r)) ? 
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
                                ${state.user.roles.some(r => ['superadmin', 'admin'].includes(r)) ? 
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
    const isSuper = state.user.roles.includes('superadmin');

    if (!isSuper) {
        return `
            <div class="settings-card">
                <h3>Acceso denegado</h3>
                <p>Solo los usuarios con rol superadmin pueden gestionar la configuración.</p>
            </div>
        `;
    }

    const userRows = users.map(u => {
        const roles = (u.roles || (u.role ? [u.role] : [])).map(r => `
            <span class="badge ${r === 'superadmin' ? 'badge-primary' : (r === 'admin' ? 'badge-info' : (r === 'secretary' ? 'badge-warning' : 'badge-gray'))}">${r}</span>
        `).join(' ');

        const profNames = u.allowedProfessionals && u.allowedProfessionals.length > 0
            ? u.allowedProfessionals.map(id => `<span class="badge badge-gray">${getProfName(id)}</span>`).join(' ')
            : `<span class="badge badge-gray">No asignado</span>`;

        return `
            <tr class="hover-row">
                <td class="table-name"><strong>${u.name || 'Sin nombre'}</strong><br><span class="subtle">${u.email || '-'}</span></td>
                <td>${u.type || '-'}</td>
                <td>${roles}</td>
                <td>${profNames}</td>
                <td class="text-center"><button class="btn btn-ghost btn-sm" onclick="if(confirm('¿Eliminar usuario?')){ DB.delete('users', ${u.id}); refreshCurrentView(); }"><i class="fa-solid fa-trash text-danger"></i></button></td>
            </tr>`;
    }).join('');

    const profesionalRows = profs.map(p => {
        const statusLabel = p.status === 'activo'
            ? `<span class="badge badge-success">Activo</span>`
            : `<span class="badge badge-gray">Inactivo</span>`;
        return `
            <tr class="hover-row">
                <td class="table-name">${p.name}</td>
                <td>${p.lastName || '-'}</td>
                <td>${p.specialty || '-'}</td>
                <td>${p.phone || '-'}</td>
                <td>${p.email || '-'}</td>
                <td>${statusLabel}</td>
                <td class="text-center"><button class="btn btn-secondary btn-sm" onclick="viewProfessionalCalendar(${p.id})">Ver Calendario</button></td>
            </tr>`;
    }).join('');

    return `
    <div class="settings-area">
        <div class="settings-top-grid">
            <section class="settings-card">
                <header>
                    <div>
                        <h3>Crear Nuevo Usuario</h3>
                        <p class="subtext">Campos obligatorios: Nombre completo, Email, Tipo de usuario.</p>
                    </div>
                </header>
                <form id="new-user-form" class="settings-form-row columns-1">
                    <div class="input-group"><label>Nombre completo *</label><input type="text" id="u-name" required></div>
                    <div class="input-group"><label>Email *</label><input type="email" id="u-email" required></div>
                    <div class="input-group"><label>Tipo de usuario *</label><select id="u-type" required><option value="">Seleccionar...</option><option value="administrador">Administrador</option><option value="secretario">Secretario</option><option value="profesional">Profesional</option></select></div>

                    <div class="settings-subsection">
                        <h4>Roles de Permisos</h4>
                        <p class="subtext">Selecciona uno o varios roles.</p>
                        <div class="checkbox-group"><input type="checkbox" name="u-role" value="administrador"><label>Administrador</label></div>
                        <div class="checkbox-group"><input type="checkbox" name="u-role" value="secretario"><label>Secretario</label></div>
                        <div class="checkbox-group"><input type="checkbox" name="u-role" value="profesional"><label>Profesional</label></div>
                        <div class="checkbox-group"><input type="checkbox" name="u-role" value="superadmin"><label>Superadmin</label></div>
                    </div>

                    <div class="settings-subsection">
                        <h4>Asignar Profesionales (opcional)</h4>
                        <p class="subtext">Se puede dejar vacío; acceso completo si no se selecciona ninguno.</p>
                        <div class="settings-list">
                            ${profs.map(p => `<div class="checkbox-group"><input type="checkbox" name="u-profs" value="${p.id}"><label>${p.name}</label></div>`).join('')}
                        </div>
                    </div>
                    <button type="submit" class="btn btn-primary">Guardar Usuario</button>
                </form>
            </section>

            <section class="settings-card">
                <header>
                    <div>
                        <h3>Crear Profesional</h3>
                        <p class="subtext">Campos obligatorios: Nombre, Apellido, Especialidad.</p>
                    </div>
                </header>
                <form id="new-prof-form" class="settings-form-row columns-1">
                    <div class="input-group"><label>Nombre *</label><input type="text" id="p-name" required></div>
                    <div class="input-group"><label>Apellido *</label><input type="text" id="p-lastname" required></div>
                    <div class="input-group"><label>Especialidad *</label><input type="text" id="p-specialty" required></div>
                    <div class="input-group"><label>Teléfono</label><input type="text" id="p-phone"></div>
                    <div class="input-group"><label>Email</label><input type="email" id="p-email"></div>
                    <div class="input-group"><label>Estado</label><select id="p-status"><option value="activo">Activo</option><option value="inactivo">Inactivo</option></select></div>
                    <button type="submit" class="btn btn-primary">Guardar Profesional</button>
                </form>
            </section>
        </div>

        <div class="settings-tables-grid">
            <section class="settings-card">
                <header><h3>Usuarios Existentes</h3></header>
                <div class="table-container overflow-x-auto">
                    <table class="table-modern table-compact">
                        <thead>
                            <tr>
                                <th>Nombre / Email</th>
                                <th>Tipo</th>
                                <th>Roles</th>
                                <th>Profesionales</th>
                                <th>Acción</th>
                            </tr>
                        </thead>
                        <tbody>${userRows || `<tr><td colspan="5" class="text-gray-500">No hay usuarios registrados</td></tr>`}</tbody>
                    </table>
                </div>
            </section>
            <section class="settings-card">
                <header><h3>Profesionales Existentes</h3></header>
                <div class="table-container overflow-x-auto">
                    <table class="table-modern table-compact">
                        <thead>
                            <tr>
                                <th>Nombre</th>
                                <th>Apellido</th>
                                <th>Especialidad</th>
                                <th>Teléfono</th>
                                <th>Email</th>
                                <th>Estado</th>
                                <th>Acción</th>
                            </tr>
                        </thead>
                        <tbody>${profesionalRows || `<tr><td colspan="7" class="text-gray-500">No hay profesionales registrados</td></tr>`}</tbody>
                    </table>
                </div>
            </section>
        </div>
    </div>
    `;
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
            facesHtml = `
                <rect x="0" y="0" width="100" height="100" fill="none" stroke="#ef4444" stroke-width="3" rx="8" ry="8"></rect>
                <line x1="10" y1="10" x2="90" y2="90" stroke="#ef4444" stroke-width="8" stroke-linecap="round"></line>
                <line x1="90" y1="10" x2="10" y2="90" stroke="#ef4444" stroke-width="8" stroke-linecap="round"></line>
            `;
        } else {
            const getColor = (f) => {
                if(toothData[f] === 'caries') return '#3b82f6';
                if(toothData[f] === 'restaurado') return '#ef4444';
                return 'transparent';
            };
            facesHtml = `
                <polygon points="0,0 100,0 75,25 25,25" class="tooth-face cursor-pointer hover:opacity-80 transition-opacity" data-tooth="${id}" data-face="top" fill="${getColor('top')}" stroke="#94a3b8" stroke-width="2" pointer-events="all"></polygon>
                <polygon points="100,0 100,100 75,75 75,25" class="tooth-face cursor-pointer hover:opacity-80 transition-opacity" data-tooth="${id}" data-face="right" fill="${getColor('right')}" stroke="#94a3b8" stroke-width="2"></polygon>
                <polygon points="100,100 0,100 25,75 75,75" class="tooth-face cursor-pointer hover:opacity-80 transition-opacity" data-tooth="${id}" data-face="bottom" fill="${getColor('bottom')}" stroke="#94a3b8" stroke-width="2"></polygon>
                <polygon points="0,100 0,0 25,25 25,75" class="tooth-face cursor-pointer hover:opacity-80 transition-opacity" data-tooth="${id}" data-face="left" fill="${getColor('left')}" stroke="#94a3b8" stroke-width="2"></polygon>
                <rect x="25" y="25" width="50" height="50" class="tooth-face cursor-pointer hover:opacity-80 transition-opacity" data-tooth="${id}" data-face="center" fill="${getColor('center')}" stroke="#94a3b8" stroke-width="2"></rect>
            `;
        }

        return `
        <div class="flex flex-col items-center tooth-box" data-tooth="${id}">
            <span class="text-[8px] md:text-[10px] font-bold text-gray-700 w-full text-center hover:bg-red-100 cursor-pointer rounded" title="Doble clic para marcar Ausente" ondblclick="toggleAbsent(${state.currentPatientId}, ${id})">${id}</span>
            <div class="relative w-8 h-8 md:w-10 md:h-10">
                <svg viewBox="0 0 100 100" class="w-full h-full drop-shadow-sm" style="stroke-width:2.5;">
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
    <div class="clinical-history-card bg-white rounded-xl max-w-5xl mx-auto overflow-hidden" style="font-family: Arial, sans-serif;">
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
            <div class="clinical-info-grid mb-10 pb-6 border-b border-dashed border-gray-300">
                <div class="clinical-info-summary">
                    <div><strong class="text-gray-600 uppercase text-xs">Obra Social / Plan</strong><div class="text-base font-semibold text-gray-800">${patient.obraSocial || '-'}</div></div>
                    <div><strong class="text-gray-600 uppercase text-xs">Credencial</strong><div class="text-base font-semibold text-gray-800">${patient.credencial || '-'}</div></div>
                    <div><strong class="text-gray-600 uppercase text-xs">Ficha N°</strong><div class="text-base font-semibold text-primary-700">${patient.fichaNumero || '-'}</div></div>
                </div>
                <div class="clinical-info-item"><strong class="text-gray-600 uppercase text-xs">Nacimiento</strong><div>${patient.fechaNacimiento ? patient.fechaNacimiento.split('-').reverse().join('/') : '-'}</div></div>
                <div class="clinical-info-item"><strong class="text-gray-600 uppercase text-xs">Edad</strong><div>${age} años</div></div>
                <div class="clinical-info-item"><strong class="text-gray-600 uppercase text-xs">Teléfono</strong><div>${patient.phone || '-'}</div></div>
                <div class="clinical-info-item col-span-full"><strong class="text-gray-600 uppercase text-xs">Domicilio</strong><div>${patient.domicilio || '-'}</div></div>
            </div>

            <!-- ODONTOGRAMA -->
            <div class="mb-10">
                <div class="flex items-center justify-between mb-4">
                    <h3 class="font-black text-gray-800 uppercase tracking-widest text-sm bg-gray-100 py-1 px-3 rounded inline-block border-l-4 border-primary-600">Odontograma Inicial</h3>
                    <div class="flex gap-2 text-xs">
                        <span class="badge-state badge-sano">Sano</span>
                        <span class="badge-state badge-caries">Caries</span>
                        <span class="badge-state badge-restauracion">Restauración</span>
                        <span class="badge-state badge-ausente">Ausente</span>
                    </div>
                </div>
                
                <p class="text-xs text-gray-500 mb-2 text-center w-full">Haz clic en cada cara para ciclar estado (Sano → Caries → Restaurado). Doble clic en el NÚMERO para marcar ausente.</p>
                <div class="odontogram-wrapper overflow-x-auto pb-4">
                    <div class="flex flex-col items-center gap-4"> <!-- Ajuste: más compacto -->
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
                                    ${!state.user.roles.includes('secretary') ? `
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
    if(state.user.roles.includes('secretary')) return; // Read Only for clinical charting

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

    document.querySelectorAll('.tooth-box').forEach(box => {
        box.addEventListener('click', (e) => {
            // Evitar doble procesar click en .tooth-face, dejar que su manejador se encargue
            if (e.target.closest('.tooth-face')) return;
            const toothId = box.dataset.tooth;
            const p = DB.get('patients').find(pt => pt.id === patientId);
            if (!p.odontograma) p.odontograma = {};
            if (!p.odontograma[toothId]) p.odontograma[toothId] = {};
            if (p.odontograma[toothId].estado === 'ausente') return;

            // Avanzar estado general por diente desde sano->caries->restaurado->sano
            const statusOrder = ['sano', 'caries', 'restaurado'];
            const currentGlobal = p.odontograma[toothId].estado || 'sano';
            let nextGlobal = 'sano';
            if (currentGlobal === 'sano') nextGlobal = 'caries';
            else if (currentGlobal === 'caries') nextGlobal = 'restaurado';
            else if (currentGlobal === 'restaurado') nextGlobal = 'sano';
            p.odontograma[toothId].estado = nextGlobal;

            // aplicar color de estado al centro para visual inmediato
            if (nextGlobal === 'caries') p.odontograma[toothId].center = 'caries';
            else if (nextGlobal === 'restaurado') p.odontograma[toothId].center = 'restaurado';
            else delete p.odontograma[toothId].center;

            DB.update('patients', patientId, { odontograma: p.odontograma });
            loadClinicalHistory(patientId);
        });
    });

    document.getElementById('btn-add-treatment')?.addEventListener('click', () => {
        openTreatmentModal(patientId);
    });
}

window.toggleAbsent = function(patientId, toothId) {
    if(state.user.roles.includes('secretary')) return;
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
