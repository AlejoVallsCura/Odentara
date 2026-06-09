// =============================================================================
// clinical.js -- Historia clinica, odontograma, imagenes clinicas
// Depende de: state.js, db-local.js, permissions.js, api.js, ui.js, utils.js
// =============================================================================

function clinicalRecordEntriesToLegacyOdontogram(entries = []) {
    const odontograma = {};
    const faceMap = {
        V: 'top',
        D: 'right',
        P: 'bottom',
        M: 'left',
        O: 'center',
        I: 'center',
    };
    const statusMap = {
        healthy:          'sano',
        caries:           'caries',
        restored:         'restaurado',
        absent:           'ausente',
        implant:          'implante',
        crown:            'corona',
        crown_implant:    'corona-implante',
        endodontics:      'endodoncia',
        orthodontics:     'ortodoncia',
        sealant:          'sello'
    };
    // Estados que representan el diente completo (no una cara)
    const toothStateStatuses = new Set(['ausente', 'implante', 'corona', 'corona-implante', 'endodoncia', 'ortodoncia', 'sello']);

    // Primer paso: procesar estados de diente completo
    entries.forEach((entry) => {
        const toothNumber = String(entry.toothNumber || '');
        if (!toothNumber || entry.face === 'L') return;
        if (!odontograma[toothNumber]) odontograma[toothNumber] = {};
        const status = statusMap[entry.status] || 'sano';
        if (toothStateStatuses.has(status)) {
            odontograma[toothNumber].estado = status;
        }
    });

    // Segundo paso: procesar caras y marcador de color (face='L' = azul)
    entries.forEach((entry) => {
        const toothNumber = String(entry.toothNumber || '');
        if (!toothNumber) return;
        if (!odontograma[toothNumber]) odontograma[toothNumber] = {};

        const status = statusMap[entry.status] || 'sano';

        // 'L' es el marcador de color azul para estados de diente completo
        if (entry.face === 'L') {
            if (odontograma[toothNumber].estado && status === 'restaurado') {
                odontograma[toothNumber].color = 'azul';
            }
            return;
        }

        // Ignorar entradas de estado de diente completo (ya procesadas)
        if (toothStateStatuses.has(status)) return;

        const faceKey = faceMap[entry.face] || 'center';
        if (status === 'sano') {
            delete odontograma[toothNumber][faceKey];
        } else {
            odontograma[toothNumber][faceKey] = status;
        }
    });

    return odontograma;
}

function legacyOdontogramToEntries(odontograma = {}) {
    const entries = [];
    const faceMap = {
        top: 'V',
        right: 'D',
        bottom: 'P',
        left: 'M',
        center: 'O'
    };
    const statusMap = {
        sano:             'healthy',
        caries:           'caries',
        restaurado:       'restored',
        ausente:          'absent',
        implante:         'implant',
        corona:           'crown',
        'corona-implante':'crown_implant',
        endodoncia:       'endodontics',
        ortodoncia:       'orthodontics',
        sello:            'sealant'
    };
    // Estados que se guardan como entrada de diente completo (face = null)
    const toothStateEstados = new Set(['ausente', 'implante', 'corona', 'corona-implante', 'endodoncia', 'ortodoncia', 'sello']);

    Object.entries(odontograma || {}).forEach(([toothNumber, toothData]) => {
        if (!toothData || typeof toothData !== 'object') return;

        if (toothStateEstados.has(toothData.estado)) {
            entries.push({
                toothNumber: String(toothNumber),
                face: null,
                status: statusMap[toothData.estado]
            });
            // Marcador de color azul: face='L', status='restored'
            if (toothData.color === 'azul') {
                entries.push({
                    toothNumber: String(toothNumber),
                    face: 'L',
                    status: 'restored'
                });
            }
            // Para implante, corona-implante y sello también guardar las caras si las hay
            if (toothData.estado === 'implante' || toothData.estado === 'corona-implante' || toothData.estado === 'sello') {
                ['top', 'right', 'bottom', 'left', 'center'].forEach((faceKey) => {
                    const faceStatus = toothData[faceKey];
                    if (!faceStatus || faceStatus === 'sano') return;
                    entries.push({
                        toothNumber: String(toothNumber),
                        face: faceMap[faceKey],
                        status: statusMap[faceStatus] || 'healthy'
                    });
                });
            }
            return;
        }

        ['top', 'right', 'bottom', 'left', 'center'].forEach((faceKey) => {
            const status = toothData[faceKey];
            if (!status || status === 'sano') return;

            entries.push({
                toothNumber: String(toothNumber),
                face: faceMap[faceKey],
                status: statusMap[status] || 'healthy'
            });
        });
    });

    return entries;
}

function hasChildDentitionData(patient = {}) {
    const childTeeth = new Set(['55','54','53','52','51','61','62','63','64','65','85','84','83','82','81','71','72','73','74','75']);
    const odontograma = patient.odontograma || {};
    return Object.keys(odontograma).some((tooth) => childTeeth.has(String(tooth)));
}

function createClinicalDraftFromPatient(patient) {
    if (!patient) return null;

    return {
        patientId: patient.id,
        isDirty: false,
        data: {
            fechaNacimiento: patient.fechaNacimiento || '',
            phone: patient.phone || '',
            email: patient.email || '',
            obraSocial: patient.obraSocial || '',
            credencial: patient.credencial || '',
            fichaNumero: patient.fichaNumero || '',
            domicilio: patient.domicilio || '',
            notes: patient.notes || '',
            allergies: patient.allergies || '',
            medicalNotes: patient.medicalNotes || '',
            odontograma: deepClone(patient.odontograma || {}),
            showChildDentition: Boolean(patient.showChildDentition || hasChildDentitionData(patient))
        }
    };
}

function setClinicalDraftFromPatient(patient) {
    state.clinicalDraft = createClinicalDraftFromPatient(patient);
}

function getClinicalDraft(patientId) {
    if (state.clinicalDraft?.patientId === patientId) {
        return state.clinicalDraft;
    }
    return null;
}

function getClinicalWorkingPatient(patientId) {
    const patient = DB.get('patients').find((item) => item.id === patientId);
    const draft = getClinicalDraft(patientId);
    if (!patient) return null;
    if (!draft) return patient;

    return {
        ...patient,
        ...draft.data,
        odontograma: draft.data.odontograma || {}
    };
}

function updateClinicalDraft(patientId, updater) {
    const draft = getClinicalDraft(patientId);
    if (!draft) return;
    updater(draft.data);
    draft.isDirty = true;
    syncClinicalHistorySaveState();
}

function clearClinicalDraft() {
    state.clinicalDraft = null;
    // Resetear el profesional seleccionado para que al abrir otro paciente quede en blanco
    if (isSuperadmin()) state.clinicalOdontoProfessionalId = null;
}

function hasUnsavedClinicalDraft() {
    return state.currentView === 'patient-history' && Boolean(state.clinicalDraft?.isDirty);
}

async function confirmClinicalDraftExit() {
    if (!hasUnsavedClinicalDraft()) return true;

    const shouldDiscard = await showConfirm(
        'Tienes cambios sin guardar en la historia clínica. Puedes guardarlos ahora antes de salir.',
        {
            title: 'Cambios sin guardar',
            confirmText: 'Salir sin guardar',
            cancelText: 'Guardar',
            variant: 'info'
        }
    );

    if (shouldDiscard) {
        clearClinicalDraft();
        return true;
    }

    const patientId = state.clinicalDraft?.patientId;
    if (!patientId) return false;

    try {
        await window.saveClinicalHistory(patientId);
        return true;
    } catch (_error) {
        return false;
    }
}

function syncClinicalHistorySaveState() {
    const saveButton = document.getElementById('btn-save-clinical-history');
    const isDirty = hasUnsavedClinicalDraft();

    if (saveButton) {
        saveButton.disabled = !isDirty;
        saveButton.classList.toggle('is-ready', isDirty);
    }
}

async function syncPatientClinicalData(patientId, professionalId) {
    if (!state.authToken) {
        return DB.get('patients').find((item) => item.id === patientId) || null;
    }

    const profQ = professionalId ? `&professionalId=${professionalId}` : '';
    const profQRecord = professionalId ? `?professionalId=${professionalId}` : '';
    const [patientRes, treatmentsRes, imagesRes, clinicalRecordRes] = await Promise.all([
        apiFetch(`/patients/${patientId}`),
        apiFetch(`/treatments?patientId=${patientId}${profQ}`),
        apiFetch(`/clinical-images?patientId=${patientId}${profQ}`),
        apiFetch(`/clinical-records/${patientId}${profQRecord}`)
    ]);

    const mappedPatient = mapApiPatientToLegacy(patientRes.patient || {});
    const record = clinicalRecordRes.record || null;
    const mergedPatient = {
        ...mappedPatient,
        odontograma: clinicalRecordEntriesToLegacyOdontogram(record?.odontogramEntries || []),
        treatments: (treatmentsRes.treatments || []).map(mapApiTreatmentToLegacy),
        clinicalImages: (imagesRes.images || []).map(mapApiClinicalImageToLegacy),
        notes: record?.summaryNotes || '',
        allergies: record?.allergies || '',
        medicalNotes: record?.medicalNotes || ''
    };

    upsertLocalItem('patients', mergedPatient);
    return mergedPatient;
}


function getClinicalImagesForPatient(patientId) {
    const patient = getClinicalWorkingPatient(patientId);
    return ((patient?.clinicalImages) || [])
        .slice()
        .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
}

function formatClinicalImageDate(date) {
    return date ? String(date).split('-').reverse().join('/') : 'Sin fecha';
}

window.openClinicalImageViewer = function(patientId, imageId) {
    const images = getClinicalImagesForPatient(patientId);
    if (!images.length) return;

    const imageIndex = Math.max(0, images.findIndex((image, index) => (image.id ?? index) === imageId));
    state.clinicalImageViewer = { patientId, index: imageIndex < 0 ? 0 : imageIndex };
    renderClinicalImageViewer();
};

