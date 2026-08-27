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

    // Segundo paso: procesar caras y marcadores especiales (L=color azul, I=endodoncia overlay)
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

        // 'I' es el marcador de endodoncia como capa independiente del sustrato
        // (implante, corona-implante, corona, o diente normal) — ver legacyOdontogramToEntries.
        if (entry.face === 'I' && status === 'endodoncia') {
            odontograma[toothNumber].endodoncia = true;
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

        // Endodoncia como capa independiente (ver drawTeethRow): se guarda como
        // face='I' (nunca emitida por ninguna cara real), separada del estado de
        // base. Aplica sobre cualquier sustrato salvo "ausente", y se omite si el
        // estado de base ya es 'endodoncia' (dato legacy, ya cubierto por face=null).
        if (toothData.endodoncia === true && toothData.estado !== 'ausente' && toothData.estado !== 'endodoncia') {
            entries.push({
                toothNumber: String(toothNumber),
                face: 'I',
                status: statusMap.endodoncia
            });
        }

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
            medicalHistory: patient.medicalHistory || null,
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

// La ficha clínica (odontograma, notas, tratamientos, archivos) es compartida
// por toda la clínica — no hay un "profesional activo" que filtre qué se ve.
// Recetas y presupuestos siguen siendo privados, pero el backend ya los
// scopea solo con el usuario autenticado (sin necesitar un query param acá).
async function syncPatientClinicalData(patientId) {
    if (!state.authToken) {
        return DB.get('patients').find((item) => item.id === patientId) || null;
    }

    const [patientRes, treatmentsRes, imagesRes, clinicalRecordRes, prescriptionsRes, budgetsRes] = await Promise.all([
        apiFetch(`/patients/${patientId}`),
        apiFetch(`/treatments?patientId=${patientId}`),
        apiFetch(`/clinical-images?patientId=${patientId}`),
        apiFetch(`/clinical-records/${patientId}`),
        apiFetch(`/prescriptions?patientId=${patientId}`).catch(() => ({ prescriptions: [] })),
        apiFetch(`/budgets?patientId=${patientId}`).catch(() => ({ budgets: [] }))
    ]);

    const mappedPatient = mapApiPatientToLegacy(patientRes.patient || {});
    const record = clinicalRecordRes.record || null;
    const mergedPatient = {
        ...mappedPatient,
        odontograma: clinicalRecordEntriesToLegacyOdontogram(record?.odontogramEntries || []),
        treatments: (treatmentsRes.treatments || []).map(mapApiTreatmentToLegacy),
        clinicalImages: (imagesRes.images || []).map(mapApiClinicalImageToLegacy),
        prescriptions: prescriptionsRes.prescriptions || [],
        budgets: budgetsRes.budgets || [],
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
        // El visor solo muestra imágenes reales — los PDF se abren en pestaña desde su card
        .filter(item => item.mimeType !== 'application/pdf')
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

    // ── Confinar el zoom al visor ──────────────────────────────────────────
    // El pinch solo estaba contemplado sobre la imagen. Si el gesto arrancaba
    // en cualquier otro lado del visor (fondo, encabezado, márgenes), lo tomaba
    // el navegador y hacía zoom de LA PÁGINA. Como el visor es position:fixed y
    // ocupa toda la pantalla, después no había forma de deshacer ese zoom: el
    // usuario quedaba atrapado.
    // Acá se bloquea el zoom nativo en toda la superficie del visor, para que
    // ampliar solo sea posible con los botones del propio visor.
    const overlay = document.querySelector('.clinical-image-viewer-overlay');
    if (overlay && !overlay.dataset.zoomGuard) {
        overlay.dataset.zoomGuard = '1';

        // Safari en iOS no cancela el zoom de página con touchmove: usa sus
        // propios eventos gesture*, que hay que frenar explícitamente.
        ['gesturestart', 'gesturechange', 'gestureend'].forEach((evt) => {
            overlay.addEventListener(evt, (e) => e.preventDefault());
        });

        // Cualquier pinch iniciado fuera de la imagen tampoco debe llegar al
        // navegador (dentro de la imagen ya lo maneja el handler de arriba).
        overlay.addEventListener('touchmove', (e) => {
            if (e.touches.length > 1) e.preventDefault();
        }, { passive: false });

        // Doble toque: en iOS también dispara zoom de página.
        let lastTap = 0;
        overlay.addEventListener('touchend', (e) => {
            const now = Date.now();
            if (now - lastTap < 300 && e.touches.length === 0) e.preventDefault();
            lastTap = now;
        }, { passive: false });
    }
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
                        <a href="${escapeHtml(image.dataUrl)}" download="${escapeHtml(image.fileName || label)}" class="clinical-image-viewer-zoom-btn clinical-image-viewer-download" onclick="event.stopPropagation()" aria-label="Descargar imagen" title="Descargar"><i class="fa-solid fa-download"></i></a>
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


// --- Ficha Clínica y Odontograma ---

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
    // Al abrir un paciente distinto, arrancar siempre en la pestaña Clínico
    if (state.currentPatientId !== patientId) {
        state.clinicalActiveTab = 'clinico';
    }
    state.currentView = 'patient-history';
    state.currentPatientId = patientId;
    pageTitle.innerText = 'Ficha Odontológica';
    mainContent.innerHTML = '<div class="card p-6 text-center text-gray-500">Cargando historia clínica...</div>';

    try {
        if (!options.skipSync) {
            await syncPatientClinicalData(patientId);
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
    // loadClinicalHistory no pasa por loadView, asi que registra su propia
    // entrada en el historial de navegacion.
    if (typeof recordNavEntry === 'function') recordNavEntry('patient-history', 'Ficha Odontologica');
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
                <input class="form-input clinical-readonly" type="text" value="${escapeHtml(patient.name || '')}" disabled>
            </div>
            <div class="clinical-info-item clinical-info-item-compact">
                <strong class="text-gray-600 uppercase text-xs">DNI</strong>
                <input class="form-input clinical-readonly" type="text" value="${escapeHtml(patient.dni || '')}" disabled>
            </div>
            <div class="clinical-info-item clinical-info-item-compact">
                <strong class="text-gray-600 uppercase text-xs">Nacimiento</strong>
                <input class="form-input" type="date" id="clinical-fecha-nacimiento" value="${escapeHtml(patient.fechaNacimiento || '')}" ${canEditClinical ? '' : 'disabled'}>
            </div>
            <div class="clinical-info-item clinical-info-item-compact">
                <strong class="text-gray-600 uppercase text-xs">Edad</strong>
                <div class="clinical-static-value">${age} años</div>
            </div>
            <div class="clinical-info-item clinical-info-item-compact">
                <strong class="text-gray-600 uppercase text-xs">Teléfono</strong>
                <input class="form-input" type="text" id="clinical-phone" value="${escapeHtml(patient.phone || '')}" ${canEditClinical ? '' : 'disabled'}>
            </div>
            <div class="clinical-info-item clinical-info-item-compact">
                <strong class="text-gray-600 uppercase text-xs">Email</strong>
                <input class="form-input" type="email" id="clinical-email" value="${escapeHtml(patient.email || '')}" ${canEditClinical ? '' : 'disabled'}>
            </div>
            <div class="clinical-info-item clinical-info-item-compact">
                <strong class="text-gray-600 uppercase text-xs">Obra Social / Plan</strong>
                <input class="form-input" type="text" id="clinical-obra-social" value="${escapeHtml(patient.obraSocial || '')}" ${canEditClinical ? '' : 'disabled'}>
            </div>
            <div class="clinical-info-item clinical-info-item-compact">
                <strong class="text-gray-600 uppercase text-xs">Credencial</strong>
                <input class="form-input" type="text" id="clinical-credencial" value="${escapeHtml(patient.credencial || '')}" ${canEditClinical ? '' : 'disabled'}>
            </div>
            <div class="clinical-info-item clinical-info-item-compact clinical-info-item-wide">
                <strong class="text-gray-600 uppercase text-xs">Ficha N°</strong>
                <input class="form-input" type="text" id="clinical-ficha-numero" value="${escapeHtml(patient.fichaNumero || '')}" ${canEditClinical ? '' : 'disabled'}>
            </div>
            <div class="clinical-info-item clinical-info-item-compact clinical-info-item-wide">
                <strong class="text-gray-600 uppercase text-xs">Domicilio</strong>
                <input class="form-input" type="text" id="clinical-domicilio" value="${escapeHtml(patient.domicilio || '')}" ${canEditClinical ? '' : 'disabled'}>
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

        // Endodoncia como capa independiente del sustrato (implante, corona-implante,
        // corona, o diente normal): no borra el estado de base al aplicarse. Solo se
        // bloquea sobre "ausente" (diente extraído) y se evita duplicar el dibujo si
        // el estado de base YA es 'endodoncia' (dato legacy sin capa independiente).
        if (toothData.endodoncia === true && estado !== 'ausente' && estado !== 'endodoncia') {
            const ec = tColor === 'azul' ? '#2563eb' : '#dc2626';
            facesHtml += `
                <rect x="24" y="16" width="52" height="12" fill="${ec}"/>
                <rect x="44" y="28" width="12" height="44" fill="${ec}"/>
                <rect x="24" y="72" width="52" height="12" fill="${ec}"/>
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

// ── Antecedentes médicos (cuestionario de la ficha) ───────────────
// Fuente única de verdad para las claves — debe coincidir con patient.service.js
// del backend y con el schema de extracción por IA.
const MEDICAL_BOOL_FIELDS = [
    { key: 'cardiacos',          label: 'Problemas cardíacos' },
    { key: 'presionAlta',        label: 'Presión sanguínea alta' },
    { key: 'presionBaja',        label: 'Presión sanguínea baja' },
    { key: 'hepatitis',          label: 'Hepatitis' },
    { key: 'ulcerasEstomago',    label: 'Úlceras de estómago' },
    { key: 'diabetes',           label: 'Diabetes' },
    { key: 'asma',               label: 'Asma' },
    { key: 'venereasSida',       label: 'Enfermedades venéreas / SIDA' },
    { key: 'fiebreReumatica',    label: 'Fiebre reumática' },
    { key: 'epilepsia',          label: 'Epilepsia / Convulsiones' },
    { key: 'desmayos',           label: 'Desmayos' },
    { key: 'problemasHepaticos', label: 'Problemas hepáticos' },
    { key: 'embarazo',           label: 'Embarazo' },
    { key: 'examenHiv',          label: 'Examen de HIV' },
    { key: 'problemasRenales',   label: 'Problemas renales' },
    { key: 'servicioUrgencia',   label: '¿Está asociado a servicio de urgencia?' },
    { key: 'sangradoExcesivo',   label: '¿Sangra en exceso al lastimarse o extraer un diente?' },
    { key: 'fuma',               label: '¿Fuma?' },
];
// Casilleros Sí/No con un campo de texto asociado ("¿cuál?")
const MEDICAL_BOOL_WITH_TEXT = [
    { key: 'bajoTratamiento',  textKey: 'bajoTratamientoCual',  label: '¿Bajo tratamiento médico por alguna enfermedad?', textLabel: '¿Cuál?' },
    { key: 'reaccionAlergica', textKey: 'reaccionAlergicaCual', label: '¿Tuvo reacciones alérgicas a medicamentos (aspirina, penicilina, anestésicos)?', textLabel: '¿Cuál?' },
    { key: 'tomaMedicamentos', textKey: 'medicamentosCuales',   label: '¿Toma algún medicamento (incluso de venta libre)?', textLabel: '¿Cuáles?' },
];

// Solo los campos del cuestionario (grilla Sí/No + los que llevan texto),
// sin el wrapper de pestaña — se reutiliza tanto en la Historia Clínica
// (dentro de la pestaña "Antecedentes") como en el modal de Nuevo/Editar
// Paciente (donde no hay pestañas, así que el wrapper .clinical-tab-panel
// quedaría oculto por CSS al no tener la clase .is-active).
function renderMedicalHistoryFields(patient, canEdit) {
    const mh = patient.medicalHistory || {};
    const dis = canEdit ? '' : 'disabled';
    const yesNo = (f) => `
        <label class="mh-row">
            <span class="mh-label">${f.label}</span>
            <span class="mh-toggle">
                <label class="mh-opt"><input type="radio" name="mh-${f.key}" value="si" ${mh[f.key] === true ? 'checked' : ''} ${dis}> Sí</label>
                <label class="mh-opt"><input type="radio" name="mh-${f.key}" value="no" ${mh[f.key] === false ? 'checked' : ''} ${dis}> No</label>
            </span>
        </label>`;
    const half = Math.ceil(MEDICAL_BOOL_FIELDS.length / 2);
    const col1 = MEDICAL_BOOL_FIELDS.slice(0, half).map(yesNo).join('');
    const col2 = MEDICAL_BOOL_FIELDS.slice(half).map(yesNo).join('');
    const withText = MEDICAL_BOOL_WITH_TEXT.map(f => `
        <div class="mh-row-text">
            <label class="mh-row mh-row-inline">
                <span class="mh-label">${f.label}</span>
                <span class="mh-toggle">
                    <label class="mh-opt"><input type="radio" name="mh-${f.key}" value="si" ${mh[f.key] === true ? 'checked' : ''} ${dis}> Sí</label>
                    <label class="mh-opt"><input type="radio" name="mh-${f.key}" value="no" ${mh[f.key] === false ? 'checked' : ''} ${dis}> No</label>
                </span>
            </label>
            <input type="text" class="form-input mh-text" id="mh-text-${f.textKey}" placeholder="${f.textLabel}" value="${escapeHtml(mh[f.textKey] || '')}" ${dis}>
        </div>`).join('');

    return `
        <div class="mh-grid">
            <div class="mh-col">${col1}</div>
            <div class="mh-col">${col2}</div>
        </div>
        <div class="mh-text-section">${withText}</div>`;
}

function renderMedicalHistoryPanel(patient, canEdit) {
    return `
    <div class="clinical-tab-panel ${( state.clinicalActiveTab || 'clinico') === 'antecedentes' ? 'is-active' : ''}" data-tab="antecedentes">
        <div class="mb-4">
            <div class="treatments-header bg-gray-100 py-1 px-3 rounded border-l-4 border-primary-600 mb-3">
                <h3 class="font-black text-gray-800 uppercase tracking-widest text-sm">Antecedentes Médicos</h3>
            </div>
            <p class="text-xs text-gray-500 mb-4 print-hidden"><i class="fa-solid fa-circle-info"></i> Cuestionario de salud del paciente. Marcá Sí/No en cada ítem.</p>
            ${renderMedicalHistoryFields(patient, canEdit)}
        </div>
    </div>`;
}

/**
 * Movimientos de cuenta corriente del paciente, dentro de la pestana de
 * Presupuestos.
 *
 * La tabla va dentro de un <details> cerrado: el saldo y el acceso a la cuenta
 * completa son lo que se consulta siempre, y el listado de movimientos —que en
 * un paciente con historia son decenas de filas— empujaba los presupuestos
 * fuera de la pantalla. El resumen queda a la vista y el detalle a un toque.
 *
 * Se muestra un saldo por moneda y nunca uno solo: pesos y dolares no se suman.
 * Es el mismo criterio de la pantalla de Facturacion, con el mismo modulo de
 * calculo, para que los dos lugares no puedan decir cosas distintas del mismo
 * paciente.
 */
function renderClinicalMovements(patientId) {
    const resumen = getPatientCurrentAccountSummary(patientId);
    const movimientos = (resumen?.entries || [])
        .slice()
        .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')) || (b.id - a.id));

    const saldos = (resumen?.totalesPorMoneda || []).map(t => {
        const etiqueta = etiquetaDeSaldo(t.balance, t.moneda);
        return `<span class="badge ${etiqueta.estado === 'debe' ? 'badge-warning' : 'badge-success'}">${etiqueta.texto}</span>`;
    }).join(' ');

    return `
    <div class="mb-6 print-hidden">
        <div class="treatments-header bg-gray-100 py-1 px-3 rounded border-l-4 border-primary-600 mb-3">
            <h3 class="font-black text-gray-800 uppercase tracking-widest text-sm">Movimientos de cuenta corriente</h3>
            <div class="flex gap-2 flex-wrap items-center">
                ${saldos}
                <button class="btn btn-secondary btn-sm whitespace-nowrap" onclick="verCuentaCorrienteDelPaciente(${patientId})">
                    <i class="fa-solid fa-book-open"></i> Ver cuenta corriente
                </button>
            </div>
        </div>
        ${movimientos.length ? `
        <details class="cc-movs-details">
            <summary class="cc-movs-summary">
                <span class="cc-movs-summary-inner">
                    <i class="fa-solid fa-chevron-right cc-movs-chevron"></i>
                    <span>Ver movimientos</span>
                    <span class="badge badge-gray cc-movs-count">${movimientos.length}</span>
                </span>
            </summary>
        <div class="table-container overflow-x-auto rounded-lg border border-gray-200 shadow-sm mt-2">
            <table class="w-full text-left text-xs md:text-sm table-nowrap">
                <thead class="bg-gray-50 border-b border-gray-200">
                    <tr>
                        <th class="py-2.5 px-3 font-semibold text-gray-600 uppercase tracking-wide text-[10px]">Fecha</th>
                        <th class="py-2.5 px-3 font-semibold text-gray-600 uppercase tracking-wide text-[10px] col-hide-sm">Profesional</th>
                        <th class="py-2.5 px-3 font-semibold text-gray-600 uppercase tracking-wide text-[10px]">Tipo</th>
                        <th class="py-2.5 px-3 font-semibold text-gray-600 uppercase tracking-wide text-[10px] col-hide-sm">Concepto</th>
                        <th class="py-2.5 px-3 font-semibold text-gray-600 uppercase tracking-wide text-[10px] text-right">Monto</th>
                    </tr>
                </thead>
                <tbody>
                    ${movimientos.map(m => {
                        const esPago = ['income', 'payment'].includes(m.type);
                        const prof = getAccessibleProfessionals().find(p => p.id === m.professionalId);
                        return `
                        <tr class="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                            <td class="py-2.5 px-3 text-gray-800 font-medium">${m.date ? String(m.date).split('-').reverse().join('/') : '-'}</td>
                            <td class="py-2.5 px-3 text-gray-600 col-hide-sm">${escapeHtml(prof?.name || 'Sin profesional')}</td>
                            <td class="py-2.5 px-3"><span class="badge ${esPago ? 'badge-success' : 'badge-warning'}">${esPago ? 'Pago' : 'Cargo'}</span></td>
                            <td class="py-2.5 px-3 text-gray-700 col-hide-sm">${escapeHtml(m.description || 'Sin descripcion')}</td>
                            <td class="py-2.5 px-3 text-right font-bold ${esPago ? 'text-success' : 'text-warning'}">${formatearMonto(m.amount, m.currency)}</td>
                        </tr>`;
                    }).join('')}
                </tbody>
            </table>
        </div>
        </details>` : `
        <div class="text-center py-6 text-gray-400 border border-dashed border-gray-200 rounded-lg">
            <i class="fa-solid fa-cash-register text-2xl opacity-30"></i>
            <p class="text-sm mt-1">Sin movimientos registrados</p>
        </div>`}
    </div>`;
}

/**
 * Lleva a la cuenta corriente completa del paciente, en Facturacion.
 *
 * Pasa por confirmClinicalDraftExit() antes de irse. openPatientBilling() navega
 * con skipUnsavedCheck porque los otros lugares que lo llaman no estan dentro de
 * una ficha; desde aca si, y salir sin preguntar se llevaria puesto un
 * odontograma a medio cargar sin decir nada. Si no hay borrador, la comprobacion
 * devuelve true en el acto y no se nota.
 */
window.verCuentaCorrienteDelPaciente = async function(patientId) {
    if (!(await confirmClinicalDraftExit())) return;
    await window.openPatientBilling(patientId);
};

function renderClinicalHistory(patientId) {
    const patient = getClinicalWorkingPatient(patientId);
    if(!patient) return '<p>Paciente no encontrado</p>';
    const clinicalImages = (patient.clinicalImages || []).slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    const latestClinicalImage = clinicalImages[0];
    const canEditClinical = canEditClinicalHistoryUi();
    const draft = getClinicalDraft(patientId);
    // Pestaña activa de la ficha — se conserva entre re-renders (ej: tras guardar un tratamiento)
    const activeTab = state.clinicalActiveTab || 'clinico';
    const hasAllergies = !!(patient.allergies && String(patient.allergies).trim());

    // Los tratamientos son parte de la ficha compartida: se ven todos,
    // sin importar qué profesional los cargó.
    const visibleTreatments = patient.treatments || [];

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
                <!-- Variante mono y no la del tema: esta cabecera va sobre un
                     fondo claro fijo (bg-primary-50) y además se imprime sobre
                     papel blanco, donde la oscura sería un rectángulo negro. -->
                <img src="/icons/logo-principal-128.png?v=20260813f" alt="Odentara" class="clinical-brand-logo">
                <div>
                    <h2 class="text-xl md:text-2xl font-black text-gray-900 tracking-tight uppercase">${escapeHtml(getClinicDisplayName())}</h2>
                    <p class="text-sm font-semibold text-primary-700">Ficha Clínica Odontológica</p>
                </div>
            </div>
            <div class="text-right text-sm clinical-header-actions">
                ${hasAllergies ? `<div class="clinical-allergy-badge" title="${escapeHtml(patient.allergies)}"><i class="fa-solid fa-triangle-exclamation"></i> Alergias: ${escapeHtml(patient.allergies)}</div>` : ''}
                <div class="clinical-print-toolbar print-hidden">
                    <button type="button" class="btn btn-ia btn-sm" onclick="showPatientAiSummary(${patientId})">
                        <i class="fa-solid fa-wand-magic-sparkles"></i> Resumen IA
                    </button>
                    <button type="button" class="btn btn-secondary btn-sm" onclick="printClinicalHistory(${patientId})">
                        <i class="fa-solid fa-print"></i> Imprimir Historia
                    </button>
                </div>
            </div>
        </div>
        
        <div class="p-6">
            <!-- Datos del Paciente -->
            <div class="clinical-info-grid mb-10 pb-6 border-b border-dashed border-gray-300">
                <div class="clinical-info-summary">
                    <div><strong class="text-gray-600 uppercase text-xs">Obra Social / Plan</strong><div class="text-base font-semibold text-gray-800">${escapeHtml(patient.obraSocial || '-')}</div></div>
                    <div><strong class="text-gray-600 uppercase text-xs">Credencial</strong><div class="text-base font-semibold text-gray-800">${escapeHtml(patient.credencial || '-')}</div></div>
                    <div><strong class="text-gray-600 uppercase text-xs">Ficha N°</strong><div class="text-base font-semibold text-primary-700">${escapeHtml(patient.fichaNumero || '-')}</div></div>
                </div>
                <div class="clinical-info-item"><strong class="text-gray-600 uppercase text-xs">Nacimiento</strong><div>${patient.fechaNacimiento ? patient.fechaNacimiento.split('-').reverse().join('/') : '-'}</div></div>
                <div class="clinical-info-item"><strong class="text-gray-600 uppercase text-xs">Edad</strong><div>${age} años</div></div>
                <div class="clinical-info-item"><strong class="text-gray-600 uppercase text-xs">Teléfono</strong><div>${escapeHtml(patient.phone || '-')}</div></div>
                <div class="clinical-info-item col-span-full"><strong class="text-gray-600 uppercase text-xs">Domicilio</strong><div>${escapeHtml(patient.domicilio || '-')}</div></div>
            </div>

            <!-- PESTAÑAS DE LA FICHA -->
            <div class="clinical-tabs print-hidden" role="tablist">
                <button type="button" class="clinical-tab ${activeTab === 'clinico' ? 'is-active' : ''}" data-clinical-tab="clinico" onclick="switchClinicalTab('clinico')"><i class="fa-solid fa-tooth"></i> Clínico</button>
                <button type="button" class="clinical-tab ${activeTab === 'antecedentes' ? 'is-active' : ''}" data-clinical-tab="antecedentes" onclick="switchClinicalTab('antecedentes')"><i class="fa-solid fa-notes-medical"></i> Antecedentes</button>
                <button type="button" class="clinical-tab ${activeTab === 'recetas' ? 'is-active' : ''}" data-clinical-tab="recetas" onclick="switchClinicalTab('recetas')"><i class="fa-solid fa-prescription"></i> Recetas</button>
                <button type="button" class="clinical-tab ${activeTab === 'presupuestos' ? 'is-active' : ''}" data-clinical-tab="presupuestos" onclick="switchClinicalTab('presupuestos')"><i class="fa-solid fa-file-invoice-dollar"></i> Presupuestos</button>
                <button type="button" class="clinical-tab ${activeTab === 'archivos' ? 'is-active' : ''}" data-clinical-tab="archivos" onclick="switchClinicalTab('archivos')"><i class="fa-solid fa-folder-open"></i> Archivos</button>
            </div>

            <div class="clinical-tab-panels">
            <!-- PANEL: CLÍNICO -->
            <div class="clinical-tab-panel ${activeTab === 'clinico' ? 'is-active' : ''}" data-tab="clinico">
            <!-- ODONTOGRAMA -->
            <div class="mb-10 clinical-odontogram-block">
                <div class="odontogram-header mb-4 clinical-odontogram-section">
                    <h3 class="font-black text-gray-800 uppercase tracking-widest text-sm bg-gray-100 py-1 px-3 rounded inline-block border-l-4 border-primary-600">Odontograma</h3>
                    <span class="text-xs text-gray-400 font-medium print-hidden"><i class="fa-solid fa-users"></i> Compartido con toda la clínica</span>
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

            <!-- TRATAMIENTOS (dentro del panel Clínico, vinculado al odontograma) -->
            <div class="mt-8 mb-6">
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
                                    <td class="py-2.5 px-3 font-bold text-primary-700">${escapeHtml(t.diente)}</td>
                                    <td class="py-2.5 px-3 text-gray-600 col-hide-sm">${escapeHtml(t.cara || '-')}</td>
                                    <td class="py-2.5 px-3 text-gray-600 col-hide-sm">${escapeHtml(t.sector || '-')}</td>
                                    <td class="py-2.5 px-3 text-gray-600 col-hide-sm">${escapeHtml(t.autorizacion || '-')}</td>
                                    <td class="py-2.5 px-3 font-mono text-primary-600 font-semibold">${escapeHtml(t.codigo || '-')}</td>
                                    <td class="py-2.5 px-3">
                                        <div class="text-gray-800 font-medium">${escapeHtml(t.fecha || '-')}</div>
                                        ${t.firma ? `<div class="text-[10px] text-gray-400 mt-0.5">${escapeHtml(t.firma)}</div>` : ''}
                                    </td>
                                    <td class="py-2.5 px-3 text-gray-500 max-w-xs col-hide-xs">${escapeHtml(t.observaciones || '-')}</td>
                                    <td class="py-2 px-2 print-hidden">
                                        ${canEditClinical ? `
                                        <button class="btn btn-icon btn-icon-danger" onclick="deleteTreatment(${patientId}, ${t.id ?? idx})" title="Eliminar">
                                            <i class="fa-solid fa-trash-can"></i>
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

            <!-- OBSERVACIONES / ALERGIAS (dentro del panel Clínico) -->
            <div class="mt-8 bg-yellow-50 p-4 border border-yellow-200 rounded-lg">
                <div class="flex items-center justify-between mb-2">
                    <h3 class="font-bold text-yellow-800 uppercase text-xs"><i class="fa-solid fa-notes-medical"></i> Observaciones Generales y Alergias</h3>
                    ${canEditClinical ? `<button type="button" class="btn btn-ia print-hidden" onclick="startDictation('p-general-notes', ${patientId})"><i class="fa-solid fa-microphone"></i> Dictar</button>` : ''}
                </div>
                <textarea id="p-general-notes" class="form-input w-full h-20 p-2 text-sm bg-transparent border-yellow-300 focus:border-yellow-500 focus:ring-yellow-500 rounded" ${canEditClinical ? '' : 'disabled'}>${escapeHtml(patient.notes || '')}</textarea>
            </div>
            </div><!-- /panel clinico -->

            <!-- PANEL: ANTECEDENTES MÉDICOS -->
            ${renderMedicalHistoryPanel(patient, canEditClinical)}

            <!-- PANEL: RECETAS -->
            <div class="clinical-tab-panel ${activeTab === 'recetas' ? 'is-active' : ''}" data-tab="recetas">
            <!-- RECETAS DIGITALES -->
            <div class="mb-6 print-hidden">
                <div class="treatments-header bg-gray-100 py-1 px-3 rounded border-l-4 border-primary-600 mb-3">
                    <h3 class="font-black text-gray-800 uppercase tracking-widest text-sm">Recetas</h3>
                    ${canEditClinical ? `<button class="btn btn-primary btn-sm whitespace-nowrap" onclick="openPrescriptionModal(${patientId})"><i class="fa-solid fa-prescription"></i> Nueva Receta</button>` : ''}
                </div>
                ${(patient.prescriptions || []).length ? `
                <div class="table-container overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
                    <table class="w-full text-left text-xs md:text-sm table-nowrap">
                        <thead class="bg-gray-50 border-b border-gray-200">
                            <tr>
                                <th class="py-2.5 px-3 font-semibold text-gray-600 uppercase tracking-wide text-[10px]">Fecha</th>
                                <th class="py-2.5 px-3 font-semibold text-gray-600 uppercase tracking-wide text-[10px]">Profesional</th>
                                <th class="py-2.5 px-3 font-semibold text-gray-600 uppercase tracking-wide text-[10px] col-hide-sm">Diagnóstico</th>
                                <th class="py-2.5 px-3 font-semibold text-gray-600 uppercase tracking-wide text-[10px]">Rp</th>
                                <th class="py-2.5 px-3"></th>
                            </tr>
                        </thead>
                        <tbody>
                            ${(patient.prescriptions || []).map(rx => `
                                <tr class="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                                    <td class="py-2.5 px-3 text-gray-800 font-medium">${rx.issuedAt ? new Date(rx.issuedAt).toLocaleDateString('es-AR') : '-'}</td>
                                    <td class="py-2.5 px-3 text-gray-600">${escapeHtml(rx.professional?.fullName || '-')}</td>
                                    <td class="py-2.5 px-3 text-gray-500 col-hide-sm">${escapeHtml(rx.diagnosis || '-')}</td>
                                    <td class="py-2.5 px-3 text-gray-600 max-w-xs" style="white-space:normal">${escapeHtml((rx.medications || '').split('\n')[0])}${(rx.medications || '').includes('\n') ? '…' : ''}</td>
                                    <td class="py-2 px-2 text-right whitespace-nowrap">
                                        <button class="btn btn-secondary btn-sm" onclick="printPrescription(${patientId}, ${rx.id})" title="Imprimir receta">
                                            <i class="fa-solid fa-print"></i>
                                        </button>
                                        ${canEditClinical ? `
                                        <button class="btn btn-icon btn-icon-danger" onclick="deletePrescription(${patientId}, ${rx.id})" title="Anular receta">
                                            <i class="fa-solid fa-trash-can"></i>
                                        </button>` : ''}
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>` : `
                <div class="text-center py-6 text-gray-400 border border-dashed border-gray-200 rounded-lg">
                    <i class="fa-solid fa-prescription text-2xl opacity-30"></i>
                    <p class="text-sm mt-1">No hay recetas emitidas</p>
                </div>`}
            </div>

            </div><!-- /panel recetas -->

            <!-- PANEL: PRESUPUESTOS -->
            <div class="clinical-tab-panel ${activeTab === 'presupuestos' ? 'is-active' : ''}" data-tab="presupuestos">
            <!-- PRESUPUESTOS DE TRATAMIENTO -->
            <div class="mb-6 print-hidden">
                <div class="treatments-header bg-gray-100 py-1 px-3 rounded border-l-4 border-primary-600 mb-3">
                    <h3 class="font-black text-gray-800 uppercase tracking-widest text-sm">Presupuestos</h3>
                    <div class="flex gap-2 flex-wrap">
                        ${canManagePatientBillingUi() ? `<button class="btn btn-secondary btn-sm whitespace-nowrap" onclick="openBillingModal(${patientId})"><i class="fa-solid fa-cash-register"></i> Agregar movimiento</button>` : ''}
                        ${canEditClinical ? `<button class="btn btn-primary btn-sm whitespace-nowrap" onclick="openBudgetModal(${patientId})"><i class="fa-solid fa-file-invoice-dollar"></i> Nuevo Presupuesto</button>` : ''}
                    </div>
                </div>
                ${(patient.budgets || []).length ? `
                <div class="table-container overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
                    <table class="w-full text-left text-xs md:text-sm table-nowrap">
                        <thead class="bg-gray-50 border-b border-gray-200">
                            <tr>
                                <th class="py-2.5 px-3 font-semibold text-gray-600 uppercase tracking-wide text-[10px]">Fecha</th>
                                <th class="py-2.5 px-3 font-semibold text-gray-600 uppercase tracking-wide text-[10px]">Título</th>
                                <th class="py-2.5 px-3 font-semibold text-gray-600 uppercase tracking-wide text-[10px] col-hide-sm">Profesional</th>
                                <th class="py-2.5 px-3 font-semibold text-gray-600 uppercase tracking-wide text-[10px] text-right">Total</th>
                                <th class="py-2.5 px-3 font-semibold text-gray-600 uppercase tracking-wide text-[10px]">Estado</th>
                                <th class="py-2.5 px-3"></th>
                            </tr>
                        </thead>
                        <tbody>
                            ${(patient.budgets || []).map(b => `
                                <tr class="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                                    <td class="py-2.5 px-3 text-gray-800 font-medium">${b.issuedAt ? new Date(b.issuedAt).toLocaleDateString('es-AR') : '-'}</td>
                                    <td class="py-2.5 px-3 text-gray-700">${escapeHtml(b.title)}</td>
                                    <td class="py-2.5 px-3 text-gray-600 col-hide-sm">${escapeHtml(b.professional?.fullName || '-')}</td>
                                    <td class="py-2.5 px-3 text-right font-bold text-primary-700">${formatearMonto(b.total, b.currency)}</td>
                                    <td class="py-2.5 px-3">${b.charged
                                        ? '<span class="badge badge-success">Cargado en cta. cte.</span>'
                                        : '<span class="badge badge-warning">Pendiente</span>'}</td>
                                    <td class="py-2 px-2 text-right whitespace-nowrap">
                                        <button class="btn btn-secondary btn-sm" onclick="printBudget(${patientId}, ${b.id})" title="Imprimir presupuesto">
                                            <i class="fa-solid fa-print"></i>
                                        </button>
                                        ${!b.charged && canManagePatientBillingUi() ? `
                                        <button class="btn btn-primary btn-sm" onclick="chargeBudget(${patientId}, ${b.id})" title="Cargar como deuda en cuenta corriente">
                                            <i class="fa-solid fa-file-invoice-dollar"></i> Cargar deuda
                                        </button>` : ''}
                                        ${!b.charged && canEditClinical ? `
                                        <button class="btn btn-secondary btn-sm" onclick="deleteBudget(${patientId}, ${b.id})" title="Eliminar presupuesto">
                                            <i class="fa-solid fa-trash-can" style="font-size:0.9em"></i>
                                        </button>` : ''}
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>` : `
                <div class="text-center py-6 text-gray-400 border border-dashed border-gray-200 rounded-lg">
                    <i class="fa-solid fa-file-invoice-dollar text-2xl opacity-30"></i>
                    <p class="text-sm mt-1">No hay presupuestos</p>
                </div>`}
            </div>

            <!-- MOVIMIENTOS DE CUENTA CORRIENTE -->
            <!-- El boton "Agregar movimiento" vive en esta pestana, asi que lo
                 registrado tiene que verse aca. Antes el movimiento se guardaba
                 bien pero la pantalla no lo mostraba en ningun lado, y la unica
                 lectura posible era que no se habia guardado. -->
            ${canViewPatientBillingUi() ? renderClinicalMovements(patientId) : ''}

            </div><!-- /panel presupuestos -->

            <!-- PANEL: ARCHIVOS -->
            <div class="clinical-tab-panel ${activeTab === 'archivos' ? 'is-active' : ''}" data-tab="archivos">
            <div class="mb-4 print-hidden">
                <div class="treatments-header bg-gray-100 py-1 px-3 rounded border-l-4 border-primary-600 mb-4">
                    <h3 class="font-black text-gray-800 uppercase tracking-widest text-sm">Archivos Clínicos</h3>
                    <div style="display:flex;gap:8px;flex-wrap:wrap">
                        ${clinicalImages.length ? `
                        <button class="btn btn-secondary btn-sm whitespace-nowrap" id="btn-download-clinical-images" onclick="downloadAllClinicalImages(${patientId})" title="Descargar todos los archivos en un ZIP">
                            <i class="fa-solid fa-file-zipper"></i> Descargar todo
                        </button>` : ''}
                        ${canEditClinical ? `
                        <button class="btn btn-primary btn-sm whitespace-nowrap" id="btn-add-clinical-image"><i class="fa-solid fa-image"></i> Imagen</button>
                        <button class="btn btn-secondary btn-sm whitespace-nowrap" id="btn-add-clinical-pdf"><i class="fa-solid fa-file-pdf"></i> PDF</button>` : ''}
                    </div>
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
                            <button type="button" class="clinical-image-action-btn clinical-image-action-delete clinical-image-action-icon-only" onclick="deleteClinicalImage(${patientId}, ${fileId})" aria-label="Eliminar archivo" title="Eliminar archivo">
                                <i class="fa-solid fa-trash"></i>
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

            </div><!-- /panel archivos -->
            </div><!-- /clinical-tab-panels -->

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

window.switchClinicalTab = function(tab) {
    state.clinicalActiveTab = tab;
    document.querySelectorAll('.clinical-tab').forEach(btn => {
        btn.classList.toggle('is-active', btn.dataset.clinicalTab === tab);
    });
    document.querySelectorAll('.clinical-tab-panel').forEach(panel => {
        panel.classList.toggle('is-active', panel.dataset.tab === tab);
    });
};

window.printClinicalHistory = function(patientId) {
    if (!patientId) {
        const match = window.location.hash.match(/clinical\/(\d+)/);
        patientId = match ? Number(match[1]) : null;
    }
    const patient = getClinicalWorkingPatient(patientId);
    if (!patient) {
        showAlert('Paciente no encontrado.', { title: 'Historia clínica', variant: 'error' });
        return;
    }

    const esc = escapeHtml;
    const clinicName = getClinicDisplayName();

    let age = '-';
    if (patient.fechaNacimiento) {
        const diff = Date.now() - new Date(patient.fechaNacimiento).getTime();
        age = Math.abs(new Date(diff).getUTCFullYear() - 1970);
    }

    const visibleTreatments = (patient.treatments || [])
        .slice()
        .sort((a, b) => (a.fecha || '').localeCompare(b.fecha || ''));

    const showInfantil = hasChildDentitionData(patient);

    const odontogramaHtml = `
        <div class="hx-odonto-block">
            <div class="hx-odonto-label">Dentición Adulta</div>
            <div class="hx-odonto-row">
                <div class="hx-odonto-arch">${drawTeethRow([18,17,16,15,14,13,12,11], patient.odontograma, true)}</div>
                <div class="hx-odonto-arch hx-odonto-arch-split">${drawTeethRow([21,22,23,24,25,26,27,28], patient.odontograma, true)}</div>
            </div>
            <div class="hx-odonto-row">
                <div class="hx-odonto-arch">${drawTeethRow([48,47,46,45,44,43,42,41], patient.odontograma, false)}</div>
                <div class="hx-odonto-arch hx-odonto-arch-split">${drawTeethRow([31,32,33,34,35,36,37,38], patient.odontograma, false)}</div>
            </div>
        </div>
        ${showInfantil ? `
        <div class="hx-odonto-block">
            <div class="hx-odonto-label">Dentición Infantil</div>
            <div class="hx-odonto-row">
                <div class="hx-odonto-arch">${drawTeethRow([55,54,53,52,51], patient.odontograma, true)}</div>
                <div class="hx-odonto-arch hx-odonto-arch-split">${drawTeethRow([61,62,63,64,65], patient.odontograma, true)}</div>
            </div>
            <div class="hx-odonto-row">
                <div class="hx-odonto-arch">${drawTeethRow([85,84,83,82,81], patient.odontograma, false)}</div>
                <div class="hx-odonto-arch hx-odonto-arch-split">${drawTeethRow([71,72,73,74,75], patient.odontograma, false)}</div>
            </div>
        </div>` : ''}
    `;

    const treatmentsSectionHtml = visibleTreatments.length ? `
    <div class="hx-section-title">Registro de Tratamientos</div>
    <table class="hx-table">
        <thead>
            <tr>
                <th>Diente</th><th>Cara</th><th>Sector</th><th>Autorización</th><th>Código</th><th>Fecha</th><th>Observaciones</th>
            </tr>
        </thead>
        <tbody>${visibleTreatments.map(t => `
            <tr>
                <td class="hx-td-strong">${esc(t.diente ?? '-')}</td>
                <td>${esc(t.cara || '-')}</td>
                <td>${esc(t.sector || '-')}</td>
                <td>${esc(t.autorizacion || '-')}</td>
                <td class="hx-td-mono">${esc(t.codigo || '-')}</td>
                <td>${t.fecha ? esc(t.fecha.split('-').reverse().join('/')) : '-'}${t.firma ? `<div class="hx-td-sub">${esc(t.firma)}</div>` : ''}</td>
                <td>${esc(t.observaciones || '-')}</td>
            </tr>`).join('')}</tbody>
    </table>` : '';

    // Antecedentes médicos: solo los ítems marcados "Sí" y los textos cargados —
    // si no hay ningún antecedente cargado, la sección entera no se imprime.
    const mh = patient.medicalHistory || {};
    const positiveConditions = MEDICAL_BOOL_FIELDS.filter(f => mh[f.key] === true).map(f => f.label);
    const textAnswers = MEDICAL_BOOL_WITH_TEXT.filter(f => mh[f.key] === true || mh[f.textKey]);
    const hasMedicalHistory = positiveConditions.length > 0 || textAnswers.length > 0;
    const medicalHistorySectionHtml = hasMedicalHistory ? `
    <div class="hx-section-title">Antecedentes Médicos</div>
    <div class="hx-mh">
        ${positiveConditions.length ? `<ul class="hx-mh-list">${positiveConditions.map(l => `<li>${esc(l)}</li>`).join('')}</ul>` : ''}
        ${textAnswers.map(f => `<div class="hx-mh-text"><strong>${esc(f.label)}</strong> ${esc(mh[f.textKey] || '-')}</div>`).join('')}
    </div>` : '';

    const observationsSectionHtml = patient.notes ? `
    <div class="hx-section-title">Observaciones Generales y Alergias</div>
    <div class="hx-notes">${esc(patient.notes)}</div>` : '';

    const w = window.open('', '_blank', 'width=900,height=1000');
    if (!w) {
        showAlert('El navegador bloqueó la ventana de impresión. Habilitá los pop-ups para este sitio.', { title: 'Historia clínica', variant: 'warning' });
        return;
    }
    w.document.write(`<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Historia Clínica - ${esc(patient.name || '')}</title>
<style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; color: #1a1a1a; padding: 32px 40px; max-width: 900px; margin: 0 auto; }
    .hx-header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2.5px solid #1a1a1a; padding-bottom: 14px; margin-bottom: 20px; }
    .hx-clinic { font-size: 20px; font-weight: 900; letter-spacing: 0.3px; text-transform: uppercase; }
    .hx-subtitle { font-size: 12.5px; color: #444; margin-top: 3px; font-weight: 600; }
    .hx-allergy { font-size: 12px; font-weight: 700; color: #92400e; background: #fef3c7; border: 1px solid #fcd34d; padding: 5px 10px; border-radius: 6px; text-align: right; max-width: 260px; }
    .hx-section-title { font-size: 11.5px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.12em; color: #333; background: #f3f4f6; border-left: 3px solid #1a1a1a; padding: 4px 10px; margin: 22px 0 10px; }
    .hx-info-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px 20px; font-size: 12.5px; padding-bottom: 14px; border-bottom: 1px dashed #bbb; }
    .hx-info-grid div.hx-wide { grid-column: 1 / -1; }
    .hx-info-label { display: block; font-size: 9.5px; font-weight: 700; text-transform: uppercase; color: #666; letter-spacing: 0.05em; margin-bottom: 2px; }
    .hx-info-value { font-weight: 600; color: #1a1a1a; }
    .hx-odonto-block { margin-bottom: 16px; }
    .hx-odonto-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #666; text-align: center; margin-bottom: 8px; }
    .hx-odonto-row { display: flex; justify-content: center; gap: 22px; margin-bottom: 6px; }
    .hx-odonto-arch { display: flex; gap: 4px; }
    .hx-odonto-arch-split { border-left: 1.5px solid #ccc; padding-left: 18px; }
    /* Compatibilidad con el markup Tailwind que devuelve drawTeethRow() */
    .hx-odonto-arch .flex { display: flex; }
    .hx-odonto-arch .flex-col { flex-direction: column; }
    .hx-odonto-arch .items-center { align-items: center; }
    .hx-odonto-arch .relative { position: relative; }
    .hx-odonto-arch .tooth-box { width: 30px; }
    .hx-odonto-arch .tooth-svg-box { width: 100%; height: 30px; }
    .hx-odonto-arch .tooth-svg-box svg { width: 100%; height: 100%; }
    .hx-odonto-arch .tooth-ind-slot { display: flex; align-items: center; justify-content: center; height: 12px; gap: 2px; }
    .hx-odonto-arch .tooth-box span { font-size: 7.5px; font-weight: 700; color: #555; text-align: center; display: block; line-height: 1.1; }
    table.hx-table { width: 100%; border-collapse: collapse; font-size: 11.5px; }
    table.hx-table th { text-align: left; font-size: 9.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #555; background: #f3f4f6; padding: 6px 8px; border-bottom: 1.5px solid #ccc; }
    table.hx-table td { padding: 6px 8px; border-bottom: 1px solid #e5e5e5; vertical-align: top; }
    .hx-td-strong { font-weight: 700; }
    .hx-td-mono { font-family: 'Courier New', monospace; }
    .hx-td-sub { font-size: 9.5px; color: #888; margin-top: 1px; }
    .hx-empty { text-align: center; color: #999; padding: 16px; }
    .hx-notes { font-size: 12px; background: #fffbeb; border: 1px solid #fde68a; border-radius: 6px; padding: 10px 12px; white-space: pre-wrap; min-height: 20px; }
    .hx-mh { font-size: 12px; }
    .hx-mh-list { list-style: none; display: grid; grid-template-columns: 1fr 1fr; gap: 4px 20px; margin-bottom: 8px; }
    .hx-mh-list li { padding-left: 14px; position: relative; }
    .hx-mh-list li::before { content: '⚠'; position: absolute; left: 0; color: #b45309; }
    .hx-mh-text { margin-top: 4px; }
    .hx-mh-text strong { font-weight: 700; margin-right: 4px; }
    @page { size: portrait; margin: 14mm; }
    @media print { body { padding: 16px 24px; } }
</style>
</head>
<body>
    <div class="hx-header">
        <div>
            <div class="hx-clinic">${esc(clinicName)}</div>
            <div class="hx-subtitle">Ficha Clínica Odontológica</div>
        </div>
        ${patient.allergies ? `<div class="hx-allergy">⚠ Alergias: ${esc(patient.allergies)}</div>` : ''}
    </div>

    <div class="hx-info-grid">
        <div><span class="hx-info-label">Nombre</span><span class="hx-info-value">${esc(patient.name || '-')}</span></div>
        <div><span class="hx-info-label">DNI</span><span class="hx-info-value">${esc(patient.dni || '-')}</span></div>
        <div><span class="hx-info-label">Ficha N°</span><span class="hx-info-value">${esc(patient.fichaNumero || '-')}</span></div>
        <div><span class="hx-info-label">Nacimiento</span><span class="hx-info-value">${patient.fechaNacimiento ? esc(patient.fechaNacimiento.split('-').reverse().join('/')) : '-'}</span></div>
        <div><span class="hx-info-label">Edad</span><span class="hx-info-value">${age} años</span></div>
        <div><span class="hx-info-label">Teléfono</span><span class="hx-info-value">${esc(patient.phone || '-')}</span></div>
        <div><span class="hx-info-label">Obra Social / Plan</span><span class="hx-info-value">${esc(patient.obraSocial || '-')}</span></div>
        <div><span class="hx-info-label">Credencial</span><span class="hx-info-value">${esc(patient.credencial || '-')}</span></div>
        <div><span class="hx-info-label">Email</span><span class="hx-info-value">${esc(patient.email || '-')}</span></div>
        <div class="hx-wide"><span class="hx-info-label">Domicilio</span><span class="hx-info-value">${esc(patient.domicilio || '-')}</span></div>
    </div>

    ${medicalHistorySectionHtml}

    <div class="hx-section-title">Odontograma</div>
    ${odontogramaHtml}
    ${treatmentsSectionHtml}
    ${observationsSectionHtml}

    <scr` + `ipt>window.onload = () => { window.print(); };</scr` + `ipt>
</body>
</html>`);
    w.document.close();
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
            } else if (treatment === 'endodoncia') {
                // Endodoncia es una capa independiente del sustrato (implante,
                // corona-implante, corona, o diente normal) — no reemplaza el
                // estado de base, para que ambos convivan. No aplica sobre un
                // diente marcado como ausente.
                if (toothState.estado !== 'ausente') {
                    const hasEndo = toothState.estado === 'endodoncia' || toothState.endodoncia === true;
                    if (hasEndo) {
                        delete toothState.endodoncia;
                        if (toothState.estado === 'endodoncia') delete toothState.estado;
                        if (!Object.keys(toothState).length) delete draft.data.odontograma[tooth];
                    } else {
                        toothState.endodoncia = true;
                        toothState.color = color;
                    }
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

    // Antecedentes médicos: cualquier cambio en los radios/textos marca la
    // ficha como dirty, igual que el resto de los campos — se guarda todo
    // junto con "Guardar Historia Clínica", sin un botón aparte.
    const medicalHistoryForm = document.querySelector('[data-tab="antecedentes"]');
    if (medicalHistoryForm) {
        medicalHistoryForm.addEventListener('change', () => {
            updateClinicalDraft(patientId, (draft) => {
                draft.medicalHistory = readMedicalHistoryForm();
            });
        });
        medicalHistoryForm.querySelectorAll('.mh-text').forEach((input) => {
            input.oninput = () => {
                updateClinicalDraft(patientId, (draft) => {
                    draft.medicalHistory = readMedicalHistoryForm();
                });
            };
        });
    }

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
                await syncPatientClinicalData(patientId);
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

// Lee el formulario de antecedentes del DOM y devuelve el objeto medicalHistory.
function readMedicalHistoryForm() {
    const mh = {};
    const readBool = (key) => {
        const checked = document.querySelector(`input[name="mh-${key}"]:checked`);
        if (checked) mh[key] = checked.value === 'si';
    };
    MEDICAL_BOOL_FIELDS.forEach(f => readBool(f.key));
    MEDICAL_BOOL_WITH_TEXT.forEach(f => {
        readBool(f.key);
        const txt = document.getElementById(`mh-text-${f.textKey}`);
        if (txt && txt.value.trim()) mh[f.textKey] = txt.value.trim();
    });
    return mh;
}


// ── Resumen pre-consulta con IA ───────────────────────────────────────────────
window.showPatientAiSummary = async function(patientId) {
    const patient = getClinicalWorkingPatient(patientId) || DB.get('patients').find(p => p.id === patientId) || {};
    modalsContainer.innerHTML = `
        <div class="modal-overlay active">
            <div class="modal-content" style="max-width:560px;width:94vw" onclick="event.stopPropagation()">
                <div class="modal-header">
                    <h3><i class="fa-solid fa-wand-magic-sparkles" style="color:#6366f1"></i> Resumen IA — ${escapeHtml(patient.name || '')}</h3>
                    <button class="modal-close-x" onclick="closeModal()" aria-label="Cerrar"><i class="fa-solid fa-xmark"></i></button>
                </div>
                <div class="modal-body" id="ai-summary-body" style="min-height:120px">
                    <div style="text-align:center;color:#6b7280;padding:28px"><i class="fa-solid fa-spinner fa-spin" style="font-size:1.4rem;color:#6366f1"></i><div style="margin-top:10px;font-size:13px">Analizando la ficha del paciente…</div></div>
                </div>
                <div class="modal-footer">
                    <span style="font-size:11px;color:#9ca3af;margin-right:auto"><i class="fa-solid fa-circle-info"></i> Generado por IA desde la ficha. Verificá siempre.</span>
                    <button class="btn btn-ghost" onclick="closeModal()">Cerrar</button>
                </div>
            </div>
        </div>`;
    const overlay = modalsContainer.querySelector('.modal-overlay');
    if (overlay) overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });

    try {
        const res = await withAppLoading('Analizando la ficha del paciente…', () =>
            apiFetch(`/patients/${patientId}/ai-summary`, { method: 'POST', body: JSON.stringify({}) })
        );
        const body = document.getElementById('ai-summary-body');
        if (body) body.innerHTML = `<div style="white-space:pre-wrap;line-height:1.65;font-size:14px;color:var(--gray-800,#1f2937)">${escapeHtml(res.summary || 'Sin datos suficientes.').replace(/\n/g, '<br>')}</div>`;
    } catch (error) {
        const body = document.getElementById('ai-summary-body');
        if (body) body.innerHTML = `<div style="color:#ef4444;padding:12px;font-size:13px">${escapeHtml(error.message || 'No se pudo generar el resumen.')}</div>`;
    }
};

// ── Dictado por voz → nota clínica (Web Speech API + IA que la estructura) ─────
// Aplica al odontograma las acciones detectadas por la IA en el dictado
// (ej: "pieza 26, arreglo pendiente" → pinta caries en rojo). Misma lógica
// que bindClinicalToothEvents para que ambos caminos queden consistentes.
function applyDictationOdontogramActions(patientId, actions) {
    if (!Array.isArray(actions) || !actions.length) return 0;
    const draft = getClinicalDraft(patientId);
    if (!draft) return 0;
    if (!draft.data.odontograma) draft.data.odontograma = {};

    let applied = 0;
    for (const action of actions) {
        const tooth = String(action.tooth || '').trim();
        const kind = action.kind;
        const color = action.color === 'azul' ? 'azul' : 'rojo';
        if (!tooth || !kind) continue;

        if (!draft.data.odontograma[tooth]) draft.data.odontograma[tooth] = {};
        const toothState = draft.data.odontograma[tooth];

        if (kind === 'ausente') {
            draft.data.odontograma[tooth] = { estado: 'ausente', color };
        } else if (kind === 'endodoncia') {
            if (toothState.estado !== 'ausente') {
                toothState.endodoncia = true;
                toothState.color = color;
            }
        } else {
            draft.data.odontograma[tooth] = { estado: kind, color };
        }
        applied++;
    }

    if (applied) {
        draft.isDirty = true;
        renderClinicalOdontogram(patientId);
        syncClinicalHistorySaveState();
    }
    return applied;
}

let _dictationRec = null;
window.startDictation = function(targetId, patientId) {
    if (_dictationRec) { try { _dictationRec.onend = null; _dictationRec.stop(); } catch (_e) {} }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
        showAlert('Tu navegador no soporta el dictado por voz. Usá Google Chrome en la computadora o en Android.', { title: 'Dictado', variant: 'warning' });
        return;
    }
    const target = document.getElementById(targetId);
    if (!target) return;

    let finalTranscript = '';
    let stopped = false;
    let restartCount = 0;
    const rec = new SR();
    _dictationRec = rec;
    rec.lang = 'es-AR';
    rec.continuous = true;
    rec.interimResults = true;

    // Overlay de grabación
    modalsContainer.innerHTML = `
        <div class="modal-overlay active">
            <div class="modal-content" style="max-width:480px;width:92vw;text-align:center" onclick="event.stopPropagation()">
                <div class="modal-header"><h3><i class="fa-solid fa-microphone" style="color:#ef4444"></i> Dictando nota…</h3></div>
                <div class="modal-body">
                    <div class="dictation-pulse" style="width:64px;height:64px;border-radius:50%;background:#fee2e2;color:#ef4444;display:flex;align-items:center;justify-content:center;margin:6px auto 14px;font-size:1.6rem"><i class="fa-solid fa-microphone"></i></div>
                    <p style="font-size:13px;color:#6b7280;margin-bottom:10px">Hablá con claridad. Cuando termines, tocá "Terminar" y la IA arma la nota.</p>
                    <div id="dictation-live" style="min-height:60px;max-height:160px;overflow-y:auto;text-align:left;font-size:13px;color:#374151;background:var(--gray-50,#f9fafb);border:1px solid var(--border,#e5e7eb);border-radius:8px;padding:10px"></div>
                </div>
                <div class="modal-footer" style="justify-content:center;gap:10px">
                    <button class="btn btn-ghost" id="dictation-cancel">Cancelar</button>
                    <button class="btn btn-primary" id="dictation-stop"><i class="fa-solid fa-stop"></i> Terminar y estructurar</button>
                </div>
            </div>
        </div>`;
    const live = document.getElementById('dictation-live');

    let pendingInterim = '';
    rec.onresult = (e) => {
        let interim = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
            if (e.results[i].isFinal) finalTranscript += e.results[i][0].transcript + ' ';
            else interim += e.results[i][0].transcript;
        }
        pendingInterim = interim;
        if (live) live.innerHTML = escapeHtml(finalTranscript) + `<span style="color:#9ca3af">${escapeHtml(interim)}</span>`;
    };
    rec.onerror = (e) => {
        console.warn('[dictado] speech recognition error:', e.error);
        if (e.error === 'no-speech' || e.error === 'aborted') return; // rec.onend reinicia solo
        if (e.error === 'network') {
            // El reconocimiento de voz del navegador necesita conectarse a los
            // servidores de Google — falla en HTTP/localhost de prueba; en el
            // sitio real (https://) con conexión a internet funciona normal.
            stopped = true;
            showToast('El dictado necesita conexión a internet y un sitio con https:// — no funciona en este entorno de prueba local.', { type: 'warning' });
            return;
        }
        if (e.error === 'not-allowed' || e.error === 'permission-denied') {
            stopped = true;
            showToast('Dale permiso al micrófono en tu navegador para poder dictar.', { type: 'warning' });
            return;
        }
        if (e.error === 'audio-capture') {
            stopped = true;
            showToast('No se detectó ningún micrófono disponible.', { type: 'warning' });
            return;
        }
        showToast('Error de dictado: ' + e.error, { type: 'warning' });
    };
    rec.onend = () => {
        // Chrome corta la sesión de reconocimiento tras un silencio (aunque
        // continuous=true) SIN llegar a marcar como "final" lo último que se
        // venía transcribiendo — si no lo rescatamos acá, esa parte se pierde
        // apenas arranca la sesión nueva (el texto gris "desaparece").
        if (pendingInterim.trim()) {
            finalTranscript += pendingInterim.trim() + ' ';
            pendingInterim = '';
        }
        if (stopped) return;
        restartCount++;
        // Si nunca capturó ni una palabra y ya reintentó muchas veces seguidas,
        // algo está mal (mic bloqueado, driver, etc.) — mejor avisar que quedar
        // reintentando en silencio para siempre.
        if (restartCount > 8 && !finalTranscript.trim()) {
            stopped = true;
            showToast('No se pudo mantener activo el micrófono. Cerrá y probá dictar de nuevo.', { type: 'warning' });
            closeModal();
            return;
        }
        setTimeout(() => {
            if (stopped) return;
            try { rec.start(); } catch (_e) { console.warn('[dictado] no se pudo reiniciar el micrófono:', _e); }
        }, 250);
    };

    const finish = async (useIt) => {
        stopped = true;
        if (pendingInterim.trim()) {
            finalTranscript += pendingInterim.trim() + ' ';
            pendingInterim = '';
        }
        try { rec.stop(); } catch (_e) {}
        _dictationRec = null;
        if (!useIt) { closeModal(); return; }
        const raw = finalTranscript.trim();
        if (!raw) { closeModal(); showToast('No se captó audio.', { type: 'warning' }); return; }
        closeModal();
        try {
            const res = await withAppLoading('Estructurando la nota con IA…', async () =>
                apiFetch(`/patients/${patientId}/ai-structure-note`, { method: 'POST', body: JSON.stringify({ transcript: raw }) })
            );
            const note = (res && res.note) ? res.note : raw;
            const t = document.getElementById(targetId);
            if (t) {
                t.value = (t.value ? t.value.trim() + '\n' : '') + note;
                t.dispatchEvent(new Event('input', { bubbles: true }));
            }
            const paintedCount = applyDictationOdontogramActions(patientId, res && res.odontogramActions);
            showToast(paintedCount
                ? `Nota agregada y ${paintedCount} pieza${paintedCount !== 1 ? 's' : ''} marcada${paintedCount !== 1 ? 's' : ''} en el odontograma.`
                : 'Nota dictada agregada.', { type: 'success' });
        } catch (error) {
            // Si la IA falla, al menos pegamos la transcripción cruda
            const t = document.getElementById(targetId);
            if (t) { t.value = (t.value ? t.value.trim() + '\n' : '') + raw; t.dispatchEvent(new Event('input', { bubbles: true })); }
            showAlert(error.message || 'No se pudo estructurar la nota, se pegó el texto dictado.', { title: 'Dictado', variant: 'warning' });
        }
    };
    document.getElementById('dictation-stop').onclick = () => finish(true);
    document.getElementById('dictation-cancel').onclick = () => finish(false);

    try { rec.start(); } catch (_e) { showToast('No se pudo iniciar el micrófono.', { type: 'warning' }); closeModal(); }
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

/**
 * Descarga todos los archivos clínicos del paciente en un ZIP.
 *
 * Se hace en dos pasos y NO con fetch + blob: bajar el ZIP con fetch obligaría
 * a tenerlo entero en la memoria del navegador, y una ficha con muchas
 * radiografías puede pesar cientos de megas. Pidiendo primero una autorización
 * y navegando después a esa URL, el navegador streamea directo a disco y
 * muestra su propia barra de progreso.
 */
window.downloadAllClinicalImages = async function(patientId) {
    const boton = document.getElementById('btn-download-clinical-images');
    const contenidoOriginal = boton ? boton.innerHTML : null;

    if (boton) {
        boton.disabled = true;
        boton.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Preparando...';
    }

    try {
        const respuesta = await apiFetch('/clinical-images/export/token', {
            method: 'POST',
            body: JSON.stringify({ patientId }),
        });

        // La autorización dura pocos minutos: se navega enseguida.
        const enlace = document.createElement('a');
        enlace.href = `${API_BASE_URL}/clinical-images/export?t=${encodeURIComponent(respuesta.token)}`;
        enlace.rel = 'noopener';
        document.body.appendChild(enlace);
        enlace.click();
        enlace.remove();
    } catch (error) {
        showAlert(
            error.message || 'No se pudo preparar la descarga de archivos clínicos.',
            { title: 'Archivos clínicos', variant: 'error' }
        );
    } finally {
        if (boton) {
            boton.disabled = false;
            if (contenidoOriginal !== null) boton.innerHTML = contenidoOriginal;
        }
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
                    await syncPatientClinicalData(patientId);
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

        const submitBtn = e.target.querySelector('button[type=submit]');
        if (submitBtn?.disabled) return;
        if (submitBtn) submitBtn.disabled = true;

        // Antes se procesaban todas las imágenes en paralelo con Promise.all.
        // Eso tenía dos problemas: en un celular, decodificar varias fotos a la
        // vez agota la memoria; y como img.onerror rechazaba la promesa entera,
        // una sola imagen fallada descartaba TODAS las demás. Ahora van de a una,
        // con el avance a la vista, y las que fallen se informan por nombre sin
        // arrastrar a las que sí se pudieron leer.
        const newImages = [];
        const fallidas = [];

        try {
            await withAppLoading(`Procesando imágenes… (0 de ${files.length})`, async () => {
                for (let i = 0; i < files.length; i++) {
                    const file = files[i];
                    updateAppLoadingMessage(`Procesando imágenes… (${i + 1} de ${files.length})`);
                    // Cede el hilo para que el mensaje se pinte antes del trabajo pesado.
                    await new Promise(resolve => setTimeout(resolve, 0));
                    try {
                        newImages.push({
                            id: Date.now() + Math.floor(Math.random() * 1000) + i,
                            date: selectedDate,
                            description: selectedDescription,
                            dataUrl: await clinicalImageToDataUrl(file),
                        });
                    } catch (err) {
                        fallidas.push({ nombre: file.name || 'imagen', motivo: err.message });
                    }
                }
            });

            if (newImages.length === 0) {
                showAlert(
                    fallidas.length
                        ? `No se pudo procesar ninguna imagen. ${fallidas[0].motivo}`
                        : 'No se pudo procesar ninguna imagen.',
                    { title: 'Imágenes clínicas', variant: 'error' }
                );
                return;
            }

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
                    await syncPatientClinicalData(patientId);
                } else if (p) {
                    const images = (p.clinicalImages || []).slice();
                    images.push(...newImages);
                    DB.update('patients', patientId, { clinicalImages: images });
                }
            });

            closeModal();
            loadClinicalHistory(patientId);

            // Éxito parcial: se guardó lo que se pudo y se avisa qué quedó afuera,
            // en vez de perder todo por una imagen con problemas.
            if (fallidas.length > 0) {
                showToast(
                    `Se guardaron ${newImages.length} ${newImages.length === 1 ? 'imagen' : 'imágenes'}. ` +
                    `No se pudo procesar ${fallidas.length === 1 ? fallidas[0].nombre : `${fallidas.length} archivos`}: ${fallidas[0].motivo}`,
                    'warning'
                );
            }
        } catch (err) {
            showAlert(err.message || 'No se pudieron guardar las imágenes.', { title: 'Imágenes clínicas', variant: 'error' });
        } finally {
            if (submitBtn) submitBtn.disabled = false;
        }
    });
}

/**
 * Reduce una imagen y la devuelve como data URL, preferentemente en WebP.
 * Usa createImageBitmap para decodificar directo desde el archivo, sin la copia
 * intermedia en base64 que hacía FileReader, y libera bitmap, objectURL y canvas
 * al terminar — en celulares con poca memoria eso es la diferencia entre que la
 * imagen entre o falle.
 */
async function clinicalImageToDataUrl(file) {
    const MAX_SIDE = 1600;
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

        if (!source.width || !source.height) throw new Error('La imagen no tiene dimensiones válidas.');
        const scale = Math.min(1, MAX_SIDE / Math.max(source.width, source.height));
        const width = Math.max(1, Math.round(source.width * scale));
        const height = Math.max(1, Math.round(source.height * scale));

        canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('El navegador no pudo preparar la imagen.');
        ctx.drawImage(source, 0, 0, width, height);

        let dataUrl = canvas.toDataURL('image/webp', 0.80);
        if (!dataUrl.startsWith('data:image/webp')) {
            dataUrl = canvas.toDataURL('image/jpeg', 0.78);
        }
        // Sin memoria, algunos navegadores móviles devuelven un canvas en blanco
        // en lugar de lanzar error: se detecta acá para no guardar una imagen vacía.
        if (!dataUrl || dataUrl.length < 1000) {
            throw new Error('El navegador se quedó sin memoria al procesar la imagen.');
        }
        return dataUrl;
    } finally {
        if (bitmap?.close) bitmap.close();
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        if (canvas) { canvas.width = 0; canvas.height = 0; }
    }
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
                await syncPatientClinicalData(patientId);
            });
            closeModal();
            loadClinicalHistory(patientId);
        } catch (err) {
            alert(err.message || 'No se pudieron subir los documentos PDF.');
            if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = '<i class="fa-solid fa-upload"></i> Subir PDF'; }
        }
    });
}



