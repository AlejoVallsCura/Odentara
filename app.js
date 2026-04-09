// --- Navigation & State ---
const state = {
    user: null, 
    authToken: null,
    currentView: 'dashboard',
    sidebarOpen: true,
    settingsSubView: 'create-user',
    dashboardDate: null
};

const API_BASE_URL = 'http://localhost:3001/api';
const AUTH_STORAGE_KEY = 'odentara_auth_v1';

const MOJIBAKE_REPAIRS = [
    ['ContraseÃ±a', 'Contraseña'],
    ['contraseÃ±a', 'contraseña'],
    ['Centro odontolÃ³gico', 'Centro odontológico'],
    ['Cerrar sesiÃ³n', 'Cerrar sesión'],
    ['Horarios MÃ©dicos', 'Horarios Médicos'],
    ['FacturaciÃ³n', 'Facturación'],
    ['ConfiguraciÃ³n', 'Configuración'],
    ['Historias ClÃ­nicas', 'Historias Clínicas'],
    ['RecepciÃ³n', 'Recepción'],
    ['GestiÃ³n de Turnos', 'Gestión de Turnos'],
    ['Agendas MÃ©dicas', 'Agendas Médicas'],
    ['SecretarÃ­a', 'Secretaría'],
    ['Completa email y contraseÃ±a.', 'Completa email y contraseña.'],
    ['No se pudo iniciar sesiÃ³n.', 'No se pudo iniciar sesión.'],
    ['Se inyecta despuÃ©s', 'Se inyecta después'],
    ['MÃ³dulo', 'Módulo'],
    ['TelÃ©fono', 'Teléfono'],
    ['Tel�fono', 'Teléfono'],
    ['OdontologÃ­a', 'Odontología'],
    ['odontolÃ³gica', 'odontológica'],
    ['odontolÃ³gico', 'odontológico'],
    ['AtenciÃ³n', 'Atención'],
    ['dÃ­as', 'días'],
    ['dÃ­a', 'día'],
    ['pasÃ³', 'pasó'],
    ['vÃ¡lido', 'válido'],
    ['MiÃ©rcoles', 'Miércoles'],
    ['SÃ¡bado', 'Sábado'],
    ['MiÃ©', 'Mié'],
    ['SÃ¡b', 'Sáb'],
    ['quÃ©', 'qué'],
    ['PrÃ³ximos Turnos', 'Próximos Turnos'],
    ['DÃ­a', 'Día'],
    ['D�a', 'Día'],
    ['TransacciÃ³n', 'Transacción'],
    ['DescripciÃ³n', 'Descripción'],
    ['DescripciÃ³n', 'Descripción'],
    ['MÃ©dicas', 'Médicas'],
    ['MÃ©dico', 'Médico'],
    ['ClÃ­nica', 'Clínica'],
    ['clÃ­nica', 'clínica'],
    ['Ficha OdontolÃ³gica', 'Ficha Odontológica'],
    ['aÃ±os', 'años'],
    ['NÂ°', 'N°'],
    ['NÂº', 'Nº'],
    ['Circulo OdontolÃ³gico', 'Círculo Odontológico'],
    ['CÃ­rculo OdontolÃ³gico', 'Círculo Odontológico'],
    ['Ficha ClÃ­nica OdontolÃ³gica', 'Ficha Clínica Odontológica'],
    ['RestauraciÃ³n', 'Restauración'],
    ['AÃ±adir', 'Añadir'],
    ['AutorizaciÃ³n', 'Autorización'],
    ['CÃ³digo', 'Código'],
    ['vacÃ­o', 'vacío'],
    ['vacÃƒÂ­o', 'vacío'],
    ['podrÃ¡n', 'podrán'],
    ['segÃºn', 'según'],
    ['LÃ³pez', 'López'],
    ['MartÃ­nez', 'Martínez'],
    ['GÃ³mez', 'Gómez'],
    ['MarÃ­a', 'María'],
    ['PÃ©rez', 'Pérez'],
    ['SÃ¡nchez', 'Sánchez'],
    ['RamÃ­rez', 'Ramírez'],
    ['SofÃ­a', 'Sofía'],
    ['MartÃ­n', 'Martín'],
    ['Ãlvarez', 'Álvarez'],
    ['LucÃ­a', 'Lucía'],
    ['FernÃ¡ndez', 'Fernández'],
    ['MedifÃ©', 'Medifé'],
    ['CÃ³rdoba', 'Córdoba'],
    ['EstrÃ©s', 'Estrés'],
    ['DiabÃ©tico', 'Diabético'],
    ['Ã±', 'ñ'],
    ['Ã¡', 'á'],
    ['Ã©', 'é'],
    ['Ã­', 'í'],
    ['Ã³', 'ó'],
    ['Ãº', 'ú'],
    ['Ã', 'Á'],
    ['Ã‰', 'É'],
    ['Ã', 'Í'],
    ['Ã“', 'Ó'],
    ['Ãš', 'Ú'],
    ['Â¿', '¿'],
    ['Â¡', '¡'],
    ['Â·', '·'],
    ['â†’', '→'],
    ['â€“', '–'],
    ['�', '']
];

function repairMojibakeString(value) {
    if (typeof value !== 'string' || !value) return value;
    let repaired = value;
    for (const [from, to] of MOJIBAKE_REPAIRS) {
        repaired = repaired.split(from).join(to);
    }
    repaired = repaired
        .replace(/\?\s*Eliminar/g, '¿Eliminar')
        .replace(/^\?/, '¿')
        .replace(/\s+\?/g, '?');
    return repaired;
}

function repairDomText(root = document.body) {
    if (!root) return;

    const textWalker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let textNode = textWalker.nextNode();
    while (textNode) {
        const repaired = repairMojibakeString(textNode.nodeValue);
        if (repaired !== textNode.nodeValue) {
            textNode.nodeValue = repaired;
        }
        textNode = textWalker.nextNode();
    }

    root.querySelectorAll?.('*').forEach((element) => {
        ['title', 'placeholder', 'aria-label', 'value'].forEach((attr) => {
            if (!element.hasAttribute(attr)) return;
            const current = element.getAttribute(attr);
            const repaired = repairMojibakeString(current);
            if (repaired !== current) {
                element.setAttribute(attr, repaired);
            }
        });
    });
}

let feedbackToastRoot = null;
let feedbackDialogRoot = null;

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

function showToast(message, options = {}) {
    const { type = 'info', duration = 3200 } = options;
    const { feedbackToastRoot } = ensureFeedbackUi();
    const toast = document.createElement('div');
    toast.className = `feedback-toast feedback-toast-${type}`;
    toast.innerHTML = `
        <div class="feedback-toast-icon">
            <i class="fa-solid ${type === 'success' ? 'fa-check' : type === 'error' ? 'fa-circle-exclamation' : 'fa-bell'}"></i>
        </div>
        <div class="feedback-toast-copy">${repairMojibakeString(String(message ?? ''))}</div>
    `;

    feedbackToastRoot.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('is-visible'));

    const removeToast = () => {
        toast.classList.remove('is-visible');
        window.setTimeout(() => toast.remove(), 180);
    };

    window.setTimeout(removeToast, duration);
    toast.addEventListener('click', removeToast);
}

function showDialog(message, options = {}) {
    const {
        title = 'Odentara',
        variant = 'info',
        confirmText = 'Aceptar',
        cancelText = null,
        dismissible = true
    } = options;

    const { feedbackDialogRoot } = ensureFeedbackUi();
    const overlay = document.createElement('div');
    overlay.className = 'feedback-dialog-overlay';
    overlay.innerHTML = `
        <div class="feedback-dialog feedback-dialog-${variant}" role="dialog" aria-modal="true" aria-label="${repairMojibakeString(title)}">
            <div class="feedback-dialog-badge">
                <i class="fa-solid ${variant === 'danger' ? 'fa-trash' : variant === 'error' ? 'fa-circle-exclamation' : variant === 'success' ? 'fa-check' : 'fa-bell'}"></i>
            </div>
            <div class="feedback-dialog-copy">
                <p class="feedback-dialog-eyebrow">${repairMojibakeString(title)}</p>
                <p class="feedback-dialog-message">${repairMojibakeString(String(message ?? ''))}</p>
            </div>
            <div class="feedback-dialog-actions">
                ${cancelText ? `<button type="button" class="btn btn-ghost feedback-dialog-cancel">${repairMojibakeString(cancelText)}</button>` : ''}
                <button type="button" class="btn btn-primary feedback-dialog-confirm">${repairMojibakeString(confirmText)}</button>
            </div>
        </div>
    `;

    feedbackDialogRoot.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('is-visible'));

    return new Promise((resolve) => {
        const cleanup = (result) => {
            overlay.classList.remove('is-visible');
            document.removeEventListener('keydown', onKeyDown);
            window.setTimeout(() => {
                overlay.remove();
                resolve(result);
            }, 180);
        };

        const onKeyDown = (event) => {
            if (event.key === 'Escape' && dismissible) {
                cleanup(false);
            }
        };

        document.addEventListener('keydown', onKeyDown);

        overlay.querySelector('.feedback-dialog-confirm')?.addEventListener('click', () => cleanup(true));
        overlay.querySelector('.feedback-dialog-cancel')?.addEventListener('click', () => cleanup(false));

        if (dismissible) {
            overlay.addEventListener('click', (event) => {
                if (event.target === overlay) {
                    cleanup(false);
                }
            });
        }
    });
}

function showAlert(message, options = {}) {
    return showDialog(message, {
        title: options.title || 'Odentara',
        variant: options.variant || 'info',
        confirmText: options.confirmText || 'Aceptar',
        dismissible: true
    });
}

function showConfirm(message, options = {}) {
    return showDialog(message, {
        title: options.title || 'Confirmar acción',
        variant: options.variant || 'danger',
        confirmText: options.confirmText || 'Confirmar',
        cancelText: options.cancelText || 'Cancelar',
        dismissible: true
    });
}

function setupMojibakeAutoRepair() {
    const nativeConfirm = window.confirm.bind(window);

    window.alert = (message) => showAlert(message);
    window.confirm = (message) => nativeConfirm(repairMojibakeString(String(message ?? '')));
    window.appAlert = showAlert;
    window.appConfirm = showConfirm;
    window.appToast = showToast;

    const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            mutation.addedNodes.forEach((node) => {
                if (node.nodeType === Node.TEXT_NODE) {
                    const repaired = repairMojibakeString(node.nodeValue);
                    if (repaired !== node.nodeValue) {
                        node.nodeValue = repaired;
                    }
                    return;
                }

                if (node.nodeType === Node.ELEMENT_NODE) {
                    repairDomText(node);
                }
            });
        }
    });

    observer.observe(document.body, { childList: true, subtree: true });
    repairDomText(document.body);
}

