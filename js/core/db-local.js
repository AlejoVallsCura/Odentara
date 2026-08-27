// =============================================================================
// db-local.js — Cache local (localStorage), settings de clínica, sync con backend
// Depende de: mappers.js, api.js (apiFetch), state.js
// =============================================================================

// -----------------------------------------------------------------------------
// Cache localStorage (odentara_db_v6)
// -----------------------------------------------------------------------------

// La clave estaba escrita a mano en ocho lugares de este archivo y en dos de
// views/platform.js. Con el nombre en una constante, borrar el cache deja de
// depender de que alguien se acuerde de la cadena exacta.
const CLAVE_DB_LOCAL = 'odentara_db_v6';

// Aviso de cuota: una sola vez por sesión. Si el cache no entra, cada guardado
// posterior vuelve a fallar, y un toast por intento taparía la pantalla.
let _avisoDeCuotaMostrado = false;

/**
 * Escribe el cache entero, tolerando que no entre.
 *
 * localStorage tiene un techo cercano a los 5 MB por origen, y acá va TODO el
 * estado de la clínica en una sola clave. Una clínica con varios miles de
 * pacientes más los datos clínicos que se van cacheando ficha por ficha llega a
 * ese techo, y sin este try el QuotaExceededError subía por el medio de un
 * guardado y cortaba la operación a la mitad. Aparece primero en las clínicas
 * más grandes, que son las de los planes que más pagan.
 *
 * Degradar es correcto: el cache es una copia: el dato real ya está —o va a
 * estar— en el servidor. Lo que no se puede es fallar en silencio.
 */
function escribirCacheLocal(snapshot) {
    try {
        localStorage.setItem(CLAVE_DB_LOCAL, JSON.stringify(snapshot || {}));
        return true;
    } catch (error) {
        const esCuota = error?.name === 'QuotaExceededError'
            || error?.name === 'NS_ERROR_DOM_QUOTA_REACHED'
            || error?.code === 22;
        console.error('[db-local] No se pudo guardar el cache local:', error?.name || error);
        if (esCuota && !_avisoDeCuotaMostrado && typeof showToast === 'function') {
            _avisoDeCuotaMostrado = true;
            showToast(
                'Este navegador se quedó sin espacio para guardar datos locales. Todo se sigue guardando en el servidor, pero la app puede ir más lenta. Cerrá sesión y volvé a entrar para liberar espacio.',
                { type: 'warning', duration: 8000 }
            );
        }
        return false;
    }
}

const ESTRUCTURA_VACIA = {
    users: [], professionals: [], patients: [],
    appointments: [], billing: [], clinic: {}
};

const DB = {
    getRaw(table) {
        // El `|| {}` no está de adorno: si la clave no existe —recién borrada al
        // cerrar sesión, o vaciada a mano— JSON.parse(null) devuelve null y
        // acceder a [table] tiraba TypeError en medio del render.
        const db = JSON.parse(localStorage.getItem(CLAVE_DB_LOCAL)) || {};
        return db[table] || [];
    },
    init() {
        if (!localStorage.getItem(CLAVE_DB_LOCAL)) {
            localStorage.setItem(CLAVE_DB_LOCAL, JSON.stringify(ESTRUCTURA_VACIA));
        }
    },
    /**
     * Borra el cache entero y lo deja inicializado.
     *
     * Se llama al cerrar sesión y al entrar un usuario distinto. Hasta que existió,
     * el padrón de pacientes —nombre, DNI, teléfono, domicilio, obra social— más el
     * odontograma, tratamientos, recetas y presupuestos de cada ficha abierta
     * quedaban en la máquina después del logout, legibles sin ninguna credencial.
     * En la computadora de recepción, que la usan varias personas, eso alcanzaba
     * para que la siguiente viera los datos de la anterior.
     */
    clear() {
        localStorage.removeItem(CLAVE_DB_LOCAL);
        this.init();
    },
    get(table) {
        return this.getRaw(table).filter(item => !item?.deletedAt);
    },
    save(table, items) {
        const db = JSON.parse(localStorage.getItem(CLAVE_DB_LOCAL)) || {};
        db[table] = items;
        escribirCacheLocal(db);
    },
    add(table, item) {
        const items = this.getRaw(table);
        // reduce y no Math.max(...ids): el spread tiene un techo de argumentos y
        // una clínica con decenas de miles de filas cacheadas lo hacía tirar
        // RangeError justo en el momento de guardar.
        item.id = items.reduce((max, i) => (i.id > max ? i.id : max), 0) + 1;
        items.push(item);
        this.save(table, items);
    },
    update(table, id, data) {
        const items = this.getRaw(table);
        const idx = items.findIndex(i => i.id === +id);
        if (idx !== -1) {
            items[idx] = { ...items[idx], ...data };
            this.save(table, items);
        }
    },
    archive(table, id, extraData = {}) {
        const items = this.getRaw(table);
        const idx = items.findIndex(i => i.id === +id);
        if (idx !== -1) {
            items[idx] = { ...items[idx], ...extraData, active: false, deletedAt: new Date().toISOString() };
            this.save(table, items);
        }
    },
    delete(table, id) {
        this.archive(table, id);
    }
};
DB.init();