// =============================================================================
// RECETAS DIGITALES
// =============================================================================

function openPrescriptionModal(patientId) {
    if (!canEditClinicalHistoryUi()) {
        showAlert('Solo el profesional y el superadmin pueden emitir recetas.', { title: 'Recetas', variant: 'error' });
        return;
    }

    // Las recetas sí son privadas por profesional: hay que elegir quién la emite.
    const scopedProfs = state.user?.allowedProfessionals || [];
    const allProfs = DB.get('professionals').filter(p => p.active !== false && p.status !== 'inactivo');
    const profs = isSuperadmin() ? allProfs : allProfs.filter(p => scopedProfs.includes(p.id));
    const defaultProfId = getCurrentOdontoProfessionalId() || profs[0]?.id || '';

    modalsContainer.innerHTML = `
        <div class="modal-overlay active">
            <div class="modal-content modal-content-patient" onclick="event.stopPropagation()">
                <div class="modal-header">
                    <h3>Nueva Receta</h3>
                    <button class="btn-ghost" data-modal-close><i class="fa-solid fa-times"></i></button>
                </div>
                <form id="prescription-form">
                    <div class="modal-body">
                        <div class="input-group">
                            <label>Profesional que emite</label>
                            <select id="rx-professional" required>
                                ${profs.map(p => `<option value="${p.id}" ${p.id === defaultProfId ? 'selected' : ''}>${escapeHtml(p.name)}</option>`).join('')}
                            </select>
                        </div>
                        <div class="input-group">
                            <label>Diagnóstico</label>
                            <input type="text" id="rx-diagnosis" placeholder="Ej: Absceso periapical pieza 26">
                        </div>
                        <div class="input-group">
                            <label>Rp: (un medicamento por línea)</label>
                            <textarea id="rx-medications" rows="4" required placeholder="Amoxicilina 875mg comp. x 14 — 1 comp. cada 12hs&#10;Ibuprofeno 600mg comp. x 10 — 1 comp. cada 8hs si hay dolor"></textarea>
                        </div>
                        <div class="input-group">
                            <label>Indicaciones para el paciente</label>
                            <textarea id="rx-instructions" rows="2" placeholder="Tomar con las comidas. Completar el tratamiento antibiótico."></textarea>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-ghost" onclick="closeModal()">Cancelar</button>
                        <button type="submit" class="btn btn-primary"><i class="fa-solid fa-prescription"></i> Emitir Receta</button>
                    </div>
                </form>
            </div>
        </div>
    `;

    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); }, { once: true });

    document.getElementById('prescription-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
            await withAppLoading('Emitiendo receta...', async () => {
                await apiFetch('/prescriptions', {
                    method: 'POST',
                    body: JSON.stringify({
                        patientId,
                        professionalId: Number(document.getElementById('rx-professional').value),
                        diagnosis: document.getElementById('rx-diagnosis').value,
                        medications: document.getElementById('rx-medications').value,
                        instructions: document.getElementById('rx-instructions').value
                    })
                });
                await syncPatientClinicalData(patientId);
            });
            closeModal();
            await loadClinicalHistory(patientId, { skipUnsavedCheck: true, skipSync: true });
        } catch (error) {
            showAlert(error.message || 'No se pudo emitir la receta.', { title: 'Recetas', variant: 'error' });
        }
    });
}