window.goToClinicalImageViewer = function(index) {
    if (!state.clinicalImageViewer) return;

    const images = getClinicalImagesForPatient(state.clinicalImageViewer.patientId);
    if (!images.length) return;

    state.clinicalImageViewer.index = Math.min(Math.max(Number(index) || 0, 0), images.length - 1);
    renderClinicalImageViewer();
};

window.stepClinicalImageViewer = function(direction) {
    if (!state.clinicalImageViewer) return;
    const { patientId, index } = state.clinicalImageViewer;
    const images = getClinicalImagesForPatient(patientId);
    if (!images.length) return;

    const nextIndex = (index + direction + images.length) % images.length;
    state.clinicalImageViewer.index = nextIndex;
    renderClinicalImageViewer();
};

let _viewerZoom = 1;
let _viewerPanX = 0;
let _viewerPanY = 0;

function _applyViewerTransform() {
    const wrap = document.getElementById('clinical-viewer-zoom-wrap');
    if (!wrap) return;
    wrap.style.transform = `scale(${_viewerZoom}) translate(${_viewerPanX}px, ${_viewerPanY}px)`;
    wrap.style.cursor = _viewerZoom > 1 ? 'grab' : 'zoom-in';
}

window.adjustViewerZoom = function(delta) {
    if (delta === 0) {
        _viewerZoom = 1; _viewerPanX = 0; _viewerPanY = 0;
    } else {
        _viewerZoom = Math.min(5, Math.max(1, _viewerZoom + delta));
        if (_viewerZoom === 1) { _viewerPanX = 0; _viewerPanY = 0; }
    }
    _applyViewerTransform();
};

window.toggleViewerZoom = function() {
    _viewerZoom = _viewerZoom > 1 ? 1 : 2.5;
    _viewerPanX = 0; _viewerPanY = 0;
    _applyViewerTransform();
};

function _bindViewerZoomEvents() {
    const wrap = document.getElementById('clinical-viewer-zoom-wrap');
    if (!wrap) return;
    _viewerZoom = 1; _viewerPanX = 0; _viewerPanY = 0;
    _applyViewerTransform();

    // Pinch-to-zoom
    let lastDist = null;
    let lastZoom = 1;
    wrap.addEventListener('touchstart', (e) => {
        if (e.touches.length === 2) {
            lastDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
            lastZoom = _viewerZoom;
            e.preventDefault();
        }
    }, { passive: false });
    wrap.addEventListener('touchmove', (e) => {
        if (e.touches.length === 2 && lastDist) {
            const dist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
            _viewerZoom = Math.min(5, Math.max(1, lastZoom * (dist / lastDist)));
            if (_viewerZoom === 1) { _viewerPanX = 0; _viewerPanY = 0; }
            _applyViewerTransform();
            e.preventDefault();
        }
    }, { passive: false });
    wrap.addEventListener('touchend', () => { lastDist = null; });

    // Wheel zoom
    wrap.addEventListener('wheel', (e) => {
        e.preventDefault();
        _viewerZoom = Math.min(5, Math.max(1, _viewerZoom - e.deltaY * 0.001));
        if (_viewerZoom === 1) { _viewerPanX = 0; _viewerPanY = 0; }
        _applyViewerTransform();
    }, { passive: false });

    // Mouse drag to pan
    let isDragging = false;
    let dragStartX = 0, dragStartY = 0;
    let panStartX = 0, panStartY = 0;

    wrap.addEventListener('mousedown', (e) => {
        if (_viewerZoom <= 1) return;
        isDragging = true;
        dragStartX = e.clientX; dragStartY = e.clientY;
        panStartX = _viewerPanX; panStartY = _viewerPanY;
        wrap.style.cursor = 'grabbing';
        e.preventDefault();
    });
    window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        _viewerPanX = panStartX + (e.clientX - dragStartX) / _viewerZoom;
        _viewerPanY = panStartY + (e.clientY - dragStartY) / _viewerZoom;
        _applyViewerTransform();
    });
    window.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            wrap.style.cursor = _viewerZoom > 1 ? 'grab' : 'zoom-in';
        }
    });

    // Single-finger touch drag to pan
    let touchDragging = false;
    let touchStartX = 0, touchStartY = 0;
    let touchPanStartX = 0, touchPanStartY = 0;

    wrap.addEventListener('touchstart', (e) => {
        if (e.touches.length === 1 && _viewerZoom > 1) {
            touchDragging = true;
            touchStartX = e.touches[0].clientX; touchStartY = e.touches[0].clientY;
            touchPanStartX = _viewerPanX; touchPanStartY = _viewerPanY;
        }
    }, { passive: true });
    wrap.addEventListener('touchmove', (e) => {
        if (e.touches.length === 1 && touchDragging && _viewerZoom > 1) {
            _viewerPanX = touchPanStartX + (e.touches[0].clientX - touchStartX) / _viewerZoom;
            _viewerPanY = touchPanStartY + (e.touches[0].clientY - touchStartY) / _viewerZoom;
            _applyViewerTransform();
            e.preventDefault();
        }
    }, { passive: false });
    wrap.addEventListener('touchend', () => { touchDragging = false; });
}

function renderClinicalImageViewer() {
    const viewer = state.clinicalImageViewer;
    if (!viewer) return;

    const images = getClinicalImagesForPatient(viewer.patientId);
    if (!images.length) {
        closeModal();
        return;
    }

    const safeIndex = Math.min(Math.max(viewer.index, 0), images.length - 1);
    state.clinicalImageViewer.index = safeIndex;
    const image = images[safeIndex];
    const patient = getClinicalWorkingPatient(viewer.patientId);
    const label = image.description || 'Imagen clínica';
    const dateLabel = formatClinicalImageDate(image.date);
    const progress = Math.round(((safeIndex + 1) / images.length) * 100);
    const previousImage = images[(safeIndex - 1 + images.length) % images.length];
    const nextImage = images[(safeIndex + 1) % images.length];
    const viewerTitle = `${label} - ${safeIndex + 1} de ${images.length}`;

    modalsContainer.innerHTML = `
        <div class="modal-overlay active clinical-image-viewer-overlay">
            <div class="clinical-image-viewer" role="dialog" aria-modal="true" aria-label="${escapeHtml(viewerTitle)}">
                <header class="clinical-image-viewer-header">
                    <div class="clinical-image-viewer-heading">
                        <span class="clinical-image-viewer-kicker">Secuencia clínica</span>
                        <h3>${escapeHtml(patient?.name || 'Paciente')}</h3>
                    </div>
                    <div class="clinical-image-viewer-header-actions">
                        <span class="clinical-image-viewer-counter">${safeIndex + 1} / ${images.length}</span>
                        <div class="clinical-image-viewer-zoom-btns">
                            <button type="button" class="clinical-image-viewer-zoom-btn" onclick="event.stopPropagation(); adjustViewerZoom(-0.5)" aria-label="Alejar"><i class="fa-solid fa-minus"></i></button>
                            <button type="button" class="clinical-image-viewer-zoom-btn" onclick="event.stopPropagation(); adjustViewerZoom(0)" aria-label="Tamaño original"><i class="fa-solid fa-expand"></i></button>
                            <button type="button" class="clinical-image-viewer-zoom-btn" onclick="event.stopPropagation(); adjustViewerZoom(0.5)" aria-label="Acercar"><i class="fa-solid fa-plus"></i></button>
                        </div>
                        <button type="button" class="clinical-image-viewer-close" onclick="event.stopPropagation(); closeModal();" aria-label="Cerrar visor">
                            <i class="fa-solid fa-xmark"></i>
                        </button>
                    </div>
                </header>

                <div class="clinical-image-viewer-layout">
                    <div class="clinical-image-viewer-stage">
                        <button type="button" class="clinical-image-viewer-nav prev" onclick="event.stopPropagation(); stepClinicalImageViewer(-1)" aria-label="Imagen anterior">
                            <i class="fa-solid fa-chevron-left"></i>
                        </button>
                        <figure class="clinical-image-viewer-figure" id="clinical-viewer-figure">
                            <div class="clinical-image-viewer-zoom-wrap" id="clinical-viewer-zoom-wrap">
                            <img src="${escapeHtml(image.dataUrl)}" alt="${escapeHtml(label)}" class="clinical-image-viewer-img" id="clinical-viewer-img" ondblclick="event.stopPropagation(); toggleViewerZoom()">
                            </div>
                            <figcaption class="clinical-image-viewer-caption">
                                <span>${escapeHtml(dateLabel)}</span>
                                <strong>${escapeHtml(label)}</strong>
                            </figcaption>
                        </figure>
                        <button type="button" class="clinical-image-viewer-nav next" onclick="event.stopPropagation(); stepClinicalImageViewer(1)" aria-label="Imagen siguiente">
                            <i class="fa-solid fa-chevron-right"></i>
                        </button>
                    </div>

                    <aside class="clinical-image-viewer-panel">
                        <div class="clinical-image-viewer-progress" aria-hidden="true">
                            <span style="width: ${progress}%"></span>
                        </div>
                        <div class="clinical-image-viewer-detail">
                            <span>Fecha</span>
                            <strong>${escapeHtml(dateLabel)}</strong>
                        </div>
                        <div class="clinical-image-viewer-detail">
                            <span>Descripción</span>
                            <strong>${escapeHtml(label)}</strong>
                        </div>
                        <div class="clinical-image-viewer-detail">
                            <span>Registro</span>
                            <strong>${safeIndex + 1} de ${images.length}</strong>
                        </div>
                        ${images.length > 1 ? `
                        <div class="clinical-image-viewer-neighbors">
                            <button type="button" onclick="event.stopPropagation(); stepClinicalImageViewer(-1)">
                                <i class="fa-solid fa-arrow-left"></i>
                                <span>${escapeHtml(formatClinicalImageDate(previousImage.date))}</span>
                            </button>
                            <button type="button" onclick="event.stopPropagation(); stepClinicalImageViewer(1)">
                                <span>${escapeHtml(formatClinicalImageDate(nextImage.date))}</span>
                                <i class="fa-solid fa-arrow-right"></i>
                            </button>
                        </div>
                        ` : ''}
                    </aside>
                </div>

                <div class="clinical-image-viewer-thumbs" aria-label="Miniaturas de imágenes clínicas">
                    ${images.map((item, index) => {
                        const itemLabel = item.description || 'Imagen clínica';
                        return `
                        <button type="button" class="clinical-image-viewer-thumb ${index === safeIndex ? 'is-active' : ''}" onclick="event.stopPropagation(); goToClinicalImageViewer(${index})" aria-label="Ver ${escapeHtml(itemLabel)}">
                            <img src="${escapeHtml(item.dataUrl)}" alt="${escapeHtml(itemLabel)}">
                            <span>${escapeHtml(formatClinicalImageDate(item.date))}</span>
                        </button>
                        `;
                    }).join('')}
                </div>
            </div>
        </div>
    `;
    _bindViewerZoomEvents();
}


