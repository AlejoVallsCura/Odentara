// =============================================================================
// permissions.js — Permisos, roles y acceso a datos filtrados por usuario
// Depende de: state.js, mappers.js (deriveTypeFromRoles via state.user.roles)
// =============================================================================

// -----------------------------------------------------------------------------
// Checks de rol
// -----------------------------------------------------------------------------

function isSelfPlatformAdmin() {
    return !!state.user?.isPlatformAdmin;
}

function isSuperadmin() {
    return !!state.user && state.user.roles.includes('superadmin');
}

function isProfessionalUser() {
    return !!state.user && state.user.roles.includes('professional');
}

// -----------------------------------------------------------------------------
// Permisos de UI (solo controlan visibilidad — el backend siempre valida)
// -----------------------------------------------------------------------------

function canManagePatientBillingUi() {
    return !!state.user && state.user.roles.some(r => ['superadmin', 'admin'].includes(r));
}

function canViewPatientBillingUi() {
    return !!state.user && state.user.roles.some(r => ['superadmin', 'admin'].includes(r));
}

function canManageAppointmentsUi() {
    return !!state.user && state.user.roles.some(r => ['superadmin', 'secretary'].includes(r));
}

function canViewAppointmentsUi() {
    return !!state.user && state.user.roles.some(r => ['superadmin', 'secretary', 'professional'].includes(r));
}

function canEditAppointmentsUi() {
    return !!state.user && state.user.roles.some(r => ['superadmin', 'secretary', 'professional'].includes(r));
}

function canCreatePatientUi() {
    return !!state.user && state.user.roles.some(r => ['superadmin', 'secretary'].includes(r));
}

function canEditPatientUi() {
    return !!state.user && state.user.roles.some(r => ['superadmin', 'secretary'].includes(r));
}

function canManageProfessionalSchedulesUi() {
    return !!state.user && state.user.roles.some(r => ['superadmin', 'secretary'].includes(r));
}

function canManageProfessionalsUi() {
    return !!state.user && state.user.roles.some(r => ['superadmin', 'admin'].includes(r));
}

function canViewBillingUi() {
    return !!state.user && state.user.roles.some(r => ['superadmin', 'admin'].includes(r));
}

function canManageUsersUi() {
    return !!state.user && state.user.roles.includes('superadmin');
}

function canAccessSettingsUi() {
    return !!state.user && state.user.roles.some(r => ['superadmin', 'admin', 'secretary'].includes(r));
}

function canEditClinicalHistoryUi() {
    return !!state.user && (state.user.roles.includes('professional') || state.user.roles.includes('superadmin'));
}

function canViewClinicalHistoryUi() {
    return !!state.user && (state.user.roles.includes('professional') || state.user.roles.includes('superadmin'));
}

function canManageAppointmentStatusUi() {
    return !!state.user && state.user.roles.some(r => ['superadmin', 'secretary'].includes(r));
}

function canSendAppointmentWhatsappUi() {
    return !!state.user && state.user.roles.some(r => ['superadmin', 'secretary'].includes(r));
}

function canEditCalendar() {
    return state.user?.roles?.some(r => ['secretary', 'superadmin', 'admin'].includes(r)) ?? false;
}

// -----------------------------------------------------------------------------
// Acceso a datos filtrado por rol
// -----------------------------------------------------------------------------

function getAccessibleProfessionalIds() {
    const allProfs = DB.get('professionals');
    if (!state.user) return [];
    if (isSuperadmin()) return allProfs.map(p => p.id);

    // Admin ve todos los profesionales (puede editar solo el propio horario)
    if (state.user.roles.includes('admin')) return allProfs.map(p => p.id);

    const explicit = Array.isArray(state.user.allowedProfessionals) ? state.user.allowedProfessionals : [];

    if (isProfessionalUser()) {
        if (explicit.length > 0) return explicit;
        return allProfs
            .filter(p => p.name === state.user.name || (p.email && p.email === state.user.email))
            .map(p => p.id);
    }

    return explicit.length > 0 ? explicit : allProfs.map(p => p.id);
}

function canAccessProfessional(profId) {
    return getAccessibleProfessionalIds().includes(parseInt(profId));
}

function getAccessibleProfessionals() {
    const allowed = new Set(getAccessibleProfessionalIds());
    return DB.get('professionals').filter(p => allowed.has(p.id));
}

function getAccessibleAppointments() {
    const allowed = new Set(getAccessibleProfessionalIds());
    return DB.get('appointments').filter(apt => allowed.has(apt.professionalId));
}