window.deletePrescription = async function(patientId, prescriptionId) {
    if (!canEditClinicalHistoryUi()) return;
    if (!await showConfirm('¿Anular esta receta? Quedará registrada en la auditoría.', { title: 'Anular receta', confirmText: 'Anular' })) return;
    try {
        await withAppLoading('Anulando receta...', async () => {
            await apiFetch(`/prescriptions/${prescriptionId}`, { method: 'DELETE' });
            await syncPatientClinicalData(patientId);
        });
        await loadClinicalHistory(patientId, { skipUnsavedCheck: true, skipSync: true });
    } catch (error) {
        showAlert(error.message || 'No se pudo anular la receta.', { title: 'Recetas', variant: 'error' });
    }
};

window.printPrescription = function(patientId, prescriptionId) {
    const patient = getClinicalWorkingPatient(patientId);
    const rx = (patient?.prescriptions || []).find(r => r.id === prescriptionId);
    if (!rx) {
        showAlert('Receta no encontrada.', { title: 'Recetas', variant: 'error' });
        return;
    }

    const clinicName = getClinicDisplayName();
    const issuedDate = rx.issuedAt ? new Date(rx.issuedAt).toLocaleDateString('es-AR') : new Date().toLocaleDateString('es-AR');
    const prof = rx.professional || {};
    const pat = rx.patient || {};
    const esc = escapeHtml;
    const medsHtml = esc(rx.medications || '').split('\n').filter(Boolean).map(line => `<div class="rx-med">${line}</div>`).join('');

    const w = window.open('', '_blank', 'width=800,height=900');
    if (!w) {
        showAlert('El navegador bloqueó la ventana de impresión. Habilitá los pop-ups para este sitio.', { title: 'Recetas', variant: 'warning' });
        return;
    }
    w.document.write(`<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Receta - ${esc(pat.fullName || '')}</title>
<style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Georgia, 'Times New Roman', serif; color: #1a1a1a; padding: 40px 48px; max-width: 720px; margin: 0 auto; }
    .rx-header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2.5px solid #1a1a1a; padding-bottom: 14px; }
    .rx-clinic { font-size: 20px; font-weight: bold; letter-spacing: 0.5px; }
    .rx-prof { font-size: 13px; margin-top: 4px; color: #333; }
    .rx-date { font-size: 13px; text-align: right; }
    .rx-patient { margin: 22px 0; font-size: 14px; line-height: 1.7; }
    .rx-patient strong { display: inline-block; min-width: 110px; }
    .rx-symbol { font-size: 34px; font-weight: bold; font-style: italic; margin: 18px 0 6px; }
    .rx-med { font-size: 15px; padding: 7px 0 7px 26px; border-bottom: 1px dotted #bbb; }
    .rx-diagnosis { margin-top: 20px; font-size: 13px; color: #333; }
    .rx-instructions { margin-top: 14px; font-size: 13px; background: #f6f6f6; padding: 10px 14px; border-left: 3px solid #888; white-space: pre-wrap; }
    .rx-footer { margin-top: 90px; display: flex; justify-content: flex-end; }
    .rx-signature { text-align: center; width: 260px; }
    .rx-signature-line { border-top: 1.5px solid #1a1a1a; padding-top: 6px; font-size: 12.5px; line-height: 1.6; }
    @media print { body { padding: 20px 30px; } }
</style>
</head>
<body>
    <div class="rx-header">
        <div>
            <div class="rx-clinic">${esc(clinicName)}</div>
            <div class="rx-prof">${esc(prof.fullName || '')}${prof.specialty ? ' — ' + esc(prof.specialty) : ''}<br>Matrícula: ${esc(prof.licenseNumber || '')}</div>
        </div>
        <div class="rx-date">Fecha: ${issuedDate}</div>
    </div>
    <div class="rx-patient">
        <div><strong>Paciente:</strong> ${esc(pat.fullName || '')}</div>
        <div><strong>DNI:</strong> ${esc(pat.dni || '-')}</div>
        <div><strong>Obra Social:</strong> ${esc(pat.insuranceName || '-')}${pat.insurancePlan ? ' — ' + esc(pat.insurancePlan) : ''}</div>
        ${pat.credentialNumber ? `<div><strong>Credencial:</strong> ${esc(pat.credentialNumber)}</div>` : ''}
    </div>
    <div class="rx-symbol">Rp/</div>
    ${medsHtml}
    ${rx.diagnosis ? `<div class="rx-diagnosis"><strong>Diagnóstico:</strong> ${esc(rx.diagnosis)}</div>` : ''}
    ${rx.instructions ? `<div class="rx-instructions">${esc(rx.instructions)}</div>` : ''}
    <div class="rx-footer">
        <div class="rx-signature">
            <div class="rx-signature-line">Firma y sello<br>${esc(prof.fullName || '')} — Mat. ${esc(prof.licenseNumber || '')}</div>
        </div>
    </div>
    <scr` + `ipt>window.onload = () => { window.print(); };</scr` + `ipt>
</body>
</html>`);
    w.document.close();
};