// --- Ficha ClÃ­nica y Odontograma ---

async function loadClinicalHistory(patientId, options = {}) {
    if (!canAccessPatient(patientId)) return;
    if (!canViewClinicalHistoryUi()) {
        showAlert('El secretario no puede acceder a la historia clínica.', { title: 'Historia clínica', variant: 'error' });
        return;
    }
    if (!options.skipUnsavedCheck) {
        const switchingPatient = state.currentView === 'patient-history' && state.currentPatientId !== patientId;
        if ((switchingPatient || state.currentView !== 'patient-history') && !(await confirmClinicalDraftExit())) {
            return;
        }
    }
    state.currentView = 'patient-history';
    state.currentPatientId = patientId;
    pageTitle.innerText = 'Ficha Odontológica';
    mainContent.innerHTML = '<div class="card p-6 text-center text-gray-500">Cargando historia clínica...</div>';
    
    // Determinar qué profesional se usa para el odontograma
    const scopedProfs = state.user?.allowedProfessionals || [];
    const needsSelector = isSuperadmin() || scopedProfs.length > 1;
    if (needsSelector && !state.clinicalOdontoProfessionalId) {
        const allProfs = DB.get('professionals').filter(p => p.active !== false && p.status !== 'inactivo');
        const candidates = isSuperadmin() ? allProfs : allProfs.filter(p => scopedProfs.includes(p.id));
        if (candidates.length > 0) {
            state.clinicalOdontoProfessionalId = candidates[0].id;
        }
    }

    try {
        if (!options.skipSync) {
            await syncPatientClinicalData(patientId, getCurrentOdontoProfessionalId());
        }
    } catch (error) {
        showAlert(error.message || 'No se pudo cargar la historia clínica.', { title: 'Historia clínica', variant: 'error' });
    }

    setClinicalDraftFromPatient(DB.get('patients').find((item) => item.id === patientId));

    mainContent.innerHTML = '';

    const content = document.createElement('div');
    content.className = 'animate-fade-in clinical-print-root';
    content.innerHTML = renderClinicalHistory(patientId);
    mainContent.appendChild(content);
    enhanceClinicalPatientEditor(patientId);

    attachClinicalHistoryEvents(patientId);
    syncClinicalHistorySaveState();
    renderSidebar();
}