// --- Database Setup ---
const defaultData = {
    users: [
        { id: 1, email: 'admin@odentara.com', name: 'Superadmin Odentara', roles: ['superadmin'], allowedProfessionals: [] },
        { id: 2, email: 'lopez@odentara.com', name: 'Dr. LÃ³pez', roles: ['professional'], allowedProfessionals: [1] },
        { id: 3, email: 'secretaria@odentara.com', name: 'SecretarÃ­a General', roles: ['secretary'], allowedProfessionals: [] },
        { id: 4, email: 'administracion@odentara.com', name: 'Administrador General', roles: ['admin'], allowedProfessionals: [] }
    ],
    professionals: [
        { id: 1, name: 'Dr. LÃ³pez', schedule: { 
            1: {active: true, start: '08:00', end: '16:00'}, 2: {active: true, start: '08:00', end: '16:00'}, 
            3: {active: true, start: '08:00', end: '16:00'}, 4: {active: true, start: '08:00', end: '16:00'}, 
            5: {active: true, start: '08:00', end: '16:00'}, 6: {active: false, start: '08:00', end: '13:00'}, 
            0: {active: false, start: '08:00', end: '13:00'} 
        } },
        { id: 2, name: 'Dra. MartÃ­nez', schedule: { 
            1: {active: true, start: '09:00', end: '15:00'}, 2: {active: true, start: '09:00', end: '15:00'}, 
            3: {active: false, start: '09:00', end: '15:00'}, 4: {active: true, start: '09:00', end: '15:00'}, 
            5: {active: true, start: '09:00', end: '15:00'}, 6: {active: false, start: '', end: ''}, 
            0: {active: false, start: '', end: ''} 
        } },
        { id: 3, name: 'Dr. Carlos GÃ³mez', schedule: { 
            1: {active: true, start: '10:00', end: '18:00'}, 2: {active: true, start: '10:00', end: '18:00'}, 
            3: {active: true, start: '10:00', end: '18:00'}, 4: {active: true, start: '10:00', end: '18:00'}, 
            5: {active: true, start: '10:00', end: '18:00'}, 6: {active: false, start: '', end: ''}, 
            0: {active: false, start: '', end: ''} 
        } }
    ],
    appointments: [
        { id: 1, patient: 'MarÃ­a GÃ³mez', professionalId: 1, date: '2026-03-24', time: '10:00', duration: 60, status: 'confirmed', isOverbook: false },
        { id: 2, patient: 'Juan PÃ©rez', professionalId: 2, date: '2026-03-24', time: '11:00', duration: 30, status: 'sent', isOverbook: false },
        { id: 3, patient: 'Carlos Ruiz', professionalId: 1, date: '2026-03-24', time: '10:15', duration: 15, status: 'confirmed', isOverbook: true },
        { id: 4, patient: 'Laura SÃ¡nchez', professionalId: 3, date: '2026-03-24', time: '09:30', duration: 60, status: 'confirmed', isOverbook: false },
        { id: 5, patient: 'Diego RamÃ­rez', professionalId: 2, date: '2026-03-24', time: '12:00', duration: 45, status: 'not_sent', isOverbook: false },
        { id: 6, patient: 'SofÃ­a DÃ­az', professionalId: 1, date: '2026-03-24', time: '13:30', duration: 30, status: 'cancelled', isOverbook: false },
        { id: 7, patient: 'MartÃ­n Torres', professionalId: 3, date: '2026-03-24', time: '14:00', duration: 60, status: 'confirmed', isOverbook: false },
        { id: 8, patient: 'Karina LÃ³pez', professionalId: 2, date: '2026-03-24', time: '15:30', duration: 30, status: 'sent', isOverbook: false },
        { id: 9, patient: 'Facundo Vega', professionalId: 1, date: '2026-03-24', time: '16:30', duration: 60, status: 'not_sent', isOverbook: false },
        { id: 10, patient: 'Vanesa Ruiz', professionalId: 3, date: '2026-03-24', time: '17:45', duration: 30, status: 'confirmed', isOverbook: false },
        { id: 11, patient: 'Martina GÃ³mez', professionalId: 1, date: '2026-03-25', time: '09:00', duration: 45, status: 'confirmed', isOverbook: false },
        { id: 12, patient: 'Bruno Ãlvarez', professionalId: 2, date: '2026-03-25', time: '10:30', duration: 60, status: 'sent', isOverbook: false },
        { id: 13, patient: 'LucÃ­a FernÃ¡ndez', professionalId: 3, date: '2026-03-25', time: '11:45', duration: 30, status: 'not_sent', isOverbook: false }
    ],
    patients: [
        { id: 1, name: 'MarÃ­a GÃ³mez', dni: '34567890', fechaNacimiento: '1994-09-19', obraSocial: 'Sancor 4000', credencial: '1826490/00', domicilio: 'Primitivo de la Reta 513 Piso 8 Of 2 Ciudad', fichaNumero: '001', email: 'maria@example.com', phone: '261-679-1598', lastVisit: '2026-02-10', notes: 'Alergia a la penicilina', odontograma: {}, treatments: [] },
        { id: 2, name: 'Juan PÃ©rez', dni: '23456789', fechaNacimiento: '1985-05-12', obraSocial: 'OSDE 210', credencial: '12345678', domicilio: 'San Martin 123', fichaNumero: '002', email: 'juan@example.com', phone: '098-765-4321', lastVisit: '2026-03-01', notes: 'Sin antecedentes', odontograma: {}, treatments: [] },
        { id: 3, name: 'Laura SÃ¡nchez', dni: '45678901', fechaNacimiento: '1990-04-20', obraSocial: 'OSDE 310', credencial: '98765432', domicilio: 'Av. Libertador 1234', fichaNumero: '003', email: 'laura@example.com', phone: '261-111-2222', lastVisit: '2026-03-22', notes: '', odontograma: {}, treatments: [] },
        { id: 4, name: 'Diego RamÃ­rez', dni: '56789012', fechaNacimiento: '1988-08-05', obraSocial: 'SWISS MEDICAL', credencial: '11122334', domicilio: 'Calle Falsa 123', fichaNumero: '004', email: 'diego@example.com', phone: '261-333-4444', lastVisit: '2026-02-05', notes: 'Control de ortodoncia', odontograma: {}, treatments: [] },
        { id: 5, name: 'SofÃ­a DÃ­az', dni: '67890123', fechaNacimiento: '1995-12-01', obraSocial: 'Galeno', credencial: '22233445', domicilio: 'Calle Real 56', fichaNumero: '005', email: 'sofia@example.com', phone: '261-555-6666', lastVisit: '2026-01-16', notes: '', odontograma: {}, treatments: [] },
        { id: 6, name: 'MartÃ­n Torres', dni: '78901234', fechaNacimiento: '1979-03-30', obraSocial: 'MedifÃ©', credencial: '33344556', domicilio: 'Calle Luna 90', fichaNumero: '006', email: 'martin@example.com', phone: '261-777-8888', lastVisit: '2026-04-01', notes: 'DiabÃ©tico', odontograma: {}, treatments: [] },
        { id: 7, name: 'Karina LÃ³pez', dni: '89012345', fechaNacimiento: '1982-07-11', obraSocial: 'OSDE', credencial: '44455667', domicilio: 'Av. Mayo 321', fichaNumero: '007', email: 'karina@example.com', phone: '261-999-0000', lastVisit: '2026-03-10', notes: '', odontograma: {}, treatments: [] },
        { id: 8, name: 'Facundo Vega', dni: '90123456', fechaNacimiento: '1987-02-18', obraSocial: 'Swiss Medical', credencial: '55566778', domicilio: 'Calle Sol 18', fichaNumero: '008', email: 'facundo@example.com', phone: '261-101-2020', lastVisit: '2026-02-20', notes: 'Bleeding gums', odontograma: {}, treatments: [] },
        { id: 9, name: 'Vanesa Ruiz', dni: '01234567', fechaNacimiento: '1993-11-09', obraSocial: 'Galeno', credencial: '66677889', domicilio: 'Calle Mar 89', fichaNumero: '009', email: 'vanesa@example.com', phone: '261-303-4040', lastVisit: '2026-03-19', notes: '', odontograma: {}, treatments: [] },
        { id: 10, name: 'Martina GÃ³mez', dni: '11223344', fechaNacimiento: '2000-06-12', obraSocial: 'Sancor 4000', credencial: '77788990', domicilio: 'Calle Estrella 25', fichaNumero: '010', email: 'martina@example.com', phone: '261-505-6060', lastVisit: '2026-03-24', notes: '', odontograma: {}, treatments: [] },
        { id: 11, name: 'Bruno Ãlvarez', dni: '22334455', fechaNacimiento: '1975-09-27', obraSocial: 'OSDE', credencial: '88899001', domicilio: 'Av. CÃ³rdoba 101', fichaNumero: '011', email: 'bruno@example.com', phone: '261-707-8080', lastVisit: '2026-03-05', notes: '', odontograma: {}, treatments: [] },
        { id: 12, name: 'LucÃ­a FernÃ¡ndez', dni: '33445566', fechaNacimiento: '1998-01-14', obraSocial: 'MedifÃ©', credencial: '99900112', domicilio: 'Calle Internal 42', fichaNumero: '012', email: 'lucia@example.com', phone: '261-909-0101', lastVisit: '2026-03-28', notes: 'EstrÃ©s dental', odontograma: {}, treatments: [] }
    ],
    billing: [
        { id: 1, patientId: 2, professionalId: 2, type: 'income', amount: 12500, date: '2026-03-24', description: 'Consulta Dra. MartÃ­nez' },
        { id: 2, patientId: 1, professionalId: 1, type: 'debt', amount: 45000, date: '2026-03-20', description: 'Tratamiento conducto' }
    ]
};

const DB = {
    init() {
        if (!localStorage.getItem('odentara_db_v6')) {
            localStorage.setItem('odentara_db_v6', JSON.stringify(defaultData));
        }
        this.ensureSeedData();
    },
    ensureSeedData() {
        const db = JSON.parse(localStorage.getItem('odentara_db_v6'));
        if (!db) return;

        const mergeBy = (currentItems = [], seedItems = [], getKey) => {
            const merged = [...currentItems];
            const existingKeys = new Set(currentItems.map(item => getKey(item)));
            let nextId = currentItems.length > 0
                ? Math.max(...currentItems.map(item => item.id || 0)) + 1
                : 1;

            seedItems.forEach(seedItem => {
                const key = getKey(seedItem);
                if (!existingKeys.has(key)) {
                    merged.push({ ...seedItem, id: nextId++ });
                    existingKeys.add(key);
                }
            });

            return merged;
        };

        db.users = mergeBy(db.users, defaultData.users, item => item.email);
        db.professionals = mergeBy(db.professionals, defaultData.professionals, item => item.name);
        db.patients = mergeBy(db.patients, defaultData.patients, item => item.dni);

        localStorage.setItem('odentara_db_v6', JSON.stringify(db));
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
            { id: 'professionals', icon: 'fa-user-md', label: 'Horarios MÃ©dicos' },
            { id: 'patients', icon: 'fa-users', label: 'Pacientes & Historia' },
            { id: 'billing', icon: 'fa-file-invoice-dollar', label: 'FacturaciÃ³n' },
            { id: 'settings', icon: 'fa-cog', label: 'ConfiguraciÃ³n' }
        ]
    },
    admin: {
        name: 'Administrador',
        navItems: [
            { id: 'dashboard', icon: 'fa-chart-pie', label: 'Dashboard' },
            { id: 'patients', icon: 'fa-users', label: 'Directorio Pacientes' },
            { id: 'billing', icon: 'fa-file-invoice-dollar', label: 'Cuentas Corrientes' },
            { id: 'settings', icon: 'fa-cog', label: 'ConfiguraciÃ³n' }
        ]
    },
    professional: {
        name: 'Profesional',
        navItems: [
            { id: 'dashboard', icon: 'fa-chart-pie', label: 'Mi Panel' },
            { id: 'appointments', icon: 'fa-calendar-check', label: 'Mis Turnos' },
            { id: 'professionals', icon: 'fa-clock', label: 'Mis Horarios' },
            { id: 'patients', icon: 'fa-notes-medical', label: 'Historias ClÃ­nicas' }
        ]
    },
    secretary: {
        name: 'SecretarÃ­a',
        navItems: [
            { id: 'dashboard', icon: 'fa-chart-pie', label: 'RecepciÃ³n' },
            { id: 'appointments', icon: 'fa-calendar-check', label: 'GestiÃ³n de Turnos' },
            { id: 'professionals', icon: 'fa-user-md', label: 'Agendas MÃ©dicas' },
            { id: 'patients', icon: 'fa-users', label: 'Registro de Pacientes' }
        ]
    }
};

// --- Initial DOM Elements ---
const views = { login: document.getElementById('login-view'), app: document.getElementById('app-view') };
const modalsContainer = document.getElementById('modals-container');
const mainContent = document.getElementById('main-content');
const pageTitle = document.getElementById('page-title');
const appSidebar = document.getElementById('app-sidebar');
const sidebarBackdrop = document.getElementById('sidebar-backdrop');
const sidebarToggle = document.getElementById('sidebar-toggle');

function setElementText(id, value) {
    const el = document.getElementById(id);
    if (el) el.innerText = value;
}

function setPageTitle(title) {
    if (pageTitle) pageTitle.innerText = title;
}

function getPageTitle() {
    return pageTitle ? pageTitle.innerText : '';
}

function isMobileLayout() {
    return window.innerWidth <= 1024;
}

function syncSidebarLayout() {
    if (!views.app) return;
    if (isMobileLayout()) {
        views.app.classList.toggle('sidebar-open', !!state.sidebarOpen);
        if (sidebarBackdrop) sidebarBackdrop.classList.toggle('hidden', !state.sidebarOpen);
    } else {
        views.app.classList.remove('sidebar-open');
        if (sidebarBackdrop) sidebarBackdrop.classList.add('hidden');
    }
}

function setSidebarOpen(isOpen) {
    state.sidebarOpen = !!isOpen;
    syncSidebarLayout();
}

function normalizeIdentityEmail(email = '') {
    return String(email)
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
}

function normalizeDni(dni = '') {
    return String(dni).replace(/\D/g, '');
}

function normalizePatientName(name = '') {
    return String(name)
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ');
}

function mapApiUserToLegacyUser(apiUser = {}) {
    const displayName = apiUser.fullName || apiUser.name || apiUser.email || 'Usuario';
    return {
        id: apiUser.id,
        email: apiUser.email,
        name: displayName,
        fullName: apiUser.fullName || displayName,
        roles: Array.isArray(apiUser.roles) ? apiUser.roles : [],
        allowedProfessionals: Array.isArray(apiUser.allowedProfessionalIds) ? apiUser.allowedProfessionalIds : [],
        assignedProfessionalId: apiUser.assignedProfessionalId || null,
        assignedProfessionalName: apiUser.assignedProfessionalName || null,
        active: apiUser.active !== false
    };
}

function saveAuthSession(token, apiUser) {
    state.authToken = token;
    state.user = mapApiUserToLegacyUser(apiUser);
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({
        token,
        user: apiUser
    }));
}

function clearAuthSession() {
    state.authToken = null;
    state.user = null;
    localStorage.removeItem(AUTH_STORAGE_KEY);
}

async function apiFetch(path, options = {}) {
    const headers = {
        ...(options.headers || {})
    };

    if (state.authToken) {
        headers.Authorization = `Bearer ${state.authToken}`;
    }

    if (options.body && !headers['Content-Type']) {
        headers['Content-Type'] = 'application/json';
    }

    let response;
    try {
        response = await fetch(`${API_BASE_URL}${path}`, {
            ...options,
            headers
        });
    } catch (_error) {
        const connectionError = new Error('No se pudo conectar con el servidor. Verifica que el backend esté iniciado en localhost:3001.');
        connectionError.status = 0;
        throw connectionError;
    }

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        const error = new Error(data.error || 'Error de servidor');
        error.status = response.status;
        error.payload = data;
        throw error;
    }

    return data;
}

async function deleteViaApiOrLocal({ path, localTable, localId, fallbackAction, sync = true }) {
    if (state.authToken) {
        await apiFetch(path, { method: 'DELETE' });
        if (sync) {
            await syncBackendSnapshotToLocalDb();
        }
        return;
    }

    if (typeof fallbackAction === 'function') {
        fallbackAction();
        return;
    }

    if (localTable && localId !== undefined) {
        DB.delete(localTable, localId);
    }
}

function applyAuthenticatedUiState() {
    if (!state.user) return;
    state.dashboardDate = getTodayIsoLocal();
    const roleLabel = state.user.roles.map(r => roleConfig[r]?.name || r).join(' + ');
    const sourceName = state.user.name || state.user.fullName || state.user.email || 'Usuario';
    const initials = sourceName.substring(0, 2).toUpperCase();
    setElementText('user-name', sourceName);
    setElementText('user-role-display', roleLabel);
    setElementText('user-initials', initials);
    renderSidebar();
    setSidebarOpen(!isMobileLayout());
    views.login.classList.remove('active');
    views.login.classList.add('hidden');
    views.app.classList.remove('hidden');
    views.app.classList.add('active');
    loadView('dashboard');
}

function mapApiProfessionalToLegacy(professional = {}) {
    const schedule = {};
    (professional.schedules || []).forEach(item => {
        schedule[item.weekday] = {
            active: item.active,
            start: item.startTime,
            end: item.endTime
        };
    });

    return {
        id: professional.id,
        name: professional.fullName,
        firstName: professional.fullName,
        specialty: professional.specialty || '',
        email: professional.email || '',
        phone: professional.phone || '',
        color: professional.color || '#6366f1',
        status: professional.active ? 'activo' : 'inactivo',
        active: professional.active,
        schedule
    };
}

function mapApiPatientToLegacy(patient = {}) {
    return {
        id: patient.id,
        name: patient.fullName,
        dni: patient.dni,
        fechaNacimiento: patient.birthDate ? formatDateToLocalIso(new Date(patient.birthDate)) : '',
        obraSocial: [patient.insuranceName, patient.insurancePlan].filter(Boolean).join(' ').trim(),
        credencial: patient.credentialNumber || '',
        domicilio: patient.address || '',
        fichaNumero: patient.chartNumber || '',
        email: patient.email || '',
        phone: patient.phone || '',
        lastVisit: '',
        notes: patient.clinicalRecord?.summaryNotes || patient.clinicalRecord?.medicalNotes || '',
        allergies: patient.clinicalRecord?.allergies || '',
        medicalNotes: patient.clinicalRecord?.medicalNotes || '',
        odontograma: {},
        treatments: [],
        clinicalImages: []
    };
}