// -----------------------------------------------------------------------------
// Settings de clínica
// -----------------------------------------------------------------------------

const DEFAULT_CLINIC_SETTINGS = {
    name: 'Centro odontológico',
    professionalColors: {}
};

function getDbSnapshot() {
    try { return JSON.parse(localStorage.getItem(CLAVE_DB_LOCAL)) || {}; }
    catch (_) { return {}; }
}

function saveDbSnapshot(snapshot) {
    escribirCacheLocal(snapshot || {});
}

function getClinicSettings() {
    const db     = getDbSnapshot();
    const clinic = db.clinic && typeof db.clinic === 'object' ? db.clinic : {};
    const professionalColors = clinic.professionalColors && typeof clinic.professionalColors === 'object'
        ? clinic.professionalColors : {};
    return {
        ...DEFAULT_CLINIC_SETTINGS,
        ...clinic,
        professionalColors: { ...(DEFAULT_CLINIC_SETTINGS.professionalColors || {}), ...professionalColors }
    };
}

function saveClinicSettings(partialSettings = {}) {
    const db      = getDbSnapshot();
    const current = db.clinic && typeof db.clinic === 'object' ? db.clinic : {};
    const nextColors = partialSettings.professionalColors && typeof partialSettings.professionalColors === 'object'
        ? partialSettings.professionalColors : {};
    db.clinic = {
        ...DEFAULT_CLINIC_SETTINGS,
        ...current,
        ...partialSettings,
        professionalColors: {
            ...(DEFAULT_CLINIC_SETTINGS.professionalColors || {}),
            ...(current.professionalColors && typeof current.professionalColors === 'object' ? current.professionalColors : {}),
            ...nextColors
        }
    };
    saveDbSnapshot(db);
}

function getClinicDisplayName() {
    const name = String(getClinicSettings().name || '').trim();
    return name || DEFAULT_CLINIC_SETTINGS.name;
}

// -----------------------------------------------------------------------------
// Sync backend → DB local
// -----------------------------------------------------------------------------

// Campos de la ficha que NO vienen en el listado general de pacientes.
//
// `/patients` es un directorio: nombre, DNI, contacto. La historia clinica la
// trae syncPatientClinicalData(), paciente por paciente, con seis pedidos
// aparte. mapApiPatientToLegacy los deja vacios (`odontograma: {}`,
// `treatments: []`, y ni siquiera define budgets ni prescriptions) porque en esa
// respuesta no hay nada con que llenarlos.
const CAMPOS_CLINICOS_DE_LA_FICHA = [
    'odontograma', 'treatments', 'clinicalImages', 'prescriptions', 'budgets',
    'notes', 'allergies', 'medicalNotes',
];

