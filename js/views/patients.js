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
function openPatientImportModal(initialMode = 'file') {
    if (typeof XLSX === 'undefined') {
        const script = document.createElement('script');
        script.src = '/xlsx.full.min.js';
        script.onload = () => openPatientImportModal(initialMode);
        script.onerror = () => showAlert('No se pudo cargar la librería para leer Excel. Verificá tu conexión a internet.', { title: 'Error', variant: 'error' });
        document.head.appendChild(script);
        return;
    }

    // ── Helpers de normalización / detección de columnas ──────────────────────
    function normalize(s) {
        return String(s || '').trim().toLowerCase()
            .replace(/[áàäâ]/g, 'a').replace(/[éèëê]/g, 'e').replace(/[íìïî]/g, 'i')
            .replace(/[óòöô]/g, 'o').replace(/[úùüû]/g, 'u').replace(/ñ/g, 'n');
    }

    // Campos mapeables (el orden define la UI de mapeo)
    const FIELDS = [
        { key: 'apellido',         label: 'Apellido' },
        { key: 'nombre',           label: 'Nombre' },
        { key: 'dni',              label: 'DNI' },
        { key: 'phone',            label: 'Teléfono' },
        { key: 'email',            label: 'Email' },
        { key: 'insuranceName',    label: 'Obra Social' },
        { key: 'insurancePlan',    label: 'Plan' },
        { key: 'address',          label: 'Domicilio' },
        { key: 'credentialNumber', label: 'Credencial' },
        { key: 'chartNumber',      label: 'N° Historia' },
        { key: 'birthDate',        label: 'Nacimiento' },
    ];

    // Alias exactos por campo para autodetección
    const AUTO = {
        apellido:         ['apellido', 'apellidos'],
        nombre:           ['nombre', 'nombres', 'nombre completo', 'nombre y apellido', 'apellido y nombre', 'paciente'],
        dni:              ['dni', 'documento', 'doc', 'nro documento', 'n documento', 'nro doc'],
        phone:            ['telefono', 'tel', 'celular', 'cel', 'movil', 'contacto', 'telefono celular'],
        email:            ['email', 'correo', 'mail', 'e-mail', 'correo electronico'],
        insuranceName:    ['obra social', 'obrasocial', 'mutual', 'cobertura', 'os', 'prepaga'],
        insurancePlan:    ['plan'],
        address:          ['direccion', 'domicilio', 'dir'],
        credentialNumber: ['credencial', 'nro credencial', 'n credencial', 'afiliado', 'nro afiliado'],
        chartNumber:      ['historia', 'nro historia', 'historia clinica', 'ficha', 'nro ficha', 'hc'],
        birthDate:        ['nacimiento', 'fecha nacimiento', 'fecha de nacimiento', 'nac', 'fec nac'],
    };

    function autoDetect(headers) {
        const used = new Set();
        const mapping = {};
        // 1) match exacto
        for (const f of Object.keys(AUTO)) {
            for (const h of headers) {
                if (used.has(h)) continue;
                if (AUTO[f].includes(normalize(h))) { mapping[f] = h; used.add(h); break; }
            }
        }
        // 2) fallback por "contiene" para los campos clave
        const CONTAINS = { nombre: ['nombre', 'paciente'], apellido: ['apellido'], dni: ['dni', 'documento', 'doc'], phone: ['tel', 'cel', 'movil', 'contacto'] };
        for (const f of Object.keys(CONTAINS)) {
            if (mapping[f]) continue;
            for (const h of headers) {
                if (used.has(h)) continue;
                const nh = normalize(h);
                if (CONTAINS[f].some(a => nh.includes(a))) { mapping[f] = h; used.add(h); break; }
            }
        }
        return mapping;
    }

    function excelDate(val) {
        const d = new Date(Math.round((val - 25569) * 86400 * 1000));
        return isNaN(d) ? '' : d.toISOString().slice(0, 10);
    }

    // Convierte una fila cruda del Excel al formato de paciente, según el mapeo
    function mapWith(raw, mapping) {
        const g = (f) => (mapping[f] != null ? raw[mapping[f]] : undefined);
        const str = (f) => { const v = g(f); return v == null ? '' : String(v).trim(); };
        const fullName = [g('apellido'), g('nombre')]
            .map(v => (v == null ? '' : String(v).trim())).filter(Boolean).join(' ');
        let birthDate = '';
        const bv = g('birthDate');
        if (bv instanceof Date) birthDate = bv.toISOString().slice(0, 10);
        else if (typeof bv === 'number') birthDate = excelDate(bv);
        else if (bv != null) birthDate = String(bv).trim();
        return {
            fullName,
            dni: String(g('dni') ?? '').replace(/\D/g, ''),
            phone: String(g('phone') ?? '').replace(/[^\d+]/g, ''),
            email: str('email').toLowerCase(),
            address: str('address'),
            insuranceName: str('insuranceName'),
            insurancePlan: str('insurancePlan'),
            credentialNumber: str('credentialNumber'),
            chartNumber: str('chartNumber'),
            birthDate,
        };
    }

    function parseSheet(file) {
        return new Promise((resolve, reject) => {
            const isCsv = file.name.toLowerCase().endsWith('.csv');
            const reader = new FileReader();
            reader.onload = e => {
                try {
                    const wb = isCsv
                        ? XLSX.read(e.target.result, { type: 'string' })
                        : XLSX.read(e.target.result, { type: 'array', cellDates: true });
                    const ws = wb.Sheets[wb.SheetNames[0]];
                    resolve(XLSX.utils.sheet_to_json(ws, { defval: '' }));
                } catch (err) { reject(err); }
            };
            reader.onerror = reject;
            if (isCsv) reader.readAsText(file, 'UTF-8'); else reader.readAsArrayBuffer(file);
        });
    }

    // Redimensiona una imagen a máx 1600px y la devuelve como JPEG base64.
    // Antes era 2000px @ 0.85 de calidad: con hasta 10 fotos de una ficha
    // manuscrita eso rondaba 3-4MB cada una y en base64 (+33%) el lote entero
    // superaba fácil el límite del servidor, y el error llegaba como
    // "Error interno del servidor" sin explicar qué pasó. 1600px @ 0.78 sigue
    // siendo perfectamente legible para que la IA lea texto manuscrito.
    // Reduce la foto antes de mandarla. La versión anterior usaba
    // FileReader.readAsDataURL, que materializa la foto ORIGINAL entera como
    // texto base64 (una de 4 MB pasa a ~5,5 MB de string) solo para poder
    // decodificarla. En un celular, con varias fotos seguidas, eso agotaba la
    // memoria y el canvas empezaba a fallar — de ahí que entraran 8 de 10.
    // createImageBitmap decodifica desde el File directamente, sin copia
    // intermedia; el objectURL es el plan B para navegadores que no lo tengan.
    async function resizeImage(file) {
        const MAX = 1600;
        let bitmap = null;
        let objectUrl = null;
        let canvas = null;

        try {
            let source;
            if (typeof createImageBitmap === 'function') {
                bitmap = await createImageBitmap(file);
                source = bitmap;
            } else {
                objectUrl = URL.createObjectURL(file);
                source = await new Promise((resolve, reject) => {
                    const img = new Image();
                    img.onload = () => resolve(img);
                    img.onerror = () => reject(new Error('El navegador no pudo abrir la imagen.'));
                    img.src = objectUrl;
                });
            }

            let width = source.width;
            let height = source.height;
            if (!width || !height) throw new Error('La imagen no tiene dimensiones válidas.');
            if (width > MAX || height > MAX) {
                const r = Math.min(MAX / width, MAX / height);
                width = Math.round(width * r);
                height = Math.round(height * r);
            }

            canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (!ctx) throw new Error('El navegador no pudo preparar la imagen.');
            ctx.drawImage(source, 0, 0, width, height);

            const dataUrl = canvas.toDataURL('image/jpeg', 0.78);
            // Sin memoria suficiente, algunos navegadores móviles no lanzan
            // error: devuelven un canvas en blanco o una cadena mínima. Se
            // detecta acá para que no entre una foto vacía como si fuera válida.
            if (!dataUrl || dataUrl.length < 1000) {
                throw new Error('El navegador se quedó sin memoria al procesar la imagen.');
            }
            // Se guarda solo el base64: el dataUrl se arma cuando hace falta.
            // Antes se guardaban los dos y cada foto ocupaba el doble en memoria.
            return { mediaType: 'image/jpeg', data: dataUrl.split(',')[1] };
        } finally {
            if (bitmap?.close) bitmap.close();
            if (objectUrl) URL.revokeObjectURL(objectUrl);
            // Liberar el canvas explícitamente ayuda en móviles con poca memoria.
            if (canvas) { canvas.width = 0; canvas.height = 0; }
        }
    }

    function photoDataUrl(img) {
        return `data:${img.mediaType};base64,${img.data}`;
    }

    // ── Estado ────────────────────────────────────────────────────────────────
    let _mode = 'file';           // 'file' | 'photo'
    let _rawRows = [];            // filas crudas del Excel
    let _headers = [];            // encabezados del Excel
    let _colMapping = {};         // { campo: encabezado }
    let _photoImages = [];        // [{mediaType, data, dataUrl}]
    let _reviewRows = [];         // pacientes extraídos por foto (editables)
    let _photoBusy = false;       // procesando imágenes (redimensionado)
    let _extractBusy = false;     // extracción con IA en curso

    // Tope de imágenes que acepta la UI. La lectura se hace por tandas (ver
    // extractPhotoBatch), así que el total no influye en cuánto tarda cada
    // request: subir esto a 14-15 no requiere tocar nada más.
    const PHOTO_MAX_IMAGES = 10;
    // Imágenes por request. Con 2 cada tanda contesta en decenas de segundos,
    // bien lejos del corte del proxy.
    const PHOTO_BATCH_SIZE = 2;

    // ── Construcción del modal ─────────────────────────────────────────────────
    // Cada botón lleva a su propia ventana dedicada: "Importar con IA" abre
    // directo en modo foto (sin pestañas ni opción de cambiar a Excel), e
    // "Importar Excel" abre directo en modo archivo. Son dos experiencias
    // separadas, no una sola ventana con tabs para elegir.
    const isPhotoMode = initialMode === 'photo';
    const modal = document.createElement('div');
    modal.className = 'modal-overlay active';
    modal.innerHTML = `
    <div class="modal-content" style="max-width:760px;width:96vw;margin-top:1.5rem">
        <div class="modal-header">
            <h3 class="modal-title">${isPhotoMode
                ? '<i class="fa-solid fa-wand-magic-sparkles" style="color:#6366f1"></i> Importar con IA'
                : '<i class="fa-solid fa-file-excel" style="color:#22c55e"></i> Importar desde Excel'}</h3>
            <button class="modal-close-x" id="import-modal-close"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div class="import-tabs" id="import-tabs-bar" style="display:none;gap:6px;padding:0 20px;border-bottom:1px solid var(--border)">
            <button class="import-tab is-active" data-mode="file" style="padding:11px 16px;border:none;background:none;font-weight:600;font-size:13px;color:var(--gray-700,#374151);border-bottom:2px solid #6366f1;cursor:pointer;margin-bottom:-1px">
                <i class="fa-solid fa-file-excel"></i> Desde archivo
            </button>
            <button class="import-tab" data-mode="photo" id="import-tab-photo" hidden style="padding:11px 16px;border:none;background:none;font-weight:600;font-size:13px;color:var(--gray-400,#9ca3af);border-bottom:2px solid transparent;cursor:pointer;margin-bottom:-1px">
                <i class="fa-solid fa-camera"></i> Desde foto
            </button>
        </div>
        <div class="modal-body" style="min-height:200px">
            <!-- Panel: archivo -->
            <div id="panel-file">
                <div id="import-dropzone" style="border:2px dashed var(--border);border-radius:10px;padding:28px;text-align:center;cursor:pointer;transition:border-color .15s">
                    <i class="fa-solid fa-cloud-arrow-up" style="font-size:1.8rem;color:#6366f1;margin-bottom:8px"></i>
                    <div style="font-weight:600;margin-bottom:4px">Arrastrá tu Excel o CSV, o elegí el archivo</div>
                    <div style="font-size:12px;color:#6b7280">Aceptamos cualquier planilla — después te dejamos ajustar qué columna es cada dato.</div>
                    <input type="file" id="import-file-input" accept=".xlsx,.xls,.csv" style="display:none">
                    <button class="btn btn-secondary" id="import-pick-file" style="margin-top:12px"><i class="fa-solid fa-folder-open"></i> Elegir archivo</button>
                </div>
                <div id="import-mapping"></div>
                <div id="import-preview"></div>
            </div>
            <!-- Panel: foto -->
            <div id="panel-photo" hidden>
                <div id="photo-dropzone" style="border:2px dashed var(--border);border-radius:10px;padding:28px;text-align:center;cursor:pointer;transition:border-color .15s">
                    <i class="fa-solid fa-camera" style="font-size:1.8rem;color:#6366f1;margin-bottom:8px"></i>
                    <div style="font-weight:600;margin-bottom:4px">Sacá o subí fotos de la ficha o el listado</div>
                    <div style="font-size:12px;color:#6b7280">Hasta 10 imágenes. La IA lee los datos y vos los revisás antes de importar.</div>
                    <!-- Sin "capture": así el navegador ofrece elegir entre Cámara y Galería
                         (con capture="environment" salta directo a la cámara y no deja elegir). -->
                    <input type="file" id="photo-file-input" accept="image/*" multiple style="display:none">
                    <button class="btn btn-secondary" id="photo-pick-file" style="margin-top:12px"><i class="fa-solid fa-image"></i> Elegir imágenes</button>
                </div>
                <div id="photo-thumbs" style="display:flex;flex-wrap:wrap;gap:8px;margin-top:12px"></div>
                <div id="photo-extract-bar" style="margin-top:12px" hidden>
                    <button class="btn btn-primary" id="photo-extract-btn" style="width:100%"><i class="fa-solid fa-wand-magic-sparkles"></i> Extraer datos con IA</button>
                    <div style="font-size:11px;color:#6b7280;text-align:center;margin-top:6px">Las imágenes se envían a un servicio de IA para leer los datos. Revisá siempre antes de importar.</div>
                </div>
                <div id="photo-review"></div>
            </div>
        </div>
        <div class="modal-footer">
            <a href="#" id="import-download-template" style="font-size:12px;color:#6366f1;text-decoration:none;margin-right:auto"><i class="fa-solid fa-download"></i> Descargar plantilla</a>
            <button class="btn btn-ghost" id="import-cancel">Cancelar</button>
            <button class="btn btn-primary" id="import-confirm" disabled><i class="fa-solid fa-file-import"></i> Importar</button>
        </div>
    </div>`;
    document.body.appendChild(modal);

    const $ = sel => modal.querySelector(sel);
    const confirmBtn = $('#import-confirm');
    const panelFile = $('#panel-file');
    const panelPhoto = $('#panel-photo');

    function close() { modal.classList.remove('active'); setTimeout(() => modal.remove(), 200); }
    modal.addEventListener('click', e => { if (e.target === modal) close(); });
    $('#import-modal-close').onclick = close;
    $('#import-cancel').onclick = close;

    // Plantilla descargable
    $('#import-download-template').onclick = e => {
        e.preventDefault();
        const ws = XLSX.utils.aoa_to_sheet([
            ['Nombre', 'DNI', 'Teléfono', 'Email', 'Dirección', 'Obra Social', 'Plan', 'Credencial', 'Historia', 'Nacimiento'],
            ['Juan Pérez', '12345678', '2613001234', 'juan@mail.com', 'Av. San Martín 100', 'OSDE', '210', '12345', 'HC001', '1985-03-15'],
        ]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Pacientes');
        XLSX.writeFile(wb, 'plantilla_pacientes.xlsx');
    };

    // ── Tabs ────────────────────────────────────────────────────────────────
    function applyMode(mode) {
        _mode = mode;
        modal.querySelectorAll('.import-tab').forEach(t => {
            const active = t.dataset.mode === mode;
            t.classList.toggle('is-active', active);
            t.style.color = active ? 'var(--gray-700,#374151)' : 'var(--gray-400,#9ca3af)';
            t.style.borderBottomColor = active ? '#6366f1' : 'transparent';
        });
        panelFile.hidden = mode !== 'file';
        panelPhoto.hidden = mode !== 'photo';
        $('#import-download-template').style.visibility = mode === 'file' ? '' : 'hidden';
        recomputeConfirm();
    }
    modal.querySelectorAll('.import-tab').forEach(tab => {
        tab.onclick = () => applyMode(tab.dataset.mode);
    });

    // La pestaña "Desde foto" siempre está visible (hay un botón dedicado "Importar con IA").
    // El estado depende del plan de la clínica y de la cuota mensual — se muestra el mensaje adecuado.
    $('#import-tab-photo').hidden = false;
    apiFetch('/patients/extract-photo/status').then(r => {
        const dz = $('#photo-dropzone');
        if (!dz) return;
        if (r && r.available) {
            // Disponible: mostrar cupo restante del mes (si el plan tiene límite)
            const q = r.quota;
            if (q && q.remaining !== null && q.limit !== null) {
                const bar = document.createElement('div');
                bar.style.cssText = 'font-size:12px;color:#6b7280;margin-top:10px;text-align:center';
                bar.innerHTML = `<i class="fa-solid fa-gauge-high" style="color:#6366f1"></i> Te quedan <b>${q.remaining}</b> de ${q.limit} importaciones con IA este mes.`;
                $('#panel-photo').appendChild(bar);
            }
            return;
        }
        // No disponible: mensaje según el motivo
        const reason = r && r.quota ? r.quota.reason : null;
        let msg;
        if (reason === 'plan-not-included') {
            msg = '<i class="fa-solid fa-lock"></i> Tu plan no incluye la importación con IA. Actualizá al plan <b>Clínica</b> o <b>Pro</b> para activarla.';
        } else if (reason === 'monthly-limit-reached') {
            const lim = r.quota.limit;
            msg = `<i class="fa-solid fa-hourglass-end"></i> Alcanzaste el límite mensual de importación con IA${lim ? ` (${lim} este mes)` : ''}. Se renueva el mes que viene.`;
        } else {
            msg = '<i class="fa-solid fa-triangle-exclamation"></i> La importación con IA no está configurada en el servidor todavía. Contactá al administrador.';
        }
        dz.innerHTML = `<div style="color:#92400e;font-size:13px;padding:8px;line-height:1.5">${msg}</div>`;
    }).catch(() => {});

    // Modo inicial según el botón que abrió el modal ('file' | 'photo')
    applyMode(initialMode === 'photo' ? 'photo' : 'file');

    // ═══════════════════ MODO ARCHIVO ═══════════════════
    const fileInput = $('#import-file-input');
    const dropzone = $('#import-dropzone');
    $('#import-pick-file').onclick = () => fileInput.click();
    dropzone.addEventListener('dragover', e => { e.preventDefault(); dropzone.style.borderColor = '#6366f1'; });
    dropzone.addEventListener('dragleave', () => { dropzone.style.borderColor = ''; });
    dropzone.addEventListener('drop', e => { e.preventDefault(); dropzone.style.borderColor = ''; if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); });
    fileInput.addEventListener('change', () => { if (fileInput.files[0]) handleFile(fileInput.files[0]); });

    async function handleFile(file) {
        $('#import-preview').innerHTML = '<div style="padding:16px;text-align:center;color:#6b7280"><i class="fa-solid fa-spinner fa-spin"></i> Procesando...</div>';
        $('#import-mapping').innerHTML = '';
        try {
            _rawRows = await parseSheet(file);
            if (_rawRows.length === 0) {
                $('#import-preview').innerHTML = '<div style="color:#ef4444;padding:12px">El archivo está vacío o no tiene el formato correcto.</div>';
                return;
            }
            _headers = Object.keys(_rawRows[0]);
            _colMapping = autoDetect(_headers);
            renderMapping(file.name);
            renderFilePreview();
        } catch (err) {
            $('#import-preview').innerHTML = `<div style="color:#ef4444;padding:12px">Error al leer el archivo: ${escapeHtml(err.message)}</div>`;
        }
    }

    function renderMapping(fileName) {
        const opt = (field) => `<option value="">(ninguna)</option>` + _headers.map(h =>
            `<option value="${escapeHtml(h)}" ${_colMapping[field] === h ? 'selected' : ''}>${escapeHtml(h)}</option>`).join('');
        $('#import-mapping').innerHTML = `
            <div style="margin-top:14px;padding:12px;background:var(--gray-50,#f9fafb);border:1px solid var(--border);border-radius:10px">
                <div style="font-size:12px;font-weight:700;color:var(--gray-600,#4b5563);margin-bottom:8px"><i class="fa-solid fa-wand-magic-sparkles" style="color:#6366f1"></i> ${escapeHtml(fileName)} — asigná qué columna es cada dato</div>
                <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px">
                    ${FIELDS.map(f => `
                        <label style="font-size:11px;font-weight:600;color:var(--gray-500,#6b7280)">${f.label}
                            <select data-mapfield="${f.key}" class="form-input" style="width:100%;margin-top:2px;font-size:12px;padding:5px 6px">${opt(f.key)}</select>
                        </label>`).join('')}
                </div>
            </div>`;
        $('#import-mapping').querySelectorAll('select[data-mapfield]').forEach(sel => {
            sel.onchange = () => {
                const field = sel.dataset.mapfield;
                if (sel.value) _colMapping[field] = sel.value; else delete _colMapping[field];
                renderFilePreview();
            };
        });
    }

    function computeStatus(mapped, dupeSet, seenDnis, localMap) {
        const dniClean = mapped.dni ? String(mapped.dni).replace(/\D/g, '') : '';
        const noName = !mapped.fullName, noDni = !mapped.dni, noPhone = !mapped.phone;
        if (noName || noDni || noPhone) {
            const missing = [noName && 'nombre', noDni && 'DNI', noPhone && 'teléfono'].filter(Boolean).join(', ');
            return { kind: 'error', badge: `<span title="Falta: ${missing}" style="background:#fee2e2;color:#991b1b;padding:2px 6px;border-radius:4px;font-size:10px;font-weight:600">Error</span>` };
        }
        const isDupe = dniClean && (dupeSet.has(dniClean) || seenDnis.has(dniClean));
        if (isDupe) {
            const local = localMap.get(dniClean);
            const canFill = local && ['phone', 'email', 'address', 'insuranceName'].some(f => !local[f] && mapped[f]);
            if (canFill) return { kind: 'update', badge: `<span style="background:#dbeafe;color:#1e40af;padding:2px 6px;border-radius:4px;font-size:10px;font-weight:600">Actualizar</span>` };
            return { kind: 'skip', badge: `<span style="background:#fef3c7;color:#92400e;padding:2px 6px;border-radius:4px;font-size:10px;font-weight:600">Duplicado</span>` };
        }
        return { kind: 'new', badge: `<span style="background:#d1fae5;color:#065f46;padding:2px 6px;border-radius:4px;font-size:10px;font-weight:600">Nuevo</span>` };
    }

    function renderFilePreview() {
        const dupeSet = new Set(DB.get('patients').map(p => String(p.dni).replace(/\D/g, '')));
        const localMap = new Map(DB.get('patients').map(p => [String(p.dni).replace(/\D/g, ''), p]));
        const seenDnis = new Set();
        let willImport = 0, willUpdate = 0, willSkip = 0, willError = 0;
        let body = '';
        for (const raw of _rawRows) {
            const mapped = mapWith(raw, _colMapping);
            const st = computeStatus(mapped, dupeSet, seenDnis, localMap);
            const dniClean = mapped.dni ? String(mapped.dni).replace(/\D/g, '') : '';
            if (dniClean) seenDnis.add(dniClean);
            if (st.kind === 'error') willError++;
            else if (st.kind === 'update') willUpdate++;
            else if (st.kind === 'skip') willSkip++;
            else willImport++;
            body += `<tr>
                <td style="padding:5px 8px;border-bottom:1px solid var(--border)">${st.badge}</td>
                <td style="padding:5px 8px;border-bottom:1px solid var(--border)">${escapeHtml(mapped.fullName) || '<i style="color:#9ca3af">—</i>'}</td>
                <td style="padding:5px 8px;border-bottom:1px solid var(--border);font-family:monospace">${escapeHtml(mapped.dni) || '<i style="color:#9ca3af">—</i>'}</td>
                <td style="padding:5px 8px;border-bottom:1px solid var(--border)">${escapeHtml(mapped.phone) || '—'}</td>
                <td style="padding:5px 8px;border-bottom:1px solid var(--border)">${escapeHtml(mapped.insuranceName) || '—'}</td>
            </tr>`;
        }
        $('#import-preview').innerHTML = `
            <div style="max-height:280px;overflow-y:auto;margin-top:12px">
                <table style="width:100%;border-collapse:collapse;font-size:12px">
                    <thead style="position:sticky;top:0;background:var(--surface,#fff)"><tr>
                        <th style="padding:6px 8px;text-align:left;border-bottom:1px solid var(--border)">Estado</th>
                        <th style="padding:6px 8px;text-align:left;border-bottom:1px solid var(--border)">Nombre</th>
                        <th style="padding:6px 8px;text-align:left;border-bottom:1px solid var(--border)">DNI</th>
                        <th style="padding:6px 8px;text-align:left;border-bottom:1px solid var(--border)">Teléfono</th>
                        <th style="padding:6px 8px;text-align:left;border-bottom:1px solid var(--border)">Obra social</th>
                    </tr></thead><tbody>${body}</tbody>
                </table>
            </div>
            <div style="display:flex;gap:12px;margin-top:10px;font-size:12px;font-weight:600;flex-wrap:wrap">
                ${willImport ? `<span style="color:#065f46"><i class="fa-solid fa-circle-check"></i> ${willImport} para importar</span>` : ''}
                ${willUpdate ? `<span style="color:#1e40af"><i class="fa-solid fa-pen-to-square"></i> ${willUpdate} para actualizar</span>` : ''}
                ${willSkip ? `<span style="color:#92400e"><i class="fa-solid fa-triangle-exclamation"></i> ${willSkip} duplicado${willSkip !== 1 ? 's' : ''}</span>` : ''}
                ${willError ? `<span style="color:#991b1b"><i class="fa-solid fa-circle-xmark"></i> ${willError} con error</span>` : ''}
            </div>`;
        recomputeConfirm(willImport + willUpdate);
    }

    // ═══════════════════ MODO FOTO ═══════════════════
    const photoInput = $('#photo-file-input');
    const photoDrop = $('#photo-dropzone');
    $('#photo-pick-file').onclick = () => photoInput.click();
    photoDrop.addEventListener('dragover', e => { e.preventDefault(); photoDrop.style.borderColor = '#6366f1'; });
    photoDrop.addEventListener('dragleave', () => { photoDrop.style.borderColor = ''; });
    photoDrop.addEventListener('drop', e => { e.preventDefault(); photoDrop.style.borderColor = ''; addPhotos(e.dataTransfer.files); });
    photoInput.addEventListener('change', () => addPhotos(photoInput.files));

    // Redimensionar una foto de celular con canvas bloquea el hilo principal
    // varios cientos de milisegundos. Con 10 fotos seguidas la pantalla quedaba
    // congelada 10-20 segundos sin mostrar nada —ni miniaturas ni el botón de
    // extraer, que está oculto hasta que hay imágenes— y desde el mostrador
    // parecía que la app no respondía. Ahora se informa el avance, las
    // miniaturas aparecen de a una, y se cede el hilo entre imagen e imagen para
    // que el navegador pueda repintar y atender clics.
    async function addPhotos(fileList) {
        if (_photoBusy) {
            showToast('Esperá a que terminen de procesarse las imágenes anteriores.', 'warning');
            return;
        }
        const files = Array.from(fileList || []).filter(f => f.type.startsWith('image/'));
        if (files.length === 0) return;

        _photoBusy = true;
        setPhotoPickerEnabled(false);

        const fallidas = [];
        try {
            let procesadas = 0;
            for (const f of files) {
                if (_photoImages.length >= PHOTO_MAX_IMAGES) {
                    showToast(`Máximo ${PHOTO_MAX_IMAGES} imágenes.`, 'warning');
                    break;
                }
                showPhotoProgress(`Procesando imagen ${procesadas + 1} de ${files.length}…`);
                // Cede el hilo para que el mensaje de arriba llegue a pintarse
                // antes de arrancar el trabajo pesado de la imagen siguiente.
                await new Promise(resolve => setTimeout(resolve, 0));
                try {
                    _photoImages.push(await resizeImage(f));
                } catch (err) {
                    // Antes esto se descartaba en silencio: si fallaban 2 de 10,
                    // la pantalla mostraba 8 y nadie sabía por qué faltaban.
                    fallidas.push({ nombre: f.name || 'imagen', motivo: err.message });
                }
                procesadas += 1;
                renderThumbs(); // aparecen de a una, no todas al final
            }
        } finally {
            showPhotoProgress('');
            _photoBusy = false;
            setPhotoPickerEnabled(true);
            // Permite volver a elegir el mismo archivo (si no, 'change' no dispara).
            if (photoInput) photoInput.value = '';
            renderThumbs();

            if (fallidas.length > 0) {
                const cuantas = fallidas.length === 1
                    ? 'No se pudo procesar 1 imagen'
                    : `No se pudieron procesar ${fallidas.length} imágenes`;
                showToast(
                    `${cuantas}: ${fallidas.map(f => f.nombre).join(', ')}. ` +
                    `${fallidas[0].motivo} Probá sacarlas de a menos, o con menor resolución.`,
                    'warning'
                );
            }
        }
    }

    // Cartel de avance propio, fuera del dropzone: el input de archivos y el
    // botón "Elegir imágenes" viven dentro del dropzone, así que reescribir su
    // contenido los destruiría y dejaría los handlers apuntando a nodos sueltos.
    function showPhotoProgress(text) {
        let node = $('#photo-progress');
        if (!node) {
            const panel = $('#panel-photo');
            const thumbs = $('#photo-thumbs');
            if (!panel) return;
            node = document.createElement('div');
            node.id = 'photo-progress';
            node.style.cssText = 'margin-top:10px;font-size:13px;color:#6b7280;text-align:center';
            panel.insertBefore(node, thumbs || null);
        }
        node.innerHTML = text ? `<i class="fa-solid fa-spinner fa-spin"></i> ${escapeHtml(text)}` : '';
    }

    function setPhotoPickerEnabled(enabled) {
        const pick = $('#photo-pick-file');
        if (pick) pick.disabled = !enabled;
    }

    function renderThumbs() {
        $('#photo-thumbs').innerHTML = _photoImages.map((img, i) => `
            <div style="position:relative;width:74px;height:74px;border-radius:8px;overflow:hidden;border:1px solid var(--border)">
                <img src="${photoDataUrl(img)}" style="width:100%;height:100%;object-fit:cover">
                <button data-rm="${i}" style="position:absolute;top:2px;right:2px;width:20px;height:20px;border:none;border-radius:50%;background:rgba(0,0,0,.6);color:#fff;cursor:pointer;font-size:11px;line-height:1">×</button>
            </div>`).join('');
        $('#photo-thumbs').querySelectorAll('button[data-rm]').forEach(b => {
            b.onclick = () => { _photoImages.splice(Number(b.dataset.rm), 1); renderThumbs(); };
        });
        $('#photo-extract-bar').hidden = _photoImages.length === 0;
    }

    // Lee una tanda de imágenes. Antes se mandaban las 10 juntas en un solo
    // request: la IA tardaba varios minutos en contestar y el proxy cortaba la
    // conexión antes, así que pasar de 3 fotos fallaba siempre. Yendo por tandas
    // cada request es corto e independiente, el total de fotos deja de importar,
    // y lo ya leído no se pierde si una tanda falla.
    async function extractPhotoBatch(images, attempt = 0) {
        try {
            const res = await apiFetch('/patients/extract-photo', {
                method: 'POST',
                body: JSON.stringify({ images: images.map(i => ({ mediaType: i.mediaType, data: i.data })) }),
            });
            if (!res.ok) throw new Error(res.error || 'No se pudo extraer.');
            return res.patients || [];
        } catch (err) {
            // Un reintento ante fallas transitorias (IA saturada, corte de red).
            // Los 4xx (plan, cuota, permisos, imagen inválida) no se reintentan:
            // volver a mandar da el mismo error y gasta tiempo del usuario.
            const transient = !err.status || err.status >= 500;
            if (transient && attempt === 0) {
                await new Promise(resolve => setTimeout(resolve, 1500));
                return extractPhotoBatch(images, attempt + 1);
            }
            throw err;
        }
    }

    $('#photo-extract-btn').onclick = async () => {
        // Cerrojo además del `disabled` del botón: si por lo que sea entran dos
        // clics, no se pueden disparar dos secuencias de tandas en paralelo. Una
        // ráfaga de POST pesados hace que el WAF del hosting corte la IP y
        // devuelva un 403 en toda la página, no solo en la petición.
        if (_extractBusy) return;
        if (_photoBusy) {
            showToast('Esperá a que terminen de procesarse las imágenes.', 'warning');
            return;
        }
        _extractBusy = true;

        const btn = $('#photo-extract-btn');
        const total = _photoImages.length;
        const batches = [];
        for (let i = 0; i < total; i += PHOTO_BATCH_SIZE) {
            batches.push(_photoImages.slice(i, i + PHOTO_BATCH_SIZE));
        }

        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Leyendo imágenes…';
        $('#photo-review').innerHTML = '';

        const patients = [];
        const errors = [];
        let done = 0;

        try {
            await withAppLoading(`Leyendo imágenes con IA… (0 de ${total})`, async () => {
                let primera = true;
                for (const batch of batches) {
                    // Respiro entre tandas: encadenar POST pesados sin pausa es
                    // lo que el WAF del hosting interpreta como abuso.
                    if (!primera) await new Promise(resolve => setTimeout(resolve, 400));
                    primera = false;
                    try {
                        patients.push(...await extractPhotoBatch(batch));
                    } catch (err) {
                        errors.push(err);
                        // Plan, cuota o permisos: cortar acá, las tandas que
                        // siguen van a fallar por lo mismo.
                        if (err.status === 403) break;
                    }
                    done += batch.length;
                    updateAppLoadingMessage(`Leyendo imágenes con IA… (${done} de ${total})`);
                }
            });

            _reviewRows = patients;
            if (patients.length === 0) {
                const msg = errors.length
                    ? escapeHtml(errors[0].message)
                    : 'No se detectaron pacientes en las imágenes. Probá con una foto más nítida.';
                $('#photo-review').innerHTML = `<div style="color:#92400e;padding:12px;font-size:13px"><i class="fa-solid fa-triangle-exclamation"></i> ${msg}</div>`;
            } else {
                renderReview();
                // Éxito parcial: se muestra lo que sí se leyó y se avisa qué
                // falló, en vez de descartar todo por una tanda con error.
                if (errors.length) {
                    showToast(`Se leyeron ${patients.length} pacientes, pero ${errors.length === 1 ? 'una tanda falló' : `${errors.length} tandas fallaron`}: ${errors[0].message}`, 'warning');
                }
            }
        } catch (err) {
            $('#photo-review').innerHTML = `<div style="color:#ef4444;padding:12px;font-size:13px">${escapeHtml(err.message)}</div>`;
        } finally {
            _extractBusy = false;
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> Extraer datos con IA';
        }
    };

    function renderReview() {
        const rowHtml = (p, i) => `
            <tr data-row="${i}">
                <td style="padding:4px;border-bottom:1px solid var(--border)"><span data-badge="${i}"></span></td>
                <td style="padding:4px;border-bottom:1px solid var(--border)"><input data-i="${i}" data-f="fullName" value="${escapeHtml(p.fullName || '')}" style="width:100%;border:1px solid var(--border);border-radius:5px;padding:4px 6px;font-size:12px"></td>
                <td style="padding:4px;border-bottom:1px solid var(--border)"><input data-i="${i}" data-f="dni" value="${escapeHtml(p.dni || '')}" style="width:88px;border:1px solid var(--border);border-radius:5px;padding:4px 6px;font-size:12px;font-family:monospace"></td>
                <td style="padding:4px;border-bottom:1px solid var(--border)"><input data-i="${i}" data-f="phone" value="${escapeHtml(p.phone || '')}" style="width:100px;border:1px solid var(--border);border-radius:5px;padding:4px 6px;font-size:12px"></td>
                <td style="padding:4px;border-bottom:1px solid var(--border)"><input data-i="${i}" data-f="insuranceName" value="${escapeHtml(p.insuranceName || '')}" style="width:100%;border:1px solid var(--border);border-radius:5px;padding:4px 6px;font-size:12px"></td>
                <td style="padding:4px;border-bottom:1px solid var(--border)"><input data-i="${i}" data-f="credentialNumber" value="${escapeHtml(p.credentialNumber || '')}" style="width:104px;border:1px solid var(--border);border-radius:5px;padding:4px 6px;font-size:12px;font-family:monospace"></td>
                <td style="padding:4px;border-bottom:1px solid var(--border);text-align:center"><button data-del="${i}" class="btn btn-icon btn-icon-danger"><i class="fa-solid fa-trash-can"></i></button></td>
            </tr>`;
        $('#photo-review').innerHTML = `
            <div style="margin-top:14px;font-size:12px;color:#6b7280"><i class="fa-solid fa-circle-info"></i> Revisá y corregí lo que la IA haya leído mal. Solo se importan las filas con nombre, DNI y teléfono.</div>
            <div style="max-height:300px;overflow-y:auto;margin-top:8px">
                <table style="width:100%;border-collapse:collapse;font-size:12px">
                    <thead style="position:sticky;top:0;background:var(--surface,#fff)"><tr>
                        <th style="padding:6px;text-align:left;border-bottom:1px solid var(--border)"></th>
                        <th style="padding:6px;text-align:left;border-bottom:1px solid var(--border)">Nombre y apellido</th>
                        <th style="padding:6px;text-align:left;border-bottom:1px solid var(--border)">DNI</th>
                        <th style="padding:6px;text-align:left;border-bottom:1px solid var(--border)">Teléfono</th>
                        <th style="padding:6px;text-align:left;border-bottom:1px solid var(--border)">Obra social</th>
                        <th style="padding:6px;text-align:left;border-bottom:1px solid var(--border)">Afiliado N°</th>
                        <th style="padding:6px;border-bottom:1px solid var(--border)"></th>
                    </tr></thead>
                    <tbody id="review-tbody">${_reviewRows.map(rowHtml).join('')}</tbody>
                </table>
            </div>
            <div style="margin-top:8px"><button class="btn btn-secondary btn-sm" id="review-add"><i class="fa-solid fa-plus"></i> Agregar fila</button></div>`;

        const tbody = $('#review-tbody');
        tbody.querySelectorAll('input[data-i]').forEach(inp => {
            inp.oninput = () => {
                const i = Number(inp.dataset.i), f = inp.dataset.f;
                _reviewRows[i][f] = inp.value;
                updateReviewBadge(i);
                recomputeConfirm();
            };
        });
        tbody.querySelectorAll('button[data-del]').forEach(b => {
            b.onclick = () => { _reviewRows.splice(Number(b.dataset.del), 1); renderReview(); recomputeConfirm(); };
        });
        $('#review-add').onclick = () => { _reviewRows.push({ fullName: '', dni: '', phone: '', email: '', address: '', insuranceName: '', insurancePlan: '', credentialNumber: '', birthDate: '' }); renderReview(); };
        _reviewRows.forEach((_, i) => updateReviewBadge(i));
        recomputeConfirm();
    }

    function reviewRowValid(p) {
        return !!(String(p.fullName).trim() && String(p.dni).replace(/\D/g, '') && String(p.phone).replace(/\D/g, ''));
    }

    function updateReviewBadge(i) {
        const el = modal.querySelector(`[data-badge="${i}"]`);
        if (!el) return;
        el.innerHTML = reviewRowValid(_reviewRows[i])
            ? '<span style="background:#d1fae5;color:#065f46;padding:2px 6px;border-radius:4px;font-size:10px;font-weight:600">OK</span>'
            : '<span style="background:#fee2e2;color:#991b1b;padding:2px 6px;border-radius:4px;font-size:10px;font-weight:600">Falta dato</span>';
    }

    // ── Botón importar (depende del modo) ──────────────────────────────────────
    function recomputeConfirm(fileCount) {
        if (_mode === 'file') {
            confirmBtn.disabled = !(fileCount > 0);
        } else {
            confirmBtn.disabled = !_reviewRows.some(reviewRowValid);
        }
    }

    confirmBtn.onclick = async () => {
        let patients;
        if (_mode === 'file') {
            const seen = new Set();
            patients = _rawRows.map(r => mapWith(r, _colMapping)).filter(r => {
                if (!r.fullName || !r.dni || !r.phone) return false;
                const dni = String(r.dni).replace(/\D/g, '');
                if (seen.has(dni)) return false;
                seen.add(dni); return true;
            });
        } else {
            const seen = new Set();
            patients = _reviewRows.filter(reviewRowValid).map(p => ({
                fullName: p.fullName, dni: p.dni, phone: p.phone, email: p.email,
                address: p.address, insuranceName: p.insuranceName, insurancePlan: p.insurancePlan,
                credentialNumber: p.credentialNumber, birthDate: p.birthDate,
                medicalHistory: p.medicalHistory || null,
            })).filter(r => {
                const dni = String(r.dni).replace(/\D/g, '');
                if (seen.has(dni)) return false;
                seen.add(dni); return true;
            });
        }
        if (patients.length === 0) return;
        confirmBtn.disabled = true;
        confirmBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Importando...';
        try {
            const res = await apiFetch('/patients/import', { method: 'POST', body: JSON.stringify({ patients }) });
            if (!res.ok) throw new Error(res.error || 'Error al importar');
            await syncBackendSnapshotToLocalDb();
            close();
            refreshCurrentView();
            const parts = [];
            if (res.created) parts.push(`${res.created} paciente${res.created !== 1 ? 's' : ''} importado${res.created !== 1 ? 's' : ''}`);
            if (res.updated) parts.push(`${res.updated} modificado${res.updated !== 1 ? 's' : ''}`);
            if (res.skipped) parts.push(`${res.skipped} omitido${res.skipped !== 1 ? 's' : ''}`);
            showToast(`✓ ${parts.join(' · ') || 'Importación completa'}`, { type: 'success', duration: 7000 });
        } catch (err) {
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

                        <details class="patient-mh-details">
                            <summary><i class="fa-solid fa-notes-medical"></i> Antecedentes médicos <span class="patient-mh-hint">(opcional, cuestionario de salud)</span></summary>
                            <div class="patient-mh-body">
                                ${typeof renderMedicalHistoryFields === 'function' ? renderMedicalHistoryFields(p || {}, true) : ''}
                            </div>
                        </details>
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
        // Cerrojo además del overlay: aunque hoy la validación es sincrónica y no
        // deja hueco, un envío en curso nunca debe poder dispararse dos veces.
        const submitBtn = patientForm.querySelector('button[type=submit]');
        if (submitBtn?.disabled) return;

        const validation = validatePatientForm(patientForm, editId);
        if (!validation.ok) {
            return;
        }
        if (submitBtn) submitBtn.disabled = true;

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
            clinicalImages: p ? (p.clinicalImages || []) : [],
            medicalHistory: typeof readMedicalHistoryForm === 'function' ? readMedicalHistoryForm() : (p ? p.medicalHistory : null)
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
                    // Guardar notas en el ClinicalRecord (requiere professionalId).
                    // Aislado en su propio try/catch: este endpoint solo lo puede
                    // escribir quien edita historia clínica (profesional/superadmin),
                    // no una secretaria. Si falla por permisos, el paciente YA se
                    // guardó bien arriba — no hay que tirar todo el flujo abajo con
                    // un error confuso de "no tenés permisos para editar historia
                    // clínica" cuando en realidad el paciente sí se creó.
                    const _profId = getCurrentOdontoProfessionalId() || getAccessibleProfessionals()[0]?.id || null;
                    if (targetPatientId && _profId && data.notes !== undefined && data.notes !== '') {
                        try {
                            await apiFetch(`/clinical-records/${targetPatientId}`, {
                                method: 'PUT',
                                body: JSON.stringify({ professionalId: _profId, summaryNotes: data.notes || null })
                            });
                        } catch (notesError) {
                            // No es fatal para el guardado del paciente, pero si fue por
                            // falta de permiso avisamos — si no, parece que se guardó
                            // cuando en realidad esa observación se perdió.
                            if (notesError?.status === 403) {
                                showToast('Paciente guardado. La observación médica no se guardó (hace falta un profesional para cargarla).', { type: 'warning' });
                            }
                        }
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
        } finally {
            // Se rehabilita siempre: si falló (por ejemplo, DNI duplicado), el
            // formulario sigue abierto y hay que poder corregir y reintentar.
            if (submitBtn) submitBtn.disabled = false;
        }
    });
}