function mapApiTreatmentToLegacy(treatment = {}) {
    return {
        id: treatment.id,
        diente: treatment.tooth || '',
        cara: treatment.face || '',
        sector: treatment.sector || '',
        autorizacion: treatment.authorizationNumber || '',
        codigo: treatment.insuranceCode || '',
        observaciones: treatment.observations || '',
        fecha: treatment.performedAt ? new Date(treatment.performedAt).toLocaleDateString('es-AR') : '',
        firma: treatment.professional?.fullName || state.user?.fullName || state.user?.name || ''
    };
}

function mapApiClinicalImageToLegacy(image = {}) {
    return {
        id: image.id,
        date: image.takenAt
            ? formatDateToLocalIso(new Date(image.takenAt))
            : image.createdAt
                ? formatDateToLocalIso(new Date(image.createdAt))
                : '',
        description: image.description || '',
        dataUrl: image.imageUrl || ''
    };
}

function upsertLocalItem(table, item) {
    const items = DB.get(table);
    const index = items.findIndex((entry) => entry.id === item.id);

    if (index >= 0) {
        items[index] = {
            ...items[index],
            ...item
        };
    } else {
        items.push(item);
    }

    DB.save(table, items);
}

async function syncPatientClinicalData(patientId) {
    const patient = DB.get('patients').find((item) => item.id === patientId);
    if (!state.authToken) return patient;

    const [patientRes, treatmentsRes, imagesRes] = await Promise.all([
        apiFetch(`/patients/${patientId}`),
        apiFetch(`/treatments?patientId=${patientId}`),
        apiFetch(`/clinical-images?patientId=${patientId}`)
    ]);

    const mappedPatient = mapApiPatientToLegacy(patientRes.patient || {});
    const mergedPatient = {
        ...(patient || {}),
        ...mappedPatient,
        odontograma: patient?.odontograma || {},
        treatments: (treatmentsRes.treatments || []).map(mapApiTreatmentToLegacy),
        clinicalImages: (imagesRes.images || []).map(mapApiClinicalImageToLegacy),
        notes: patientRes.patient?.clinicalRecord?.summaryNotes || '',
        allergies: patientRes.patient?.clinicalRecord?.allergies || '',
        medicalNotes: patientRes.patient?.clinicalRecord?.medicalNotes || ''
    };

    upsertLocalItem('patients', mergedPatient);
    return mergedPatient;
}

function buildProfessionalSchedulesPayload(schedule = {}) {
    return Object.entries(schedule)
        .map(([weekday, values]) => ({
            weekday: Number(weekday),
            startTime: values?.start || '',
            endTime: values?.end || '',
            active: Boolean(values?.active)
        }))
        .filter(item => item.startTime && item.endTime);
}

function buildPatientApiPayload(values = {}) {
    return {
        fullName: values.name || '',
        dni: values.dni || '',
        birthDate: values.fechaNacimiento || null,
        phone: values.phone || '',
        email: values.email || '',
        address: values.domicilio || '',
        insuranceName: values.obraSocial || '',
        insurancePlan: values.insurancePlan || null,
        credentialNumber: values.credencial || '',
        chartNumber: values.fichaNumero || '',
        summaryNotes: values.notes || '',
        allergies: values.allergies || null,
        medicalNotes: values.medicalNotes || null,
        active: values.active !== false
    };
}

function mapApiAppointmentToLegacy(appointment = {}) {
    return {
        id: appointment.id,
        patient: appointment.patient?.fullName || '',
        patientId: appointment.patientId,
        professionalId: appointment.professionalId,
        date: appointment.date ? formatDateToLocalIso(new Date(appointment.date)) : '',
        time: appointment.startTime ? new Date(appointment.startTime).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false }) : '',
        duration: appointment.durationMinutes,
        status: appointment.status,
        isOverbook: !!appointment.isOverbook,
        notes: appointment.notes || '',
        confirmationChannel: appointment.confirmationChannel || null,
        cancellationReason: appointment.cancellationReason || null
    };
}

function mapApiBillingToLegacy(entry = {}) {
    return {
        id: entry.id,
        patientId: entry.patientId,
        professionalId: entry.professionalId,
        appointmentId: entry.appointmentId,
        type: entry.type,
        amount: Number(entry.amount || 0),
        date: entry.date ? formatDateToLocalIso(new Date(entry.date)) : '',
        description: entry.description || '',
        patientName: entry.patient?.fullName || ''
    };
}

function mapApiUserToSettings(user = {}) {
    return {
        id: user.id,
        name: user.fullName || user.name || user.email,
        email: user.email,
        type: user.roles?.[0] || 'user',
        roles: user.roles || [],
        allowedProfessionals: user.allowedProfessionalIds || []
    };
}

async function syncBackendSnapshotToLocalDb() {
    const [professionalsRes, patientsRes, appointmentsRes, billingRes, usersRes] = await Promise.allSettled([
        apiFetch('/professionals'),
        apiFetch('/patients'),
        apiFetch('/appointments'),
        apiFetch('/billing'),
        apiFetch('/users')
    ]);

    if (professionalsRes.status === 'fulfilled') {
        DB.save('professionals', (professionalsRes.value.professionals || []).map(mapApiProfessionalToLegacy));
    }

    if (patientsRes.status === 'fulfilled') {
        DB.save('patients', (patientsRes.value.patients || []).map(mapApiPatientToLegacy));
    }

    if (appointmentsRes.status === 'fulfilled') {
        DB.save('appointments', (appointmentsRes.value.appointments || []).map(mapApiAppointmentToLegacy));
    }

    if (billingRes.status === 'fulfilled') {
        DB.save('billing', (billingRes.value.entries || []).map(mapApiBillingToLegacy));
    }

    if (usersRes.status === 'fulfilled') {
        DB.save('users', (usersRes.value.users || []).map(mapApiUserToSettings));
    }
}

async function tryRestoreSession() {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return;

    try {
        const saved = JSON.parse(raw);
        if (!saved?.token) return;
        state.authToken = saved.token;
        const me = await apiFetch('/auth/me');
        saveAuthSession(saved.token, me.user);
        await syncBackendSnapshotToLocalDb();
        applyAuthenticatedUiState();
    } catch (_error) {
        clearAuthSession();
    }
}

function getPatientOptionLabel(patient) {
    return `${patient.name} | DNI ${patient.dni}`;
}

function getTodayIsoLocal() {
    const now = new Date();
    return formatDateToLocalIso(now);
}

