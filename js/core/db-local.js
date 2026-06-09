// =============================================================================
// db-local.js — Cache local (localStorage), settings de clínica, sync con backend
// Depende de: mappers.js, api.js (apiFetch), state.js
// =============================================================================

// -----------------------------------------------------------------------------
// Cache localStorage (odentara_db_v6)
// -----------------------------------------------------------------------------

const DB = {
    getRaw(table) {
        return JSON.parse(localStorage.getItem('odentara_db_v6'))[table] || [];
    },
    init() {
        if (!localStorage.getItem('odentara_db_v6')) {
            localStorage.setItem('odentara_db_v6', JSON.stringify({
                users: [], professionals: [], patients: [],
                appointments: [], billing: [], clinic: {}
            }));
        }
    },
    get(table) {
        return this.getRaw(table).filter(item => !item?.deletedAt);
    },
    save(table, items) {
        const db = JSON.parse(localStorage.getItem('odentara_db_v6')) || {};
        db[table] = items;
        localStorage.setItem('odentara_db_v6', JSON.stringify(db));
    },
    add(table, item) {
        const items = this.getRaw(table);
        item.id = items.length > 0 ? Math.max(...items.map(i => i.id)) + 1 : 1;
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
    try { return JSON.parse(localStorage.getItem('odentara_db_v6')) || {}; }
    catch (_) { return {}; }
}

function saveDbSnapshot(snapshot) {
    localStorage.setItem('odentara_db_v6', JSON.stringify(snapshot || {}));
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

async function syncBackendSnapshotToLocalDb() {
    const canManageUsers = (state.user?.roles || []).some(r => r === 'superadmin' || r === 'admin');
    const [professionalsRes, patientsRes, appointmentsRes, billingRes, usersRes] = await Promise.allSettled([
        apiFetch('/professionals'),
        apiFetch('/patients'),
        apiFetch('/appointments'),
        apiFetch('/billing'),
        canManageUsers ? apiFetch('/users') : Promise.resolve({ users: [] })
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
        DB.save('users', (usersRes.value.users || []).map(mapApiUserToLegacyUser));
    }
}