// Contenido de las 3 formas de cargar pacientes — se usa tanto en el estado
// vacío (sin pacientes) como en el modal de ayuda (ícono de info del header),
// para no duplicar el texto en dos lugares.
function renderPatientImportMethods() {
    return `
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
            <div class="patients-empty-method">
                <div class="patients-empty-method-icon patients-empty-method-icon--ia">
                    <i class="fa-solid fa-wand-magic-sparkles"></i>
                </div>
                <div>
                    <strong>Importar con IA</strong>
                    <p>Sacale una foto a la ficha o historia clínica en papel (hasta 10 imágenes) desde <em>Importar con IA</em> y la inteligencia artificial completa los datos del paciente automáticamente. Ideal para pasar fichas viejas sin tipearlas a mano.</p>
                </div>
            </div>
        </div>
    `;
}

window.showPatientImportGuideModal = function() {
    modalsContainer.innerHTML = `
        <div class="modal-overlay active" onclick="closeModal()">
            <div class="modal-content" style="max-width:640px" onclick="event.stopPropagation()">
                <div class="modal-header">
                    <h3><i class="fa-solid fa-circle-info" style="color:var(--primary-600)"></i> Cómo cargar pacientes</h3>
                    <button type="button" class="modal-close-x" onclick="closeModal()" aria-label="Cerrar"><i class="fa-solid fa-xmark"></i></button>
                </div>
                <div class="modal-body">
                    <p class="patients-empty-sub" style="margin-top:0">Podés agregar pacientes de tres maneras:</p>
                    ${renderPatientImportMethods()}
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-primary" onclick="closeModal()">Entendido</button>
                </div>
            </div>
        </div>
    `;
};