// =============================================================================
// PRESUPUESTOS DE TRATAMIENTO
// =============================================================================

function _budgetItemRowHtml() {
    return `
    <div class="budget-item-row" style="display:flex;gap:8px;margin-bottom:8px;align-items:center;">
        <input type="text" class="bg-item-desc" placeholder="Práctica / tratamiento" style="flex:3;min-width:0;" required>
        <input type="number" class="bg-item-qty" value="1" min="1" title="Cantidad" style="flex:0 0 64px;">
        <input type="number" class="bg-item-price" placeholder="Precio" min="0" step="0.01" title="Precio unitario" style="flex:0 0 110px;" required>
        <button type="button" class="btn btn-icon btn-icon-danger bg-item-remove" title="Quitar ítem"><i class="fa-solid fa-times"></i></button>
    </div>`;
}

function _recalcBudgetTotal() {
    const rows = document.querySelectorAll('#budget-items .budget-item-row');
    let subtotal = 0;
    rows.forEach(row => {
        const qty = Math.max(1, Number(row.querySelector('.bg-item-qty').value) || 1);
        const price = Math.max(0, Number(row.querySelector('.bg-item-price').value) || 0);
        subtotal += qty * price;
    });
    const discount = Math.max(0, Number(document.getElementById('bg-discount')?.value) || 0);
    const total = Math.max(0, subtotal - discount);
    const totalEl = document.getElementById('bg-total');
    // El total lleva el símbolo de la moneda elegida: un número sin símbolo, en
    // una pantalla donde conviven pesos y dólares, se lee como la moneda que uno
    // tenga en la cabeza.
    const moneda = document.getElementById('bg-currency')?.value || MONEDA_POR_DEFECTO;
    if (totalEl) totalEl.textContent = formatearMonto(total, moneda);
}