function formatDateToLocalIso(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function parseLocalIsoDate(dateStr) {
    if (!dateStr) return new Date();
    const [year, month, day] = String(dateStr).split('-').map(Number);
    return new Date(year, (month || 1) - 1, day || 1);
}

function timeToMinutes(timeStr = '') {
    const [hours, minutes] = timeStr.split(':').map(Number);
    if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
    return (hours * 60) + minutes;
}

function getCurrentMinutes() {
    const now = new Date();
    return (now.getHours() * 60) + now.getMinutes();
}

function isPastDate(dateStr) {
    return Boolean(dateStr) && dateStr < getTodayIsoLocal();
}

function isTodayDate(dateStr) {
    return Boolean(dateStr) && dateStr === getTodayIsoLocal();
}

// --- Events ---
document.addEventListener('DOMContentLoaded', () => {
    setupMojibakeAutoRepair();

    document.getElementById('login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;
        const submitBtn = e.target.querySelector('button[type="submit"]');
        if (submitBtn) submitBtn.disabled = true;
        try {
            await login(email, password);
        } finally {
            if (submitBtn) submitBtn.disabled = false;
        }
    });

    document.getElementById('logout-btn').addEventListener('click', logout);
    sidebarToggle?.addEventListener('click', () => setSidebarOpen(!state.sidebarOpen));
    sidebarBackdrop?.addEventListener('click', () => setSidebarOpen(false));
    window.addEventListener('resize', syncSidebarLayout);
    setSidebarOpen(!isMobileLayout());
    
    document.addEventListener('click', async (e) => {
        if (e.target.matches('.modal-overlay') || e.target.closest('[data-modal-close]')) closeModal();
        
        // CRUD Routes
        if (e.target.closest('#btn-add-apt')) openAppointmentModal();
        if (e.target.closest('.btn-edit-apt')) openAppointmentModal(parseInt(e.target.closest('.btn-edit-apt').dataset.id));
        if (e.target.closest('.btn-delete-apt')) {
            const aptId = parseInt(e.target.closest('.btn-delete-apt').dataset.id);
            const apt = getAccessibleAppointments().find(item => item.id === aptId);
            if (apt && await showConfirm('¿Eliminar este turno?', { title: 'Eliminar turno', confirmText: 'Eliminar' })) {
                try {
                    await deleteViaApiOrLocal({
                        path: `/appointments/${aptId}`,
                        localTable: 'appointments',
                        localId: aptId
                    });
                    refreshCurrentView();
                } catch (error) {
                    alert(error.message || 'No se pudo eliminar el turno.');
                }
            }
        }
        
        if (e.target.closest('#btn-add-patient')) openPatientModal();
        if (e.target.closest('.btn-edit-patient')) openPatientModal(parseInt(e.target.closest('.btn-edit-patient').dataset.id));
        if (e.target.closest('.btn-delete-patient')) {
            const patientId = parseInt(e.target.closest('.btn-delete-patient').dataset.id);
            if (!isSuperadmin()) {
                alert('Solo el superadmin puede eliminar pacientes.');
                return;
            }
            if (canAccessPatient(patientId) && await showConfirm('¿Eliminar paciente y su historial?', { title: 'Eliminar paciente', confirmText: 'Eliminar' })) {
                try {
                    if (state.authToken) {
                        await apiFetch(`/patients/${patientId}`, { method: 'DELETE' });
                        await syncBackendSnapshotToLocalDb();
                    } else {
                        DB.delete('patients', patientId);
                    }
                    refreshCurrentView();
                } catch (error) {
                    alert(error.message || 'No se pudo eliminar el paciente.');
                }
            }
        }
        if (e.target.closest('.btn-view-history')) {
            const patientId = parseInt(e.target.closest('.btn-view-history').dataset.id);
            if (!canViewClinicalHistoryUi()) {
                showAlert('El secretario no puede acceder a la historia clínica.', { title: 'Historia clínica', variant: 'error' });
                return;
            }
            if (canAccessPatient(patientId)) loadClinicalHistory(patientId);
        }

        if (e.target.closest('#btn-add-tx')) openBillingModal();
        if (e.target.closest('.btn-delete-tx')) {
            const txId = parseInt(e.target.closest('.btn-delete-tx').dataset.id);
            const tx = DB.get('billing').find(item => item.id === txId);
            if (tx && canAccessProfessional(tx.professionalId) && await showConfirm('¿Eliminar transacción?', { title: 'Eliminar transacción', confirmText: 'Eliminar' })) {
                try {
                    await deleteViaApiOrLocal({
                        path: `/billing/${txId}`,
                        localTable: 'billing',
                        localId: txId
                    });
                    refreshCurrentView();
                } catch (error) {
                    alert(error.message || 'No se pudo eliminar la transacción.');
                }
            }
        }
        
        if (e.target.closest('.btn-edit-schedule')) {
            const profId = parseInt(e.target.closest('.btn-edit-schedule').dataset.id);
            if (canAccessProfessional(profId)) openScheduleModal(profId);
        }
    });

    // Calendar navigation & filter
    document.addEventListener('click', (e2) => {
        if (e2.target.closest('#cal-prev')) {
            const date = parseLocalIsoDate(calendarState.currentDate);
            if (calendarState.viewMode === 'day') {
                date.setDate(date.getDate() - 1);
            } else if (calendarState.viewMode === 'week') {
                date.setDate(date.getDate() - 7);
            }
            calendarState.currentDate = formatDateToLocalIso(date);
            refreshCurrentView();
        }
        if (e2.target.closest('#cal-next')) {
            const date = parseLocalIsoDate(calendarState.currentDate);
            if (calendarState.viewMode === 'day') {
                date.setDate(date.getDate() + 1);
            } else if (calendarState.viewMode === 'week') {
                date.setDate(date.getDate() + 7);
            }
            calendarState.currentDate = formatDateToLocalIso(date);
            refreshCurrentView();
        }
        if (e2.target.closest('#cal-today')) {
            calendarState.currentDate = getTodayIsoLocal();
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

    document.addEventListener('change', (e3) => {
        if (e3.target.id === 'dashboard-date-filter') {
            state.dashboardDate = e3.target.value || getTodayIsoLocal();
            if (state.currentView === 'dashboard') refreshCurrentView();
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

    document.addEventListener('click', (e) => {
        const settingsButton = e.target.closest('[data-settings-view]');
        if (settingsButton) {
            state.settingsSubView = settingsButton.dataset.settingsView;
            refreshCurrentView();
        }
    });

    document.addEventListener('submit', async (e) => {
        if (e.target.id === 'new-user-form') {
            e.preventDefault();
            const name = document.getElementById('u-name').value.trim();
            const email = document.getElementById('u-email').value.trim();
            const password = document.getElementById('u-password').value;
            const type = document.getElementById('u-type').value;

            if (!name || !email || !password || !type) {
                alert('Completa nombre, email, contraseña y tipo de usuario.');
                return;
            }

            if (password.length < 6) {
                alert('La contraseña debe tener al menos 6 caracteres.');
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

            try {
                if (state.authToken) {
                    await apiFetch('/users', {
                        method: 'POST',
                        body: JSON.stringify({
                            fullName: name,
                            email,
                            password,
                            type,
                            roles,
                            allowedProfessionalIds: selectedProfessionals
                        })
                    });
                    await syncBackendSnapshotToLocalDb();
                } else {
                    DB.add('users', {
                        name,
                        email,
                        password,
                        type,
                        roles,
                        allowedProfessionals: selectedProfessionals
                    });
                }

                e.target.reset();
                showToast('Usuario creado correctamente.', { type: 'success' });
            } catch (error) {
                alert(error.message || 'No se pudo crear el usuario.');
            }

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

            try {
                if (state.authToken) {
                    await apiFetch('/professionals', {
                        method: 'POST',
                        body: JSON.stringify({
                            fullName: `${name} ${lastName}`.trim(),
                            specialty,
                            phone,
                            email,
                            active: (status || 'activo') === 'activo'
                        })
                    });
                    await syncBackendSnapshotToLocalDb();
                } else {
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
                }

                e.target.reset();
                refreshCurrentView();
            } catch (error) {
                alert(error.message || 'No se pudo crear el profesional.');
            }
        }
    });

    tryRestoreSession();
});

// --- Auth ---
async function login(email, password) {
    const normalizedEmail = normalizeIdentityEmail(email);
    if (!normalizedEmail || !password) {
        alert('Completa email y contraseÃ±a.');
        return;
    }

    try {
        const result = await apiFetch('/auth/login', {
            method: 'POST',
            body: JSON.stringify({
                email: normalizedEmail,
                password
            })
        });

        saveAuthSession(result.token, result.user);
        await syncBackendSnapshotToLocalDb();
        applyAuthenticatedUiState();
    } catch (error) {
        const message = error.status === 0
            ? 'No se pudo conectar con el servidor de Odentara. Inicia el backend en localhost:3001 e intenta nuevamente.'
            : (error.payload?.error || error.message || 'No se pudo iniciar sesión.');
        showAlert(message, { title: 'Error de inicio de sesión', variant: 'error' });
    }
}

function logout() {
    clearAuthSession();
    state.dashboardDate = null;
    setSidebarOpen(false);
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
            if (isMobileLayout()) setSidebarOpen(false);
        });
        sidebarNav.appendChild(link);
    });
}

function refreshCurrentView() {
    loadView(state.currentView, getPageTitle());
}

function formatDashboardDateLabel(dateStr) {
    if (!dateStr) return '';
    const date = parseLocalIsoDate(dateStr);
    return date.toLocaleDateString('es-AR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long'
    });
}

function loadView(viewId, title = 'Dashboard') {
    state.currentView = viewId;
    setPageTitle(title);
    mainContent.innerHTML = '';
    syncSidebarLayout();
    
    const content = document.createElement('div');
    content.className = 'animate-fade-in';
    
    if (viewId === 'dashboard') content.innerHTML = renderDashboard();
    else if (viewId === 'appointments') content.innerHTML = renderAppointments();
    else if (viewId === 'professionals') content.innerHTML = renderProfessionals();
    else if (viewId === 'patients') content.innerHTML = renderPatients();
    else if (viewId === 'billing') content.innerHTML = renderBilling();
    else if (viewId === 'settings') content.innerHTML = renderSettingsSubpages();
    else if (viewId === 'patient-history') content.innerHTML = ''; // Se inyecta despuÃ©s por loadClinicalHistory
    else content.innerHTML = renderPlaceholder(viewId);
    
    mainContent.appendChild(content);
}

function renderPlaceholder(viewId) {
    return `<div class="card p-12 text-center"><i class="fa-solid fa-tools text-4xl text-gray-300 mb-4"></i><h3 class="text-lg font-medium text-gray-700">MÃ³dulo ${viewId} en ConstrucciÃ³n</h3></div>`;
}

// --- Helpers ---
function getProfName(id) {
    const p = DB.get('professionals').find(x => x.id === parseInt(id));
    return p ? p.name : 'Desconocido';
}

function getPatientByAppointment(apt) {
    return DB.get('patients').find(p => p.name === apt.patient) || null;
}

function isSuperadmin() {
    return !!state.user && state.user.roles.includes('superadmin');
}

function isProfessionalUser() {
    return !!state.user && state.user.roles.includes('professional');
}

function getAccessibleProfessionalIds() {
    const allProfs = DB.get('professionals');
    if (!state.user) return [];
    if (isSuperadmin()) return allProfs.map(p => p.id);

    const explicitAllowed = Array.isArray(state.user.allowedProfessionals) ? state.user.allowedProfessionals : [];

    if (isProfessionalUser()) {
        if (explicitAllowed.length > 0) return explicitAllowed;
        return allProfs
            .filter(p => p.name === state.user.name || (p.email && p.email === state.user.email))
            .map(p => p.id);
    }

    if (explicitAllowed.length > 0) return explicitAllowed;

    return allProfs.map(p => p.id);
}

function canAccessProfessional(profId) {
    return getAccessibleProfessionalIds().includes(parseInt(profId));
}

function getAccessibleProfessionals() {
    const allowedIds = new Set(getAccessibleProfessionalIds());
    return DB.get('professionals').filter(p => allowedIds.has(p.id));
}

function getAccessibleAppointments() {
    const allowedIds = new Set(getAccessibleProfessionalIds());
    return DB.get('appointments').filter(apt => allowedIds.has(apt.professionalId));
}

function getAccessiblePatientIds() {
    if (state.authToken) {
        return DB.get('patients').map(p => p.id);
    }

    if (isSuperadmin()) {
        return DB.get('patients').map(p => p.id);
    }

    const ids = new Set();
    getAccessibleAppointments().forEach(apt => {
        const patient = getPatientByAppointment(apt);
        if (patient) ids.add(patient.id);
    });

    DB.get('billing')
        .filter(tx => canAccessProfessional(tx.professionalId))
        .forEach(tx => ids.add(tx.patientId));

    return Array.from(ids);
}

function canAccessPatient(patientId) {
    return getAccessiblePatientIds().includes(parseInt(patientId));
}

function getAccessiblePatients() {
    if (state.authToken) {
        return DB.get('patients');
    }

    const allowedIds = new Set(getAccessiblePatientIds());
    return DB.get('patients').filter(p => allowedIds.has(p.id));
}

function canEditClinicalHistoryUi() {
    return !!state.user && state.user.roles.includes('professional');
}

function canViewClinicalHistoryUi() {
    return !!state.user && !state.user.roles.includes('secretary');
}

function normalizeAppointmentStatus(status = '') {
    if (status === 'pending') return 'not_sent';
    if (status === 'in progress') return 'sent';
    return status || 'not_sent';
}

function getAppointmentStatusMeta(status) {
    const normalized = normalizeAppointmentStatus(status);
    if (normalized === 'confirmed') return { key: normalized, label: 'Confirmado', badge: 'badge-success', color: '#10b981' };
    if (normalized === 'cancelled') return { key: normalized, label: 'Cancelado', badge: 'badge-danger', color: '#ef4444' };
    if (normalized === 'sent') return { key: normalized, label: 'Enviado / Sin respuesta', badge: 'badge-info', color: '#3b82f6' };
    return { key: 'not_sent', label: 'Sin enviar', badge: 'badge-warning', color: '#f59e0b' };
}

function getWhatsAppLink(patient, apt) {
    if (!patient || !patient.phone) return '';
    const phone = String(patient.phone).replace(/\D/g, '');
    if (!phone) return '';
    const dateLabel = parseLocalIsoDate(apt.date).toLocaleDateString('es-AR');
    const message = `Hola ${patient.name}, te escribimos de Odentara para confirmar tu turno del ${dateLabel} a las ${apt.time} con ${getProfName(apt.professionalId)}. Por favor responde CONFIRMADO o si necesitas reprogramarlo.`;
    return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

window.markAppointmentAsSent = async function(aptId) {
    const apt = DB.get('appointments').find(item => item.id === aptId);
    if (!apt) return;
    const normalizedStatus = normalizeAppointmentStatus(apt.status);
    if (normalizedStatus === 'not_sent') {
        try {
            if (state.authToken) {
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
                DB.update('appointments', aptId, { status: 'sent' });
            }
        } catch (error) {
            showAlert(error.message || 'No se pudo actualizar el estado del turno.', { title: 'Turnos', variant: 'error' });
            return;
        }
        if (state.currentView === 'dashboard' || state.currentView === 'appointments') refreshCurrentView();
    }
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
                </div>
                <div class="modal-body">
                    <div class="grid grid-cols-2 gap-4 mb-4">
                        <div><strong>Paciente:</strong> ${apt.patient}</div>
                        <div><strong>Tel�fono:</strong> ${patient ? patient.phone : 'N/A'}</div>
                        <div><strong>Profesional:</strong> ${prof ? prof.name : 'N/A'}</div>
                        <div><strong>Especialidad:</strong> OdontologÃ­a</div>
                        <div><strong>Fecha:</strong> ${parseLocalIsoDate(apt.date).toLocaleDateString('es-AR')}</div>
                        <div><strong>Hora:</strong> ${apt.time} (${apt.duration} min)</div>
                        <div><strong>Estado:</strong> <span class="badge ${statusMeta.badge}">${statusMeta.label}</span></div>
                        <div><strong>Motivo:</strong> Consulta odontolÃ³gica</div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-ghost" onclick="closeModal()">Cerrar</button>
                    ${patient && canViewClinicalHistoryUi() ? `<button type="button" class="btn btn-secondary" onclick="closeModal(); loadClinicalHistory(${patient.id})">Historia Clinica</button>` : ''}
                    <button type="button" class="btn btn-secondary" onclick="openAppointmentModal(${aptId})">Editar</button>
                    <button type="button" class="btn btn-primary">Iniciar Cita</button>
                </div>
            </div>
        </div>
    `;
}

function openAppointmentModal(editId = null) {
    const apt = editId ? getAccessibleAppointments().find(a => a.id === editId) : null;
    if (editId && !apt) return;
    const patients = getAccessiblePatients();
    const professionals = getAccessibleProfessionals();
    
    if (patients.length === 0) {
        alert("AtenciÃ³n: Necesitas crear al menos un paciente en el directorio antes de agendar un turno.");
        return;
    }
    
    modalsContainer.innerHTML = `
        <div class="modal-overlay active">
            <div class="modal-content" onclick="event.stopPropagation()">
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
                            <label>Profesional</label>
                            <select id="apt-professional" required>
                                ${professionals.map(p => `<option value="${p.id}" ${apt && apt.professionalId === p.id ? 'selected':''}>${p.name}</option>`).join('')}
                            </select>
                        </div>
                        <div class="flex gap-4">
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
                            <label>DuraciÃ³n</label>
                            <select id="apt-duration">
                                <option value="30" ${apt && apt.duration===30?'selected':''}>30 minutos</option>
                                <option value="60" ${!apt || apt.duration===60?'selected':''}>60 minutos (1 hora)</option>
                                <option value="90" ${apt && apt.duration===90?'selected':''}>90 minutos (1.5 horas)</option>
                                <option value="120" ${apt && apt.duration===120?'selected':''}>120 minutos (2 horas)</option>
                            </select>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-ghost" onclick="closeModal()">Cancelar</button>
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

        if (isPastDate(dateStr)) {
            timeSelect.innerHTML = '<option value="">No se pueden asignar turnos en fechas pasadas</option>';
            timeSelect.disabled = true;
            durSelect.innerHTML = '<option value="">-</option>';
            return;
        }
        
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
        const currentMinutes = getCurrentMinutes();
        const isToday = isTodayDate(dateStr);
        
        let foundSelected = false;
        const minDuration = isOverbook ? 15 : 30; // Assuming minimum valid normal duration is 30 mins
        
        for (let t = startMinBase; t + minDuration <= endMin; t += 15) {
            if (isToday && !isOverbook && t < currentMinutes) {
                continue;
            }

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
    
    document.getElementById('apt-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const selectedDate = document.getElementById('apt-date').value;
        const selectedTime = timeSelect.value;
        const isOverbook = sCheck.checked;
        const selectedMinutes = timeToMinutes(selectedTime);

        if (isPastDate(selectedDate)) {
            alert('No se pueden sacar turnos para dÃ­as anteriores.');
            return;
        }

        if (isTodayDate(selectedDate) && !isOverbook && selectedMinutes !== null && selectedMinutes < getCurrentMinutes()) {
            alert('Ese horario ya pasÃ³. Para horarios pasados del dÃ­a de hoy solo se permiten sobreturnos.');
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
            alert('Selecciona un paciente vÃ¡lido.');
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

            closeModal();
            refreshCurrentView();
        } catch (error) {
            showAlert(error.message || 'No se pudo guardar el turno.', { title: 'Turnos', variant: 'error' });
        }
    });
}

function openScheduleModal(profId) {
    if (!canAccessProfessional(profId)) return;
    const prof = DB.get('professionals').find(x => x.id === profId);
    
    const days = ['Domingo', 'Lunes', 'Martes', 'MiÃ©rcoles', 'Jueves', 'Viernes', 'SÃ¡bado'];
    
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
                </div>
                <form id="schedule-form">
                    <div class="modal-body max-h-[60vh] overflow-y-auto">
                        <p class="text-sm text-gray-600 mb-4">Selecciona quÃ© dÃ­as trabaja el profesional y su horario de entrada/salida.</p>
                        ${daysHtml}
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-ghost" onclick="closeModal()">Cancelar</button>
                        <button type="submit" class="btn btn-primary">Actualizar Agenda</button>
                    </div>
                </form>
            </div>
        </div>
    `;
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
        try {
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

            closeModal();
            refreshCurrentView();
        } catch (error) {
            alert(error.message || 'No se pudieron guardar los horarios.');
        }
    });
}

function openPatientModal(editId = null) {
    const p = editId ? getAccessiblePatients().find(x => x.id === editId) : null;
    if (editId && !p) return;
    modalsContainer.innerHTML = `
        <div class="modal-overlay active">
            <div class="modal-content modal-content-patient" onclick="event.stopPropagation()">
                <div class="modal-header">
                    <h3>${editId ? 'Editar Paciente' : 'Nuevo Paciente'}</h3>
                </div>
                <form id="patient-form">
                    <div class="modal-body">
                        <div class="input-group"><label>Nombre y Apellido *</label><input type="text" id="p-name" value="${p?p.name:''}" required></div>
                        <div class="patient-form-row patient-form-row-2">
                            <div class="input-group flex-1"><label>DNI *</label><input type="text" id="p-dni" value="${p?p.dni||'':''}" required></div>
                            <div class="input-group flex-1"><label>Tel�fono (Celular) *</label><input type="text" id="p-phone" value="${p?p.phone||'':''}" required></div>
                        </div>
                        <div class="patient-form-row patient-form-row-2">
                            <div class="input-group flex-1"><label>Fecha de Nacimiento</label><input type="date" id="p-nacimiento" value="${p?p.fechaNacimiento||'':''}"></div>
                            <div class="input-group flex-1"><label>Email</label><input type="email" id="p-email" value="${p?p.email||'':''}"></div>
                        </div>
                        <div class="input-group"><label>Domicilio</label><input type="text" id="p-domicilio" value="${p?p.domicilio||'':''}"></div>
                        <div class="patient-form-row patient-form-row-3">
                            <div class="input-group flex-1"><label>Obra Social / Plan</label><input type="text" id="p-obrasocial" value="${p?p.obraSocial||'':''}"></div>
                            <div class="input-group flex-1"><label>Credencial</label><input type="text" id="p-credencial" value="${p?p.credencial||'':''}"></div>
                            <div class="input-group flex-1"><label>Ficha N�</label><input type="text" id="p-ficha" value="${p?p.fichaNumero||'':''}"></div>
                        </div>
                        <div class="input-group"><label>Observaciones M�dicas / Alergias</label><input type="text" id="p-notes" value="${p?p.notes||'':''}"></div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-ghost" onclick="closeModal()">Cancelar</button>
                        <button type="submit" class="btn btn-primary">Guardar Paciente</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    document.getElementById('patient-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const rawName = document.getElementById('p-name').value;
        const rawDni = document.getElementById('p-dni').value;
        const normalizedName = normalizePatientName(rawName);
        const normalizedDni = normalizeDni(rawDni);

        if (!normalizedName) {
            alert('Ingresa un nombre vÃ¡lido.');
            return;
        }

        if (!normalizedDni) {
            alert('Ingresa un DNI vÃ¡lido.');
            return;
        }

        const duplicatedByName = DB.get('patients').find(patient =>
            normalizePatientName(patient.name) === normalizedName && patient.id !== editId
        );

        if (duplicatedByName) {
            alert('Ya existe un paciente cargado con ese nombre.');
            return;
        }

        const duplicatedPatient = DB.get('patients').find(patient =>
            normalizeDni(patient.dni) === normalizedDni && patient.id !== editId
        );

        if (duplicatedPatient) {
            alert('Ya existe un paciente cargado con ese DNI.');
            return;
        }

        const data = {
            name: document.getElementById('p-name').value,
            dni: normalizedDni,
            email: document.getElementById('p-email').value,
            phone: document.getElementById('p-phone').value,
            fechaNacimiento: document.getElementById('p-nacimiento').value,
            domicilio: document.getElementById('p-domicilio').value,
            obraSocial: document.getElementById('p-obrasocial').value,
            credencial: document.getElementById('p-credencial').value,
            fichaNumero: document.getElementById('p-ficha').value,
            notes: document.getElementById('p-notes').value,
            lastVisit: p ? p.lastVisit : getTodayIsoLocal(),
            odontograma: p ? p.odontograma : {},
            treatments: p ? p.treatments : [],
            clinicalImages: p ? (p.clinicalImages || []) : []
        };
        try {
            if (state.authToken) {
                const payload = buildPatientApiPayload(data);
                if (editId) {
                    await apiFetch(`/patients/${editId}`, {
                        method: 'PUT',
                        body: JSON.stringify(payload)
                    });
                } else {
                    await apiFetch('/patients', {
                        method: 'POST',
                        body: JSON.stringify(payload)
                    });
                }
                await syncBackendSnapshotToLocalDb();
            } else {
                if (editId) DB.update('patients', editId, data); else DB.add('patients', data);
            }

            closeModal();
            refreshCurrentView();
        } catch (error) {
            alert(error.message || 'No se pudo guardar el paciente.');
        }
    });
}

function openBillingModal() {
    const patients = getAccessiblePatients();
    const professionals = getAccessibleProfessionals();

    if (patients.length === 0) { alert("Debes crear pacientes primero en el directorio."); return; }

    modalsContainer.innerHTML = `
        <div class="modal-overlay active">
            <div class="modal-content" onclick="event.stopPropagation()">
                <div class="modal-header">
                    <h3>Nueva TransacciÃ³n</h3>
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
                            <label>Profesional Asignado a la TransacciÃ³n</label>
                            <select id="tx-prof" required>
                                ${professionals.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
                            </select>
                        </div>
                        <div class="input-group"><label>Tipo de Registro</label><select id="tx-type" required><option value="income">Abono / Pago recibido (Ingreso)</option><option value="debt">Cargo por Tratamiento (Deuda)</option></select></div>
                        <div class="input-group"><label>Monto ($)</label><input type="number" id="tx-amount" min="1" required></div>
                        <div class="input-group"><label>Concepto / DescripciÃ³n</label><input type="text" id="tx-desc" required placeholder="Ej: Tratamiento conducto, Pago parcial..."></div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-ghost" onclick="closeModal()">Cancelar</button>
                        <button type="submit" class="btn btn-primary">Registrar en Cuenta Corriente</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    document.getElementById('tx-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = {
            patientId: parseInt(document.getElementById('tx-patient').value),
            professionalId: parseInt(document.getElementById('tx-prof').value),
            type: document.getElementById('tx-type').value,
            amount: parseFloat(document.getElementById('tx-amount').value),
            description: document.getElementById('tx-desc').value,
            date: getTodayIsoLocal()
        };

        try {
            if (state.authToken) {
                await apiFetch('/billing', {
                    method: 'POST',
                    body: JSON.stringify(data)
                });
                await syncBackendSnapshotToLocalDb();
            } else {
                DB.add('billing', data);
            }

            closeModal();
            refreshCurrentView();
        } catch (error) {
            showAlert(error.message || 'No se pudo registrar el movimiento.', { title: 'Facturación', variant: 'error' });
        }
    });
}

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
                <h3>PrÃ³ximos Turnos</h3>
            </div>
            <div class="overflow-x-auto">
                <table class="w-full text-left">
                    <thead><tr><th>Hora</th><th>Paciente</th><th>Estado</th></tr></thead>
                    <tbody>
                        ${apts.sort((a,b)=>a.time.localeCompare(b.time)).slice(0, 5).map(apt => `
                            <tr class="${apt.isOverbook?'tr-sobreturno':''}">
                                <td><span class="font-semibold">${apt.time}</span> <span class="text-xs text-gray-500">(${apt.duration}m)</span></td>
                                <td>${apt.patient} ${apt.isOverbook ? '<span class="badge badge-purple text-xs ml-2">Sobreturno</span>' : ''}</td>
                                <td><span class="badge ${getAppointmentStatusMeta(apt.status).badge}">${getAppointmentStatusMeta(apt.status).label}</span></td>
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
    currentDate: getTodayIsoLocal(),
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

function getAppointmentVisual(apt) {
    const profColor = getProfColor(apt.professionalId);

    if (apt.isOverbook) {
        return {
            bg: '#fff7ed',
            text: '#9a3412',
            border: '#f97316',
            accent: '#fb923c'
        };
    }

    const statusMeta = getAppointmentStatusMeta(apt.status);
    if (statusMeta.key === 'cancelled') {
        return {
            bg: '#fee2e2',
            text: '#991b1b',
            border: '#ef4444',
            accent: '#f87171'
        };
    }
    if (statusMeta.key === 'sent') {
        return {
            bg: '#dbeafe',
            text: '#1e3a8a',
            border: '#3b82f6',
            accent: '#60a5fa'
        };
    }
    if (statusMeta.key === 'not_sent') {
        return {
            bg: '#fef3c7',
            text: '#92400e',
            border: '#f59e0b',
            accent: '#fbbf24'
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

function renderCalendarFilterLegend(professionals) {
    return `
        <div class="cal-legend ${isCompactAppointmentsLayout() ? 'cal-legend-mobile' : ''}">
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
}

function renderAppointmentCompactCard(apt) {
    const patient = getPatientByAppointment(apt);
    const statusMeta = getAppointmentStatusMeta(apt.status);
    const visual = getAppointmentVisual(apt);
    return `
        <article class="cal-mobile-card ${apt.isOverbook ? 'is-overbook' : ''}" style="border-left-color:${visual.border}">
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
            <div class="cal-mobile-card-name">${apt.patient}</div>
            <div class="cal-mobile-card-prof">${getProfName(apt.professionalId)}</div>
            <div class="cal-mobile-card-actions">
                ${patient && canViewClinicalHistoryUi() ? `<button class="btn btn-ghost btn-sm" onclick="loadClinicalHistory(${patient.id})">Historia</button>` : ''}
                <button class="btn btn-secondary btn-sm" onclick="openAppointmentViewModal(${apt.id})">Ver</button>
                ${state.user.roles.some(r => ['secretary', 'superadmin', 'admin'].includes(r)) ? `<button class="btn btn-primary btn-sm" onclick="openAppointmentModal(${apt.id})">Editar</button>` : ''}
            </div>
        </article>
    `;
}

function renderAppointmentsCompact(professionals, allApts, currentDate, canEdit) {
    const legendHtml = renderCalendarFilterLegend(professionals);
    const toolbar = `
        <div class="cal-toolbar card mb-4 flex justify-between items-center flex-wrap gap-2">
            <div class="flex items-center gap-3">
                <button class="btn btn-ghost btn-sm" id="cal-prev"><i class="fa-solid fa-chevron-left"></i></button>
                <span class="font-semibold text-gray-700 text-sm" id="cal-date-display">${parseLocalIsoDate(currentDate).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
                <button class="btn btn-ghost btn-sm" id="cal-next"><i class="fa-solid fa-chevron-right"></i></button>
                <button class="btn btn-secondary btn-sm" id="cal-today">Hoy</button>
            </div>
            <div class="flex items-center gap-2">
                <button class="btn btn-ghost btn-sm ${calendarState.viewMode === 'day' ? 'active' : ''}" id="cal-view-day">D�a</button>
                <button class="btn btn-ghost btn-sm ${calendarState.viewMode === 'week' ? 'active' : ''}" id="cal-view-week">Semana</button>
                <button class="btn btn-ghost btn-sm ${calendarState.viewMode === 'month' ? 'active' : ''}" id="cal-view-month">Mes</button>
            </div>
            ${canEdit ? '<button class="btn btn-primary btn-sm" id="btn-add-apt"><i class="fa-solid fa-plus"></i> Nuevo Turno</button>' : ''}
        </div>`;

    let sectionsHtml = '';

    if (calendarState.viewMode === 'day') {
        const visibleProfs = professionals.filter(p => calendarState.visibleProfs[p.id]);
        sectionsHtml = visibleProfs.map(prof => {
            const profApts = allApts
                .filter(apt => apt.date === currentDate && apt.professionalId === prof.id)
                .sort((a, b) => a.time.localeCompare(b.time));
            return `
                <section class="cal-mobile-section">
                    <header class="cal-mobile-section-header">${prof.name}</header>
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
            return `
                <section class="cal-mobile-section">
                    <header class="cal-mobile-section-header">${day.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}</header>
                    <div class="cal-mobile-list">
                        ${dayApts.length ? dayApts.map(renderAppointmentCompactCard).join('') : '<div class="cal-mobile-empty">Sin turnos.</div>'}
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
                <section class="cal-mobile-section">
                    <header class="cal-mobile-section-header">${parseLocalIsoDate(dateStr).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}</header>
                    <div class="cal-mobile-list">${items.map(renderAppointmentCompactCard).join('')}</div>
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

// Calendar constants
const CAL_START_HOUR = 8;   // 8:00
const CAL_END_HOUR   = 20;  // 20:00
const CAL_TOTAL_MINS = (CAL_END_HOUR - CAL_START_HOUR) * 60; // 720 min
const CAL_PX_PER_MIN = 2;   // Each minute = 2px â†’ 1 hour = 120px
const CAL_TOTAL_HEIGHT = CAL_TOTAL_MINS * CAL_PX_PER_MIN;    // 1440px

function renderAppointments() {
    const professionals = getAccessibleProfessionals();

    professionals.forEach(p => {
        if (calendarState.visibleProfs[p.id] === undefined) calendarState.visibleProfs[p.id] = true;
    });

    const allApts = getAccessibleAppointments();
    const currentDate = calendarState.currentDate;
    const canEdit = state.user.roles.some(r => ['secretary', 'superadmin', 'admin'].includes(r));

    if (isCompactAppointmentsLayout()) {
        return renderAppointmentsCompact(professionals, allApts, currentDate, canEdit);
    }

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
                const offsetMin = startMin - CAL_START_HOUR * 60;
                const duration = apt.isOverbook ? 15 : apt.duration;
                const topPx = offsetMin * CAL_PX_PER_MIN;
                const heightPx = Math.max(duration * CAL_PX_PER_MIN, 28);
                const visual = getAppointmentVisual(apt);
                const blockClasses = `cal-apt-block ${apt.isOverbook ? 'cal-apt-overbook' : ''}`;
                const blockStyle = apt.isOverbook
                    ? `background:${visual.bg}; color:${visual.text}; border-left:4px solid ${visual.border}; top:${topPx}px; height:${heightPx}px; cursor:pointer;`
                    : `background:${visual.bg}; color:${visual.text}; border-left:4px solid ${visual.border}; top:${topPx}px; height:${heightPx}px; cursor:pointer;`;

                return `<div class="${blockClasses}" 
                    style="${blockStyle}"
                    onclick="openAppointmentViewModal(${apt.id})">
                    <span class="cal-apt-name">${apt.patient}</span>
                    <span class="cal-apt-meta">${apt.time} - ${duration}min</span>
                    ${apt.isOverbook ? '<span class="cal-apt-tag">Sobreturno</span>' : ''}
                    ${canEdit ? `<div class="cal-apt-actions">
                        ${patient && canViewClinicalHistoryUi() ? `<button class="cal-apt-btn btn-view-history-inline" data-id="${patient.id}" title="Historia clinica" onclick="event.stopPropagation(); loadClinicalHistory(${patient.id})"><i class="fa-solid fa-notes-medical"></i></button>` : ''}
                        <button class="cal-apt-btn btn-edit-apt" data-id="${apt.id}" title="Editar"><i class="fa-solid fa-pen"></i></button>
                        <button class="cal-apt-btn btn-delete-apt" data-id="${apt.id}" title="Cancelar"><i class="fa-solid fa-times"></i></button>
                    </div>` : `${patient && canViewClinicalHistoryUi() ? `<div class="cal-apt-actions cal-apt-actions-readonly">
                        <button class="cal-apt-btn btn-view-history-inline" data-id="${patient.id}" title="Historia clinica" onclick="event.stopPropagation(); loadClinicalHistory(${patient.id})"><i class="fa-solid fa-notes-medical"></i></button>
                    </div>` : ''}`}
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
        const legendHtml = renderCalendarFilterLegend(professionals);

        return `
        <div class="cal-wrapper">
            <!-- Toolbar -->
            <div class="cal-toolbar card mb-4 flex justify-between items-center flex-wrap gap-2">
                <div class="flex items-center gap-3">
                    <button class="btn btn-ghost btn-sm" id="cal-prev"><i class="fa-solid fa-chevron-left"></i></button>
                    <span class="font-semibold text-gray-700 text-sm" id="cal-date-display">${parseLocalIsoDate(currentDate).toLocaleDateString('es-AR', {weekday:'long', day:'numeric', month:'long', year:'numeric'})}</span>
                    <button class="btn btn-ghost btn-sm" id="cal-next"><i class="fa-solid fa-chevron-right"></i></button>
                    <button class="btn btn-secondary btn-sm" id="cal-today">Hoy</button>
                </div>
                <div class="flex items-center gap-2">
                    <button class="btn btn-ghost btn-sm ${calendarState.viewMode === 'day' ? 'active' : ''}" id="cal-view-day">D�a</button>
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
        const startOfWeek = parseLocalIsoDate(currentDate);
        startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay()); // Sunday
        const days = [];
        for (let i = 0; i < 7; i++) {
            const d = new Date(startOfWeek);
            d.setDate(startOfWeek.getDate() + i);
            days.push(d);
        }

        let dayCols = '';
        days.forEach(d => {
            const iso = formatDateToLocalIso(d);
            const isToday = iso === getTodayIsoLocal();
            const dayName = ['Dom', 'Lun', 'Mar', 'MiÃ©', 'Jue', 'Vie', 'SÃ¡b'][d.getDay()];
            const dayNum = d.getDate();

            const dayApts = allApts.filter(a => a.date === iso && calendarState.visibleProfs[a.professionalId]);

            const aptList = dayApts.map(apt => {
                const profName = getProfName(apt.professionalId);
                const statusColor = getAppointmentStatusMeta(apt.status).color;

                return `<div class="cal-week-apt" style="background:${statusColor};" onclick="openAppointmentViewModal(${apt.id})">
                    <div class="cal-week-apt-name">${apt.patient}</div>
                    <div class="cal-week-apt-meta">${profName} Â· ${apt.time}</div>
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

        const legendHtml = renderCalendarFilterLegend(professionals);

        return `
        <div class="cal-wrapper">
            <div class="cal-toolbar card mb-4 flex justify-between items-center flex-wrap gap-2">
                <div class="flex items-center gap-3">
                    <button class="btn btn-ghost btn-sm" id="cal-prev"><i class="fa-solid fa-chevron-left"></i></button>
                    <span class="font-semibold text-gray-700 text-sm">
                        ${days[0].toLocaleDateString('es-AR',{day:'numeric',month:'short'})} â€“ ${days[6].toLocaleDateString('es-AR',{day:'numeric',month:'short',year:'numeric'})}
                    </span>
                    <button class="btn btn-ghost btn-sm" id="cal-next"><i class="fa-solid fa-chevron-right"></i></button>
                    <button class="btn btn-secondary btn-sm" id="cal-today">Hoy</button>
                </div>
                <div class="flex items-center gap-2">
                    <button class="btn btn-ghost btn-sm ${calendarState.viewMode === 'day' ? 'active' : ''}" id="cal-view-day">D�a</button>
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
        const date = parseLocalIsoDate(currentDate);
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
            let content = '<div class="cal-month-empty-slot"></div>';

            if (dayNum > 0 && dayNum <= daysInMonth) {
                isCurrentMonth = true;
                cellDate = new Date(year, month, dayNum);
                const iso = formatDateToLocalIso(cellDate);
                const isToday = iso === getTodayIsoLocal();
                let dayApts = allApts.filter(a => a.date === iso && calendarState.visibleProfs[a.professionalId]);
                dayApts = dayApts.sort((a,b)=>a.time.localeCompare(b.time));

                const aptList = dayApts.map(apt => {
                    const profName = getProfName(apt.professionalId);
                    const visual = getAppointmentVisual(apt);
                    return `<button type="button" class="cal-month-apt ${apt.isOverbook ? 'is-overbook' : ''}" style="border-left-color:${visual.border}; background:${visual.bg}; color:${visual.text};" onclick="openAppointmentViewModal(${apt.id})">
                        <span class="cal-month-apt-time">${apt.time}</span>
                        <span class="cal-month-apt-name">${apt.patient}</span>
                        <span class="cal-month-apt-prof">${profName}</span>
                    </button>`;
                }).join('');

                content = `
                    <div class="cal-month-dayhead ${isToday ? 'is-today' : ''}">
                        <span class="cal-month-daynum">${dayNum}</span>
                    </div>
                    <div class="cal-month-daybody">
                        ${aptList || '<div class="cal-month-dayempty">Sin turnos</div>'}
                    </div>
                `;
            }

            cells += `<div class="cal-month-cell ${isCurrentMonth ? '' : 'is-outside-month'}">${content}</div>`;
        }

        const monthName = date.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });

        const legend = renderCalendarFilterLegend(professionals);

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
                    <button class="btn btn-ghost btn-sm ${calendarState.viewMode === 'day' ? 'active' : ''}" id="cal-view-day">D�a</button>
                    <button class="btn btn-ghost btn-sm ${calendarState.viewMode === 'week' ? 'active' : ''}" id="cal-view-week">Semana</button>
                    <button class="btn btn-ghost btn-sm ${calendarState.viewMode === 'month' ? 'active' : ''}" id="cal-view-month">Mes</button>
                </div>
                ${canEdit ? '<button class="btn btn-primary btn-sm" id="btn-add-apt"><i class="fa-solid fa-plus"></i> Nuevo Turno</button>' : ''}
            </div>

            <div class="cal-layout">
                <div class="cal-scroll-wrap">
                    <div class="cal-month-board">
                        <div class="cal-month-weekdays">
                            <div class="cal-month-weekday">Dom</div>
                            <div class="cal-month-weekday">Lun</div>
                            <div class="cal-month-weekday">Mar</div>
                            <div class="cal-month-weekday">MiÃ©</div>
                            <div class="cal-month-weekday">Jue</div>
                            <div class="cal-month-weekday">Vie</div>
                            <div class="cal-month-weekday">SÃ¡b</div>
                        </div>
                        <div class="cal-month-grid">
                        ${cells}
                        </div>
                    </div>
                </div>
                ${legend}
            </div>
        </div>`;
    }
}

function renderProfessionals() {
    const profs = getAccessibleProfessionals();
    return `
        <div class="card mb-6 flex justify-between items-center">
            <h3 class="font-semibold px-2">ConfiguraciÃ³n de Horarios de AtenciÃ³n</h3>
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
                                ${state.user.roles.some(r => ['superadmin', 'admin', 'secretary'].includes(r)) ? `
                                <button class="btn btn-secondary btn-sm btn-edit-schedule" data-id="${p.id}"><i class="fa-solid fa-clock mr-1"></i> Configurar Horarios por DÃ­a</button>
                                ` : ''}
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
        <div class="mt-4 text-sm text-gray-500 ml-2"><i class="fa-solid fa-info-circle mr-1 text-primary-500"></i> Los turnos solo se podrÃ¡n asignar segÃºn el horario activo configurado para cada dÃ­a de la semana.</div>
    `;
}

function renderPatients() {
    const patients = getAccessiblePatients().sort((a,b)=>a.name.localeCompare(b.name));
    return `
        <div class="card mb-6 flex justify-between items-center">
            <h3 class="font-semibold px-2">Directorio MÃ©dico</h3>
            ${state.user.roles.some(r => ['superadmin', 'secretary', 'admin'].includes(r)) ? 
            '<button class="btn btn-primary" id="btn-add-patient"><i class="fa-solid fa-user-plus"></i> Nuevo Paciente</button>' : ''}
        </div>
        <input type="search" id="search-patient" placeholder="Buscar pacientes por nombre o DNI..." class="form-input mb-4 w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 text-sm">
        <div class="table-container shadow-sm">
            <table class="w-full text-left" id="patients-table">
                <thead><tr><th>Paciente</th><th>Contacto</th><th>DNI</th><th>Notas MÃ©dicas</th><th>Acciones</th></tr></thead>
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
                                    ${canViewClinicalHistoryUi() ? `<button class="btn btn-ghost p-1 btn-view-history" data-id="${p.id}" title="Historia ClÃ­nica"><i class="fa-solid fa-file-medical text-purple-600"></i></button>` : ''}
                                    <button class="btn btn-ghost p-1 btn-edit-patient" data-id="${p.id}"><i class="fa-solid fa-pen text-primary-600"></i></button>
                                    ${isSuperadmin() ? `<button class="btn btn-ghost p-1 btn-delete-patient" data-id="${p.id}"><i class="fa-solid fa-trash text-danger"></i></button>` : ''}
                                ` : `${canViewClinicalHistoryUi() ? '<button class="btn btn-secondary btn-sm btn-view-history" data-id="'+p.id+'"><i class="fa-solid fa-eye"></i> Historia</button>' : ''}`}
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
    const txs = DB.get('billing').filter(t => canAccessProfessional(t.professionalId));
    const patients = getAccessiblePatients();
    
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
                                      : `<span class="badge badge-success text-xs">Al d�a ${pb.balance < 0 ? `(A favor: $${Math.abs(pb.balance).toLocaleString()})` : ''}</span>`}
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
                <thead><tr><th>Fecha</th><th>Paciente</th><th>Tipo</th><th>Concepto</th><th>Monto</th><th>AcciÃ³n</th></tr></thead>
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

function renderDashboardContent(apts, patients, todaysApts, selectedDate, selectedDateApts) {
    const now = new Date();
    const todaysOpenApts = todaysApts.filter(apt => {
        if (normalizeAppointmentStatus(apt.status) === 'cancelled') return false;
        const [hours, minutes] = apt.time.split(':').map(Number);
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0, 0);
        const duration = apt.isOverbook ? 15 : (apt.duration || 0);
        const end = new Date(start.getTime() + duration * 60000);
        return end > now;
    });
    const patientsTodayCount = new Set(todaysOpenApts.map(apt => apt.patient)).size;
    const activeTurnsCount = todaysOpenApts.length;
    const activeOverbooksCount = todaysOpenApts.filter(apt => apt.isOverbook).length;
    const selectedLabel = formatDashboardDateLabel(selectedDate);
    const selectedTitle = selectedDate === getTodayIsoLocal() ? 'Turnos de Hoy' : 'Turnos Programados';

    return `
        <div class="metrics-grid">
            <div class="card metric-card">
                <div class="metric-icon metric-blue"><i class="fa-solid fa-users"></i></div>
                <div class="metric-info"><h3>Pacientes de Hoy</h3><p>${patientsTodayCount}</p></div>
            </div>
            <div class="card metric-card">
                <div class="metric-icon metric-green"><i class="fa-solid fa-calendar-check"></i></div>
                <div class="metric-info"><h3>Turnos Activos</h3><p>${activeTurnsCount}</p></div>
            </div>
            <div class="card metric-card">
                <div class="metric-icon metric-purple"><i class="fa-solid fa-bolt" style="color:var(--purple)"></i></div>
                <div class="metric-info"><h3>Sobreturnos</h3><p>${activeOverbooksCount}</p></div>
            </div>
        </div>

        <div class="table-container shadow-sm mt-6 border border-gray-200">
            <div class="table-header">
                <div>
                    <h3>${selectedTitle}</h3>
                    <p class="dashboard-date-label">${selectedLabel}</p>
                </div>
                <div class="dashboard-date-filter-wrap">
                    <label for="dashboard-date-filter" class="dashboard-date-filter-label">Fecha</label>
                    <input type="date" id="dashboard-date-filter" class="dashboard-date-filter" value="${selectedDate}">
                </div>
            </div>
            <div class="overflow-x-auto">
                <table class="w-full text-left">
                    <thead><tr><th>Hora</th><th>Paciente</th><th>Profesional</th><th>Confirmacion</th><th>Whatsapp</th></tr></thead>
                    <tbody>
                        ${selectedDateApts.map(apt => {
                            const patient = getPatientByAppointment(apt);
                            const whatsappLink = getWhatsAppLink(patient, apt);
                            const statusMeta = getAppointmentStatusMeta(apt.status);
                            return `
                                <tr class="${apt.isOverbook ? 'tr-sobreturno' : ''}">
                                    <td><span class="font-semibold">${apt.time}</span> <span class="text-xs text-gray-500">(${apt.duration}m)</span></td>
                                    <td>${apt.patient} ${apt.isOverbook ? '<span class="badge badge-purple text-xs ml-2">Sobreturno</span>' : ''}</td>
                                    <td>${getProfName(apt.professionalId)}</td>
                                    <td><span class="badge ${statusMeta.badge}">${statusMeta.label}</span></td>
                                    <td>${whatsappLink ? `<a class="btn btn-secondary btn-sm dashboard-wa-btn" href="${whatsappLink}" target="_blank" rel="noopener noreferrer" onclick="markAppointmentAsSent(${apt.id})"><i class="fa-brands fa-whatsapp"></i> Enviar</a>` : '<span class="text-xs text-gray-400">Sin telefono</span>'}</td>
                                </tr>
                            `;
                        }).join('')}
                        ${selectedDateApts.length === 0 ? '<tr><td colspan="5" class="text-center py-6 text-gray-500">No hay turnos para la fecha seleccionada.</td></tr>' : ''}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

function renderSettingsSubpages() {
    const users = DB.get('users');
    const profs = DB.get('professionals');
    const isSuper = state.user.roles.includes('superadmin');
    const canManageSettings = state.user.roles.some(role => ['superadmin', 'admin'].includes(role));

    if (!canManageSettings) {
        return `
            <div class="settings-card">
                <h3>Acceso denegado</h3>
                <p>Solo los usuarios con rol superadmin o admin pueden gestionar la configuraciÃƒÂ³n.</p>
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
                <td class="text-center"><button class="btn btn-ghost btn-sm" onclick="deleteUser(${u.id})"><i class="fa-solid fa-trash text-danger"></i></button></td>
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

    const settingsSections = [
        { id: 'create-user', label: 'Crear usuario', icon: 'fa-user-plus', description: 'Alta de nuevos usuarios y permisos.' },
        { id: 'create-professional', label: 'Crear profesional', icon: 'fa-user-doctor', description: 'Registro de profesionales y datos base.' },
        { id: 'users-list', label: 'Usuarios existentes', icon: 'fa-users-gear', description: 'Listado de usuarios y accesos asignados.' },
        { id: 'professionals-list', label: 'Profesionales existentes', icon: 'fa-address-card', description: 'Vista de profesionales y acceso al calendario.' }
    ];

    const activeSection = settingsSections.some(section => section.id === state.settingsSubView)
        ? state.settingsSubView
        : 'create-user';
    state.settingsSubView = activeSection;

    const settingsContent = {
        'create-user': `
            <section class="settings-card settings-panel-card">
                <header>
                    <div>
                        <h3>Crear Nuevo Usuario</h3>
                        <p class="subtext">Campos obligatorios: Nombre completo, Email, Contraseña y Tipo de usuario.</p>
                    </div>
                </header>
                <form id="new-user-form" class="settings-form-row columns-1">
                    <div class="input-group"><label>Nombre completo *</label><input type="text" id="u-name" required></div>
                    <div class="input-group"><label>Email *</label><input type="email" id="u-email" required></div>
                    <div class="input-group"><label>Contraseña *</label><input type="password" id="u-password" minlength="6" required></div>
                    <div class="input-group"><label>Tipo de usuario *</label><select id="u-type" required><option value="">Seleccionar...</option><option value="administrador">Administrador</option><option value="secretario">Secretario</option><option value="profesional">Profesional</option></select></div>

                    <div class="settings-subsection">
                        <h4>Roles de Permisos</h4>
                        <p class="subtext">Selecciona uno o varios roles.</p>
                        <div class="settings-list settings-list-static">
                            <div class="checkbox-group"><input type="checkbox" name="u-role" value="administrador"><label>Administrador</label></div>
                            <div class="checkbox-group"><input type="checkbox" name="u-role" value="secretario"><label>Secretario</label></div>
                            <div class="checkbox-group"><input type="checkbox" name="u-role" value="profesional"><label>Profesional</label></div>
                            ${isSuper ? '<div class="checkbox-group"><input type="checkbox" name="u-role" value="superadmin"><label>Superadmin</label></div>' : ''}
                        </div>
                    </div>

                    <div class="settings-subsection">
                        <h4>Asignar Profesionales (opcional)</h4>
                        <p class="subtext">Se puede dejar vacÃƒÂ­o; acceso completo si no se selecciona ninguno.</p>
                        <div class="settings-list">
                            ${profs.map(p => `<div class="checkbox-group"><input type="checkbox" name="u-profs" value="${p.id}"><label>${p.name}</label></div>`).join('')}
                        </div>
                    </div>
                    <button type="submit" class="btn btn-primary">Guardar Usuario</button>
                </form>
            </section>
        `,
        'create-professional': `
            <section class="settings-card settings-panel-card">
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
                    <div class="input-group"><label>TelÃƒÂ©fono</label><input type="text" id="p-phone"></div>
                    <div class="input-group"><label>Email</label><input type="email" id="p-email"></div>
                    <div class="input-group"><label>Estado</label><select id="p-status"><option value="activo">Activo</option><option value="inactivo">Inactivo</option></select></div>
                    <button type="submit" class="btn btn-primary">Guardar Profesional</button>
                </form>
            </section>
        `,
        'users-list': `
            <section class="settings-card settings-panel-card">
                <header><h3>Usuarios Existentes</h3></header>
                <div class="table-container overflow-x-auto">
                    <table class="table-modern table-compact">
                        <thead>
                            <tr>
                                <th>Nombre / Email</th>
                                <th>Tipo</th>
                                <th>Roles</th>
                                <th>Profesionales</th>
                                <th>AcciÃƒÂ³n</th>
                            </tr>
                        </thead>
                        <tbody>${userRows || `<tr><td colspan="5" class="text-gray-500">No hay usuarios registrados</td></tr>`}</tbody>
                    </table>
                </div>
            </section>
        `,
        'professionals-list': `
            <section class="settings-card settings-panel-card">
                <header><h3>Profesionales Existentes</h3></header>
                <div class="table-container overflow-x-auto">
                    <table class="table-modern table-compact">
                        <thead>
                            <tr>
                                <th>Nombre</th>
                                <th>Apellido</th>
                                <th>Especialidad</th>
                                <th>TelÃƒÂ©fono</th>
                                <th>Email</th>
                                <th>Estado</th>
                                <th>AcciÃƒÂ³n</th>
                            </tr>
                        </thead>
                        <tbody>${profesionalRows || `<tr><td colspan="7" class="text-gray-500">No hay profesionales registrados</td></tr>`}</tbody>
                    </table>
                </div>
            </section>
        `
    };

    return `
    <div class="settings-area">
        <section class="settings-card settings-nav-card">
            <div class="settings-nav-header">
                <div>
                    <h3>Subpaginas de Configuracion</h3>
                    <p class="subtext">Elegi una seccion para trabajar dentro de Configuracion.</p>
                </div>
            </div>

            <div class="settings-subnav">
                ${settingsSections.map(section => `
                    <button type="button" class="settings-subnav-item ${section.id === activeSection ? 'active' : ''}" data-settings-view="${section.id}">
                        <i class="fa-solid ${section.icon}"></i>
                        <span>${section.label}</span>
                        <small>${section.description}</small>
                    </button>
                `).join('')}
            </div>
        </section>

        <div class="settings-subpage-content">
            ${settingsContent[activeSection]}
        </div>
    </div>
    `;
}

function renderSettings() {
    const users = DB.get('users');
    const profs = DB.get('professionals');
    const isSuper = state.user.roles.includes('superadmin');
    const canManageSettings = state.user.roles.some(role => ['superadmin', 'admin'].includes(role));

    if (!canManageSettings) {
        return `
            <div class="settings-card">
                <h3>Acceso denegado</h3>
                <p>Solo los usuarios con rol superadmin o admin pueden gestionar la configuraciÃ³n.</p>
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
                <td class="text-center"><button class="btn btn-ghost btn-sm" onclick="deleteUser(${u.id})"><i class="fa-solid fa-trash text-danger"></i></button></td>
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
                        <p class="subtext">Campos obligatorios: Nombre completo, Email, Contraseña y Tipo de usuario.</p>
                    </div>
                </header>
                <form id="new-user-form" class="settings-form-row columns-1">
                    <div class="input-group"><label>Nombre completo *</label><input type="text" id="u-name" required></div>
                    <div class="input-group"><label>Email *</label><input type="email" id="u-email" required></div>
                    <div class="input-group"><label>Contraseña *</label><input type="password" id="u-password" minlength="6" required></div>
                    <div class="input-group"><label>Tipo de usuario *</label><select id="u-type" required><option value="">Seleccionar...</option><option value="administrador">Administrador</option><option value="secretario">Secretario</option><option value="profesional">Profesional</option></select></div>

                    <div class="settings-subsection">
                        <h4>Roles de Permisos</h4>
                        <p class="subtext">Selecciona uno o varios roles.</p>
                        <div class="checkbox-group"><input type="checkbox" name="u-role" value="administrador"><label>Administrador</label></div>
                        <div class="checkbox-group"><input type="checkbox" name="u-role" value="secretario"><label>Secretario</label></div>
                        <div class="checkbox-group"><input type="checkbox" name="u-role" value="profesional"><label>Profesional</label></div>
                        ${isSuper ? '<div class="checkbox-group"><input type="checkbox" name="u-role" value="superadmin"><label>Superadmin</label></div>' : ''}
                    </div>

                    <div class="settings-subsection">
                        <h4>Asignar Profesionales (opcional)</h4>
                        <p class="subtext">Se puede dejar vacÃ­o; acceso completo si no se selecciona ninguno.</p>
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
                    <div class="input-group"><label>TelÃ©fono</label><input type="text" id="p-phone"></div>
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
                                <th>AcciÃ³n</th>
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
                                <th>TelÃ©fono</th>
                                <th>Email</th>
                                <th>Estado</th>
                                <th>AcciÃ³n</th>
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

// --- Ficha ClÃ­nica y Odontograma ---

async function loadClinicalHistory(patientId) {
    if (!canAccessPatient(patientId)) return;
    if (!canViewClinicalHistoryUi()) {
        showAlert('El secretario no puede acceder a la historia clínica.', { title: 'Historia clínica', variant: 'error' });
        return;
    }
    state.currentView = 'patient-history';
    state.currentPatientId = patientId;
    pageTitle.innerText = 'Ficha OdontolÃ³gica';
    mainContent.innerHTML = '<div class="card p-6 text-center text-gray-500">Cargando historia clínica...</div>';
    
    try {
        await syncPatientClinicalData(patientId);
    } catch (error) {
        showAlert(error.message || 'No se pudo cargar la historia clínica.', { title: 'Historia clínica', variant: 'error' });
    }

    mainContent.innerHTML = '';

    const content = document.createElement('div');
    content.className = 'animate-fade-in';
    content.innerHTML = renderClinicalHistory(patientId);
    mainContent.appendChild(content);
    enhanceClinicalPatientEditor(patientId);

    attachClinicalHistoryEvents(patientId);
}

function enhanceClinicalPatientEditor(patientId) {
    const patient = DB.get('patients').find(p => p.id === patientId);
    if (!patient) return;
    const canEditClinical = canEditClinicalHistoryUi();

    let age = '-';
    if (patient.fechaNacimiento) {
        const diff = Date.now() - new Date(patient.fechaNacimiento).getTime();
        age = Math.abs(new Date(diff).getUTCFullYear() - 1970);
    }

    const container = document.querySelector('.clinical-info-grid');
    if (!container) return;

    container.innerHTML = `
        <div class="clinical-edit-grid">
            <div class="clinical-info-item">
                <strong class="text-gray-600 uppercase text-xs">Nombre</strong>
                <input class="form-input clinical-readonly" type="text" value="${patient.name || ''}" disabled>
            </div>
            <div class="clinical-info-item">
                <strong class="text-gray-600 uppercase text-xs">DNI</strong>
                <input class="form-input clinical-readonly" type="text" value="${patient.dni || ''}" disabled>
            </div>
            <div class="clinical-info-item">
                <strong class="text-gray-600 uppercase text-xs">Nacimiento</strong>
                <input class="form-input" type="date" id="clinical-fecha-nacimiento" value="${patient.fechaNacimiento || ''}" ${canEditClinical ? '' : 'disabled'}>
            </div>
            <div class="clinical-info-item">
                <strong class="text-gray-600 uppercase text-xs">Edad</strong>
                <div class="clinical-static-value">${age} aÃ±os</div>
            </div>
            <div class="clinical-info-item">
                <strong class="text-gray-600 uppercase text-xs">Telefono</strong>
                <input class="form-input" type="text" id="clinical-phone" value="${patient.phone || ''}" ${canEditClinical ? '' : 'disabled'}>
            </div>
            <div class="clinical-info-item">
                <strong class="text-gray-600 uppercase text-xs">Email</strong>
                <input class="form-input" type="email" id="clinical-email" value="${patient.email || ''}" ${canEditClinical ? '' : 'disabled'}>
            </div>
            <div class="clinical-info-item">
                <strong class="text-gray-600 uppercase text-xs">Obra Social / Plan</strong>
                <input class="form-input" type="text" id="clinical-obra-social" value="${patient.obraSocial || ''}" ${canEditClinical ? '' : 'disabled'}>
            </div>
            <div class="clinical-info-item">
                <strong class="text-gray-600 uppercase text-xs">Credencial</strong>
                <input class="form-input" type="text" id="clinical-credencial" value="${patient.credencial || ''}" ${canEditClinical ? '' : 'disabled'}>
            </div>
            <div class="clinical-info-item">
                <strong class="text-gray-600 uppercase text-xs">Ficha NÂ°</strong>
                <input class="form-input" type="text" id="clinical-ficha-numero" value="${patient.fichaNumero || ''}" ${canEditClinical ? '' : 'disabled'}>
            </div>
            <div class="clinical-info-item col-span-full">
                <strong class="text-gray-600 uppercase text-xs">Domicilio</strong>
                <input class="form-input" type="text" id="clinical-domicilio" value="${patient.domicilio || ''}" ${canEditClinical ? '' : 'disabled'}>
            </div>
        </div>
        ${canEditClinical ? `
        <div class="clinical-edit-actions">
            <button class="btn btn-secondary btn-sm" onclick="savePatientDetails(${patientId})">Guardar Datos del Paciente</button>
        </div>` : ''}
    `;
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
    const clinicalImages = (patient.clinicalImages || []).slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    const canEditClinical = canEditClinicalHistoryUi();

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
                    <h2 class="text-xl md:text-2xl font-black text-gray-900 tracking-tight uppercase">Circulo OdontolÃ³gico</h2>
                    <p class="text-sm font-semibold text-primary-700">Ficha ClÃ­nica OdontolÃ³gica</p>
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
                    <div><strong class="text-gray-600 uppercase text-xs">Ficha NÂ°</strong><div class="text-base font-semibold text-primary-700">${patient.fichaNumero || '-'}</div></div>
                </div>
                <div class="clinical-info-item"><strong class="text-gray-600 uppercase text-xs">Nacimiento</strong><div>${patient.fechaNacimiento ? patient.fechaNacimiento.split('-').reverse().join('/') : '-'}</div></div>
                <div class="clinical-info-item"><strong class="text-gray-600 uppercase text-xs">Edad</strong><div>${age} aÃ±os</div></div>
                <div class="clinical-info-item"><strong class="text-gray-600 uppercase text-xs">TelÃ©fono</strong><div>${patient.phone || '-'}</div></div>
                <div class="clinical-info-item col-span-full"><strong class="text-gray-600 uppercase text-xs">Domicilio</strong><div>${patient.domicilio || '-'}</div></div>
            </div>

            <!-- ODONTOGRAMA -->
            <div class="mb-10">
                <div class="odontogram-header mb-4">
                    <h3 class="font-black text-gray-800 uppercase tracking-widest text-sm bg-gray-100 py-1 px-3 rounded inline-block border-l-4 border-primary-600">Odontograma Inicial</h3>
                    <div class="odontogram-legend text-xs">
                        <span class="badge-state badge-sano">Sano</span>
                        <span class="badge-state badge-caries">Caries</span>
                        <span class="badge-state badge-restauracion">RestauraciÃ³n</span>
                        <span class="badge-state badge-ausente">Ausente</span>
                    </div>
                </div>
                
                <p class="text-xs text-gray-500 mb-2 text-center w-full">Haz clic en cada cara para ciclar estado (Sano â†’ Caries â†’ Restaurado). Doble clic en el NÃšMERO para marcar ausente.</p>
                <div class="odontogram-wrapper overflow-x-auto pb-4">
                    <div class="flex flex-col items-center gap-4"> <!-- Ajuste: mÃ¡s compacto -->
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
                    <div class="treatments-header bg-gray-100 py-1 px-3 rounded border-l-4 border-primary-600 mb-4">
                        <h3 class="font-black text-gray-800 uppercase tracking-widest text-sm">Registro de Tratamientos</h3>
                    ${canEditClinical ? '<button class="btn btn-primary btn-sm whitespace-nowrap" id="btn-add-treatment"><i class="fa-solid fa-plus"></i> AÃ±adir Fila</button>' : ''}
                </div>
                <div class="table-container shadow-sm border border-gray-300 overflow-visible">
                    <table class="w-full text-left text-xs md:text-sm" id="treatments-table">
                        <thead class="bg-gray-50 border-b border-gray-300"><tr>
                            <th class="py-2 px-3">Diente</th><th class="py-2 px-3">Cara</th><th class="py-2 px-3">Sector</th>
                            <th class="py-2 px-3">AutorizaciÃ³n</th><th class="py-2 px-3">CÃ³digo</th><th class="py-2 px-3">Fecha / Firma</th><th class="py-2 px-3">Observaciones</th><th class="py-2 px-3"></th>
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
                                    ${canEditClinical ? `
                                        <button class="btn-ghost text-red-400 hover:text-red-600 p-1" onclick="deleteTreatment(${patientId}, ${t.id ?? idx})"><i class="fa-solid fa-times"></i></button>
                                    ` : ''}
                                    </td>
                                </tr>
                            `).join('')}
                            ${!(patient.treatments||[]).length ? '<tr><td colspan="8" class="text-center py-4 text-gray-400 italic">No hay tratamientos registrados en la ficha.</td></tr>' : ''}
                        </tbody>
                    </table>
                </div>
            </div>

            <div class="mb-4">
                <div class="treatments-header bg-gray-100 py-1 px-3 rounded border-l-4 border-primary-600 mb-4">
                    <h3 class="font-black text-gray-800 uppercase tracking-widest text-sm">Imagenes Clinicas</h3>
                    ${canEditClinical ? '<button class="btn btn-primary btn-sm whitespace-nowrap" id="btn-add-clinical-image"><i class="fa-solid fa-image"></i> Agregar Imagen</button>' : ''}
                </div>
                <div class="clinical-images-shell">
                    <div class="clinical-images-grid">
                    ${clinicalImages.map((image, idx) => `
                        <article class="clinical-image-card">
                            <img src="${image.dataUrl}" alt="${image.description || 'Imagen clinica'}" class="clinical-image-preview">
                            <div class="clinical-image-body">
                                <div class="clinical-image-date">${image.date ? image.date.split('-').reverse().join('/') : 'Sin fecha'}</div>
                                <p class="clinical-image-description">${image.description || 'Sin descripcion'}</p>
                                ${canEditClinical ? `<button class="btn btn-ghost btn-sm clinical-image-delete" onclick="deleteClinicalImage(${patientId}, ${image.id ?? idx})"><i class="fa-solid fa-trash"></i> Eliminar</button>` : ''}
                            </div>
                        </article>
                    `).join('')}
                    ${clinicalImages.length === 0 ? '<div class="clinical-image-empty">Todavia no hay imagenes cargadas en la historia clinica.</div>' : ''}
                    </div>
                </div>
            </div>

            <!-- NOTAS -->
            <div class="mt-8 bg-yellow-50 p-4 border border-yellow-200 rounded-lg">
                <h3 class="font-bold text-yellow-800 mb-2 uppercase text-xs"><i class="fa-solid fa-notes-medical"></i> Observaciones Generales y Alergias</h3>
                <textarea id="p-general-notes" class="form-input w-full h-20 p-2 text-sm bg-transparent border-yellow-300 focus:border-yellow-500 focus:ring-yellow-500 rounded" ${canEditClinical ? '' : 'disabled'}>${patient.notes || ''}</textarea>
                ${canEditClinical ? '<div class="text-right mt-2"><button class="btn btn-secondary btn-sm bg-yellow-100 text-yellow-800 border-yellow-300 hover:bg-yellow-200" onclick="savePatientNotes(' + patientId + ')">Guardar Notas</button></div>' : ''}
            </div>
        </div>
    </div>
    `;
}

function attachClinicalHistoryEvents(patientId) {
    if(!canEditClinicalHistoryUi()) return; // Read Only for clinical charting

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

    document.getElementById('btn-add-clinical-image')?.addEventListener('click', () => {
        openClinicalImageModal(patientId);
    });
}

window.toggleAbsent = function(patientId, toothId) {
    if(!canEditClinicalHistoryUi()) return;
    const p = DB.get('patients').find(pt => pt.id === patientId);
    if(!p.odontograma) p.odontograma = {};
    if(!p.odontograma[toothId]) p.odontograma[toothId] = {};
    
    p.odontograma[toothId].estado = p.odontograma[toothId].estado === 'ausente' ? 'sano' : 'ausente';
    DB.update('patients', patientId, { odontograma: p.odontograma });
    loadClinicalHistory(patientId);
};

window.savePatientNotes = async function(patientId) {
    if (!canEditClinicalHistoryUi()) {
        showAlert('Solo el profesional puede modificar la historia clínica.', { title: 'Historia clínica', variant: 'error' });
        return;
    }
    const notes = document.getElementById('p-general-notes').value;
    const patient = DB.get('patients').find((item) => item.id === patientId);
    if (!patient) return;

    try {
        if (state.authToken) {
            await apiFetch(`/patients/${patientId}`, {
                method: 'PUT',
                body: JSON.stringify(buildPatientApiPayload({
                    ...patient,
                    notes
                }))
            });
            await syncPatientClinicalData(patientId);
        } else {
            DB.update('patients', patientId, { notes });
        }

        showToast('Notas guardadas.', { type: 'success' });
        loadClinicalHistory(patientId);
    } catch (error) {
        showAlert(error.message || 'No se pudieron guardar las notas.', { title: 'Historia clínica', variant: 'error' });
    }
};

window.savePatientDetails = async function(patientId) {
    if (!canEditClinicalHistoryUi()) {
        showAlert('Solo el profesional puede modificar la historia clínica.', { title: 'Historia clínica', variant: 'error' });
        return;
    }
    const patient = DB.get('patients').find(p => p.id === patientId);
    if (!patient) return;

    const updatedValues = {
        ...patient,
        fechaNacimiento: document.getElementById('clinical-fecha-nacimiento')?.value || '',
        phone: document.getElementById('clinical-phone')?.value || '',
        email: document.getElementById('clinical-email')?.value || '',
        obraSocial: document.getElementById('clinical-obra-social')?.value || '',
        credencial: document.getElementById('clinical-credencial')?.value || '',
        fichaNumero: document.getElementById('clinical-ficha-numero')?.value || '',
        domicilio: document.getElementById('clinical-domicilio')?.value || ''
    };

    try {
        if (state.authToken) {
            await apiFetch(`/patients/${patientId}`, {
                method: 'PUT',
                body: JSON.stringify(buildPatientApiPayload(updatedValues))
            });
            await syncBackendSnapshotToLocalDb();
        } else {
            DB.update('patients', patientId, updatedValues);
        }

        loadClinicalHistory(patientId);
    } catch (error) {
        alert(error.message || 'No se pudieron guardar los datos del paciente.');
    }
};

window.deleteUser = async function(userId) {
    if (!await showConfirm('¿Eliminar usuario?', { title: 'Eliminar usuario', confirmText: 'Eliminar' })) return;

    try {
        await deleteViaApiOrLocal({
            path: `/users/${userId}`,
            localTable: 'users',
            localId: userId
        });
        refreshCurrentView();
    } catch (error) {
        alert(error.message || 'No se pudo eliminar el usuario.');
    }
};

window.deleteTreatment = async function(patientId, treatmentId) {
    if (!canEditClinicalHistoryUi()) {
        showAlert('Solo el profesional puede modificar la historia clínica.', { title: 'Historia clínica', variant: 'error' });
        return;
    }
    if(await showConfirm('¿Eliminar registro de tratamiento?', { title: 'Eliminar tratamiento', confirmText: 'Eliminar' })) {
        const p = DB.get('patients').find(pt => pt.id === patientId);
        if (!p) return;

        try {
            if (state.authToken && Number.isInteger(Number(treatmentId))) {
                await apiFetch(`/treatments/${treatmentId}`, { method: 'DELETE' });
                await syncPatientClinicalData(patientId);
            } else {
                const treatments = (p.treatments || []).filter((item, index) => (item.id ?? index) !== treatmentId);
                DB.update('patients', patientId, { treatments });
            }
        } catch (error) {
            showAlert(error.message || 'No se pudo eliminar el tratamiento.', { title: 'Historia clínica', variant: 'error' });
            return;
        }

        loadClinicalHistory(patientId);
    }
};

window.deleteClinicalImage = async function(patientId, imageId) {
    if (!canEditClinicalHistoryUi()) {
        showAlert('Solo el profesional puede modificar la historia clínica.', { title: 'Historia clínica', variant: 'error' });
        return;
    }
    if(await showConfirm('¿Eliminar imagen clínica?', { title: 'Eliminar imagen', confirmText: 'Eliminar' })) {
        const p = DB.get('patients').find(pt => pt.id === patientId);
        if (!p) return;

        try {
            if (state.authToken && Number.isInteger(Number(imageId))) {
                await apiFetch(`/clinical-images/${imageId}`, { method: 'DELETE' });
                await syncPatientClinicalData(patientId);
            } else {
                const images = (p.clinicalImages || []).filter((item, index) => (item.id ?? index) !== imageId);
                DB.update('patients', patientId, { clinicalImages: images });
            }
        } catch (error) {
            showAlert(error.message || 'No se pudo eliminar la imagen clínica.', { title: 'Historia clínica', variant: 'error' });
            return;
        }

        loadClinicalHistory(patientId);
    }
};

function openTreatmentModal(patientId) {
    if (!canEditClinicalHistoryUi()) {
        showAlert('Solo el profesional puede modificar la historia clínica.', { title: 'Historia clínica', variant: 'error' });
        return;
    }
    modalsContainer.innerHTML = `
        <div class="modal-overlay active">
            <div class="modal-content modal-content-treatment" onclick="event.stopPropagation()">
                <div class="modal-header">
                    <h3>AÃ±adir Tratamiento a Ficha</h3>
                    <button class="btn-ghost" data-modal-close><i class="fa-solid fa-times"></i></button>
                </div>
                <form id="tx-history-form">
                    <div class="modal-body">
                        <div class="treatment-form-row treatment-form-row-3">
                            <div class="input-group flex-1"><label>Diente</label><input type="text" id="tx-diente" placeholder="Ej: 18"></div>
                            <div class="input-group flex-1"><label>Cara</label><input type="text" id="tx-cara" placeholder="M, D, V, P, O"></div>
                            <div class="input-group flex-1"><label>Sector</label><input type="text" id="tx-sector" placeholder="1-6"></div>
                        </div>
                        <div class="treatment-form-row treatment-form-row-2">
                            <div class="input-group flex-1"><label>AutorizaciÃ³n</label><input type="text" id="tx-auth" placeholder="NÂº Orden"></div>
                            <div class="input-group flex-1"><label>CÃ³digo OS</label><input type="text" id="tx-codigo" placeholder="Ej: 01.01"></div>
                        </div>
                        <div class="input-group"><label>Observaciones</label><input type="text" id="tx-obs" placeholder="Detalles del procedimiento..." required></div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-ghost" onclick="closeModal()">Cancelar</button>
                        <button type="submit" class="btn btn-primary">AÃ±adir a Tabla</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    
    document.getElementById('tx-history-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const p = DB.get('patients').find(pt => pt.id === patientId);
        if(!p.treatments) p.treatments = [];

        const treatment = {
            id: Date.now(),
            diente: document.getElementById('tx-diente').value,
            cara: document.getElementById('tx-cara').value,
            sector: document.getElementById('tx-sector').value,
            autorizacion: document.getElementById('tx-auth').value,
            codigo: document.getElementById('tx-codigo').value,
            observaciones: document.getElementById('tx-obs').value,
            fecha: new Date().toLocaleDateString('es-AR'),
            firma: state.user?.fullName || state.user?.name || 'Usuario'
        };

        try {
            if (state.authToken) {
                await apiFetch('/treatments', {
                    method: 'POST',
                    body: JSON.stringify({
                        patientId,
                        professionalId: state.user?.assignedProfessionalId || null,
                        tooth: treatment.diente,
                        face: treatment.cara,
                        sector: treatment.sector,
                        authorizationNumber: treatment.autorizacion,
                        insuranceCode: treatment.codigo,
                        observations: treatment.observaciones,
                        performedAt: new Date().toISOString()
                    })
                });
                await syncPatientClinicalData(patientId);
            } else {
                p.treatments.push(treatment);
                DB.update('patients', patientId, { treatments: p.treatments });
            }

            closeModal();
            loadClinicalHistory(patientId);
        } catch (error) {
            showAlert(error.message || 'No se pudo guardar el tratamiento.', { title: 'Historia clínica', variant: 'error' });
        }
    });
}

function openClinicalImageModal(patientId) {
    if (!canEditClinicalHistoryUi()) {
        showAlert('Solo el profesional puede modificar la historia clínica.', { title: 'Historia clínica', variant: 'error' });
        return;
    }
    modalsContainer.innerHTML = `
        <div class="modal-overlay active">
            <div class="modal-content modal-content-patient" onclick="event.stopPropagation()">
                <div class="modal-header">
                    <h3>Agregar Imagen Clinica</h3>
                    <button class="btn-ghost" data-modal-close><i class="fa-solid fa-times"></i></button>
                </div>
                <form id="clinical-image-form">
                    <div class="modal-body">
                        <div class="input-group">
                            <label>Fecha</label>
                            <input type="date" id="clinical-image-date" value="${getTodayIsoLocal()}" required>
                        </div>
                        <div class="input-group">
                            <label>Descripcion</label>
                            <input type="text" id="clinical-image-description" placeholder="Ej: Radiografia panoramica inicial" required>
                        </div>
                        <div class="input-group">
                            <label>Imagenes</label>
                            <input type="file" id="clinical-image-file" accept="image/*" multiple required>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-ghost" onclick="closeModal()">Cancelar</button>
                        <button type="submit" class="btn btn-primary">Guardar Imagenes</button>
                    </div>
                </form>
            </div>
        </div>
    `;

    document.getElementById('clinical-image-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const fileInput = document.getElementById('clinical-image-file');
        const files = Array.from(fileInput.files || []);

        if (files.length === 0) {
            alert('Selecciona al menos una imagen.');
            return;
        }

        const selectedDate = document.getElementById('clinical-image-date').value;
        const selectedDescription = document.getElementById('clinical-image-description').value.trim();

        Promise.all(files.map(file => new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve({
                id: Date.now() + Math.floor(Math.random() * 1000),
                date: selectedDate,
                description: selectedDescription,
                dataUrl: reader.result
            });
            reader.onerror = reject;
            reader.readAsDataURL(file);
        }))).then(async (newImages) => {
            const p = DB.get('patients').find(pt => pt.id === patientId);

            if (state.authToken) {
                await apiFetch('/clinical-images', {
                    method: 'POST',
                    body: JSON.stringify({
                        patientId,
                        images: newImages.map((image) => ({
                            imageUrl: image.dataUrl,
                            description: image.description,
                            takenAt: image.date
                        }))
                    })
                });
                await syncPatientClinicalData(patientId);
            } else if (p) {
                const images = (p.clinicalImages || []).slice();
                images.push(...newImages);
                DB.update('patients', patientId, { clinicalImages: images });
            }

            closeModal();
            loadClinicalHistory(patientId);
        }).catch(() => {
            alert('No se pudieron cargar una o mas imagenes.');
        });
    });
}


