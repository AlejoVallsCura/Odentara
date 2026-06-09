// =============================================================================
// settings.js — Vista de configuracion de clinica y usuarios
// =============================================================================

function renderSettingsSubpages() {
    const users = DB.get('users');
    const profs = DB.get('professionals');
    const clinicSettings = getClinicSettings();
    const clinicName = String(clinicSettings.name || DEFAULT_CLINIC_SETTINGS.name);
    const isSuper = state.user.roles.includes('superadmin');
    const isAdmin = state.user.roles.some(role => ['superadmin', 'admin'].includes(role));
    const isSecretary = state.user.roles.includes('secretary');
    const canManageSettings = isAdmin || isSecretary;
    const canManageUsers = isAdmin;       // crear/ver usuarios y profesionales
    const canManageClinic = isSecretary || isAdmin; // configuración de clínica

    if (!canManageSettings) {
        return `
            <div class="settings-card">
                <h3>Acceso denegado</h3>
                <p>No tenés permisos para acceder a la configuración.</p>
            </div>
        `;
    }

    const _roleBadgeClass = r => r === 'superadmin' ? 'badge-danger' : r === 'admin' ? 'badge-info' : r === 'secretary' ? 'badge-warning' : r === 'professional' ? 'badge-success' : 'badge-gray';
    const _roleLabel = r => ({ superadmin: 'superadmin', admin: 'admin', secretary: 'secretario', professional: 'profesional' }[r] || r);
    const userCards = users.map(u => {
        const rolesList = (u.roles || (u.role ? [u.role] : []));
        const initials = (u.name || u.email || 'U').substring(0, 2).toUpperCase();
        const roleBadges = rolesList.length
            ? rolesList.map(r => `<span class="badge ${_roleBadgeClass(r)} flex-shrink-0">${_roleLabel(r)}</span>`).join('')
            : `<span class="badge badge-gray flex-shrink-0">sin rol</span>`;
        return `
            <div class="settings-entity-card">
                <div class="settings-entity-avatar">${escapeHtml(initials)}</div>
                <div class="settings-entity-info">
                    <span class="settings-entity-name">${escapeHtml(u.name || 'Sin nombre')}</span>
                    <span class="settings-entity-sub">${escapeHtml(u.email || '-')}</span>
                </div>
                <div class="user-role-badges flex-shrink-0" style="display:flex;gap:4px;flex-wrap:wrap;justify-content:flex-end;">${roleBadges}</div>
                <div class="settings-entity-actions">
                    ${(isSuper || u.id === state.user?.id) ? `
                    <button class="btn btn-icon btn-edit-user" data-id="${u.id}" title="Editar"><i class="fa-solid fa-pen"></i></button>` : ''}
                    ${isSuper && !u.isPlatformAdmin ? `<button class="btn btn-icon" onclick="deleteUser(${u.id})" title="Eliminar" style="color:var(--danger)"><i class="fa-solid fa-trash"></i></button>` : ''}
                </div>
            </div>`;
    }).join('');

    const profesionalRows = profs.map(p => {
        const statusLabel = p.status === 'activo'
            ? `<span class="badge badge-success">Activo</span>`
            : `<span class="badge badge-gray">Inactivo</span>`;
        return `
            <div class="settings-entity-card">
                <div class="settings-entity-avatar" style="background:${getProfColor(p.id).bg}22; color:${getProfColor(p.id).bg}; border:2px solid ${getProfColor(p.id).bg}44;">
                    ${(p.name||'').split(' ').map(w=>w[0]).join('').substring(0,2).toUpperCase() || '?'}
                </div>
                <div class="settings-entity-info">
                    <span class="settings-entity-name">${escapeHtml(p.name)}${p.lastName ? ' ' + escapeHtml(p.lastName) : ''}</span>
                    <span class="settings-entity-sub">${escapeHtml(p.specialty || p.email || '-')}</span>
                </div>
                ${statusLabel}
                <div class="settings-entity-actions">
                    <button class="btn btn-icon btn-edit-prof" data-id="${p.id}" title="Editar"><i class="fa-solid fa-pen"></i></button>
                    ${canViewAppointmentsUi() ? `<button class="btn btn-icon" onclick="viewProfessionalCalendar(${p.id})" title="Calendario"><i class="fa-solid fa-calendar-days"></i></button>` : ''}
                    ${canManageProfessionalSchedulesUi() ? `<button class="btn btn-icon btn-edit-schedule" data-id="${p.id}" title="Horarios"><i class="fa-solid fa-clock"></i></button>` : ''}
                </div>
            </div>`;
    }).join('');

    const professionalColorRows = profs.length
        ? profs.map((professional, idx) => {
            // Usar getProfColor como fuente única — es lo que muestran los chips realmente
            const currentColor = getProfColor(professional.id).bg;
            const swatchId = `swatch-${professional.id}`;
            const hexId    = `hexval-${professional.id}`;
            const chipId   = `chip-${professional.id}`;
            return `
                <div class="prof-color-row">
                    <span class="dash-prof-chip" id="${chipId}" style="background:${currentColor};color:#fff;min-width:7rem;text-align:center;">
                        ${escapeHtml(professional.name)}
                    </span>
                    <label class="prof-color-swatch-label" title="Cambiar color">
                        <span class="prof-color-swatch" id="${swatchId}" style="background:${currentColor}"></span>
                        <span class="prof-color-hex" id="${hexId}">${currentColor}</span>
                        <input type="color" name="clinic-prof-color" data-prof-id="${professional.id}" value="${currentColor}"
                            class="prof-color-input-hidden"
                            oninput="
                                document.getElementById('${swatchId}').style.background=this.value;
                                document.getElementById('${hexId}').textContent=this.value;
                                document.getElementById('${chipId}').style.background=this.value;
                            ">
                    </label>
                </div>
            `;
        }).join('')
        : '<p class="subtext">No hay profesionales cargados todavía.</p>';

    const settingsSections = [
        ...(canManageClinic ? [{ id: 'clinic-settings', label: 'Configuración clínica', icon: 'fa-hospital', description: 'Nombre comercial e identidad visual de profesionales.' }] : []),
        ...(canManageUsers ? [{ id: 'create-user', label: 'Crear usuario', icon: 'fa-user-plus', description: 'Alta de nuevos usuarios y permisos.' }] : []),
        ...(canManageUsers ? [{ id: 'create-professional', label: 'Crear profesional', icon: 'fa-user-doctor', description: 'Registro de profesionales y datos base.' }] : []),
        ...(canManageUsers ? [{ id: 'users-list', label: 'Usuarios existentes', icon: 'fa-users-gear', description: 'Listado de usuarios y accesos asignados.' }] : []),
        ...(canManageUsers ? [{ id: 'professionals-list', label: 'Profesionales existentes', icon: 'fa-address-card', description: 'Vista de profesionales y acceso al calendario.' }] : []),
    ];

    const activeSection = settingsSections.some(section => section.id === state.settingsSubView)
        ? state.settingsSubView
        : (settingsSections[0]?.id || 'create-professional');
    state.settingsSubView = activeSection;

    const settingsContent = {
        'clinic-settings': `
            <section class="settings-card settings-panel-card">
                <header>
                    <div>
                        <h3>Configuración de la Clínica</h3>
                        <p class="subtext">"Odentara" queda fijo. Aquí personalizas el subtítulo (debajo del logo) y los colores de cada profesional en agenda y vistas de turnos.</p>
                    </div>
                </header>
                <form id="clinic-settings-form" class="settings-form-row columns-1">
                    <div class="input-group">
                        <label>Subtítulo de la clínica (debajo de Odentara) *</label>
                        <input type="text" id="clinic-name" value="${clinicName}" required>
                    </div>

                    <div class="settings-subsection">
                        <h4>Color por profesional</h4>
                        <p class="subtext">Estos colores se usan en chips, agenda diaria y referencias de turnos.</p>
                        <div class="settings-list settings-list-static">
                            ${professionalColorRows}
                        </div>
                    </div>

                    <button type="submit" class="btn btn-primary">Guardar Configuración</button>
                </form>
            </section>
        `,
        'create-user': canManageUsers ? (() => {
            const editingUser = state.editingUserId ? users.find(u => u.id === state.editingUserId) : null;
            const isEditing = !!editingUser;
            const editingRoles = new Set(editingUser ? (editingUser.roles || (editingUser.role ? [editingUser.role] : [])) : []);
            const currentLinkedProfId = editingUser?.assignedProfessionalId || editingUser?.linkedProfessionalId || null;
            const editingProfs = new Set([
                ...((editingUser && editingUser.allowedProfessionals) || []).map(id => parseInt(id, 10)),
                ...(currentLinkedProfId ? [currentLinkedProfId] : [])
            ]);
            const isRoleChecked = (r) => editingRoles.has(r) || (r==='administrador'&&editingRoles.has('admin')) || (r==='secretario'&&editingRoles.has('secretary')) || (r==='profesional'&&editingRoles.has('professional'));
            return `
            <section class="settings-card settings-panel-card">
                <header>
                    <div>
                        <h3>${isEditing ? 'Editar Usuario' : 'Crear Nuevo Usuario'}</h3>
                        <p class="subtext">${isEditing ? 'La contraseña es opcional; completala solo si querés cambiarla.' : 'Campos obligatorios: Nombre completo, Email y Contraseña. El tipo se define por los roles.'}</p>
                    </div>
                </header>
                <form id="new-user-form" class="settings-form-row columns-1">
                    <input type="hidden" id="u-editing-id" value="${isEditing ? editingUser.id : ''}">
                    <div class="input-group"><label>Nombre completo *</label><input type="text" id="u-name" value="${isEditing ? escapeHtml(editingUser.name||editingUser.fullName||'') : ''}" required></div>
                    <div class="input-group"><label>Email *</label><input type="email" id="u-email" value="${isEditing ? escapeHtml(editingUser.email||'') : ''}" required></div>
                    <div class="input-group"><label>Contraseña ${isEditing ? '(opcional — completá solo si querés cambiarla)' : '*'}</label><div class="pwd-wrap"><input type="password" id="u-password" minlength="8" placeholder="${isEditing ? 'Dejar vacío para no cambiar' : 'Mínimo 8 caracteres'}" ${isEditing ? '' : 'required'} style="padding-right:40px;"><button type="button" class="login-pwd-toggle" tabindex="-1" onclick="const i=document.getElementById('u-password');i.type=i.type==='password'?'text':'password';this.querySelector('i').className='fa-solid '+(i.type==='password'?'fa-eye':'fa-eye-slash')"><i class="fa-solid fa-eye"></i></button></div></div>
                    ${(isAdmin || !isEditing || editingUser?.id !== state.user?.id) ? `
                    <div class="settings-subsection">
                        <h4>Roles de Permisos</h4>
                        <p class="subtext">Selecciona uno o varios roles.</p>
                        <div class="settings-list settings-list-static">
                            <div class="checkbox-group"><input type="checkbox" name="u-role" value="administrador" ${isRoleChecked('administrador')?'checked':''}><label>Administrador</label></div>
                            <div class="checkbox-group"><input type="checkbox" name="u-role" value="secretario" ${isRoleChecked('secretario')?'checked':''}><label>Secretario</label></div>
                            <div class="checkbox-group"><input type="checkbox" name="u-role" value="profesional" ${isRoleChecked('profesional')?'checked':''}><label>Profesional</label></div>
                        </div>
                    </div>
                    <div class="settings-subsection">
                        <h4>Asignar Profesionales</h4>
                        <p class="subtext">Para rol <strong>Profesional</strong>: seleccioná el profesional que corresponde a este usuario — determina a qué agenda, odontograma y tratamientos accede. Para otros roles: acceso completo si no se selecciona ninguno.</p>
                        <div class="settings-list settings-list-static">
                            ${profs.map(p => `<div class="checkbox-group"><input type="checkbox" name="u-profs" value="${p.id}" ${editingProfs.has(p.id)?'checked':''}><label>${escapeHtml(p.name)}</label></div>`).join('')}
                        </div>
                    </div>` : `
                    <input type="hidden" name="u-role" value="${[...editingRoles][0] || ''}">
                    `}
                    <div class="form-action-row">
                        <button type="submit" class="btn btn-primary">${isEditing ? 'Actualizar Usuario' : 'Guardar Usuario'}</button>
                        ${isEditing ? '<button type="button" class="btn btn-ghost" onclick="window._cancelEditUser()">Cancelar</button>' : ''}
                    </div>
                </form>
            </section>`;
        })() : '',
        'create-professional': (() => {
            const editingProf = state.editingProfId ? profs.find(p => p.id === state.editingProfId) : null;
            const isEditing = !!editingProf;
            const nameParts = String((editingProf && editingProf.name) || '').trim().split(/\s+/).filter(Boolean);
            const firstName = isEditing ? (editingProf.firstName || nameParts.slice(0,-1).join(' ') || nameParts[0] || '') : '';
            const lastName  = isEditing ? (editingProf.lastName  || (nameParts.length>1 ? nameParts[nameParts.length-1] : '')) : '';
            const profStatus = isEditing ? (editingProf.status || (editingProf.active ? 'activo' : 'inactivo')) : 'activo';
            return `
            <section class="settings-card settings-panel-card">
                <header>
                    <div>
                        <h3>${isEditing ? 'Editar Profesional' : 'Crear Profesional'}</h3>
                        <p class="subtext">Campos obligatorios: Nombre, Apellido, Especialidad.</p>
                    </div>
                </header>
                <form id="new-prof-form" class="settings-form-row columns-1">
                    <input type="hidden" id="p-editing-id" value="${isEditing ? editingProf.id : ''}">
                    <div class="input-group"><label>Nombre *</label><input type="text" id="p-name" value="${escapeHtml(firstName)}" required></div>
                    <div class="input-group"><label>Apellido *</label><input type="text" id="p-lastname" value="${escapeHtml(lastName)}" required></div>
                    <div class="input-group"><label>Especialidad *</label><input type="text" id="p-specialty" value="${isEditing ? escapeHtml(editingProf.specialty||'') : ''}" required></div>
                    <div class="input-group"><label>Teléfono</label><input type="text" id="p-phone" value="${isEditing ? escapeHtml(editingProf.phone||'') : ''}"></div>
                    <div class="input-group"><label>Email</label><input type="email" id="p-email" value="${isEditing ? escapeHtml(editingProf.email||'') : ''}"></div>
                    <div class="input-group"><label>Estado</label><select id="p-status"><option value="activo" ${profStatus==='activo'?'selected':''}>Activo</option><option value="inactivo" ${profStatus==='inactivo'?'selected':''}>Inactivo</option></select></div>
                    <div class="form-action-row">
                        <button type="submit" class="btn btn-primary">${isEditing ? 'Actualizar Profesional' : 'Guardar Profesional'}</button>
                        ${isEditing ? '<button type="button" class="btn btn-ghost" onclick="window._cancelEditProf()">Cancelar</button>' : ''}
                    </div>
                </form>
            </section>`;
        })(),
        'users-list': canManageUsers ? `
            <section class="settings-card settings-panel-card">
                <header><h3>Usuarios Existentes</h3></header>
                <div class="settings-entity-list">
                    ${userCards || `<div class="settings-entity-empty"><i class="fa-solid fa-users"></i><span>No hay usuarios registrados</span></div>`}
                </div>
            </section>
        ` : '',
        'professionals-list': `
            <section class="settings-card settings-panel-card">
                <header><h3>Profesionales Existentes</h3></header>
                <div class="settings-entity-list">
                    ${profesionalRows || `<div class="settings-entity-empty"><i class="fa-solid fa-user-doctor"></i><span>No hay profesionales registrados</span></div>`}
                </div>
            </section>
        `
    };

    return `
    <div class="settings-area">
        <section class="settings-card settings-nav-card">
            <div class="settings-nav-header">
                <div>
                    <span class="section-eyebrow">Administración</span>
                    <h3 class="section-title section-title-sm">Configuración</h3>
                    <p class="subtext">Elegí una sección para trabajar dentro de la configuración general.</p>
                </div>
            </div>

            <div class="settings-subnav">
                ${settingsSections.map(section => `
                    <button type="button" class="settings-subnav-item ${section.id === activeSection ? 'active' : ''}" data-settings-view="${section.id}">
                        <i class="fa-solid ${section.icon}"></i>
                        <span>${section.label}</span>
                        <small>${section.description}</small>
                    </button>
                `).join('')}
            </div>
        </section>

        <div class="settings-subpage-content">
            ${settingsContent[activeSection]}
        </div>
    </div>
    `;
}