// Los pacientes pertenecen a toda la clínica — todos los roles ven todos
function getAccessiblePatientIds() {
    return DB.get('patients').map(p => p.id);
}

function canAccessPatient(patientId) {
    return getAccessiblePatientIds().includes(parseInt(patientId));
}

function getAccessiblePatients() {
    const allowed = new Set(getAccessiblePatientIds());
    return DB.get('patients').filter(p => allowed.has(p.id));
}

// Devuelve el profesionalId activo en el odontograma (superadmin usa selector)
function getCurrentOdontoProfessionalId() {
    if (isSuperadmin() || (state.user?.allowedProfessionals || []).length > 1) {
        return state.clinicalOdontoProfessionalId || null;
    }
    if (state.user?.assignedProfessionalId) return state.user.assignedProfessionalId;
    const scoped = state.user?.allowedProfessionals || [];
    if (scoped.length === 1) return scoped[0];
    return null;
}

// -----------------------------------------------------------------------------
// Estados de turno
// -----------------------------------------------------------------------------

// Normaliza variantes legacy del backend al código interno
function normalizeAppointmentStatus(status = '') {
    if (status === 'pending')      return 'not_sent';
    if (status === 'in progress')  return 'sent';
    if (status === 'reprogramado') return 'rescheduled';
    return status || 'not_sent';
}

// Un turno "bloqueante" ocupa el slot — cancelado y reprogramado no bloquean
function isBlockingAppointmentStatus(status = '') {
    const normalized = normalizeAppointmentStatus(status);
    return normalized !== 'cancelled' && normalized !== 'rescheduled';
}

// -----------------------------------------------------------------------------
// Helpers de facturación por paciente (dependen de permisos de acceso)
// -----------------------------------------------------------------------------

function getBillingEntriesForPatient(patientId) {
    return DB.get('billing')
        .filter(e => e.patientId === patientId && canAccessProfessional(e.professionalId))
        .sort((a, b) => String(b.date).localeCompare(String(a.date)) || (b.id - a.id));
}

function getPatientCurrentAccountSummary(patientId) {
    const patient = getAccessiblePatients().find(p => p.id === patientId);
    const entries = getBillingEntriesForPatient(patientId);
    const professionals = getAccessibleProfessionals();
    const byProfMap = new Map();

    entries.forEach(entry => {
        const prof = professionals.find(p => p.id === entry.professionalId);
        if (!prof) return;
        if (!byProfMap.has(entry.professionalId)) {
            byProfMap.set(entry.professionalId, { professionalId: prof.id, professionalName: prof.name, deuda: 0, pagado: 0 });
        }
        const item = byProfMap.get(entry.professionalId);
        if (entry.type === 'debt') item.deuda += entry.amount;
        if (entry.type === 'income' || entry.type === 'payment') item.pagado += entry.amount;
    });

    const byProfessional = Array.from(byProfMap.values())
        .map(item => ({ ...item, balance: item.deuda - item.pagado }))
        .sort((a, b) => a.professionalName.localeCompare(b.professionalName));

    const deuda  = byProfessional.reduce((s, i) => s + i.deuda,  0);
    const pagado = byProfessional.reduce((s, i) => s + i.pagado, 0);

    return { patient, entries, byProfessional, deuda, pagado, balance: deuda - pagado };
}

function getPatientCurrentAccountSummaries() {
    return getAccessiblePatients()
        .map(patient => {
            const s = getPatientCurrentAccountSummary(patient.id);
            return { patientId: patient.id, name: patient.name, dni: patient.dni,
                     deuda: s.deuda, pagado: s.pagado, balance: s.balance,
                     byProfessional: s.byProfessional, movementCount: s.entries.length };
        })
        .sort((a, b) => a.name.localeCompare(b.name));
}

function getPatientProfessionalAccountRows() {
    return getAccessiblePatients()
        .flatMap(patient => {
            const s = getPatientCurrentAccountSummary(patient.id);
            if (!s.byProfessional.length) {
                return [{ patientId: patient.id, name: patient.name, dni: patient.dni,
                          professionalId: null, professionalName: 'Sin movimientos',
                          deuda: 0, pagado: 0, balance: 0 }];
            }
            return s.byProfessional.map(item => ({
                patientId: patient.id, name: patient.name, dni: patient.dni,
                professionalId: item.professionalId, professionalName: item.professionalName,
                deuda: item.deuda, pagado: item.pagado, balance: item.balance
            }));
        })
        .sort((a, b) => a.name.localeCompare(b.name) || a.professionalName.localeCompare(b.professionalName));
}