function openBudgetModal(patientId) {
    if (!canEditClinicalHistoryUi()) {
        showAlert('Solo el profesional y el superadmin pueden crear presupuestos.', { title: 'Presupuestos', variant: 'error' });
        return;
    }

    const scopedProfs = state.user?.allowedProfessionals || [];
    const allProfs = DB.get('professionals').filter(p => p.active !== false && p.status !== 'inactivo');
    const profs = isSuperadmin() ? allProfs : allProfs.filter(p => scopedProfs.includes(p.id));
    const defaultProfId = getCurrentOdontoProfessionalId() || profs[0]?.id || '';

    modalsContainer.innerHTML = `
        <div class="modal-overlay active">
            <div class="modal-content modal-content-patient" onclick="event.stopPropagation()">
                <div class="modal-header">
                    <h3>Nuevo Presupuesto</h3>
                    <button class="btn-ghost" data-modal-close><i class="fa-solid fa-times"></i></button>
                </div>
                <form id="budget-form">
                    <div class="modal-body">
                        <div class="input-group">
                            <label>Título *</label>
                            <input type="text" id="bg-title" placeholder="Ej: Plan de tratamiento — implante pieza 26" required>
                        </div>
                        <div class="input-group">
                            <label>Profesional responsable</label>
                            <select id="bg-professional" required>
                                ${profs.map(p => `<option value="${p.id}" ${p.id === defaultProfId ? 'selected' : ''}>${escapeHtml(p.name)}</option>`).join('')}
                            </select>
                        </div>
                        <div class="input-group">
                            <label>Ítems del presupuesto *</label>
                            <div id="budget-items">${_budgetItemRowHtml()}</div>
                            <button type="button" class="btn btn-secondary btn-sm" id="bg-add-item"><i class="fa-solid fa-plus"></i> Agregar ítem</button>
                        </div>
                        <div style="display:flex;gap:12px;align-items:flex-end;">
                            <div class="input-group" style="flex:1">
                                <label>Moneda</label>
                                <select id="bg-currency">
                                    ${MONEDAS.map(m => `<option value="${m.codigo}">${m.simbolo} ${m.label}</option>`).join('')}
                                </select>
                            </div>
                            <div class="input-group" style="flex:1">
                                <label>Descuento</label>
                                <input type="number" id="bg-discount" value="0" min="0" step="0.01">
                            </div>
                            <div class="input-group" style="flex:1;text-align:right;">
                                <label>Total</label>
                                <div id="bg-total" style="font-size:1.4rem;font-weight:800;color:var(--primary-600, #0d9488);">$0</div>
                            </div>
                        </div>
                        <div class="input-group">
                            <label>Observaciones</label>
                            <textarea id="bg-notes" rows="2" placeholder="Validez, forma de pago, aclaraciones..."></textarea>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-ghost" onclick="closeModal()">Cancelar</button>
                        <button type="submit" class="btn btn-primary"><i class="fa-solid fa-file-invoice-dollar"></i> Guardar Presupuesto</button>
                    </div>
                </form>
            </div>
        </div>
    `;

    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); }, { once: true });

    const itemsWrap = document.getElementById('budget-items');
    document.getElementById('bg-add-item').addEventListener('click', () => {
        itemsWrap.insertAdjacentHTML('beforeend', _budgetItemRowHtml());
        _recalcBudgetTotal();
    });
    // Delegación: recalcular total ante cualquier cambio y manejar quitar fila
    document.getElementById('budget-form').addEventListener('input', _recalcBudgetTotal);
    document.getElementById('budget-form').addEventListener('change', _recalcBudgetTotal);
    itemsWrap.addEventListener('click', (e) => {
        const btn = e.target.closest('.bg-item-remove');
        if (!btn) return;
        if (itemsWrap.querySelectorAll('.budget-item-row').length > 1) {
            btn.closest('.budget-item-row').remove();
        }
        _recalcBudgetTotal();
    });

    document.getElementById('budget-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const items = Array.from(document.querySelectorAll('#budget-items .budget-item-row')).map(row => ({
            description: row.querySelector('.bg-item-desc').value.trim(),
            quantity: Math.max(1, Number(row.querySelector('.bg-item-qty').value) || 1),
            unitPrice: Math.max(0, Number(row.querySelector('.bg-item-price').value) || 0)
        })).filter(item => item.description);

        if (!items.length) {
            showAlert('Agregá al menos un ítem con descripción y precio.', { title: 'Presupuestos', variant: 'warning' });
            return;
        }

        try {
            await withAppLoading('Guardando presupuesto...', async () => {
                await apiFetch('/budgets', {
                    method: 'POST',
                    body: JSON.stringify({
                        patientId,
                        professionalId: Number(document.getElementById('bg-professional').value),
                        title: document.getElementById('bg-title').value,
                        items,
                        discount: Number(document.getElementById('bg-discount').value) || 0,
                        currency: document.getElementById('bg-currency')?.value || MONEDA_POR_DEFECTO,
                        notes: document.getElementById('bg-notes').value
                    })
                });
                await syncPatientClinicalData(patientId);
            });
            closeModal();
            await loadClinicalHistory(patientId, { skipUnsavedCheck: true, skipSync: true });
        } catch (error) {
            showAlert(error.message || 'No se pudo guardar el presupuesto.', { title: 'Presupuestos', variant: 'error' });
        }
    });
}

