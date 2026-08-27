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

/**
 * Secciones de Configuracion que puede ver el usuario actual.
 *
 * Una sola lista para los dos lugares que la muestran: el submenu del sidebar
 * (router.js) y la pantalla de Configuracion (settings.js). Antes eran dos listas
 * escritas a mano, y pasó lo previsible: se agregó "Mensaje de confirmacion" a la
 * de la pantalla y la del sidebar quedó sin él, así que la seccion existia pero no
 * habia forma de llegar desde el menu. Con dos listas eso vuelve a pasar cada vez
 * que se agrega una seccion.
 *
 * `label` es el nombre corto del sidebar; `labelLargo` el de la pantalla, que
 * tiene mas lugar.
 */
function getSettingsSections() {
    const roles = state.user?.roles || [];
    const esAdmin      = roles.some(r => ['superadmin', 'admin'].includes(r));
    const esSecretaria = roles.includes('secretary');

    const puedeClinica = esAdmin || esSecretaria;

    return [
        { id: 'clinic-settings', icon: 'fa-hospital', label: 'Clínica',
          labelLargo: 'Configuración clínica',
          description: 'Nombre comercial e identidad visual de profesionales.',
          visible: puedeClinica },
        { id: 'confirmation-message', icon: 'fa-comment-dots', label: 'Mensaje',
          labelLargo: 'Mensaje de confirmación',
          description: 'Texto que se envía por WhatsApp al confirmar un turno.',
          visible: puedeClinica },
        { id: 'create-user', icon: 'fa-user-plus', label: 'Crear usuario',
          labelLargo: 'Crear usuario',
          description: 'Alta de nuevos usuarios y permisos.',
          visible: esAdmin },
        { id: 'create-professional', icon: 'fa-user-doctor', label: 'Crear profesional',
          labelLargo: 'Crear profesional',
          description: 'Registro de profesionales y datos base.',
          visible: esAdmin },
        { id: 'users-list', icon: 'fa-users-gear', label: 'Usuarios existentes',
          labelLargo: 'Usuarios existentes',
          description: 'Listado de usuarios y accesos asignados.',
          visible: esAdmin },
        { id: 'professionals-list', icon: 'fa-address-card', label: 'Profesionales existentes',
          labelLargo: 'Profesionales existentes',
          description: 'Vista de profesionales y acceso al calendario.',
          visible: esAdmin },
    ].filter(seccion => seccion.visible);
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

// Igual que getAccessibleProfessionals() pero además excluye profesionales
// desactivados — usar en selectores donde se elige/asigna un profesional
// (nuevo turno, horarios, odontograma). NO usar para historial (turnos
// pasados, cuentas corrientes) — ahí un profesional inactivo debe seguir
// apareciendo porque los datos históricos no se borran.
function getActiveAccessibleProfessionals() {
    return getAccessibleProfessionals().filter(p => p.active !== false && p.status !== 'inactivo');
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

// Devuelve el profesional "propio" del usuario actual — se usa como valor por
// defecto al emitir una receta/presupuesto (que sí son privados por
// profesional). El odontograma, tratamientos y archivos son compartidos y ya
// no dependen de esto.
function getCurrentOdontoProfessionalId() {
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

/**
 * Cuenta corriente de un paciente, separada por profesional Y POR MONEDA.
 *
 * Una fila por cada combinación: la misma profesional puede tener un saldo en
 * pesos y otro en dólares, y son dos saldos distintos. Sumarlos daría un número
 * que no significa nada (ver shared/money.js).
 */
function getPatientCurrentAccountSummary(patientId) {
    const patient = getAccessiblePatients().find(p => p.id === patientId);
    const entries = getBillingEntriesForPatient(patientId);
    const professionals = getAccessibleProfessionals();

    const porProfesional = new Map();
    entries.forEach(entry => {
        const prof = professionals.find(p => p.id === entry.professionalId);
        if (!prof) return;
        if (!porProfesional.has(prof.id)) porProfesional.set(prof.id, { prof, movimientos: [] });
        porProfesional.get(prof.id).movimientos.push(entry);
    });

    const byProfessional = [...porProfesional.values()]
        .flatMap(({ prof, movimientos }) =>
            resumirPorMoneda(movimientos).map(saldo => ({
                professionalId:   prof.id,
                professionalName: prof.name,
                moneda:           saldo.moneda,
                deuda:            saldo.deuda,
                pagado:           saldo.pagado,
                balance:          saldo.balance
            }))
        )
        .sort((a, b) =>
            a.professionalName.localeCompare(b.professionalName) ||
            a.moneda.localeCompare(b.moneda)
        );

    return {
        patient,
        entries,
        byProfessional,
        // Cantidad de PROFESIONALES, no de filas: con dos monedas, una sola
        // profesional genera dos filas y el conteo diría "2 profesionales".
        professionalCount: porProfesional.size,
        totalesPorMoneda: resumirPorMoneda(entries)
    };
}

