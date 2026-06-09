// =============================================================================
// patients.js — Vista de pacientes y modal de alta/edicion
// =============================================================================

// ── Exportación de pacientes a Excel ──────────────────────────────────────────
function exportPatients() {
    if (typeof XLSX === 'undefined') {
        const script = document.createElement('script');
        script.src = '/xlsx.full.min.js';
        script.onload = () => exportPatients();
        script.onerror = () => showAlert('No se pudo cargar la librería para generar Excel.', { title: 'Error', variant: 'error' });
        document.head.appendChild(script);
        return;
    }
    const patients = DB.get('patients') || [];
    if (patients.length === 0) {
        showAlert('No hay pacientes para exportar.', { title: 'Sin datos', variant: 'warning' });
        return;
    }
    const rows = patients.map(p => ({
        'Nombre completo':  p.name || p.fullName || '',
        'DNI':              p.dni || '',
        'Teléfono':         p.phone || '',
        'Email':            p.email || '',
        'Dirección':        p.domicilio || p.address || '',
        'Obra social':      p.obraSocial || p.insuranceName || '',
        'Plan':             p.insurancePlan || '',
        'Credencial':       p.credencial || p.credentialNumber || '',
        'Historia':         p.fichaNumero || p.chartNumber || '',
        'Fecha nacimiento': p.fechaNacimiento || p.birthDate || '',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Pacientes');
    // Ancho de columnas automático
    const colWidths = Object.keys(rows[0]).map(k => ({ wch: Math.max(k.length, 16) }));
    ws['!cols'] = colWidths;
    const fecha = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `pacientes_odentara_${fecha}.xlsx`);
}

// ── Importación de pacientes desde Excel ──────────────────────────────────────
function openPatientImportModal() {
    if (typeof XLSX === 'undefined') {
        // Intentar cargar SheetJS dinámicamente si no cargó por CDN
        const script = document.createElement('script');
        script.src = '/xlsx.full.min.js';
        script.onload = () => openPatientImportModal();
        script.onerror = () => showAlert('No se pudo cargar la librería para leer Excel. Verificá tu conexión a internet.', { title: 'Error', variant: 'error' });
        document.head.appendChild(script);
        return;
    }

    // Columnas aceptadas (case-insensitive, con y sin tildes)
    const COL_MAP = {
        nombre: 'fullName', apellido: 'fullName', 'nombre completo': 'fullName',
        dni: 'dni', documento: 'dni',
        telefono: 'phone', tel: 'phone', celular: 'phone',
        'teléfono': 'phone',
        email: 'email', correo: 'email',
        direccion: 'address', domicilio: 'address',
        'dirección': 'address',
        'obra social': 'insuranceName', 'obrasocial': 'insuranceName', mutual: 'insuranceName',
        plan: 'insurancePlan',
        credencial: 'credentialNumber', 'nro credencial': 'credentialNumber',
        historia: 'chartNumber', 'nro historia': 'chartNumber', 'historia clinica': 'chartNumber',
        nacimiento: 'birthDate', 'fecha nacimiento': 'birthDate', 'fecha de nacimiento': 'birthDate',
    };

    function normalize(s) {
        return String(s || '').trim().toLowerCase()
            .replace(/[áàäâ]/g, 'a')
            .replace(/[éèëê]/g, 'e')
            .replace(/[íìïî]/g, 'i')
            .replace(/[óòöô]/g, 'o')
            .replace(/[úùüû]/g, 'u')
            .replace(/ñ/g, 'n');
    }

    function parseSheet(file) {
        return new Promise((resolve, reject) => {
            const isCsv = file.name.toLowerCase().endsWith('.csv');
            const reader = new FileReader();
            reader.onload = e => {
                try {
                    let wb;
                    if (isCsv) {
                        // Leer CSV como texto UTF-8 para preservar acentos
                        wb = XLSX.read(e.target.result, { type: 'string' });
                    } else {
                        wb = XLSX.read(e.target.result, { type: 'array', cellDates: true });
                    }
                    const ws = wb.Sheets[wb.SheetNames[0]];
                    const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
                    resolve(rows);
                } catch(err) { reject(err); }
            };
            reader.onerror = reject;
            if (isCsv) {
                reader.readAsText(file, 'UTF-8');
            } else {
                reader.readAsArrayBuffer(file);
            }
        });
    }

    function mapRow(raw) {
        const out = {};
        for (const [col, val] of Object.entries(raw)) {
            const key = COL_MAP[normalize(col)];
            if (!key) continue;
            if (key === 'fullName' && out.fullName) {
                out.fullName = out.fullName + ' ' + String(val).trim(); // apellido separado
            } else {
                if (key === 'birthDate' && typeof val === 'number') {
                    // XLSX convierte fechas CSV a serial de Excel; convertir a ISO
                    const d = new Date(Math.round((val - 25569) * 86400 * 1000));
                    out[key] = isNaN(d) ? '' : d.toISOString().slice(0, 10);
                } else {
                    out[key] = val instanceof Date
                        ? val.toISOString().slice(0,10)
                        : String(val).trim();
                }
            }
        }
        return out;
    }

    function renderPreview(rows, existingDnis) {
        const existing = DB.get('patients').map(p => p.dni);
        const dupeSet = new Set(existing);
        let html = `<div style="max-height:320px;overflow-y:auto;margin-top:12px">
        <table style="width:100%;border-collapse:collapse;font-size:12px">
            <thead style="position:sticky;top:0;background:var(--surface,#fff)">
                <tr>
                    <th style="padding:6px 8px;text-align:left;border-bottom:1px solid var(--border)">Estado</th>
                    <th style="padding:6px 8px;text-align:left;border-bottom:1px solid var(--border)">Nombre</th>
                    <th style="padding:6px 8px;text-align:left;border-bottom:1px solid var(--border)">DNI</th>
                    <th style="padding:6px 8px;text-align:left;border-bottom:1px solid var(--border)">Teléfono</th>
                    <th style="padding:6px 8px;text-align:left;border-bottom:1px solid var(--border)">Obra social</th>
                </tr>
            </thead><tbody>`;
        let willImport = 0, willUpdate = 0, willSkip = 0, willError = 0;
        const seenDnis = new Set();
        // Mapa de paciente local para detectar cuáles se pueden completar
        const localPatientMap = new Map(DB.get('patients').map(p => [String(p.dni).replace(/\D/g,''), p]));
        for (const row of rows) {
            const mapped = mapRow(row);
            const dniClean = mapped.dni ? String(mapped.dni).replace(/\D/g,'') : '';
            const isDupe = dniClean && (dupeSet.has(dniClean) || seenDnis.has(dniClean));
            const noName  = !mapped.fullName;
            const noDni   = !mapped.dni;
            const noPhone = !mapped.phone;
            if (dniClean) seenDnis.add(dniClean);
            let badge, rowStyle;
            if (noName || noDni || noPhone) {
                const missing = [noName && 'nombre', noDni && 'DNI', noPhone && 'teléfono'].filter(Boolean).join(', ');
                badge = `<span style="background:#fee2e2;color:#991b1b;padding:2px 6px;border-radius:4px;font-size:10px;font-weight:600" title="Falta: ${missing}">Error</span>`;
                rowStyle = 'background:rgba(239,68,68,0.04)';
                willError++;
            } else if (isDupe) {
                // Verificar si el paciente local tiene campos vacíos que el Excel puede completar
                const local = localPatientMap.get(dniClean);
                const canFill = local && ['phone','email','address','insuranceName'].some(f => !local[f] && mapped[f === 'insuranceName' ? 'insuranceName' : f]);
                if (canFill) {
                    badge = `<span style="background:#dbeafe;color:#1e40af;padding:2px 6px;border-radius:4px;font-size:10px;font-weight:600" title="Se completarán datos faltantes">Actualizar</span>`;
                    rowStyle = 'background:rgba(59,130,246,0.04)';
                    willUpdate++;
                } else {
                    badge = `<span style="background:#fef3c7;color:#92400e;padding:2px 6px;border-radius:4px;font-size:10px;font-weight:600">Duplicado</span>`;
                    rowStyle = 'background:rgba(245,158,11,0.06)';
                    willSkip++;
                }
            } else {
                badge = `<span style="background:#d1fae5;color:#065f46;padding:2px 6px;border-radius:4px;font-size:10px;font-weight:600">Nuevo</span>`;
                rowStyle = '';
                willImport++;
            }
            html += `<tr style="${rowStyle}">
                <td style="padding:5px 8px;border-bottom:1px solid var(--border)">${badge}</td>
                <td style="padding:5px 8px;border-bottom:1px solid var(--border)">${mapped.fullName || '<i style="color:#9ca3af">Sin nombre</i>'}</td>
                <td style="padding:5px 8px;border-bottom:1px solid var(--border);font-family:monospace">${mapped.dni || '<i style="color:#9ca3af">Sin DNI</i>'}</td>
                <td style="padding:5px 8px;border-bottom:1px solid var(--border)">${mapped.phone || '—'}</td>
                <td style="padding:5px 8px;border-bottom:1px solid var(--border)">${mapped.insuranceName || '—'}</td>
            </tr>`;
        }
        html += `</tbody></table></div>
        <div style="display:flex;gap:12px;margin-top:10px;font-size:12px;font-weight:600;flex-wrap:wrap">
            ${willImport ? `<span style="color:#065f46"><i class="fa-solid fa-circle-check"></i> ${willImport} para importar</span>` : ''}
            ${willUpdate ? `<span style="color:#1e40af"><i class="fa-solid fa-pen-to-square"></i> ${willUpdate} para actualizar</span>` : ''}
            ${willSkip   ? `<span style="color:#92400e"><i class="fa-solid fa-triangle-exclamation"></i> ${willSkip} duplicado${willSkip!==1?'s':''}</span>` : ''}
            ${willError  ? `<span style="color:#991b1b"><i class="fa-solid fa-circle-xmark"></i> ${willError} con error</span>` : ''}
        </div>`;
        return { html, willImport: willImport + willUpdate };
    }

    let _parsedRows = [];

    const modal = document.createElement('div');
    modal.className = 'modal-overlay active';
    modal.innerHTML = `
    <div class="modal-content" style="max-width:680px;width:95vw;margin-top:2rem">
        <div class="modal-header">
            <h3 class="modal-title"><i class="fa-solid fa-file-excel" style="color:#16a34a"></i> Importar pacientes desde Excel</h3>
            <button class="modal-close" id="import-modal-close"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div class="modal-body">
            <div id="import-dropzone" style="border:2px dashed var(--border);border-radius:10px;padding:32px;text-align:center;cursor:pointer;transition:border-color .15s">
                <i class="fa-solid fa-cloud-arrow-up" style="font-size:2rem;color:#6366f1;margin-bottom:8px"></i>
                <div style="font-weight:600;margin-bottom:4px">Arrastrá tu archivo Excel o CSV aquí</div>
                <div style="font-size:12px;color:#6b7280">Formatos: .xlsx, .xls, .csv — columnas: Nombre, DNI, Teléfono, Email, Obra Social, Plan, Dirección, Nacimiento</div>
                <input type="file" id="import-file-input" accept=".xlsx,.xls,.csv" style="display:none">
                <button class="btn btn-secondary mt-4" id="import-pick-file" style="margin-top:12px"><i class="fa-solid fa-folder-open"></i> Elegir archivo</button>
            </div>
            <div id="import-preview"></div>
        </div>
        <div class="modal-footer">
            <a href="#" id="import-download-template" style="font-size:12px;color:#6366f1;text-decoration:none;margin-right:auto"><i class="fa-solid fa-download"></i> Descargar plantilla</a>
            <button class="btn btn-ghost" id="import-cancel">Cancelar</button>
            <button class="btn btn-primary" id="import-confirm" disabled><i class="fa-solid fa-file-import"></i> Importar</button>
        </div>
    </div>`;

    document.body.appendChild(modal);

    const fileInput = modal.querySelector('#import-file-input');
    const dropzone  = modal.querySelector('#import-dropzone');
    const preview   = modal.querySelector('#import-preview');
    const confirmBtn = modal.querySelector('#import-confirm');

    function close() { modal.classList.remove('active'); setTimeout(() => modal.remove(), 200); }
    modal.addEventListener('click', e => { if (e.target === modal) close(); });
    modal.querySelector('#import-modal-close').onclick = close;
    modal.querySelector('#import-cancel').onclick = close;
    modal.querySelector('#import-pick-file').onclick = () => fileInput.click();

    // Plantilla descargable
    modal.querySelector('#import-download-template').onclick = e => {
        e.preventDefault();
        const ws = XLSX.utils.aoa_to_sheet([
            ['Nombre','DNI','Teléfono','Email','Dirección','Obra Social','Plan','Credencial','Historia','Nacimiento'],
            ['Juan Pérez','12345678','2613001234','juan@mail.com','Av. San Martín 100','OSDE','210','12345','HC001','1985-03-15'],
        ]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Pacientes');
        XLSX.writeFile(wb, 'plantilla_pacientes.xlsx');
    };

    // Drag & drop
    dropzone.addEventListener('dragover', e => { e.preventDefault(); dropzone.style.borderColor='#6366f1'; });
    dropzone.addEventListener('dragleave', () => { dropzone.style.borderColor=''; });
    dropzone.addEventListener('drop', e => {
        e.preventDefault();
        dropzone.style.borderColor='';
        if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
    });
    fileInput.addEventListener('change', () => { if (fileInput.files[0]) handleFile(fileInput.files[0]); });

    async function handleFile(file) {
        preview.innerHTML = '<div style="padding:16px;text-align:center;color:#6b7280"><i class="fa-solid fa-spinner fa-spin"></i> Procesando...</div>';
        confirmBtn.disabled = true;
        try {
            _parsedRows = await parseSheet(file);
            if (_parsedRows.length === 0) {
                preview.innerHTML = '<div style="color:#ef4444;padding:12px">El archivo está vacío o no tiene el formato correcto.</div>';
                return;
            }
            const { html, willImport } = renderPreview(_parsedRows);
            preview.innerHTML = `<div style="margin-top:8px;font-size:12px;color:#6b7280">${file.name} — ${_parsedRows.length} fila${_parsedRows.length!==1?'s':''}</div>` + html;
            confirmBtn.disabled = willImport === 0;
        } catch(err) {
            preview.innerHTML = `<div style="color:#ef4444;padding:12px">Error al leer el archivo: ${err.message}</div>`;
        }
    }

    confirmBtn.onclick = async () => {
        if (_parsedRows.length === 0) return;
        confirmBtn.disabled = true;
        confirmBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Importando...';
        // Enviar todas las filas válidas; el backend descarta duplicados
        const seenDnis = new Set();
        const patients = _parsedRows.map(mapRow).filter(r => {
            if (!r.fullName || !r.dni || !r.phone) return false;
            const dni = String(r.dni).replace(/\D/g, '');
            if (seenDnis.has(dni)) return false;
            seenDnis.add(dni);
            return true;
        });
        try {
            const res = await apiFetch('/patients/import', { method: 'POST', body: JSON.stringify({ patients }) });
            if (!res.ok) throw new Error(res.error || 'Error al importar');
            await syncBackendSnapshotToLocalDb();
            close();
            refreshCurrentView();
            const parts = [];
            if (res.created) parts.push(`${res.created} paciente${res.created!==1?'s':''} importado${res.created!==1?'s':''}`);
            if (res.updated) parts.push(`${res.updated} paciente${res.updated!==1?'s':''} modificado${res.updated!==1?'s':''}`);
            if (res.skipped) parts.push(`${res.skipped} omitido${res.skipped!==1?'s':''}`);
            showToast(`✓ ${parts.join(' · ')}`, { type: 'success', duration: 7000 });
        } catch(err) {
            showToast(err.message, 'error');
            confirmBtn.disabled = false;
            confirmBtn.innerHTML = '<i class="fa-solid fa-file-import"></i> Importar';
        }
    };
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
                        <div class="form-feedback" id="patient-form-feedback" hidden></div>
                        <div class="input-group"><label>Nombre y Apellido *</label><input type="text" id="p-name" value="${p?escapeHtml(p.name):''}" required></div>
                        <div class="patient-form-row patient-form-row-2">
                            <div class="input-group flex-1"><label>DNI *</label><input type="text" id="p-dni" value="${p?escapeHtml(p.dni||''):''}" required></div>
                            <div class="input-group flex-1"><label>Teléfono (Celular) *</label><input type="text" id="p-phone" value="${p?escapeHtml(p.phone||''):''}" required></div>
                        </div>
                        <div class="patient-form-row patient-form-row-2">
                            <div class="input-group flex-1"><label>Fecha de Nacimiento</label><input type="date" id="p-nacimiento" value="${p?escapeHtml(p.fechaNacimiento||''):''}"></div>
                            <div class="input-group flex-1"><label>Email</label><input type="email" id="p-email" value="${p?escapeHtml(p.email||''):''}"></div>
                        </div>
                        <div class="input-group"><label>Domicilio</label><input type="text" id="p-domicilio" value="${p?escapeHtml(p.domicilio||''):''}"></div>
                        <div class="patient-form-row patient-form-row-3">
                            <div class="input-group flex-1"><label>Obra Social / Plan</label><input type="text" id="p-obrasocial" value="${p?escapeHtml(p.obraSocial||''):''}"></div>
                            <div class="input-group flex-1"><label>Credencial</label><input type="text" id="p-credencial" value="${p?escapeHtml(p.credencial||''):''}"></div>
                            <div class="input-group flex-1"><label>Ficha N°</label><input type="text" id="p-ficha" value="${p?escapeHtml(p.fichaNumero||''):''}"></div>
                        </div>
                        <div class="input-group"><label>Observaciones Médicas / Alergias</label><input type="text" id="p-notes" value="${p?escapeHtml(p.notes||''):''}"></div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-ghost" onclick="closeModal()">Cancelar</button>
                        <button type="submit" class="btn btn-primary">Guardar Paciente</button>
                    </div>
                </form>
            </div>
        </div>
    `;

    // ESC cierra el modal
    const _escHandler = (e) => {
        if (e.key !== 'Escape') return;
        closeModal();
    };
    document.addEventListener('keydown', _escHandler, { once: true });
    const patientForm = document.getElementById('patient-form');

    // Al editar, cargar las notas desde el ClinicalRecord
    if (editId && state.authToken) {
        const _profId = getCurrentOdontoProfessionalId() || getAccessibleProfessionals()[0]?.id || null;
        const _url = _profId ? `/clinical-records/${editId}?professionalId=${_profId}` : null;
        if (_url) {
            apiFetch(_url).then(res => {
                const notesField = document.getElementById('p-notes');
                if (notesField && res?.record?.summaryNotes) {
                    notesField.value = res.record.summaryNotes;
                }
            }).catch(() => {});
        }
    }

    ['#p-name', '#p-dni', '#p-phone', '#p-email'].forEach((selector) => {
        const field = patientForm.querySelector(selector);
        if (!field) return;

        field.addEventListener('input', () => {
            if (field.classList.contains('input-invalid')) {
                clearFormValidation(patientForm);
            }
        });
    });

    patientForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const validation = await validatePatientForm(patientForm, editId);
        if (!validation.ok) {
            return;
        }

        const data = {
            name: document.getElementById('p-name').value,
            dni: validation.normalizedDni,
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
            await withAppLoading(editId ? 'Actualizando paciente...' : 'Guardando paciente...', async () => {
                if (state.authToken) {
                    const payload = buildPatientApiPayload(data);
                    let targetPatientId = editId;
                    if (editId) {
                        await apiFetch(`/patients/${editId}`, {
                            method: 'PUT',
                            body: JSON.stringify(payload)
                        });
                    } else {
                        const res = await apiFetch('/patients', {
                            method: 'POST',
                            body: JSON.stringify(payload)
                        });
                        targetPatientId = res?.patient?.id || null;
                    }
                    // Guardar notas en el ClinicalRecord (requiere professionalId)
                    const _profId = getCurrentOdontoProfessionalId() || getAccessibleProfessionals()[0]?.id || null;
                    if (targetPatientId && _profId && data.notes !== undefined) {
                        await apiFetch(`/clinical-records/${targetPatientId}`, {
                            method: 'PUT',
                            body: JSON.stringify({ professionalId: _profId, summaryNotes: data.notes || null })
                        });
                    }
                    await syncBackendSnapshotToLocalDb();
                } else {
                    if (editId) DB.update('patients', editId, data); else DB.add('patients', data);
                }
            });

            closeModal();
            refreshCurrentView();
        } catch (error) {
            const mapped = applyPatientApiErrorToForm(patientForm, error);
            if (!mapped) {
                showFormFeedback(patientForm, error.message || 'No se pudo guardar el paciente.');
            }
        }
    });
}

function renderPatients() {
    const patients = getAccessiblePatients().sort((a,b)=>a.name.localeCompare(b.name));
    const canCreate = canCreatePatientUi();
    const emptyState = patients.length === 0 ? `
        <div class="patients-empty-state">
            <div class="patients-empty-icon">
                <i class="fa-solid fa-users"></i>
            </div>
            <h3 class="patients-empty-title">Todavía no hay pacientes cargados</h3>
            <p class="patients-empty-sub">Podés agregar pacientes de dos maneras:</p>
            <div class="patients-empty-methods">
                <div class="patients-empty-method">
                    <div class="patients-empty-method-icon">
                        <i class="fa-solid fa-user-plus"></i>
                    </div>
                    <div>
                        <strong>Uno por uno</strong>
                        <p>Hacé clic en <em>Nuevo Paciente</em> y completá el formulario con los datos del paciente (nombre, DNI, teléfono, etc.).</p>
                    </div>
                </div>
                <div class="patients-empty-method">
                    <div class="patients-empty-method-icon patients-empty-method-icon--excel">
                        <i class="fa-solid fa-file-excel"></i>
                    </div>
                    <div>
                        <strong>Importar desde Excel</strong>
                        <p>Usá la plantilla de Excel para cargar múltiples pacientes a la vez. Descargá la plantilla desde <em>Exportar Excel</em>, completala y luego importala con <em>Importar Excel</em>.</p>
                    </div>
                </div>
            </div>
            ${canCreate ? `
            <div class="patients-empty-actions">
                <button class="btn btn-primary" id="btn-add-patient-empty"><i class="fa-solid fa-user-plus"></i> Nuevo Paciente</button>
                <button class="btn btn-secondary" id="btn-import-patients-empty"><i class="fa-solid fa-file-excel"></i> Importar Excel</button>
            </div>` : ''}
        </div>
    ` : '';
    return `
        <div class="card mb-6 section-hero-card section-hero-inline">
            <div class="section-hero-copy">
                <span class="section-eyebrow">Pacientes</span>
                <h3 class="section-title">Registro de Pacientes</h3>
                <p class="section-subtitle">Visualiza, edita y administra los datos base de cada paciente.</p>
            </div>
            ${canCreate ? `
            <div class="flex gap-2 flex-wrap">
                <button class="btn btn-primary" id="btn-add-patient"><i class="fa-solid fa-user-plus"></i> Nuevo Paciente</button>
                <button class="btn btn-secondary" id="btn-import-patients"><i class="fa-solid fa-file-excel"></i> Importar Excel</button>
                <button class="btn btn-secondary" id="btn-export-patients" onclick="exportPatients()"><i class="fa-solid fa-file-arrow-down"></i> Exportar Excel</button>
            </div>` : ''}
        </div>
        ${patients.length > 0 ? `
        <div class="patient-search-shell mb-4">
            <i class="fa-solid fa-magnifying-glass patient-search-icon"></i>
            <input type="search" id="search-patient" placeholder="Buscar pacientes por nombre o DNI..." class="form-input w-full border text-sm">
        </div>
        <div class="table-container table-container-patients shadow-sm">
            <div class="patients-scroll-inner">
                <table class="w-full text-left" id="patients-table">
                    <thead><tr><th>Paciente</th><th>Contacto</th><th>DNI</th><th>Acciones</th></tr></thead>
                    <tbody>
                        ${patients.map((p, i) => `
                            <tr style="animation-delay:${Math.min(i * 35, 350)}ms">
                                <td class="font-medium flex items-center gap-3" data-label="Paciente">
                                    <div class="patient-list-avatar">${p.name.split(' ').filter(Boolean).slice(0,2).map(w=>w[0]).join('').toUpperCase()}</div>
                                    ${escapeHtml(p.name)}
                                </td>
                                <td data-label="Contacto">
                                    <span class="block text-sm text-gray-600" style="margin-bottom:4px;"><i class="fa-solid fa-phone mr-1"></i> ${escapeHtml(p.phone)}</span>
                                    <span class="block text-xs text-gray-400"><i class="fa-solid fa-envelope mr-1"></i> ${escapeHtml(p.email || 'Sin email')}</span>
                                </td>
                                <td class="text-sm font-semibold" data-label="DNI">${p.dni}</td>
                                <td data-label="Acciones" class="table-actions-cell">
                                    <div class="flex gap-2 patient-actions">
                                        ${canViewClinicalHistoryUi() ? `<button class="btn btn-ghost p-1 btn-view-history" data-id="${p.id}" title="Historia Clínica"><i class="fa-solid fa-file-medical text-purple-600"></i></button>` : ''}
                                        ${canEditPatientUi() ? `<button class="btn btn-ghost p-1 btn-edit-patient" data-id="${p.id}" title="Editar"><i class="fa-solid fa-pen text-primary-600"></i></button>` : ''}
                                        ${isSuperadmin() ? `<button class="btn btn-ghost p-1 btn-delete-patient" data-id="${p.id}" title="Eliminar"><i class="fa-solid fa-trash text-danger"></i></button>` : ''}
                                        ${canViewPatientBillingUi() ? `<button class="btn btn-ghost p-1 btn-view-patient-billing" data-id="${p.id}" title="Cuenta Corriente"><i class="fa-solid fa-wallet text-emerald-600"></i></button>` : ''}
                                    </div>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>` : emptyState}
    `;
}