window.chargeBudget = async function(patientId, budgetId) {
    const patient = getClinicalWorkingPatient(patientId);
    const budget = (patient?.budgets || []).find(b => b.id === budgetId);
    if (!budget) return;

    const ok = await showConfirm(
        `Se va a generar una deuda de $${Number(budget.total).toLocaleString('es-AR')} en la cuenta corriente de ${escapeHtml(patient.name || 'este paciente')}. ¿Continuar?`,
        { title: 'Cargar presupuesto como deuda', confirmText: 'Cargar deuda' }
    );
    if (!ok) return;

    try {
        await withAppLoading('Cargando deuda en cuenta corriente...', async () => {
            await apiFetch(`/budgets/${budgetId}/charge`, { method: 'POST' });
            await syncPatientClinicalData(patientId);
            await syncBillingToLocalDb();
        });
        await loadClinicalHistory(patientId, { skipUnsavedCheck: true, skipSync: true });
        showToast('Deuda cargada en la cuenta corriente del paciente.');
    } catch (error) {
        showAlert(error.message || 'No se pudo cargar la deuda.', { title: 'Presupuestos', variant: 'error' });
    }
};

window.deleteBudget = async function(patientId, budgetId) {
    if (!canEditClinicalHistoryUi()) return;
    if (!await showConfirm('¿Eliminar este presupuesto?', { title: 'Eliminar presupuesto', confirmText: 'Eliminar' })) return;
    try {
        await withAppLoading('Eliminando presupuesto...', async () => {
            await apiFetch(`/budgets/${budgetId}`, { method: 'DELETE' });
            await syncPatientClinicalData(patientId);
        });
        await loadClinicalHistory(patientId, { skipUnsavedCheck: true, skipSync: true });
    } catch (error) {
        showAlert(error.message || 'No se pudo eliminar el presupuesto.', { title: 'Presupuestos', variant: 'error' });
    }
};

