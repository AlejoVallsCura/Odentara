// =============================================================================
// helpers.js — Form helpers, validacion, utilidades de API y payload builders
// Depende de: state.js, api.js, db-local.js
// =============================================================================

function clearFormValidation(form) {
    if (!form) return;

    form.querySelectorAll('.input-invalid').forEach((element) => {
        element.classList.remove('input-invalid');
        element.removeAttribute('aria-invalid');
    });

    form.querySelectorAll('.field-error-message').forEach((element) => element.remove());

    const feedback = form.querySelector('.form-feedback');
    if (feedback) {
        feedback.hidden = true;
        feedback.textContent = '';
        feedback.classList.remove('is-visible');
    }
}

function showFormFeedback(form, message) {
    if (!form || !message) return;

    const feedback = form.querySelector('.form-feedback');
    if (!feedback) return;

    feedback.textContent = message;
    feedback.hidden = false;
    feedback.classList.add('is-visible');
}

function markFieldInvalid(field, message) {
    if (!field) return;

    field.classList.add('input-invalid');
    field.setAttribute('aria-invalid', 'true');

    const inputGroup = field.closest('.input-group');
    if (!inputGroup) return;

    const existingError = inputGroup.querySelector('.field-error-message');
    if (existingError) existingError.remove();

    if (message) {
        const error = document.createElement('div');
        error.className = 'field-error-message';
        error.textContent = message;
        inputGroup.appendChild(error);
    }
}

function focusField(field) {
    if (!field || typeof field.focus !== 'function') return;

    field.focus();
    if (typeof field.select === 'function' && field.tagName === 'INPUT' && field.type !== 'date') {
        field.select();
    }
}

async function validatePatientForm(form, editId = null) {
    clearFormValidation(form);

    const fieldMap = {
        name: form.querySelector('#p-name'),
        dni: form.querySelector('#p-dni'),
        phone: form.querySelector('#p-phone'),
        email: form.querySelector('#p-email')
    };

    const rawName = fieldMap.name?.value || '';
    const rawDni = fieldMap.dni?.value || '';
    const rawPhone = fieldMap.phone?.value || '';
    const rawEmail = fieldMap.email?.value || '';

    const normalizedName = normalizePatientName(rawName);
    const normalizedDni = normalizeDni(rawDni);
    const normalizedPhone = normalizeDni(rawPhone);
    const email = rawEmail.trim();

    const fail = (fieldKey, fieldMessage, summary = fieldMessage) => {
        const field = fieldMap[fieldKey];
        showFormFeedback(form, summary);
        markFieldInvalid(field, fieldMessage);
        focusField(field);
        return { ok: false };
    };

    if (!normalizedName) {
        return fail('name', 'Ingresa el nombre y apellido del paciente.', 'Revisa el campo Nombre y Apellido.');
    }

    if (normalizedName.length < 3) {
        return fail('name', 'El nombre es demasiado corto.', 'Revisa el campo Nombre y Apellido.');
    }

    if (!normalizedDni) {
        return fail('dni', 'Ingresa un DNI válido.', 'Revisa el campo DNI.');
    }

    if (normalizedDni.length < 7) {
        return fail('dni', 'El DNI debe tener al menos 7 números.', 'Revisa el campo DNI.');
    }

    if (!normalizedPhone) {
        return fail('phone', 'Ingresa un teléfono o celular válido.', 'Revisa el campo Teléfono.');
    }

    if (normalizedPhone.length < 8) {
        return fail('phone', 'El teléfono debe tener al menos 8 números.', 'Revisa el campo Teléfono.');
    }

    if (email && fieldMap.email && !fieldMap.email.checkValidity()) {
        return fail('email', 'El email no tiene un formato válido.', 'Revisa el campo Email.');
    }

    let allPatients = [];
    try {
        const patientsRes = await apiFetch('/patients');
        allPatients = patientsRes.patients || [];
    } catch (_e) {
        // Si falla la carga, dejamos pasar — el backend validará duplicados al guardar
    }

    const duplicatedByName = allPatients.find((patient) =>
        normalizePatientName(patient.fullName) === normalizedName && patient.id !== editId
    );

    if (duplicatedByName) {
        return fail('name', 'Ya existe un paciente cargado con ese nombre.', 'Ya existe un paciente cargado con ese nombre.');
    }

    const duplicatedByDni = allPatients.find((patient) =>
        normalizeDni(patient.dni) === normalizedDni && patient.id !== editId
    );

    if (duplicatedByDni) {
        return fail('dni', 'Ya existe un paciente cargado con ese DNI.', 'Ya existe un paciente cargado con ese DNI.');
    }

    return {
        ok: true,
        normalizedName,
        normalizedDni
    };
}

function applyPatientApiErrorToForm(form, error) {
    if (!form || !error) return false;

    const payload = error.payload || {};
    const conflicts = Array.isArray(payload.conflicts) ? payload.conflicts : [];
    const message = payload.error || error.message || 'No se pudo guardar el paciente.';
    const lowerMessage = String(message).toLowerCase();

    const fieldMap = {
        name: form.querySelector('#p-name'),
        dni: form.querySelector('#p-dni'),
        phone: form.querySelector('#p-phone'),
        email: form.querySelector('#p-email')
    };

    const mark = (fieldKey, fieldMessage, summary = message) => {
        showFormFeedback(form, summary);
        markFieldInvalid(fieldMap[fieldKey], fieldMessage);
        focusField(fieldMap[fieldKey]);
        return true;
    };

    if (conflicts.length > 0) {
        const dniConflict = conflicts.find((item) => /dni/i.test(item));
        const nameConflict = conflicts.find((item) => /nombre/i.test(item));

        if (dniConflict) return mark('dni', dniConflict, dniConflict);
        if (nameConflict) return mark('name', nameConflict, nameConflict);
    }

    if (lowerMessage.includes('dni')) {
        return mark('dni', message, message);
    }

    if (lowerMessage.includes('nombre')) {
        return mark('name', message, message);
    }

    if (lowerMessage.includes('email')) {
        return mark('email', message, message);
    }

    if (lowerMessage.includes('telefono') || lowerMessage.includes('teléfono')) {
        return mark('phone', message, message);
    }

    showFormFeedback(form, message);
    return false;
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
        DB.archive(localTable, localId);
    }
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



function getPatientOptionLabel(patient) {
    return `${patient.name} | DNI ${patient.dni}`;
}

