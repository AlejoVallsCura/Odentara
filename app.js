
// --- Events ---
document.addEventListener('DOMContentLoaded', () => {
    clearTimeout(window.__clinicFallback); // app.js cargó — cancelar fallback de redirección

    ensureThemeControls();
    applyTheme(getStoredTheme(), false);
    applyClinicBranding();
    setupMojibakeAutoRepair();

    const loginForm = document.getElementById('login-form');
    loginForm.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter') return;
        if (isAppLoading()) {
            event.preventDefault();
            return;
        }
        event.preventDefault();
        loginForm.requestSubmit();
    });

    // ── Login setup ──────────────────────────────────────────────────────────────
    const isTurnstileHost = /^app\.odentara\.com$/i.test(location.hostname);
    const submitBtn = document.getElementById('login-submit-btn');

    function showLoginError(msg) {
        const el = document.getElementById('login-error-msg');
        if (!el) return;
        el.textContent = msg;
        el.classList.remove('hidden');
    }
    function clearLoginError() {
        const el = document.getElementById('login-error-msg');
        if (el) el.classList.add('hidden');
    }
    document.getElementById('email')?.addEventListener('input', clearLoginError);
    document.getElementById('password')?.addEventListener('input', clearLoginError);

    // ── Turnstile (solo en app.odentara.com) ─────────────────────────────────────
    if (isTurnstileHost) {
        if (submitBtn) submitBtn.disabled = true;

        // _renderTurnstile limpia e inicia el widget. Se llama en tres momentos:
        //   • Al cargar la página (desde _turnstileOnLoad o el flag de arranque)
        //   • Al hacer logout (desde logout())
        window._renderTurnstile = function() {
            const container = document.getElementById('turnstile-container');
            if (!container || !window.turnstile) return;
            container.innerHTML = '';
            if (submitBtn) submitBtn.disabled = true;
            window.turnstile.render(container, {
                sitekey: '0x4AAAAAADXSH3_I07gUFeOy',
                theme: 'dark',
                callback: function() {
                    if (submitBtn) submitBtn.disabled = false;
                    clearLoginError();
                },
                'expired-callback': function() {
                    if (submitBtn) submitBtn.disabled = true;
                },
            });
        };

        window._turnstileOnLoad = window._renderTurnstile;

        // Si CF terminó de cargar antes que app.js (flag activado por el stub):
        if (window._turnstileReadyFlag) window._renderTurnstile();

    } else {
        if (submitBtn) submitBtn.disabled = false;
    }

    // ── Submit ────────────────────────────────────────────────────────────────────
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (isAppLoading()) return;

        const email    = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;

        if (!email && !password) { showLoginError('Ingresá tu email y contraseña.'); return; }
        if (!email)               { showLoginError('Ingresá tu email.'); return; }
        if (!password)            { showLoginError('Ingresá tu contraseña.'); return; }

        const turnstileInput = document.querySelector('[name="cf-turnstile-response"]');
        if (isTurnstileHost && !turnstileInput?.value) {
            showLoginError('Completá la verificación de seguridad antes de continuar.');
            return;
        }

        clearLoginError();
        if (submitBtn) submitBtn.disabled = true;

        try {
            const turnstileToken = isTurnstileHost ? (turnstileInput?.value || '') : '';
            await withAppLoading('Iniciando sesión...', () => login(email, password, turnstileToken));
        } finally {
            if (isTurnstileHost && window.turnstile) {
                window.turnstile.reset();
                if (submitBtn) submitBtn.disabled = true;
            } else {
                if (submitBtn) submitBtn.disabled = false;
            }
        }
    });

    // ── Forgot / Reset password ──────────────────────────────────────────────────
    function showLoginPanel(panelId) {
        ['login-panel', 'forgot-panel', 'reset-panel', 'clinic-picker-panel'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.classList.toggle('hidden', id !== panelId);
        });
    }

    // Si la URL tiene ?resetToken=xxx, mostrar el formulario de reset
    const urlParams = new URLSearchParams(window.location.search);
    const resetToken = urlParams.get('resetToken');
    if (resetToken) {
        showLoginPanel('reset-panel');
        // Limpiar el token de la URL sin recargar la página
        const cleanUrl = window.location.pathname;
        window.history.replaceState({}, '', cleanUrl);
    }

    // Link "¿Olvidaste tu contraseña?"
    document.getElementById('forgot-password-link')?.addEventListener('click', () => {
        showLoginPanel('forgot-panel');
        document.getElementById('forgot-email')?.focus();
    });

    // Link "← Volver al login" desde forgot panel
    document.getElementById('back-to-login-link')?.addEventListener('click', () => {
        showLoginPanel('login-panel');
    });

    // Botón "Volver al login" desde el mensaje de éxito del forgot
    document.getElementById('forgot-back-btn')?.addEventListener('click', () => {
        document.getElementById('forgot-form')?.classList.remove('hidden');
        document.getElementById('forgot-success')?.classList.add('hidden');
        showLoginPanel('login-panel');
    });

    // Botón "← Volver al login" desde el clinic picker
    document.getElementById('clinic-picker-back-btn')?.addEventListener('click', () => {
        showLoginPanel('login-panel');
    });

    // Botón "Ir al login" desde el mensaje de éxito del reset
    document.getElementById('reset-goto-login-btn')?.addEventListener('click', () => {
        document.getElementById('reset-form')?.classList.remove('hidden');
        document.getElementById('reset-success')?.classList.add('hidden');
        showLoginPanel('login-panel');
    });

    // Formulario de forgot password
    document.getElementById('forgot-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('forgot-email')?.value?.trim();
        const btn = document.getElementById('forgot-submit-btn');
        if (!email || !btn) return;
        btn.disabled = true;
        btn.textContent = 'Enviando...';
        try {
            await apiFetch('/auth/forgot-password', {
                method: 'POST',
                body: JSON.stringify({ email }),
            });
            // Siempre mostramos éxito (el servidor no revela si existe el email)
            document.getElementById('forgot-form')?.classList.add('hidden');
            document.getElementById('forgot-success')?.classList.remove('hidden');
        } catch (_) {
            // Error de red — igual mostramos mensaje genérico
            document.getElementById('forgot-form')?.classList.add('hidden');
            document.getElementById('forgot-success')?.classList.remove('hidden');
        } finally {
            btn.disabled = false;
            btn.textContent = 'Enviar enlace';
        }
    });

    // Formulario de reset password
    document.getElementById('reset-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const password  = document.getElementById('reset-password')?.value;
        const password2 = document.getElementById('reset-password2')?.value;
        const btn = document.getElementById('reset-submit-btn');
        if (!password || !password2 || !btn) return;

        if (password !== password2) {
            alert('Las contraseñas no coinciden.');
            return;
        }
        if (password.length < 8) {
            alert('La contraseña debe tener al menos 8 caracteres.');
            return;
        }

        // Recuperamos el token que guardamos en una variable de closure
        const token = (window.__resetToken__ || '');
        if (!token) {
            alert('Token inválido. Solicitá un nuevo enlace de recuperación.');
            showLoginPanel('login-panel');
            return;
        }

        btn.disabled = true;
        btn.textContent = 'Guardando...';
        try {
            const res = await apiFetch('/auth/reset-password', {
                method: 'POST',
                body: JSON.stringify({ token, password }),
            });
            if (!res.ok) throw new Error(res.error || 'Error');
            window.__resetToken__ = null;
            document.getElementById('reset-form')?.classList.add('hidden');
            document.getElementById('reset-success')?.classList.remove('hidden');
        } catch (err) {
            alert(err.message || 'No se pudo restablecer la contraseña.');
        } finally {
            btn.disabled = false;
            btn.textContent = 'Guardar contraseña';
        }
    });

    // Guardamos el token en una variable global de módulo para el submit del reset
    if (resetToken) window.__resetToken__ = resetToken;

    document.getElementById('logout-btn').addEventListener('click', logout);
    sidebarToggle?.addEventListener('click', () => setSidebarOpen(!state.sidebarOpen));
    sidebarBackdrop?.addEventListener('click', () => setSidebarOpen(false));
    document.getElementById('sidebar-close-btn')?.addEventListener('click', () => setSidebarOpen(false));
    window.addEventListener('resize', syncSidebarLayout);
    setSidebarOpen(!isMobileLayout());
    
    document.addEventListener('click', async (e) => {
        if (e.target.matches('.modal-overlay') || e.target.closest('[data-modal-close]')) closeModal();
        if (e.target.closest('[data-theme-toggle]')) {
            e.preventDefault();
            toggleTheme();
            return;
        }

        // CRUD Routes
        if (e.target.closest('#btn-add-apt')) openAppointmentModal();
        if (e.target.closest('.btn-edit-apt')) openAppointmentModal(parseInt(e.target.closest('.btn-edit-apt').dataset.id));
        if (e.target.closest('.btn-delete-apt')) {
            const aptId = parseInt(e.target.closest('.btn-delete-apt').dataset.id);
            const apt = getAccessibleAppointments().find(item => item.id === aptId);
            if (apt && await showConfirm('¿Eliminar este turno?', { title: 'Eliminar turno', confirmText: 'Eliminar' })) {
                try {
                    await deleteViaApiOrLocal({
                        path: `/appointments/${aptId}`,
                        localTable: 'appointments',
                        localId: aptId
                    });
                    refreshCurrentView();
                } catch (error) {
                    alert(error.message || 'No se pudo eliminar el turno.');
                }
            }
        }
        
        if (e.target.closest('.btn-edit-user')) {
            const userId = parseInt(e.target.closest('.btn-edit-user').dataset.id);
            state.editingUserId = userId;
            state.settingsSubView = 'create-user';
            refreshCurrentView();
        }
        if (e.target.closest('.btn-edit-prof')) {
            const profId = parseInt(e.target.closest('.btn-edit-prof').dataset.id);
            state.editingProfId = profId;
            state.settingsSubView = 'create-professional';
            refreshCurrentView();
        }
        if (e.target.closest('#btn-add-patient') || e.target.closest('#btn-add-patient-empty')) openPatientModal();
        if (e.target.closest('#btn-import-patients') || e.target.closest('#btn-import-patients-empty')) openPatientImportModal();
        if (e.target.closest('.btn-edit-patient')) openPatientModal(parseInt(e.target.closest('.btn-edit-patient').dataset.id));
        if (e.target.closest('.btn-delete-patient')) {
            const patientId = parseInt(e.target.closest('.btn-delete-patient').dataset.id);
            if (!isSuperadmin()) {
                alert('Solo el superadmin puede eliminar pacientes.');
                return;
            }
            if (canAccessPatient(patientId) && await showConfirm('¿Eliminar paciente y su historial?', { title: 'Eliminar paciente', confirmText: 'Eliminar' })) {
                try {
                    if (state.authToken) {
                        await apiFetch(`/patients/${patientId}`, { method: 'DELETE' });
                        await syncBackendSnapshotToLocalDb();
                    } else {
                        DB.archive('patients', patientId);
                    }
                    refreshCurrentView();
                } catch (error) {
                    alert(error.message || 'No se pudo eliminar el paciente.');
                }
            }
        }
        if (e.target.closest('.btn-view-history')) {
            const patientId = parseInt(e.target.closest('.btn-view-history').dataset.id);
            if (!canViewClinicalHistoryUi()) {
                showAlert('El secretario no puede acceder a la historia clínica.', { title: 'Historia clínica', variant: 'error' });
                return;
            }
            if (canAccessPatient(patientId)) loadClinicalHistory(patientId);
        }
        if (e.target.closest('.btn-view-patient-billing')) {
            const patientId = parseInt(e.target.closest('.btn-view-patient-billing').dataset.id);
            if (Number.isInteger(patientId)) {
                if (document.getElementById('patient-billing-picker-results')) {
                    closeModal();
                }
                openPatientBilling(patientId);
            }
        }

        if (!e.target.closest('.stp-wrap')) {
            document.querySelectorAll('.stp-dropdown').forEach(d => { d.hidden = true; });
        }
        if (e.target.closest('#btn-add-tx')) openBillingModal();
        if (e.target.closest('#btn-open-patient-billing')) openPatientBillingPicker();
        if (e.target.closest('#btn-clear-patient-billing')) clearPatientBillingFilter();
        const addMovBtn = e.target.closest('#btn-add-movement-from-account');
        if (addMovBtn) openBillingModal(parseInt(addMovBtn.dataset.patientId));
        if (e.target.closest('.btn-delete-tx')) {
            const txId = parseInt(e.target.closest('.btn-delete-tx').dataset.id);
            // Buscar en local DB (ya sincronizado al cargar la vista)
            const tx = DB.get('billing').find(item => item.id === txId);
            const canAccess = tx ? canAccessProfessional(tx.professionalId) : true; // si no está en local, asumir acceso y dejar que la API rechace
            if (canAccess && await showConfirm('¿Eliminar transacción?', { title: 'Eliminar transacción', confirmText: 'Eliminar' })) {
                try {
                    await deleteViaApiOrLocal({
                        path: `/billing/${txId}`,
                        localTable: 'billing',
                        localId: txId
                    });
                    refreshCurrentView();
                } catch (error) {
                    alert(error.message || 'No se pudo eliminar la transacción.');
                }
            }
        }
        
        if (e.target.closest('.btn-edit-schedule')) {
            const profId = parseInt(e.target.closest('.btn-edit-schedule').dataset.id);
            if (canAccessProfessional(profId)) openScheduleModal(profId);
        }
    });

    // Calendar navigation & filter
    document.addEventListener('click', (e2) => {
        if (e2.target.closest('#cal-prev')) {
            const date = parseLocalIsoDate(calendarState.currentDate);
            if (calendarState.viewMode === 'day') {
                date.setDate(date.getDate() - 1);
            } else if (calendarState.viewMode === 'week') {
                date.setDate(date.getDate() - 7);
            } else if (calendarState.viewMode === 'month') {
                date.setMonth(date.getMonth() - 1);
            }
            calendarState.currentDate = formatDateToLocalIso(date);
            refreshCurrentView();
        }
        if (e2.target.closest('#cal-next')) {
            const date = parseLocalIsoDate(calendarState.currentDate);
            if (calendarState.viewMode === 'day') {
                date.setDate(date.getDate() + 1);
            } else if (calendarState.viewMode === 'week') {
                date.setDate(date.getDate() + 7);
            } else if (calendarState.viewMode === 'month') {
                date.setMonth(date.getMonth() + 1);
            }
            calendarState.currentDate = formatDateToLocalIso(date);
            refreshCurrentView();
        }
        if (e2.target.closest('#cal-view-today')) {
            calendarState.viewMode = 'day';
            calendarState.currentDate = getTodayIsoLocal();
            refreshCurrentView();
        }
        if (e2.target.closest('#cal-view-week')) {
            calendarState.viewMode = 'week';
            refreshCurrentView();
        }
        if (e2.target.closest('#cal-view-month')) {
            calendarState.viewMode = 'month';
            refreshCurrentView();
        }
        const dayJumpTarget = e2.target.closest('[data-calendar-date]');
        if (dayJumpTarget) {
            const nextDate = dayJumpTarget.dataset.calendarDate;
            if (nextDate) {
                calendarState.currentDate = nextDate;
                calendarState.viewMode = 'day';
                refreshCurrentView();
            }
        }
    });

    document.addEventListener('change', (e3) => {
        if (e3.target.id === 'dashboard-date-filter') {
            state.dashboardDate = e3.target.value || getTodayIsoLocal();
            if (state.currentView === 'dashboard') refreshCurrentView();
        }
    });
    document.addEventListener('change', (e2) => {
    });

    document.addEventListener('click', (e4) => {
        const profButton = e4.target.closest('.cal-prof-select');
        if (!profButton) return;
        const id = parseInt(profButton.dataset.id, 10);
        const professionals = getAccessibleProfessionals();
        if (!Number.isFinite(id) || !professionals.some((p) => p.id === id)) return;
        setCalendarProfessionalSelection(professionals, id);
        refreshCurrentView();
    });

    document.addEventListener('keydown', (event) => {
        if (!state.clinicalImageViewer) return;

        if (event.key === 'ArrowLeft') {
            event.preventDefault();
            stepClinicalImageViewer(-1);
        }

        if (event.key === 'ArrowRight') {
            event.preventDefault();
            stepClinicalImageViewer(1);
        }

        if (event.key === 'Escape') {
            event.preventDefault();
            closeModal();
        }
    });

    document.addEventListener('input', (e) => {
        // Auto-generar slug desde nombre en el form de clínica
        if (e.target.id === 'pcf-name') {
            const slugEl = document.getElementById('pcf-slug');
            if (slugEl && !slugEl.disabled) {
                slugEl.value = e.target.value.trim().toLowerCase()
                    .normalize('NFD').replace(/[̀-ͯ]/g, '')
                    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
            }
        }
        // Actualizar preview de URL al tipear nombre o slug
        if (e.target.id === 'pcf-name' || e.target.id === 'pcf-slug') {
            const slugEl = document.getElementById('pcf-slug');
            const preview = document.getElementById('pcf-url-preview');
            if (slugEl && preview) {
                preview.textContent = `${slugEl.value || '______'}.odentara.com`;
            }
        }

        if (e.target.id === 'search-patient') {
            const term = e.target.value.toLowerCase();
            const rows = document.querySelectorAll('#patients-table tbody tr');
            rows.forEach(row => {
                const text = row.innerText.toLowerCase();
                row.style.display = text.includes(term) ? '' : 'none';
            });
        }

        if (e.target.id === 'search-patient-billing-main') {
            syncBillingPatientSearchResults(e.target.value || '');
        }

        if (e.target.id === 'patient-billing-picker-search') {
            syncPatientBillingPickerResults(e.target.value || '');
        }
    });

    document.addEventListener('click', (e) => {
        const settingsButton = e.target.closest('[data-settings-view]');
        if (settingsButton) {
            state.settingsSubView = settingsButton.dataset.settingsView;
            state.editingUserId = null;
            state.editingProfId = null;
            refreshCurrentView();
        }
    });

    document.addEventListener('click', (e) => {
        const billingButton = e.target.closest('[data-billing-view]');
        if (billingButton) {
            state.billingSubView = billingButton.dataset.billingView;
            refreshCurrentView();
        }
        const cajaPeriodBtn = e.target.closest('[data-caja-period]');
        if (cajaPeriodBtn) {
            state.cajaPeriod = cajaPeriodBtn.dataset.cajaPeriod;
            refreshCurrentView();
        }
    });

    document.addEventListener('submit', async (e) => {
        if (e.target.id === 'clinic-settings-form') {
            e.preventDefault();
            const clinicNameInput = document.getElementById('clinic-name');
            const clinicName = String(clinicNameInput?.value || '').trim();

            if (!clinicName) {
                alert('El nombre de la clínica es obligatorio.');
                clinicNameInput?.focus();
                return;
            }

            const colorInputs = Array.from(e.target.querySelectorAll('input[name="clinic-prof-color"]'));
            const professionalColors = {};
            colorInputs.forEach((input, idx) => {
                const profId = parseInt(input.dataset.profId || '', 10);
                if (!Number.isFinite(profId)) return;
                const fallback = PROF_COLORS[idx % PROF_COLORS.length]?.bg || '#6366f1';
                const color = normalizeHexColor(input.value, fallback);
                professionalColors[String(profId)] = color;
                DB.update('professionals', profId, { color });
            });
            saveClinicSettings({
                name: clinicName,
                professionalColors
            });

            applyClinicBranding();
            showToast('Configuración de clínica guardada.', { type: 'success' });
            refreshCurrentView();
            renderSidebar();
            return;
        }

        if (e.target.id === 'new-user-form') {
            e.preventDefault();
            const editingId = parseInt(document.getElementById('u-editing-id')?.value || '', 10);
            const isEditing = Number.isFinite(editingId) && editingId > 0;
            const name     = document.getElementById('u-name').value.trim();
            const email    = document.getElementById('u-email').value.trim();
            const password = document.getElementById('u-password').value;

            if (!name || !email || (!isEditing && !password)) {
                alert(isEditing ? 'Completa nombre y email.' : 'Completa nombre, email y contraseña.');
                return;
            }
            if (password && password.length < 8) {
                alert('La contraseña debe tener al menos 8 caracteres.');
                return;
            }
            const roleNodes = Array.from(document.querySelectorAll('input[name="u-role"]:checked'));
            const roles = roleNodes.map(r => r.value);
            if (roles.length === 0) {
                alert('Selecciona al menos un rol de permisos.');
                return;
            }
            // Derivar tipo visualmente desde los roles seleccionados
            const type = (() => {
                const r = roles.map(c => String(c).toLowerCase());
                if (r.some(c => c === 'superadmin')) return 'superadmin';
                if (r.some(c => c === 'professional' || c === 'profesional')) return 'profesional';
                if (r.some(c => c === 'secretary' || c === 'secretario')) return 'secretario';
                if (r.some(c => c === 'admin' || c === 'administrador')) return 'administrador';
                return 'administrador';
            })();
            const profNodes = Array.from(document.querySelectorAll('input[name="u-profs"]:checked'));
            const selectedProfessionals = profNodes.map(p => parseInt(p.value));
            const hasProfRole = roles.includes('profesional') || roles.includes('professional');
            const linkedProfessionalId = hasProfRole && selectedProfessionals.length > 0 ? selectedProfessionals[0] : null;
            const payload = { fullName: name, email, type, roles, allowedProfessionalIds: selectedProfessionals, linkedProfessionalId };
            if (password) payload.password = password;

            try {
                await withAppLoading(isEditing ? 'Actualizando usuario...' : 'Guardando usuario...', async () => {
                    if (state.authToken) {
                        await apiFetch(isEditing ? `/users/${editingId}` : '/users', {
                            method: isEditing ? 'PUT' : 'POST',
                            body: JSON.stringify(payload)
                        });
                        await syncBackendSnapshotToLocalDb();
                    } else if (isEditing) {
                        DB.update('users', editingId, { name, email, ...(password ? { password } : {}), type, roles, allowedProfessionals: selectedProfessionals });
                    } else {
                        DB.add('users', { name, email, password, type, roles, allowedProfessionals: selectedProfessionals });
                    }
                });
                state.editingUserId = null;
                e.target.reset();
                showToast(isEditing ? 'Usuario actualizado correctamente.' : 'Usuario creado correctamente.', { type: 'success' });
            } catch (error) {
                const detail = error.payload?.detail ? `\n\nDetalle: ${error.payload.detail}` : '';
                alert((error.message || (isEditing ? 'No se pudo actualizar el usuario.' : 'No se pudo crear el usuario.')) + detail);
            }
            refreshCurrentView();
        }

        if (e.target.id === 'new-prof-form') {
            e.preventDefault();
            const editingId = parseInt(document.getElementById('p-editing-id')?.value || '', 10);
            const isEditing = Number.isFinite(editingId) && editingId > 0;
            const name      = document.getElementById('p-name').value.trim();
            const lastName  = document.getElementById('p-lastname').value.trim();
            const specialty = document.getElementById('p-specialty').value.trim();
            const phone     = document.getElementById('p-phone').value.trim();
            const email     = document.getElementById('p-email').value.trim();
            const status    = document.getElementById('p-status').value;

            if (!name || !lastName || !specialty) {
                alert('Nombre, apellido y especialidad son obligatorios para un profesional.');
                return;
            }
            const payload = { fullName: `${name} ${lastName}`.trim(), specialty, phone, email, active: (status || 'activo') === 'activo' };

            try {
                await withAppLoading(isEditing ? 'Actualizando profesional...' : 'Guardando profesional...', async () => {
                    if (state.authToken) {
                        await apiFetch(isEditing ? `/professionals/${editingId}` : '/professionals', {
                            method: isEditing ? 'PUT' : 'POST',
                            body: JSON.stringify(payload)
                        });
                        await syncBackendSnapshotToLocalDb();
                    } else if (isEditing) {
                        DB.update('professionals', editingId, { name: `${name} ${lastName}`, firstName: name, lastName, specialty, phone, email, status: status || 'activo', active: status === 'activo' });
                    } else {
                        DB.add('professionals', { name: `${name} ${lastName}`, firstName: name, lastName, specialty, phone, email, status: status || 'activo', schedule: { 1:{active:true,start:'08:00',end:'16:00'}, 2:{active:true,start:'08:00',end:'16:00'}, 3:{active:true,start:'08:00',end:'16:00'}, 4:{active:true,start:'08:00',end:'16:00'}, 5:{active:true,start:'08:00',end:'16:00'}, 6:{active:false,start:'',end:''}, 0:{active:false,start:'',end:''} } });
                    }
                });
                state.editingProfId = null;
                e.target.reset();
                showToast(isEditing ? 'Profesional actualizado correctamente.' : 'Profesional creado correctamente.', { type: 'success' });
            } catch (error) {
                alert(error.message || (isEditing ? 'No se pudo actualizar el profesional.' : 'No se pudo crear el profesional.'));
            }
            refreshCurrentView();
        }
    });

    window.addEventListener('beforeunload', (event) => {
        if (!hasUnsavedClinicalDraft()) return;
        event.preventDefault();
        event.returnValue = '';
    });

    // Si viene con ?__exchange=, ocultar el login inmediatamente para evitar
    // el flash del formulario mientras el loading overlay todavía no cargó.
    if (new URLSearchParams(location.search).has('__exchange')) {
        views.login?.classList.add('hidden');
        views.login?.classList.remove('active');
    }

    withAppLoading('Iniciando sesión...', async () => {
        await tryRestoreSession();
    });
});