/**
 * Conserva la historia clinica ya cargada al refrescar el listado de pacientes.
 *
 * DB.save() reemplaza la coleccion entera, asi que guardar ahi la respuesta de
 * `/patients` tal cual borraba de un plumazo el odontograma, los tratamientos,
 * las imagenes, las recetas y los presupuestos de todos los pacientes que
 * estuvieran cargados. El sintoma era desconcertante: registrabas un movimiento
 * estando en una ficha, y como el guardado sincroniza y despues re-renderiza,
 * la pestana de Presupuestos pasaba a decir "No hay presupuestos" con los
 * presupuestos intactos en el servidor.
 *
 * El listado no tiene autoridad sobre estos campos: nunca trae un valor real
 * para ellos, solo el vacio del mapper. Por eso se toman siempre de lo que ya
 * habia, y el paciente que todavia no se abrio queda con los vacios de siempre.
 */
function conservarDatosClinicos(pacientesDelListado) {
    const previos = new Map(DB.getRaw('patients').map((p) => [p.id, p]));

    return pacientesDelListado.map((paciente) => {
        const anterior = previos.get(paciente.id);
        if (!anterior) return paciente;

        const clinicos = {};
        for (const campo of CAMPOS_CLINICOS_DE_LA_FICHA) {
            if (anterior[campo] !== undefined) clinicos[campo] = anterior[campo];
        }
        return { ...paciente, ...clinicos };
    });
}

async function syncBackendSnapshotToLocalDb() {
    const canManageUsers = (state.user?.roles || []).some(r => r === 'superadmin' || r === 'admin');
    const [professionalsRes, patientsRes, appointmentsRes, billingRes, usersRes, clinicRes] = await Promise.allSettled([
        apiFetch('/professionals'),
        apiFetch('/patients'),
        apiFetch('/appointments'),
        apiFetch('/billing'),
        canManageUsers ? apiFetch('/users') : Promise.resolve({ users: [] }),
        // La plantilla del mensaje de confirmación vive en el servidor, no en
        // este navegador: es de la clínica y la comparten todas las secretarías.
        // Viaja en el mismo ciclo para que un cambio se propague sin recargar.
        apiFetch('/clinic/settings')
    ]);

    if (professionalsRes.status === 'fulfilled') {
        DB.save('professionals', (professionalsRes.value.professionals || []).map(mapApiProfessionalToLegacy));
    }
    if (patientsRes.status === 'fulfilled') {
        DB.save('patients', conservarDatosClinicos(
            (patientsRes.value.patients || []).map(mapApiPatientToLegacy)
        ));
    }
    if (appointmentsRes.status === 'fulfilled') {
        DB.save('appointments', (appointmentsRes.value.appointments || []).map(mapApiAppointmentToLegacy));
    }
    if (billingRes.status === 'fulfilled') {
        DB.save('billing', (billingRes.value.entries || []).map(mapApiBillingToLegacy));
    }
    if (usersRes.status === 'fulfilled') {
        DB.save('users', (usersRes.value.users || []).map(mapApiUserToLegacyUser));
    }
    if (clinicRes.status === 'fulfilled' && clinicRes.value?.settings) {
        saveClinicSettings({
            appointmentMessageTemplate: clinicRes.value.settings.appointmentMessageTemplate || ''
        });
    }
}

/**
 * Refresca solo los movimientos de cuenta corriente.
 *
 * Registrar un cargo no cambia los profesionales, ni los pacientes, ni los
 * turnos, ni la plantilla de mensajes. El sync completo pedia las seis cosas:
 * trece pedidos para registrar un pago, que en hosting compartido se siente
 * como que la pantalla se traba, y cinco oportunidades de mas para que una
 * respuesta 401 saque a la persona de la sesion en medio de la operacion.
 */
async function syncBillingToLocalDb() {
    const res = await apiFetch('/billing');
    DB.save('billing', (res.entries || []).map(mapApiBillingToLegacy));
}

// Plantilla vigente del mensaje de confirmación. Cadena vacía significa "usar la
// de por defecto", que arma getWhatsAppLink.
function getAppointmentMessageTemplate() {
    return String(getClinicSettings().appointmentMessageTemplate || '').trim();
}