function renderPatients() {
    const patients = getAccessiblePatients().sort((a,b)=>a.name.localeCompare(b.name));
    const canCreate = canCreatePatientUi();
    const emptyState = patients.length === 0 ? `
        <div class="patients-empty-state">
            <div class="patients-empty-icon">
                <i class="fa-solid fa-users"></i>
            </div>
            <h3 class="patients-empty-title">Todavía no hay pacientes cargados</h3>
            <p class="patients-empty-sub">Podés agregar pacientes de tres maneras:</p>
            ${renderPatientImportMethods()}
            ${canCreate ? `
            <div class="patients-empty-actions">
                <button class="btn btn-primary" id="btn-add-patient-empty"><i class="fa-solid fa-user-plus"></i> Nuevo Paciente</button>
                <button class="btn btn-ia" id="btn-import-ia-empty"><i class="fa-solid fa-wand-magic-sparkles"></i> Importar con IA</button>
                <button class="btn btn-secondary" id="btn-import-patients-empty"><i class="fa-solid fa-file-excel"></i> Importar Excel</button>
            </div>` : ''}
        </div>
    ` : '';
    return `
        <div class="card mb-6 section-hero-card section-hero-inline">
            <div class="section-hero-copy">
                <span class="section-eyebrow">Pacientes</span>
                <h3 class="section-title">
                    Registro de Pacientes
                    <button type="button" class="patients-info-btn" onclick="showPatientImportGuideModal()" title="Cómo cargar pacientes" aria-label="Cómo cargar pacientes"><i class="fa-solid fa-circle-info"></i></button>
                </h3>
                <p class="section-subtitle">Visualiza, edita y administra los datos base de cada paciente.</p>
            </div>
            ${canCreate ? `
            <div class="flex gap-2 flex-wrap">
                <button class="btn btn-primary" id="btn-add-patient"><i class="fa-solid fa-user-plus"></i> Nuevo Paciente</button>
                <button class="btn btn-ia" id="btn-import-ia"><i class="fa-solid fa-wand-magic-sparkles"></i> Importar con IA</button>
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
                                    <span class="block text-sm text-gray-600"><i class="fa-solid fa-phone mr-1"></i> ${escapeHtml(p.phone)}</span>
                                </td>
                                <td class="text-sm font-semibold" data-label="DNI">${p.dni}</td>
                                <td data-label="Acciones" class="table-actions-cell">
                                    <div class="flex gap-2 patient-actions">
                                        ${canViewClinicalHistoryUi() ? `<button class="btn btn-ghost p-1 btn-view-history" data-id="${p.id}" title="Historia Clínica"><i class="fa-solid fa-file-medical text-purple-600"></i></button>` : ''}
                                        ${canEditPatientUi() ? `<button class="btn btn-ghost p-1 btn-edit-patient" data-id="${p.id}" title="Editar"><i class="fa-solid fa-pen text-primary-600"></i></button>` : ''}
                                        ${isSuperadmin() ? `<button class="btn btn-ghost p-1 btn-delete-patient" data-id="${p.id}" title="Eliminar"><i class="fa-solid fa-trash text-danger"></i></button>` : ''}
                                        ${canViewPatientBillingUi() ? `<button class="btn btn-ghost p-1 btn-view-patient-billing" data-id="${p.id}" title="Cuenta Corriente"><i class="fa-solid fa-wallet text-emerald-600"></i></button>` : ''}
                                        ${(() => {
                                            // Solo si el teléfono se puede convertir a un número que WhatsApp
                                            // entienda: un botón que abre un chat con un número inventado es
                                            // peor que no tener botón.
                                            const wa = toWhatsappNumber(p.phone);
                                            return wa
                                                ? `<a class="btn btn-ghost p-1 btn-whatsapp-patient" href="https://wa.me/${wa}" target="_blank" rel="noopener noreferrer" title="Escribir por WhatsApp a ${escapeHtml(p.phone)}"><i class="fa-brands fa-whatsapp"></i></a>`
                                                : '';
                                        })()}
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