function renderSettings() {
    const users = DB.get('users');
    const profs = DB.get('professionals');
    const isSuper = state.user.roles.includes('superadmin');
    const isAdmin = state.user.roles.some(role => ['superadmin', 'admin'].includes(role));
    const isSecretary = state.user.roles.includes('secretary');
    const canManageSettings = isAdmin || isSecretary;

    if (!canManageSettings) {
        return `
            <div class="settings-card">
                <h3>Acceso denegado</h3>
                <p>No tenés permisos para acceder a la configuración.</p>
            </div>
        `;
    }

    const userRows = users.map(u => {
        const roles = (u.roles || (u.role ? [u.role] : [])).map(r => `
            <span class="badge ${r === 'superadmin' ? 'badge-primary' : (r === 'admin' ? 'badge-info' : (r === 'secretary' ? 'badge-warning' : 'badge-gray'))}">${r}</span>
        `).join(' ');

        const profNames = u.allowedProfessionals && u.allowedProfessionals.length > 0
            ? u.allowedProfessionals.map(id => `<span class="badge badge-gray">${getProfName(id)}</span>`).join(' ')
            : `<span class="badge badge-gray">No asignado</span>`;

        return `
            <tr class="hover-row">
                <td class="table-name"><strong>${escapeHtml(u.name || 'Sin nombre')}</strong><br><span class="subtle">${escapeHtml(u.email || '-')}</span></td>
                <td>${u.type || '-'}</td>
                <td>${roles}</td>
                <td>${profNames}</td>
                <td class="text-center">
                    ${(isSuper || u.id === state.user?.id) ? `<button class="btn btn-icon btn-edit-user" data-id="${u.id}" title="Editar usuario"><i class="fa-solid fa-pen"></i></button>` : ''}
                    ${isSuper && !u.isPlatformAdmin ? `<button class="btn btn-icon" onclick="deleteUser(${u.id})" title="Eliminar usuario" style="color:var(--danger)"><i class="fa-solid fa-trash"></i></button>` : ''}
                </td>
            </tr>`;
    }).join('');

    const profesionalRows = profs.map(p => {
        const statusLabel = p.status === 'activo'
            ? `<span class="badge badge-success">Activo</span>`
            : `<span class="badge badge-gray">Inactivo</span>`;
        return `
            <tr class="hover-row">
                <td class="table-name">${escapeHtml(p.name)}</td>
                <td>${escapeHtml(p.lastName || '-')}</td>
                <td>${escapeHtml(p.specialty || '-')}</td>
                <td>${escapeHtml(p.phone || '-')}</td>
                <td>${escapeHtml(p.email || '-')}</td>
                <td>${statusLabel}</td>
                <td class="text-center">${canViewAppointmentsUi() ? `<button class="btn btn-icon" onclick="viewProfessionalCalendar(${p.id})" title="Ver calendario"><i class="fa-solid fa-calendar-days"></i></button>` : ''}${canManageProfessionalSchedulesUi() ? `<button class="btn btn-icon btn-edit-schedule" data-id="${p.id}" title="Configurar horarios"><i class="fa-solid fa-clock"></i></button>` : ''}</td>
            </tr>`;
    }).join('');

    return `
    <div class="settings-area">
        <div class="settings-top-grid">
            <section class="settings-card">
                <header>
                    <div>
                        <h3>Crear Nuevo Usuario</h3>
                        <p class="subtext">Campos obligatorios: Nombre completo, Email y Contraseña. El tipo se define por los roles.</p>
                    </div>
                </header>
                <form id="new-user-form" class="settings-form-row columns-1">
                    <div class="input-group"><label>Nombre completo *</label><input type="text" id="u-name" required></div>
                    <div class="input-group"><label>Email *</label><input type="email" id="u-email" required></div>
                    <div class="input-group"><label>Contraseña *</label><div class="pwd-wrap"><input type="password" id="u-password" minlength="8" placeholder="Mínimo 8 caracteres" required style="padding-right:40px;"><button type="button" class="login-pwd-toggle" tabindex="-1" onclick="const i=document.getElementById('u-password');i.type=i.type==='password'?'text':'password';this.querySelector('i').className='fa-solid '+(i.type==='password'?'fa-eye':'fa-eye-slash')"><i class="fa-solid fa-eye"></i></button></div></div>

                    <div class="settings-subsection">
                        <h4>Roles de Permisos</h4>
                        <p class="subtext">Selecciona uno o varios roles.</p>
                        <div class="checkbox-group"><input type="checkbox" name="u-role" value="administrador"><label>Administrador</label></div>
                        <div class="checkbox-group"><input type="checkbox" name="u-role" value="secretario"><label>Secretario</label></div>
                        <div class="checkbox-group"><input type="checkbox" name="u-role" value="profesional"><label>Profesional</label></div>
                    </div>

                    <div class="settings-subsection">
                        <h4>Asignar Profesionales (opcional)</h4>
                        <p class="subtext">Se puede dejar vacío; acceso completo si no se selecciona ninguno.</p>
                        <div class="settings-list settings-list-static">
                            ${profs.map(p => `<div class="checkbox-group"><input type="checkbox" name="u-profs" value="${p.id}"><label>${escapeHtml(p.name)}</label></div>`).join('')}
                        </div>
                    </div>
                    <button type="submit" class="btn btn-primary">Guardar Usuario</button>
                </form>
            </section>

            <section class="settings-card">
                <header>
                    <div>
                        <h3>Crear Profesional</h3>
                        <p class="subtext">Campos obligatorios: Nombre, Apellido, Especialidad.</p>
                    </div>
                </header>
                <form id="new-prof-form" class="settings-form-row columns-1">
                    <div class="input-group"><label>Nombre *</label><input type="text" id="p-name" required></div>
                    <div class="input-group"><label>Apellido *</label><input type="text" id="p-lastname" required></div>
                    <div class="input-group"><label>Especialidad *</label><input type="text" id="p-specialty" required></div>
                    <div class="input-group"><label>Teléfono</label><input type="text" id="p-phone"></div>
                    <div class="input-group"><label>Email</label><input type="email" id="p-email"></div>
                    <div class="input-group"><label>Estado</label><select id="p-status"><option value="activo">Activo</option><option value="inactivo">Inactivo</option></select></div>
                    <button type="submit" class="btn btn-primary">Guardar Profesional</button>
                </form>
            </section>
        </div>

        <div class="settings-tables-grid">
            <section class="settings-card">
                <header><h3>Usuarios Existentes</h3></header>
                <div class="table-container overflow-x-auto">
                    <table class="table-modern table-compact">
                        <thead>
                            <tr>
                                <th>Nombre / Email</th>
                                <th>Tipo</th>
                                <th>Roles</th>
                                <th>Profesionales</th>
                                <th>Acción</th>
                            </tr>
                        </thead>
                        <tbody>${userRows || `<tr><td colspan="5" class="text-gray-500">No hay usuarios registrados</td></tr>`}</tbody>
                    </table>
                </div>
            </section>
            <section class="settings-card">
                <header><h3>Profesionales Existentes</h3></header>
                <div class="table-container overflow-x-auto">
                    <table class="table-modern table-compact">
                        <thead>
                            <tr>
                                <th>Nombre</th>
                                <th>Apellido</th>
                                <th>Especialidad</th>
                                <th>Teléfono</th>
                                <th>Email</th>
                                <th>Estado</th>
                                <th>Acción</th>
                            </tr>
                        </thead>
                        <tbody>${profesionalRows || `<tr><td colspan="7" class="text-gray-500">No hay profesionales registrados</td></tr>`}</tbody>
                    </table>
                </div>
            </section>
        </div>
    </div>
    `;
}