function enhanceClinicalPatientEditor(patientId) {
    const patient = getClinicalWorkingPatient(patientId);
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
        <div class="clinical-edit-grid clinical-edit-grid-compact">
            <div class="clinical-info-item clinical-info-item-compact">
                <strong class="text-gray-600 uppercase text-xs">Nombre</strong>
                <input class="form-input clinical-readonly" type="text" value="${patient.name || ''}" disabled>
            </div>
            <div class="clinical-info-item clinical-info-item-compact">
                <strong class="text-gray-600 uppercase text-xs">DNI</strong>
                <input class="form-input clinical-readonly" type="text" value="${patient.dni || ''}" disabled>
            </div>
            <div class="clinical-info-item clinical-info-item-compact">
                <strong class="text-gray-600 uppercase text-xs">Nacimiento</strong>
                <input class="form-input" type="date" id="clinical-fecha-nacimiento" value="${patient.fechaNacimiento || ''}" ${canEditClinical ? '' : 'disabled'}>
            </div>
            <div class="clinical-info-item clinical-info-item-compact">
                <strong class="text-gray-600 uppercase text-xs">Edad</strong>
                <div class="clinical-static-value">${age} años</div>
            </div>
            <div class="clinical-info-item clinical-info-item-compact">
                <strong class="text-gray-600 uppercase text-xs">Teléfono</strong>
                <input class="form-input" type="text" id="clinical-phone" value="${patient.phone || ''}" ${canEditClinical ? '' : 'disabled'}>
            </div>
            <div class="clinical-info-item clinical-info-item-compact">
                <strong class="text-gray-600 uppercase text-xs">Email</strong>
                <input class="form-input" type="email" id="clinical-email" value="${patient.email || ''}" ${canEditClinical ? '' : 'disabled'}>
            </div>
            <div class="clinical-info-item clinical-info-item-compact">
                <strong class="text-gray-600 uppercase text-xs">Obra Social / Plan</strong>
                <input class="form-input" type="text" id="clinical-obra-social" value="${patient.obraSocial || ''}" ${canEditClinical ? '' : 'disabled'}>
            </div>
            <div class="clinical-info-item clinical-info-item-compact">
                <strong class="text-gray-600 uppercase text-xs">Credencial</strong>
                <input class="form-input" type="text" id="clinical-credencial" value="${patient.credencial || ''}" ${canEditClinical ? '' : 'disabled'}>
            </div>
            <div class="clinical-info-item clinical-info-item-compact">
                <strong class="text-gray-600 uppercase text-xs">Ficha N°</strong>
                <input class="form-input" type="text" id="clinical-ficha-numero" value="${patient.fichaNumero || ''}" ${canEditClinical ? '' : 'disabled'}>
            </div>
            <div class="clinical-info-item clinical-info-item-compact clinical-info-item-wide">
                <strong class="text-gray-600 uppercase text-xs">Domicilio</strong>
                <input class="form-input" type="text" id="clinical-domicilio" value="${patient.domicilio || ''}" ${canEditClinical ? '' : 'disabled'}>
            </div>
        </div>
    `;
}

// ── Odontogram tool state ─────────────────────────────────────
let odontogramTool = { color: 'rojo', treatment: null, clearing: false };

function calcAge(fechaNacimiento) {
    if (!fechaNacimiento) return null;
    const birth = new Date(fechaNacimiento);
    if (isNaN(birth.getTime())) return null;
    const now = new Date();
    let age = now.getFullYear() - birth.getFullYear();
    const m = now.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
    return age;
}

window.toggleInfantilSection = function() {
    const section = document.getElementById('odonto-infantil-section');
    const icon    = document.getElementById('odonto-infantil-icon');
    if (!section) return;
    const visible = section.style.display !== 'none';
    section.style.display = visible ? 'none' : 'flex';
    if (icon) icon.className = visible ? 'fa-solid fa-chevron-down' : 'fa-solid fa-chevron-up';
};

function drawTeethRow(teethArray, patientOdontograma, isUpper = true) {
    if(!patientOdontograma) patientOdontograma = {};
    const S = '#b0a0a0';   // stroke color
    const BG = '#f2e8e8';  // face background (light pinkish)

    return teethArray.map(id => {
        const toothData = patientOdontograma[id] || {};
        const estado = toothData.estado;
        const tColor = toothData.color || 'rojo';
        const xColor = tColor === 'azul' ? '#2563eb' : '#dc2626';

        const getColor = (f) => {
            if(toothData[f] === 'caries')     return '#ef4444';
            if(toothData[f] === 'restaurado') return '#2563eb';
            return BG;
        };

        const baseFaces = (interactable = true) => {
            const cls = interactable ? 'class="tooth-face cursor-pointer" pointer-events="all"' : 'pointer-events="none"';
            const getC = interactable ? getColor : () => BG;
            return `
                <polygon points="2,2 98,2 50,50"   ${interactable ? `class="tooth-face cursor-pointer" data-tooth="${id}" data-face="top"` : ''} fill="${getC('top')}"    stroke="${S}" stroke-width="1.5" ${interactable ? 'pointer-events="all"' : 'pointer-events="none"'}/>
                <polygon points="98,2 98,98 50,50"  ${interactable ? `class="tooth-face cursor-pointer" data-tooth="${id}" data-face="right"` : ''} fill="${getC('right')}"  stroke="${S}" stroke-width="1.5" ${interactable ? 'pointer-events="all"' : 'pointer-events="none"'}/>
                <polygon points="98,98 2,98 50,50"  ${interactable ? `class="tooth-face cursor-pointer" data-tooth="${id}" data-face="bottom"` : ''} fill="${getC('bottom')}" stroke="${S}" stroke-width="1.5" ${interactable ? 'pointer-events="all"' : 'pointer-events="none"'}/>
                <polygon points="2,98 2,2 50,50"    ${interactable ? `class="tooth-face cursor-pointer" data-tooth="${id}" data-face="left"` : ''} fill="${getC('left')}"   stroke="${S}" stroke-width="1.5" ${interactable ? 'pointer-events="all"' : 'pointer-events="none"'}/>
                <circle cx="50" cy="50" r="24" ${interactable ? `class="tooth-face cursor-pointer" data-tooth="${id}" data-face="center"` : ''} fill="${getC('center')}" stroke="${S}" stroke-width="2" ${interactable ? 'pointer-events="all"' : 'pointer-events="none"'}/>
                <rect x="2" y="2" width="96" height="96" fill="transparent" stroke="${S}" stroke-width="2.5" pointer-events="none"/>
            `;
        };

        let facesHtml = '';
        let indHtml = '';   // indicator below/above tooth (same slot on every tooth)

        if(estado === 'ausente') {
            facesHtml = `
                <rect x="2" y="2" width="96" height="96" fill="${BG}" stroke="${S}" stroke-width="2.5"/>
                ${baseFaces(false)}
                <line x1="12" y1="12" x2="88" y2="88" stroke="${xColor}" stroke-width="10" stroke-linecap="round"/>
                <line x1="88" y1="12" x2="12" y2="88" stroke="${xColor}" stroke-width="10" stroke-linecap="round"/>
                <rect x="0" y="0" width="100" height="100" class="tooth-face cursor-pointer" data-tooth="${id}" data-face="center" fill="transparent" stroke="none"/>
            `;
        } else if(estado === 'implante') {
            const ic = tColor === 'azul' ? '#1d4ed8' : '#dc2626';
            facesHtml = `
                <rect x="2" y="2" width="96" height="96" fill="${BG}" stroke="${S}" stroke-width="2.5"/>
                ${baseFaces(true)}
            `;
            indHtml = `<svg width="11" height="11" viewBox="0 0 11 11"><rect x="0" y="0" width="11" height="11" fill="${ic}" rx="1.5"/></svg>`;
        } else if(estado === 'corona-implante') {
            const ci = tColor === 'azul' ? '#2563eb' : '#dc2626';
            facesHtml = `
                <rect x="2" y="2" width="96" height="96" fill="${BG}" stroke="${S}" stroke-width="2.5"/>
                ${baseFaces(true)}
            `;
            indHtml = `<svg width="11" height="11" viewBox="0 0 11 11"><polygon points="5.5,0 11,5.5 5.5,11 0,5.5" fill="${ci}"/></svg>`;
        } else if(estado === 'corona') {
            const cc = tColor === 'azul' ? '#2563eb' : '#dc2626';
            facesHtml = `
                <rect x="2" y="2" width="96" height="96" fill="${BG}" stroke="${S}" stroke-width="2.5"/>
                ${baseFaces(false)}
                <circle cx="50" cy="50" r="38" fill="transparent" stroke="${cc}" stroke-width="10"/>
                <rect x="0" y="0" width="100" height="100" class="tooth-face cursor-pointer" data-tooth="${id}" data-face="center" fill="transparent" stroke="none"/>
            `;
        } else if(estado === 'endodoncia') {
            const ec = tColor === 'azul' ? '#2563eb' : '#dc2626';
            facesHtml = `
                <rect x="2" y="2" width="96" height="96" fill="${BG}" stroke="${S}" stroke-width="2.5"/>
                ${baseFaces(false)}
                <rect x="24" y="16" width="52" height="12" fill="${ec}"/>
                <rect x="44" y="28" width="12" height="44" fill="${ec}"/>
                <rect x="24" y="72" width="52" height="12" fill="${ec}"/>
                <rect x="0" y="0" width="100" height="100" class="tooth-face cursor-pointer" data-tooth="${id}" data-face="center" fill="transparent" stroke="none"/>
            `;
        } else if(estado === 'sello') {
            const sc = tColor === 'azul' ? '#2563eb' : '#dc2626';
            facesHtml = `
                <rect x="2" y="2" width="96" height="96" fill="${BG}" stroke="${S}" stroke-width="2.5"/>
                ${baseFaces(true)}
                <text x="50" y="56" font-size="54" font-weight="900" text-anchor="middle" dominant-baseline="middle" fill="${sc}" font-family="Georgia,serif" opacity="0.88" pointer-events="none">S</text>
            `;
        } else if(estado === 'ortodoncia') {
            const oc = tColor === 'azul' ? '#2563eb' : '#dc2626';
            facesHtml = `
                <rect x="2" y="2" width="96" height="96" fill="${BG}" stroke="${S}" stroke-width="2.5"/>
                ${baseFaces(false)}
                <path d="M 62 20 C 62 20 28 20 28 42 C 28 62 72 40 72 62 C 72 82 38 82 38 82" stroke="${oc}" stroke-width="10" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
                <rect x="0" y="0" width="100" height="100" class="tooth-face cursor-pointer" data-tooth="${id}" data-face="center" fill="transparent" stroke="none"/>
            `;
        } else {
            facesHtml = `
                <rect x="2" y="2" width="96" height="96" fill="${BG}" stroke="${S}" stroke-width="2.5"/>
                ${baseFaces(true)}
            `;
        }

        const numSpan = `<span class="text-[9px] md:text-[11px] font-bold text-gray-600 w-full text-center leading-tight">${id}</span>`;
        const svgBox = `<div class="relative tooth-svg-box">
                <svg viewBox="0 0 100 100" class="w-full h-full" style="filter:drop-shadow(0 1px 2px rgba(0,0,0,.12));">
                    ${facesHtml}
                </svg>
            </div>`;
        // Fila inferior: número e indicador en la misma línea
        // implante → cuadrado a la izquierda del número; corona-implante → rombo a la derecha
        const lowerBottom = `<div class="tooth-ind-slot" style="justify-content:center;gap:2px;">
            <div style="width:11px;height:11px;flex-shrink:0;">${estado === 'implante' ? indHtml : ''}</div>
            <span class="text-[9px] md:text-[11px] font-bold text-gray-600 leading-tight">${id}</span>
            <div style="width:11px;height:11px;flex-shrink:0;">${estado === 'corona-implante' ? indHtml : ''}</div>
        </div>`;

        const upperIndAlign = estado === 'corona-implante' ? 'flex-end' : 'flex-start';
        return isUpper
            ? `<div class="flex flex-col items-center tooth-box" data-tooth="${id}">${numSpan}${svgBox}<div class="tooth-ind-slot" style="justify-content:${upperIndAlign};">${indHtml}</div></div>`
            : `<div class="flex flex-col items-center tooth-box" data-tooth="${id}">${svgBox}${lowerBottom}</div>`;
    }).join('');
}

function renderClinicalHistory(patientId) {
    const patient = getClinicalWorkingPatient(patientId);
    if(!patient) return '<p>Paciente no encontrado</p>';
    const clinicalImages = (patient.clinicalImages || []).slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    const latestClinicalImage = clinicalImages[0];
    const canEditClinical = canEditClinicalHistoryUi();
    const draft = getClinicalDraft(patientId);

    // Tratamientos filtrados por profesional seleccionado
    // Los tratamientos sin professionalId (null) se muestran para todos los profesionales
    const selectedProfId = getCurrentOdontoProfessionalId();
    const visibleTreatments = selectedProfId
        ? (patient.treatments || []).filter(t => !t.professionalId || t.professionalId === selectedProfId)
        : (patient.treatments || []);

    let age = '-';
    if(patient.fechaNacimiento) {
        const diff = Date.now() - new Date(patient.fechaNacimiento).getTime();
        age = Math.abs(new Date(diff).getUTCFullYear() - 1970);
    }

    return `
    <div class="clinical-history-card rounded-xl max-w-5xl mx-auto overflow-hidden" style="font-family: Arial, sans-serif;">
        <!-- Cabecera estilo Recetario -->
        <div class="flex flex-col md:flex-row justify-between items-center p-6 border-b-2 border-primary-800 bg-primary-50">
            <div class="flex items-center gap-4 mb-4 md:mb-0">
                <img src="favicon.svg" alt="Odentara" class="clinical-brand-logo">
                <div>
                    <h2 class="text-xl md:text-2xl font-black text-gray-900 tracking-tight uppercase">${escapeHtml(getClinicDisplayName())}</h2>
                    <p class="text-sm font-semibold text-primary-700">Ficha Clínica Odontológica</p>
                </div>
            </div>
            <div class="text-right text-sm clinical-header-actions">
                <div class="clinical-print-toolbar print-hidden">
                    <button type="button" class="btn btn-primary btn-sm" onclick="printClinicalHistory()">
                        <i class="fa-solid fa-print"></i> Imprimir Historia
                    </button>
                </div>
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
            <div class="mb-10 clinical-odontogram-block">
                <div class="odontogram-header mb-4 clinical-odontogram-section">
                    <h3 class="font-black text-gray-800 uppercase tracking-widest text-sm bg-gray-100 py-1 px-3 rounded inline-block border-l-4 border-primary-600">Odontograma</h3>
                    ${(() => {
                        const _scopedProfs = state.user?.allowedProfessionals || [];
                        const _needsSelector = isSuperadmin() || _scopedProfs.length > 1;
                        if (_needsSelector) {
                            const allProfs = DB.get('professionals').filter(p => p.active !== false && p.status !== 'inactivo');
                            const profs = isSuperadmin() ? allProfs : allProfs.filter(p => _scopedProfs.includes(p.id));
                            const selectedId = state.clinicalOdontoProfessionalId;
                            return `<div class="odonto-prof-selector print-hidden">
                                <label class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Profesional:</label>
                                <select id="odonto-prof-select" class="odonto-prof-select-input" onchange="window.changeOdontoProfessional(${patientId}, this.value)">
                                    <option value="">— Seleccionar —</option>
                                    ${profs.map(p => `<option value="${p.id}" ${p.id === selectedId ? 'selected' : ''}>${escapeHtml(p.name)}${p.specialty ? ' · ' + escapeHtml(p.specialty) : ''}</option>`).join('')}
                                </select>
                            </div>`;
                        }
                        const profName = state.user?.assignedProfessionalName || '';
                        const profLabel = profName && !/^Dr\.?\/?(Dra\.?)?|^Dr\.?\s/i.test(profName) ? `Dr/Dra. ${profName}` : profName;
                        return profLabel ? `<span class="text-xs text-gray-500 font-medium print-hidden">${profLabel}</span>` : '';
                    })()}
                </div>
                
                <div class="odontogram-wrapper overflow-x-auto pb-4">
                    <div class="flex flex-col items-center gap-5 min-w-max">
                        <div class="w-full flex flex-col items-center gap-3">
                            <div class="text-[10px] md:text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Dentición Adulta</div>
                            <div class="flex gap-4 md:gap-8 justify-center min-w-max">
                                <div class="flex gap-[2px] md:gap-1"> ${drawTeethRow([18,17,16,15,14,13,12,11], patient.odontograma, true)} </div>
                                <div class="flex gap-[2px] md:gap-1 border-l-2 border-gray-300 pl-4 md:pl-8"> ${drawTeethRow([21,22,23,24,25,26,27,28], patient.odontograma, true)} </div>
                            </div>
                            <div class="odonto-jaw-gap"></div>
                            <div class="flex gap-4 md:gap-8 justify-center min-w-max">
                                <div class="flex gap-[2px] md:gap-1"> ${drawTeethRow([48,47,46,45,44,43,42,41], patient.odontograma, false)} </div>
                                <div class="flex gap-[2px] md:gap-1 border-l-2 border-gray-300 pl-4 md:pl-8"> ${drawTeethRow([31,32,33,34,35,36,37,38], patient.odontograma, false)} </div>
                            </div>
                        </div>

                        ${(() => { const _age = calcAge(patient.fechaNacimiento); const _show = (_age !== null && _age < 13) || hasChildDentitionData(patient); return `
                        <button class="odonto-infantil-toggle" onclick="window.toggleInfantilSection()">
                            <span class="odonto-infantil-toggle-line"></span>
                            <span>Dentición Infantil</span>
                            <i id="odonto-infantil-icon" class="fa-solid ${_show ? 'fa-chevron-up' : 'fa-chevron-down'}"></i>
                            <span class="odonto-infantil-toggle-line"></span>
                        </button>
                        <div id="odonto-infantil-section" style="display:${_show ? 'flex' : 'none'};flex-direction:column;align-items:center;gap:12px;width:100%;">
                            <div class="flex gap-4 md:gap-8 justify-center min-w-max">
                                <div class="flex gap-[2px] md:gap-1"> ${drawTeethRow([55,54,53,52,51], patient.odontograma, true)} </div>
                                <div class="flex gap-[2px] md:gap-1 border-l-2 border-gray-300 pl-4 md:pl-8"> ${drawTeethRow([61,62,63,64,65], patient.odontograma, true)} </div>
                            </div>
                            <div class="odonto-jaw-gap"></div>
                            <div class="flex gap-4 md:gap-8 justify-center min-w-max">
                                <div class="flex gap-[2px] md:gap-1"> ${drawTeethRow([85,84,83,82,81], patient.odontograma, false)} </div>
                                <div class="flex gap-[2px] md:gap-1 border-l-2 border-gray-300 pl-4 md:pl-8"> ${drawTeethRow([71,72,73,74,75], patient.odontograma, false)} </div>
                            </div>
                        </div>`; })()}
                    </div>
                </div>
                <div class="odontogram-mobile-notice print-hidden">
                    <i class="fa-solid fa-display"></i>
                    <div>
                        <strong>Odontograma no disponible</strong>
                        <span>Accedé desde una tablet o computadora para ver y editar el odontograma.</span>
                    </div>
                </div>
                ${canEditClinical ? `
                <div class="odontogram-toolbar print-hidden" id="odontogram-toolbar">
                    <div class="odonto-color-group">
                        <button class="odonto-color-btn odonto-rojo is-active" data-color="rojo" title="Rojo – Caries / Problema">
                            <svg viewBox="0 0 32 32" width="22" height="22"><circle cx="16" cy="16" r="12" fill="#ef4444"/></svg>
                        </button>
                        <button class="odonto-color-btn odonto-azul" data-color="azul" title="Azul – Restaurado / Tratado">
                            <svg viewBox="0 0 32 32" width="22" height="10"><rect x="2" y="10" width="28" height="12" rx="2" fill="#2563eb"/></svg>
                        </button>
                    </div>
                    <div class="odonto-treat-group">
                        <button class="odonto-treat-btn is-active" data-treatment="" title="Arreglo">
                            <img src="/img/odonto/01-arreglo.jpg" alt="Arreglo" class="odonto-treat-img">
                            <span class="odonto-treat-label">Arreglo</span>
                        </button>
                        <button class="odonto-treat-btn" data-treatment="ausente" title="Extracción">
                            <img src="/img/odonto/02-extraccion.jpg" alt="Extracción" class="odonto-treat-img">
                            <span class="odonto-treat-label">Extracción</span>
                        </button>
                        <button class="odonto-treat-btn" data-treatment="implante" title="Implante">
                            <img src="/img/odonto/03-implante.jpg" alt="Implante" class="odonto-treat-img">
                            <span class="odonto-treat-label">Implante</span>
                        </button>
                        <button class="odonto-treat-btn" data-treatment="corona" title="Corona sobre diente">
                            <img src="/img/odonto/04-corona-sobre-diente.jpg" alt="Corona sobre diente" class="odonto-treat-img">
                            <span class="odonto-treat-label">Corona sobre diente</span>
                        </button>
                        <button class="odonto-treat-btn" data-treatment="corona-implante" title="Corona sobre implante">
                            <img src="/img/odonto/05-corona-sobre-implante.jpg" alt="Corona sobre implante" class="odonto-treat-img">
                            <span class="odonto-treat-label">Corona sobre implante</span>
                        </button>
                        <button class="odonto-treat-btn" data-treatment="sello" title="Sellante">
                            <img src="/img/odonto/06-sellante.jpg" alt="Sellante" class="odonto-treat-img">
                            <span class="odonto-treat-label">Sellante</span>
                        </button>
                        <button class="odonto-treat-btn" data-treatment="endodoncia" title="Endodoncia">
                            <img src="/img/odonto/07-endodoncia.jpg" alt="Endodoncia" class="odonto-treat-img">
                            <span class="odonto-treat-label">Endodoncia</span>
                        </button>
                    </div>
                    <div class="odonto-action-group">
                        <button class="odonto-apply-btn" onclick="window.saveClinicalHistory(${patientId})">
                            <i class="fa-solid fa-tooth"></i> APLICAR
                        </button>
                        <button class="odonto-clear-btn" onclick="window.clearOdontogramTooth(${patientId})" id="btn-odonto-clear">
                            <i class="fa-solid fa-eraser"></i> LIMPIAR
                        </button>
                    </div>
                </div>
                ` : ''}
            </div>

            <!-- TRATAMIENTOS -->
            <div class="mb-6">
                <div class="treatments-header bg-gray-100 py-1 px-3 rounded border-l-4 border-primary-600 mb-3">
                    <h3 class="font-black text-gray-800 uppercase tracking-widest text-sm">Registro de Tratamientos</h3>
                    ${canEditClinical ? '<button class="btn btn-primary btn-sm whitespace-nowrap print-hidden" id="btn-add-treatment"><i class="fa-solid fa-plus"></i> Añadir</button>' : ''}
                </div>
                <div class="table-container overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
                    <table class="w-full text-left text-xs md:text-sm table-nowrap" id="treatments-table">
                        <thead class="bg-gray-50 border-b border-gray-200">
                            <tr>
                                <th class="py-2.5 px-3 font-semibold text-gray-600 uppercase tracking-wide text-[10px]">Diente</th>
                                <th class="py-2.5 px-3 font-semibold text-gray-600 uppercase tracking-wide text-[10px] col-hide-sm">Cara</th>
                                <th class="py-2.5 px-3 font-semibold text-gray-600 uppercase tracking-wide text-[10px] col-hide-sm">Sector</th>
                                <th class="py-2.5 px-3 font-semibold text-gray-600 uppercase tracking-wide text-[10px] col-hide-sm">Autorización</th>
                                <th class="py-2.5 px-3 font-semibold text-gray-600 uppercase tracking-wide text-[10px]">Código</th>
                                <th class="py-2.5 px-3 font-semibold text-gray-600 uppercase tracking-wide text-[10px]">Fecha</th>
                                <th class="py-2.5 px-3 font-semibold text-gray-600 uppercase tracking-wide text-[10px] col-hide-xs">Observaciones</th>
                                <th class="py-2.5 px-3 print-hidden"></th>
                            </tr>
                        </thead>
                        <tbody>
                            ${visibleTreatments.map((t, idx) => `
                                <tr class="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                                    <td class="py-2.5 px-3 font-bold text-primary-700">${t.diente}</td>
                                    <td class="py-2.5 px-3 text-gray-600 col-hide-sm">${t.cara || '-'}</td>
                                    <td class="py-2.5 px-3 text-gray-600 col-hide-sm">${t.sector || '-'}</td>
                                    <td class="py-2.5 px-3 text-gray-600 col-hide-sm">${t.autorizacion || '-'}</td>
                                    <td class="py-2.5 px-3 font-mono text-primary-600 font-semibold">${t.codigo || '-'}</td>
                                    <td class="py-2.5 px-3">
                                        <div class="text-gray-800 font-medium">${t.fecha || '-'}</div>
                                        ${t.firma ? `<div class="text-[10px] text-gray-400 mt-0.5">${t.firma}</div>` : ''}
                                    </td>
                                    <td class="py-2.5 px-3 text-gray-500 max-w-xs col-hide-xs">${t.observaciones || '-'}</td>
                                    <td class="py-2 px-2 print-hidden">
                                        ${canEditClinical ? `
                                        <button class="btn-ghost text-gray-300 hover:text-red-500 p-1 transition-colors rounded" onclick="deleteTreatment(${patientId}, ${t.id ?? idx})" title="Eliminar">
                                            <i class="fa-solid fa-trash-can text-xs"></i>
                                        </button>` : ''}
                                    </td>
                                </tr>
                            `).join('')}
                            ${!visibleTreatments.length ? `
                            <tr>
                                <td colspan="8" class="text-center py-10 text-gray-400">
                                    <div class="flex flex-col items-center gap-2">
                                        <i class="fa-solid fa-clipboard text-2xl opacity-30"></i>
                                        <span class="text-sm">No hay tratamientos registrados</span>
                                    </div>
                                </td>
                            </tr>` : ''}
                        </tbody>
                    </table>
                </div>
            </div>

            <div class="mb-4 print-hidden">
                <div class="treatments-header bg-gray-100 py-1 px-3 rounded border-l-4 border-primary-600 mb-4">
                    <h3 class="font-black text-gray-800 uppercase tracking-widest text-sm">Archivos Clínicos</h3>
                    ${canEditClinical ? `
                    <div style="display:flex;gap:8px;flex-wrap:wrap">
                        <button class="btn btn-primary btn-sm whitespace-nowrap" id="btn-add-clinical-image"><i class="fa-solid fa-image"></i> Imagen</button>
                        <button class="btn btn-secondary btn-sm whitespace-nowrap" id="btn-add-clinical-pdf"><i class="fa-solid fa-file-pdf"></i> PDF</button>
                    </div>` : ''}
                </div>
                <div class="clinical-images-shell">
                    <div class="clinical-images-summary">
                        <div>
                            <span>Imágenes</span>
                            <strong>${clinicalImages.filter(i => (i.mimeType || '').startsWith('image/')).length}</strong>
                        </div>
                        <div>
                            <span>Documentos PDF</span>
                            <strong>${clinicalImages.filter(i => i.mimeType === 'application/pdf').length}</strong>
                        </div>
                        <div>
                            <span>Última carga</span>
                            <strong>${escapeHtml(formatClinicalImageDate(latestClinicalImage?.date))}</strong>
                        </div>
                    </div>
                    <div class="clinical-images-grid">
                    ${clinicalImages.map((image, idx) => {
                        const isPdf = image.mimeType === 'application/pdf';
                        const fileId = image.id ?? idx;
                        const deleteBtn = canEditClinical ? `
                            <button type="button" class="clinical-image-action-btn clinical-image-action-delete" onclick="deleteClinicalImage(${patientId}, ${fileId})" aria-label="Eliminar archivo">
                                <i class="fa-solid fa-trash"></i><span>Eliminar</span>
                            </button>` : '';
                        if (isPdf) {
                            const name = escapeHtml(image.fileName || image.description || 'documento.pdf');
                            const url  = escapeHtml(image.dataUrl);
                            return `
                            <article class="clinical-image-card clinical-pdf-card">
                                <div class="clinical-image-actions">
                                    <a href="${url}" target="_blank" rel="noopener" class="clinical-image-action-btn clinical-image-action-view">
                                        <i class="fa-solid fa-eye"></i><span>Ver</span>
                                    </a>
                                    <a href="${url + '&download=1'}" class="clinical-image-action-btn" download>
                                        <i class="fa-solid fa-download"></i><span>Bajar</span>
                                    </a>
                                    ${deleteBtn}
                                </div>
                                <a href="${url}" target="_blank" rel="noopener" class="clinical-pdf-preview-link" style="display:block;text-decoration:none" aria-label="Abrir PDF">
                                    <div class="clinical-pdf-icon"><i class="fa-solid fa-file-pdf"></i></div>
                                </a>
                                <div class="clinical-image-body">
                                    <div class="clinical-image-meta">
                                        <div class="clinical-image-date">${escapeHtml(formatClinicalImageDate(image.date))}</div>
                                        <a href="${url}" target="_blank" rel="noopener" class="clinical-image-inline-link">Abrir</a>
                                    </div>
                                    <p class="clinical-image-description" title="${name}">${name}</p>
                                </div>
                            </article>`;
                        }
                        return `
                        <article class="clinical-image-card">
                            <div class="clinical-image-actions">
                                <button type="button" class="clinical-image-action-btn clinical-image-action-view" onclick="event.stopPropagation(); openClinicalImageViewer(${patientId}, ${fileId})" aria-label="Ver imagen ampliada">
                                    <i class="fa-solid fa-expand"></i><span>Ver</span>
                                </button>
                                ${deleteBtn}
                            </div>
                            <button type="button" class="clinical-image-preview-button" onclick="event.stopPropagation(); openClinicalImageViewer(${patientId}, ${fileId})" aria-label="Ver imagen ampliada">
                                <img src="${escapeHtml(image.dataUrl)}" alt="${escapeHtml(image.description || 'Imagen clínica')}" class="clinical-image-preview" onerror="this.style.display='none'; this.closest('.clinical-image-card')?.querySelector('.clinical-image-body')?.classList.add('clinical-image-body--error'); this.closest('.clinical-image-card')?.classList.add('clinical-image-card--broken');">
                            </button>
                            <div class="clinical-image-body">
                                <div class="clinical-image-meta">
                                    <div class="clinical-image-date">${escapeHtml(formatClinicalImageDate(image.date))}</div>
                                    <button type="button" class="clinical-image-inline-link" onclick="event.stopPropagation(); openClinicalImageViewer(${patientId}, ${fileId})">Abrir</button>
                                </div>
                                <p class="clinical-image-description">${escapeHtml(image.description || 'Sin descripción')}</p>
                                <p class="clinical-image-error">La imagen guardada está incompleta. Vuelve a cargarla.</p>
                            </div>
                        </article>`;
                    }).join('')}
                    ${clinicalImages.length === 0 ? '<div class="clinical-image-empty">Todavía no hay archivos cargados en la historia clínica.</div>' : ''}
                    </div>
                </div>
            </div>

            <!-- NOTAS -->
            <div class="mt-8 bg-yellow-50 p-4 border border-yellow-200 rounded-lg">
                <h3 class="font-bold text-yellow-800 mb-2 uppercase text-xs"><i class="fa-solid fa-notes-medical"></i> Observaciones Generales y Alergias</h3>
                <textarea id="p-general-notes" class="form-input w-full h-20 p-2 text-sm bg-transparent border-yellow-300 focus:border-yellow-500 focus:ring-yellow-500 rounded" ${canEditClinical ? '' : 'disabled'}>${patient.notes || ''}</textarea>
            </div>

            ${canEditClinical ? `
            <div class="clinical-save-footer print-hidden">
                <button type="button" id="btn-save-clinical-history" class="btn btn-primary btn-lg clinical-save-btn ${draft?.isDirty ? 'is-ready' : ''}" onclick="saveClinicalHistory(${patientId})" ${draft?.isDirty ? '' : 'disabled'}>
                    Guardar Historia Clínica
                </button>
            </div>
            ` : ''}
        </div>
    </div>
    `;
}

window.printClinicalHistory = function() {
    document.body.classList.add('printing-clinical-history');

    const cleanup = () => {
        document.body.classList.remove('printing-clinical-history');
    };

    window.addEventListener('afterprint', cleanup, { once: true });
    window.print();

    setTimeout(() => {
        document.body.classList.remove('printing-clinical-history');
    }, 1200);
};

function bindClinicalToothEvents(patientId) {
    document.querySelectorAll('.tooth-face').forEach(face => {
        face.addEventListener('click', (e) => {
            e.stopPropagation();
            const tooth = e.target.dataset.tooth;
            const faceName = e.target.dataset.face;
            if (!tooth) return;

            const draft = getClinicalDraft(patientId);
            if (!draft) return;
            if (!draft.data.odontograma) draft.data.odontograma = {};
            if (!draft.data.odontograma[tooth]) draft.data.odontograma[tooth] = {};

            const toothState = draft.data.odontograma[tooth];
            const { color, treatment } = odontogramTool;

            // LIMPIAR mode — permanece activo hasta que se desactive explícitamente
            if (odontogramTool.clearing) {
                delete draft.data.odontograma[tooth];
                draft.isDirty = true;
                renderClinicalOdontogram(patientId);
                syncClinicalHistorySaveState();
                return;
            }

            const colorValue = color === 'rojo' ? 'caries' : 'restaurado';

            if (treatment === 'ausente') {
                // Toggle ausente
                if (toothState.estado === 'ausente' && toothState.color === color) {
                    delete draft.data.odontograma[tooth];
                } else {
                    draft.data.odontograma[tooth] = { estado: 'ausente', color };
                }
            } else if (treatment && treatment !== '') {
                // Apply treatment to whole tooth
                if (toothState.estado === treatment && toothState.color === color) {
                    delete draft.data.odontograma[tooth];
                } else {
                    draft.data.odontograma[tooth] = { estado: treatment, color };
                }
            } else {
                // Libre: apply color to specific face
                if (toothState.estado) {
                    delete toothState.estado;
                    delete toothState.color;
                }
                if (toothState[faceName] === colorValue) {
                    delete toothState[faceName];
                } else {
                    toothState[faceName] = colorValue;
                }
                const active = ['top','right','bottom','left','center'].filter(k => toothState[k]);
                if (!active.length && !Object.keys(toothState).length) {
                    delete draft.data.odontograma[tooth];
                }
            }

            draft.isDirty = true;
            renderClinicalOdontogram(patientId);
            syncClinicalHistorySaveState();
        });
    });
}

function updateTreatBtnActiveStyle(btn) {
    if (!btn) return;
    if (!btn.classList.contains('is-active')) {
        btn.style.borderColor = '';
        btn.style.background  = '';
        btn.style.boxShadow   = '';
        return;
    }
    const activeStyle = odontogramTool.color === 'azul'
        ? { borderColor: '#2563eb', background: '#2563eb18', boxShadow: '0 2px 8px #2563eb44' }
        : { borderColor: '#dc2626', background: '#dc262618', boxShadow: '0 2px 8px #dc262644' };
    btn.style.borderColor = activeStyle.borderColor;
    btn.style.background  = activeStyle.background;
    btn.style.boxShadow   = activeStyle.boxShadow;
}

function attachOdontogramToolbar(patientId) {
    const toolbar = document.getElementById('odontogram-toolbar');
    if (!toolbar) return;

    odontogramTool.clearing = false;

    // Sincronizar estado interno con el botón activo del HTML (siempre arranca en rojo)
    const activeColorBtn = toolbar.querySelector('.odonto-color-btn.is-active');
    odontogramTool.color = activeColorBtn?.dataset.color || 'rojo';

    toolbar.querySelectorAll('.odonto-color-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            toolbar.querySelectorAll('.odonto-color-btn').forEach(b => b.classList.remove('is-active'));
            btn.classList.add('is-active');
            odontogramTool.color = btn.dataset.color;
            toolbar.querySelectorAll('.odonto-treat-btn').forEach(updateTreatBtnActiveStyle);
        });
    });

    toolbar.querySelectorAll('.odonto-treat-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const already = btn.classList.contains('is-active');
            odontogramTool.clearing = false;
            document.getElementById('btn-odonto-clear')?.classList.remove('is-clearing');
            document.querySelector('.odontogram-wrapper')?.classList.remove('odontogram-erasing');

            toolbar.querySelectorAll('.odonto-treat-btn').forEach(b => {
                b.classList.remove('is-active');
                updateTreatBtnActiveStyle(b);
            });
            if (!already) {
                btn.classList.add('is-active');
                odontogramTool.treatment = btn.dataset.treatment;
                updateTreatBtnActiveStyle(btn);
            } else {
                odontogramTool.treatment = null;
            }
        });
    });

    toolbar.querySelectorAll('.odonto-treat-btn').forEach(updateTreatBtnActiveStyle);
    document.getElementById('btn-odonto-clear')?.classList.toggle('is-clearing', odontogramTool.clearing);
    document.querySelector('.odontogram-wrapper')?.classList.toggle('odontogram-erasing', odontogramTool.clearing);
}

window.clearOdontogramTooth = function(patientId) {
    odontogramTool.clearing = !odontogramTool.clearing;
    const btn     = document.getElementById('btn-odonto-clear');
    const wrapper = document.querySelector('.odontogram-wrapper');
    btn?.classList.toggle('is-clearing', odontogramTool.clearing);
    wrapper?.classList.toggle('odontogram-erasing', odontogramTool.clearing);
};

function attachClinicalHistoryEvents(patientId) {
    if(!canEditClinicalHistoryUi()) return; // Read Only for clinical charting

    const bindDraftInput = (selector, key) => {
        const element = document.querySelector(selector);
        if (!element) return;
        element.oninput = (event) => {
            updateClinicalDraft(patientId, (draft) => {
                draft[key] = event.target.value;
            });
        };
    };

    bindDraftInput('#clinical-fecha-nacimiento', 'fechaNacimiento');
    bindDraftInput('#clinical-phone', 'phone');
    bindDraftInput('#clinical-email', 'email');
    bindDraftInput('#clinical-obra-social', 'obraSocial');
    bindDraftInput('#clinical-credencial', 'credencial');
    bindDraftInput('#clinical-ficha-numero', 'fichaNumero');
    bindDraftInput('#clinical-domicilio', 'domicilio');
    bindDraftInput('#p-general-notes', 'notes');

    bindClinicalToothEvents(patientId);
    attachOdontogramToolbar(patientId);

    document.getElementById('btn-add-treatment')?.addEventListener('click', () => {
        openTreatmentModal(patientId);
    });

    document.getElementById('btn-add-clinical-image')?.addEventListener('click', () => {
        openClinicalImageModal(patientId);
    });
    document.getElementById('btn-add-clinical-pdf')?.addEventListener('click', () => {
        openClinicalPdfModal(patientId);
    });
}

function renderClinicalOdontogram(patientId) {
    const patient = getClinicalWorkingPatient(patientId);
    const wrapper = document.querySelector('.odontogram-wrapper');
    if (!patient || !wrapper) return;

    // Preservar el estado visible de dentición infantil si ya fue toggleado por el usuario
    const existingSection = document.getElementById('odonto-infantil-section');
    const infantilVisible = existingSection
        ? existingSection.style.display !== 'none'
        : ((calcAge(patient.fechaNacimiento) !== null && calcAge(patient.fechaNacimiento) < 13) || hasChildDentitionData(patient));

    wrapper.innerHTML = `
        <div class="flex flex-col items-center gap-5 min-w-max">
            <div class="w-full flex flex-col items-center gap-3">
                <div class="text-[10px] md:text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Dentición Adulta</div>
                <div class="flex gap-4 md:gap-8 justify-center min-w-max">
                    <div class="flex gap-[2px] md:gap-1"> ${drawTeethRow([18,17,16,15,14,13,12,11], patient.odontograma, true)} </div>
                    <div class="flex gap-[2px] md:gap-1 border-l-2 border-gray-300 pl-4 md:pl-8"> ${drawTeethRow([21,22,23,24,25,26,27,28], patient.odontograma, true)} </div>
                </div>
                <div class="odonto-jaw-gap"></div>
                <div class="flex gap-4 md:gap-8 justify-center min-w-max">
                    <div class="flex gap-[2px] md:gap-1"> ${drawTeethRow([48,47,46,45,44,43,42,41], patient.odontograma, false)} </div>
                    <div class="flex gap-[2px] md:gap-1 border-l-2 border-gray-300 pl-4 md:pl-8"> ${drawTeethRow([31,32,33,34,35,36,37,38], patient.odontograma, false)} </div>
                </div>
            </div>

            <button class="odonto-infantil-toggle" onclick="window.toggleInfantilSection()">
                <span class="odonto-infantil-toggle-line"></span>
                <span>Dentición Infantil</span>
                <i id="odonto-infantil-icon" class="fa-solid ${infantilVisible ? 'fa-chevron-up' : 'fa-chevron-down'}"></i>
                <span class="odonto-infantil-toggle-line"></span>
            </button>
            <div id="odonto-infantil-section" style="display:${infantilVisible ? 'flex' : 'none'};flex-direction:column;align-items:center;gap:12px;width:100%;">
                <div class="flex gap-4 md:gap-8 justify-center min-w-max">
                    <div class="flex gap-[2px] md:gap-1"> ${drawTeethRow([55,54,53,52,51], patient.odontograma, true)} </div>
                    <div class="flex gap-[2px] md:gap-1 border-l-2 border-gray-300 pl-4 md:pl-8"> ${drawTeethRow([61,62,63,64,65], patient.odontograma, true)} </div>
                </div>
                <div class="odonto-jaw-gap"></div>
                <div class="flex gap-4 md:gap-8 justify-center min-w-max">
                    <div class="flex gap-[2px] md:gap-1"> ${drawTeethRow([85,84,83,82,81], patient.odontograma, false)} </div>
                    <div class="flex gap-[2px] md:gap-1 border-l-2 border-gray-300 pl-4 md:pl-8"> ${drawTeethRow([71,72,73,74,75], patient.odontograma, false)} </div>
                </div>
            </div>
        </div>
    `;

    bindClinicalToothEvents(patientId);
}

window.savePatientNotes = async function(patientId) {
    return window.saveClinicalHistory(patientId);
};

window.savePatientDetails = async function(patientId) {
    if (!canEditClinicalHistoryUi()) {
        showAlert('Solo el profesional y el superadmin pueden modificar la historia clínica.', { title: 'Historia clínica', variant: 'error' });
        return;
    }
    return window.saveClinicalHistory(patientId);
};

window.changeOdontoProfessional = async function(patientId, professionalId) {
    const profId = professionalId ? Number(professionalId) : null;
    state.clinicalOdontoProfessionalId = profId;
    if (!profId) return;
    try {
        await syncPatientClinicalData(patientId, profId);
        setClinicalDraftFromPatient(DB.get('patients').find(p => p.id === patientId));
        await loadClinicalHistory(patientId, { skipUnsavedCheck: true, skipSync: true });
    } catch (error) {
        showAlert(error.message || 'No se pudo cargar el odontograma.', { title: 'Odontograma', variant: 'error' });
    }
};

window.saveClinicalHistory = async function(patientId) {
    if (!canEditClinicalHistoryUi()) {
        showAlert('Solo el profesional y el superadmin pueden modificar la historia clínica.', { title: 'Historia clínica', variant: 'error' });
        return;
    }

    const draft = getClinicalDraft(patientId);
    if (!draft) return;
    if (!draft.isDirty) {
        showToast('No hay cambios pendientes para guardar.', { type: 'success' });
        return;
    }

    // Usamos el paciente cacheado en localStorage (ya sincronizado con la API al cargar la vista)
    // o si no está, el draft como base
    const cachedPatient = DB.get('patients').find((item) => item.id === patientId) || {};
    const mergedValues = {
        ...cachedPatient,
        ...draft.data,
        odontograma: deepClone(draft.data.odontograma || {})
    };

    const odontoProfessionalId = getCurrentOdontoProfessionalId();

    try {
        await withAppLoading('Guardando historia clínica...', async () => {
            if (state.authToken) {
                await apiFetch(`/patients/${patientId}`, {
                    method: 'PUT',
                    body: JSON.stringify(buildPatientApiPayload(mergedValues))
                });
                await apiFetch(`/clinical-records/${patientId}`, {
                    method: 'PUT',
                    body: JSON.stringify({
                        professionalId: odontoProfessionalId,
                        summaryNotes: mergedValues.notes || '',
                        allergies: mergedValues.allergies || null,
                        medicalNotes: mergedValues.medicalNotes || null,
                        odontogramEntries: legacyOdontogramToEntries(mergedValues.odontograma || {})
                    })
                });
                await syncPatientClinicalData(patientId, odontoProfessionalId);
            } else {
                DB.update('patients', patientId, mergedValues);
            }
        });

        setClinicalDraftFromPatient(getClinicalWorkingPatient(patientId));
        if (state.clinicalDraft) state.clinicalDraft.isDirty = false;
        syncClinicalHistorySaveState();
        showToast('Historia clínica guardada.', { type: 'success' });
        await loadClinicalHistory(patientId, { skipUnsavedCheck: true, skipSync: !state.authToken });
    } catch (error) {
        showAlert(error.message || 'No se pudo guardar la historia clínica.', { title: 'Historia clínica', variant: 'error' });
    }
};

window.deleteUser = async function(userId) {
    if (!isSuperadmin()) {
        showAlert('Solo el superadmin puede eliminar usuarios.', { title: 'Usuarios', variant: 'error' });
        return;
    }
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
        showAlert('Solo el profesional y el superadmin pueden modificar la historia clínica.', { title: 'Historia clínica', variant: 'error' });
        return;
    }
    if (hasUnsavedClinicalDraft()) {
        showAlert('Primero guarda la historia clínica antes de eliminar tratamientos.', { title: 'Historia clínica', variant: 'warning' });
        return;
    }
    if(await showConfirm('¿Eliminar registro de tratamiento?', { title: 'Eliminar tratamiento', confirmText: 'Eliminar' })) {
        const p = DB.get('patients').find(pt => pt.id === patientId);
        if (!p) return;

        try {
            if (state.authToken && Number.isInteger(Number(treatmentId))) {
                await apiFetch(`/treatments/${treatmentId}`, { method: 'DELETE' });
                await syncPatientClinicalData(patientId, getCurrentOdontoProfessionalId());
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
        showAlert('Solo el profesional y el superadmin pueden modificar la historia clínica.', { title: 'Historia clínica', variant: 'error' });
        return;
    }
    if (hasUnsavedClinicalDraft()) {
        showAlert('Primero guarda la historia clínica antes de eliminar imágenes clínicas.', { title: 'Historia clínica', variant: 'warning' });
        return;
    }
    if(await showConfirm('¿Eliminar imagen clínica?', { title: 'Eliminar imagen', confirmText: 'Eliminar' })) {
        const p = DB.get('patients').find(pt => pt.id === patientId);
        if (!p) return;

        try {
            if (state.authToken && Number.isInteger(Number(imageId))) {
                await apiFetch(`/clinical-images/${imageId}`, { method: 'DELETE' });
                await syncPatientClinicalData(patientId, getCurrentOdontoProfessionalId());
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
        showAlert('Solo el profesional y el superadmin pueden modificar la historia clínica.', { title: 'Historia clínica', variant: 'error' });
        return;
    }
    if (hasUnsavedClinicalDraft()) {
        showAlert('Primero guarda la historia clínica antes de agregar tratamientos.', { title: 'Historia clínica', variant: 'warning' });
        return;
    }
    modalsContainer.innerHTML = `
        <div class="modal-overlay active">
            <div class="modal-content modal-content-treatment" onclick="event.stopPropagation()">
                <div class="modal-header">
                    <h3>Añadir Tratamiento a Ficha</h3>
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
                            <div class="input-group flex-1"><label>Autorización</label><input type="text" id="tx-auth" placeholder="Nº Orden"></div>
                            <div class="input-group flex-1"><label>Código OS</label><input type="text" id="tx-codigo" placeholder="Ej: 01.01"></div>
                        </div>
                        <div class="input-group"><label>Observaciones</label><input type="text" id="tx-obs" placeholder="Detalles del procedimiento..." required></div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-ghost" onclick="closeModal()">Cancelar</button>
                        <button type="submit" class="btn btn-primary">Añadir a Tabla</button>
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
            await withAppLoading('Guardando tratamiento...', async () => {
                if (state.authToken) {
                    await apiFetch('/treatments', {
                        method: 'POST',
                        body: JSON.stringify({
                            patientId,
                            professionalId: getCurrentOdontoProfessionalId(),
                            tooth: treatment.diente,
                            face: treatment.cara,
                            sector: treatment.sector,
                            authorizationNumber: treatment.autorizacion,
                            insuranceCode: treatment.codigo,
                            observations: treatment.observaciones,
                            performedAt: new Date().toISOString()
                        })
                    });
                    await syncPatientClinicalData(patientId, getCurrentOdontoProfessionalId());
                } else {
                    p.treatments.push(treatment);
                    DB.update('patients', patientId, { treatments: p.treatments });
                }
            });

            closeModal();
            loadClinicalHistory(patientId);
        } catch (error) {
            showAlert(error.message || 'No se pudo guardar el tratamiento.', { title: 'Historia clínica', variant: 'error' });
        }
    });
}

