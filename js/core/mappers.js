// =============================================================================
// mappers.js — Transformación de respuestas de la API al formato interno
// Depende de: utils.js (formatDateToLocalIso), state.js (state)
// =============================================================================

// -----------------------------------------------------------------------------
// Helpers internos
// -----------------------------------------------------------------------------

function deriveTypeFromRoles(roleCodes) {
    const r = roleCodes.map(c => String(c).toLowerCase());
    if (r.some(c => c === 'superadmin'))                          return 'superadmin';
    if (r.some(c => c === 'professional' || c === 'profesional')) return 'profesional';
    if (r.some(c => c === 'secretary'    || c === 'secretario'))  return 'secretario';
    if (r.some(c => c === 'admin'        || c === 'administrador')) return 'administrador';
    return '';
}

// Normaliza fechas que pueden venir como 'YYYY-MM-DD' o ISO completo
function coerceAppointmentDate(value) {
    if (!value) return '';
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
        const date = new Date(value);
        if (!Number.isNaN(date.getTime())) {
            return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
        }
    }
    return formatDateToLocalIso(new Date(value));
}

// Normaliza horas que pueden venir como 'HH:MM' o ISO completo
function coerceAppointmentTime(value) {
    if (!value) return '';
    if (typeof value === 'string' && /^\d{2}:\d{2}$/.test(value)) return value;
    return new Date(value).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });
}

// -----------------------------------------------------------------------------
// Mappers de API → formato interno (legacy)
// -----------------------------------------------------------------------------

function mapApiUserToLegacyUser(apiUser = {}) {
    const displayName = apiUser.fullName || apiUser.name || apiUser.email || 'Usuario';
    const roles = Array.isArray(apiUser.roles) ? apiUser.roles : [];
    return {
        id:                      apiUser.id,
        email:                   apiUser.email,
        name:                    displayName,
        fullName:                apiUser.fullName || displayName,
        type:                    apiUser.type || deriveTypeFromRoles(roles),
        roles,
        allowedProfessionals:    Array.isArray(apiUser.allowedProfessionalIds) ? apiUser.allowedProfessionalIds : [],
        assignedProfessionalId:  apiUser.assignedProfessionalId || null,
        assignedProfessionalName: apiUser.assignedProfessionalName || null,
        active:                  apiUser.active !== false,
        isPlatformAdmin:         apiUser.isPlatformAdmin || false,
        clinicId:                apiUser.clinicId || null,
    };
}

function mapApiUserToSettings(user = {}) {
    return {
        id:                   user.id,
        name:                 user.fullName || user.name || user.email,
        email:                user.email,
        type:                 user.roles?.[0] || 'user',
        roles:                user.roles || [],
        allowedProfessionals: user.allowedProfessionalIds || [],
        linkedProfessionalId: user.assignedProfessionalId || null,
    };
}

function mapApiProfessionalToLegacy(professional = {}) {
    const schedule = {};
    (professional.schedules || []).forEach(item => {
        schedule[item.weekday] = { active: item.active, start: item.startTime, end: item.endTime };
    });
    return {
        id:        professional.id,
        name:      professional.fullName,
        specialty: professional.specialty || '',
        email:     professional.email || '',
        phone:     professional.phone || '',
        color:     professional.color || '#6366f1',
        status:    professional.active ? 'activo' : 'inactivo',
        active:    professional.active,
        userId:    professional.userId ?? null,
        schedule,
    };
}

function mapApiPatientToLegacy(patient = {}) {
    return {
        id:             patient.id,
        name:           patient.fullName,
        dni:            patient.dni,
        fechaNacimiento: patient.birthDate ? formatDateToLocalIso(new Date(patient.birthDate)) : '',
        obraSocial:     [patient.insuranceName, patient.insurancePlan].filter(Boolean).join(' ').trim(),
        credencial:     patient.credentialNumber || '',
        domicilio:      patient.address || '',
        fichaNumero:    patient.chartNumber || '',
        email:          patient.email || '',
        phone:          patient.phone || '',
        lastVisit:      '',
        notes:          '',
        allergies:      '',
        medicalNotes:   '',
        odontograma:    {},
        treatments:     [],
        clinicalImages: [],
    };
}

function mapApiAppointmentToLegacy(appointment = {}) {
    return {
        id:                   appointment.id,
        patient:              appointment.patient?.fullName || '',
        patientId:            appointment.patientId,
        professionalId:       appointment.professionalId,
        date:                 coerceAppointmentDate(appointment.date),
        time:                 coerceAppointmentTime(appointment.startTime),
        duration:             appointment.durationMinutes,
        status:               appointment.status,
        isOverbook:           !!appointment.isOverbook,
        notes:                appointment.notes || '',
        confirmationChannel:  appointment.confirmationChannel || null,
        cancellationReason:   appointment.cancellationReason || null,
    };
}

function mapApiBillingToLegacy(entry = {}) {
    return {
        id:             entry.id,
        patientId:      entry.patientId,
        professionalId: entry.professionalId,
        appointmentId:  entry.appointmentId,
        type:           entry.type,
        amount:         Number(entry.amount || 0),
        date:           coerceAppointmentDate(entry.date),
        description:    entry.description || '',
        patientName:    entry.patient?.fullName || '',
    };
}

function mapApiTreatmentToLegacy(treatment = {}) {
    return {
        id:            treatment.id,
        professionalId: treatment.professionalId || null,
        diente:        treatment.tooth || '',
        cara:          treatment.face || '',
        sector:        treatment.sector || '',
        autorizacion:  treatment.authorizationNumber || '',
        codigo:        treatment.insuranceCode || '',
        observaciones: treatment.observations || '',
        fecha:         treatment.performedAt ? new Date(treatment.performedAt).toLocaleDateString('es-AR') : '',
        firma:         treatment.professional?.fullName || state.user?.fullName || state.user?.name || '',
    };
}

function mapApiClinicalImageToLegacy(image = {}) {
    return {
        id:          image.id,
        date:        image.takenAt   ? formatDateToLocalIso(new Date(image.takenAt))
                   : image.createdAt ? formatDateToLocalIso(new Date(image.createdAt))
                   : '',
        description: image.description || '',
        dataUrl:     image.imageUrl || '',
        mimeType:    image.mimeType || 'image/jpeg',
        fileName:    image.fileName || null,
    };
}