window.printBudget = function(patientId, budgetId) {
    const patient = getClinicalWorkingPatient(patientId);
    const budget = (patient?.budgets || []).find(b => b.id === budgetId);
    if (!budget) {
        showAlert('Presupuesto no encontrado.', { title: 'Presupuestos', variant: 'error' });
        return;
    }

    const clinicName = getClinicDisplayName();
    const issuedDate = budget.issuedAt ? new Date(budget.issuedAt).toLocaleDateString('es-AR') : new Date().toLocaleDateString('es-AR');
    const prof = budget.professional || {};
    const pat = budget.patient || {};
    const esc = escapeHtml;
    const money = (n) => '$' + Number(n).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const subtotal = (budget.items || []).reduce((s, i) => s + i.quantity * i.unitPrice, 0);

    const itemRows = (budget.items || []).map(item => `
        <tr>
            <td>${esc(item.description)}</td>
            <td class="num">${item.quantity}</td>
            <td class="num">${money(item.unitPrice)}</td>
            <td class="num">${money(item.quantity * item.unitPrice)}</td>
        </tr>`).join('');

    const w = window.open('', '_blank', 'width=800,height=900');
    if (!w) {
        showAlert('El navegador bloqueó la ventana de impresión. Habilitá los pop-ups para este sitio.', { title: 'Presupuestos', variant: 'warning' });
        return;
    }
    w.document.write(`<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Presupuesto - ${esc(pat.fullName || '')}</title>
<style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; color: #1a1a1a; padding: 40px 48px; max-width: 760px; margin: 0 auto; font-size: 14px; }
    .bg-header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2.5px solid #1a1a1a; padding-bottom: 14px; }
    .bg-clinic { font-size: 20px; font-weight: bold; letter-spacing: 0.5px; }
    .bg-doc-type { font-size: 13px; color: #555; margin-top: 3px; text-transform: uppercase; letter-spacing: 2px; }
    .bg-meta { text-align: right; font-size: 13px; line-height: 1.7; }
    .bg-patient { margin: 20px 0; font-size: 13.5px; line-height: 1.7; background: #f8f8f8; padding: 12px 16px; border-radius: 6px; }
    .bg-title { font-size: 16px; font-weight: bold; margin: 18px 0 12px; }
    table { width: 100%; border-collapse: collapse; margin-top: 6px; }
    th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #666; border-bottom: 2px solid #1a1a1a; padding: 8px 10px; }
    td { padding: 9px 10px; border-bottom: 1px solid #ddd; }
    .num { text-align: right; white-space: nowrap; }
    th.num, th:nth-child(2), th:nth-child(3), th:nth-child(4) { text-align: right; }
    .bg-totals { margin-top: 14px; display: flex; justify-content: flex-end; }
    .bg-totals-box { min-width: 260px; font-size: 14px; }
    .bg-totals-box div { display: flex; justify-content: space-between; padding: 5px 10px; }
    .bg-total-final { font-size: 17px; font-weight: bold; border-top: 2px solid #1a1a1a; margin-top: 4px; padding-top: 8px !important; }
    .bg-notes { margin-top: 22px; font-size: 12.5px; color: #444; background: #f6f6f6; padding: 10px 14px; border-left: 3px solid #888; white-space: pre-wrap; }
    .bg-validity { margin-top: 18px; font-size: 11.5px; color: #888; }
    .bg-footer { margin-top: 70px; display: flex; justify-content: flex-end; }
    .bg-signature { text-align: center; width: 260px; border-top: 1.5px solid #1a1a1a; padding-top: 6px; font-size: 12.5px; line-height: 1.6; }
    @media print { body { padding: 20px 30px; } }
</style>
</head>
<body>
    <div class="bg-header">
        <div>
            <div class="bg-clinic">${esc(clinicName)}</div>
            <div class="bg-doc-type">Presupuesto de Tratamiento</div>
        </div>
        <div class="bg-meta">
            <div><strong>Fecha:</strong> ${issuedDate}</div>
            <div><strong>N°:</strong> ${String(budget.id).padStart(6, '0')}</div>
        </div>
    </div>
    <div class="bg-patient">
        <div><strong>Paciente:</strong> ${esc(pat.fullName || '')} — DNI ${esc(pat.dni || '-')}</div>
        <div><strong>Obra Social:</strong> ${esc(pat.insuranceName || '-')}${pat.insurancePlan ? ' — ' + esc(pat.insurancePlan) : ''}</div>
        <div><strong>Profesional:</strong> ${esc(prof.fullName || '')}${prof.specialty ? ' — ' + esc(prof.specialty) : ''}${prof.licenseNumber ? ' — Mat. ' + esc(prof.licenseNumber) : ''}</div>
    </div>
    <div class="bg-title">${esc(budget.title)}</div>
    <table>
        <thead>
            <tr><th>Descripción</th><th>Cant.</th><th>Precio Unit.</th><th>Importe</th></tr>
        </thead>
        <tbody>${itemRows}</tbody>
    </table>
    <div class="bg-totals">
        <div class="bg-totals-box">
            <div><span>Subtotal</span><span>${money(subtotal)}</span></div>
            ${budget.discount > 0 ? `<div><span>Descuento</span><span>− ${money(budget.discount)}</span></div>` : ''}
            <div class="bg-total-final"><span>TOTAL</span><span>${money(budget.total)}</span></div>
        </div>
    </div>
    ${budget.notes ? `<div class="bg-notes">${esc(budget.notes)}</div>` : ''}
    <div class="bg-validity">Presupuesto válido por 30 días desde la fecha de emisión. Los valores pueden ajustarse vencido ese plazo.</div>
    <div class="bg-footer">
        <div class="bg-signature">Firma y sello<br>${esc(prof.fullName || '')}</div>
    </div>
    <scr` + `ipt>window.onload = () => { window.print(); };</scr` + `ipt>
</body>
</html>`);
    w.document.close();
};