function openClinicalImageModal(patientId) {
    if (!canEditClinicalHistoryUi()) {
        showAlert('Solo el profesional y el superadmin pueden modificar la historia clínica.', { title: 'Historia clínica', variant: 'error' });
        return;
    }
    if (hasUnsavedClinicalDraft()) {
        showAlert('Primero guarda la historia clínica antes de agregar imágenes clínicas.', { title: 'Historia clínica', variant: 'warning' });
        return;
    }
    modalsContainer.innerHTML = `
        <div class="modal-overlay active">
            <div class="modal-content modal-content-patient" onclick="event.stopPropagation()">
                <div class="modal-header">
                    <h3>Agregar Imagen Clínica</h3>
                    <button class="btn-ghost" data-modal-close><i class="fa-solid fa-times"></i></button>
                </div>
                <form id="clinical-image-form">
                    <div class="modal-body">
                        <div class="input-group">
                            <label>Fecha</label>
                            <input type="date" id="clinical-image-date" value="${getTodayIsoLocal()}" required>
                        </div>
                        <div class="input-group">
                            <label>Descripción</label>
                            <input type="text" id="clinical-image-description" placeholder="Ej: Radiografía panorámica inicial" required>
                        </div>
                        <div class="input-group">
                            <label>Imágenes</label>
                            <input type="file" id="clinical-image-file" accept="image/*" multiple required>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-ghost" onclick="closeModal()">Cancelar</button>
                        <button type="submit" class="btn btn-primary">Guardar Imágenes</button>
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
            const img = new Image();
            const objectUrl = URL.createObjectURL(file);
            img.onload = () => {
                const MAX_SIDE = 1600;
                const scale = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));
                const width  = Math.max(1, Math.round(img.width  * scale));
                const height = Math.max(1, Math.round(img.height * scale));
                const canvas = document.createElement('canvas');
                canvas.width  = width;
                canvas.height = height;
                canvas.getContext('2d').drawImage(img, 0, 0, width, height);
                URL.revokeObjectURL(objectUrl);
                let dataUrl = canvas.toDataURL('image/webp', 0.80);
                if (!dataUrl.startsWith('data:image/webp')) {
                    dataUrl = canvas.toDataURL('image/jpeg', 0.78);
                }
                resolve({
                    id: Date.now() + Math.floor(Math.random() * 1000),
                    date: selectedDate,
                    description: selectedDescription,
                    dataUrl
                });
            };
            img.onerror = reject;
            img.src = objectUrl;
        }))).then(async (newImages) => {
            const p = DB.get('patients').find(pt => pt.id === patientId);

            await withAppLoading('Guardando imágenes clínicas...', async () => {
                if (state.authToken) {
                    await apiFetch('/clinical-images', {
                        method: 'POST',
                        body: JSON.stringify({
                            patientId,
                            professionalId: getCurrentOdontoProfessionalId(),
                            images: newImages.map((image) => ({
                                imageUrl: image.dataUrl,
                                description: image.description,
                                takenAt: image.date ? image.date + 'T12:00:00' : null
                            }))
                        })
                    });
                    await syncPatientClinicalData(patientId, getCurrentOdontoProfessionalId());
                } else if (p) {
                    const images = (p.clinicalImages || []).slice();
                    images.push(...newImages);
                    DB.update('patients', patientId, { clinicalImages: images });
                }
            });

            closeModal();
            loadClinicalHistory(patientId);
        }).catch(() => {
            alert('No se pudieron cargar una o mas imagenes.');
        });
    });
}

function openClinicalPdfModal(patientId) {
    if (!canEditClinicalHistoryUi()) {
        showAlert('Solo el profesional y el superadmin pueden modificar la historia clínica.', { title: 'Historia clínica', variant: 'error' });
        return;
    }
    if (hasUnsavedClinicalDraft()) {
        showAlert('Primero guarda la historia clínica antes de agregar documentos.', { title: 'Historia clínica', variant: 'warning' });
        return;
    }

    modalsContainer.innerHTML = `
        <div class="modal-overlay active">
            <div class="modal-content modal-content-patient" onclick="event.stopPropagation()">
                <div class="modal-header">
                    <h3>Agregar Documentos PDF</h3>
                    <button class="btn-ghost" data-modal-close><i class="fa-solid fa-times"></i></button>
                </div>
                <form id="clinical-pdf-form">
                    <div class="modal-body">
                        <div class="input-group">
                            <label>Fecha</label>
                            <input type="date" id="clinical-pdf-date" value="${getTodayIsoLocal()}" required>
                        </div>
                        <div class="input-group">
                            <label>Descripción <span style="color:var(--gray-400);font-weight:400">(opcional, aplica a todos)</span></label>
                            <input type="text" id="clinical-pdf-description" placeholder="Ej: Consentimiento informado, Derivación, Análisis">
                        </div>
                        <div class="input-group">
                            <label>Archivos PDF</label>
                            <input type="file" id="clinical-pdf-file" accept="application/pdf" multiple required>
                            <p style="font-size:0.78rem;color:var(--gray-400);margin-top:4px">Podés seleccionar varios PDFs a la vez · Máx. 10 MB por archivo</p>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-ghost" onclick="closeModal()">Cancelar</button>
                        <button type="submit" class="btn btn-primary" id="clinical-pdf-submit"><i class="fa-solid fa-upload"></i> Subir PDF</button>
                    </div>
                </form>
            </div>
        </div>
    `;

    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); }, { once: true });

    document.getElementById('clinical-pdf-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const fileInput = document.getElementById('clinical-pdf-file');
        const files = Array.from(fileInput.files || []);
        if (!files.length) { alert('Seleccioná al menos un archivo PDF.'); return; }

        for (const f of files) {
            if (f.type !== 'application/pdf') { alert(`"${f.name}" no es un PDF.`); return; }
            if (f.size > 10 * 1024 * 1024) { alert(`"${f.name}" supera el límite de 10 MB.`); return; }
        }

        const selectedDate        = document.getElementById('clinical-pdf-date').value;
        const selectedDescription = document.getElementById('clinical-pdf-description').value.trim();
        const submitBtn           = document.getElementById('clinical-pdf-submit');
        if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Subiendo...'; }

        const readFileAsDataUrl = (f) => new Promise((resolve, reject) => {
            const r = new FileReader();
            r.onload  = () => resolve(r.result);
            r.onerror = reject;
            r.readAsDataURL(f);
        });

        try {
            const dataUrls = await Promise.all(files.map(readFileAsDataUrl));
            const images = dataUrls.map((dataUrl, i) => ({
                imageUrl:    dataUrl,
                mimeType:    'application/pdf',
                fileName:    files[i].name,
                description: selectedDescription || files[i].name,
                takenAt:     selectedDate ? selectedDate + 'T12:00:00' : null,
            }));

            await withAppLoading(`Guardando ${files.length > 1 ? files.length + ' documentos' : 'documento'} PDF...`, async () => {
                await apiFetch('/clinical-images', {
                    method: 'POST',
                    body: JSON.stringify({
                        patientId,
                        professionalId: getCurrentOdontoProfessionalId(),
                        images,
                    })
                });
                await syncPatientClinicalData(patientId, getCurrentOdontoProfessionalId());
            });
            closeModal();
            loadClinicalHistory(patientId);
        } catch (err) {
            alert(err.message || 'No se pudieron subir los documentos PDF.');
            if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = '<i class="fa-solid fa-upload"></i> Subir PDF'; }
        }
    });
}


