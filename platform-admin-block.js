// ══════════════════════════════════════════════════════════════════════════════
// ULTRA-ADMIN (PLATFORM) VIEWS
// ══════════════════════════════════════════════════════════════════════════════

// Inyecta los estilos propios del ultra-admin (dark theme, completamente distinto al SPA clínico)
function injectPlatformStyles() {
    if (document.getElementById('platform-admin-styles')) return;
    const style = document.createElement('style');
    style.id = 'platform-admin-styles';
    style.textContent = `
        /* ── Layout ultra-admin ── */
        .pa-root { display:flex; flex-direction:column; min-height:100%; background:#0f1117; color:#e2e8f0; font-family:'Inter',system-ui,sans-serif; }
        .pa-topbar { display:flex; align-items:center; justify-content:space-between; padding:0 24px; height:52px; background:#161b27; border-bottom:1px solid #1e2535; flex-shrink:0; }
        .pa-topbar-brand { display:flex; align-items:center; gap:10px; font-size:13px; font-weight:700; letter-spacing:.12em; text-transform:uppercase; color:#94a3b8; }
        .pa-topbar-brand .pa-diamond { width:22px; height:22px; background:linear-gradient(135deg,#6366f1,#8b5cf6); border-radius:5px; display:flex; align-items:center; justify-content:center; font-size:10px; color:#fff; font-weight:900; }
        .pa-topbar-right { display:flex; align-items:center; gap:16px; font-size:12px; color:#64748b; }
        .pa-topbar-right span { color:#94a3b8; }
        .pa-topbar-logout { background:none; border:1px solid #1e2535; border-radius:6px; padding:5px 12px; font-size:11px; color:#64748b; cursor:pointer; transition:all .15s; }
        .pa-topbar-logout:hover { border-color:#334155; color:#94a3b8; }

        /* ── Body split ── */
        .pa-body { display:flex; flex:1; min-height:0; }
        .pa-sidebar { width:200px; flex-shrink:0; background:#0d1119; border-right:1px solid #1e2535; padding:20px 0; display:flex; flex-direction:column; gap:2px; }
        .pa-nav-item { display:flex; align-items:center; gap:10px; padding:9px 20px; font-size:12px; color:#475569; cursor:pointer; border-left:2px solid transparent; transition:all .12s; letter-spacing:.02em; }
        .pa-nav-item:hover { color:#94a3b8; background:#161b27; }
        .pa-nav-item.active { color:#a5b4fc; border-left-color:#6366f1; background:#1a1f2e; }
        .pa-nav-item i { width:14px; text-align:center; font-size:11px; }
        .pa-nav-section { font-size:9px; font-weight:700; letter-spacing:.12em; text-transform:uppercase; color:#1e2535; padding:16px 20px 6px; }

        /* ── Main content ── */
        .pa-main { flex:1; overflow-y:auto; padding:28px 32px; }
        .pa-page-header { margin-bottom:24px; border-bottom:1px solid #1e2535; padding-bottom:20px; display:flex; align-items:flex-start; justify-content:space-between; gap:16px; }
        .pa-page-title { font-size:16px; font-weight:700; color:#f1f5f9; letter-spacing:-.01em; }
        .pa-page-sub { font-size:12px; color:#475569; margin-top:3px; font-family:'JetBrains Mono','Fira Mono',monospace; }

        /* ── Botones ── */
        .pa-btn { display:inline-flex; align-items:center; gap:7px; padding:8px 16px; border-radius:7px; font-size:12px; font-weight:600; cursor:pointer; border:none; transition:all .15s; letter-spacing:.01em; }
        .pa-btn-primary { background:#6366f1; color:#fff; }
        .pa-btn-primary:hover { background:#4f46e5; }
        .pa-btn-ghost { background:transparent; border:1px solid #1e2535; color:#64748b; }
        .pa-btn-ghost:hover { border-color:#334155; color:#94a3b8; }
        .pa-btn-danger { background:#7f1d1d; color:#fca5a5; }
        .pa-btn-danger:hover { background:#991b1b; }
        .pa-btn-sm { padding:5px 10px; font-size:11px; }
        .pa-btn-icon { padding:6px 9px; }

        /* ── Tabla de clínicas ── */
        .pa-table-wrap { background:#0d1119; border:1px solid #1e2535; border-radius:10px; overflow:hidden; }
        .pa-table { width:100%; border-collapse:collapse; font-size:12px; }
        .pa-table thead tr { background:#111520; border-bottom:1px solid #1e2535; }
        .pa-table thead th { padding:10px 16px; text-align:left; font-size:10px; font-weight:700; letter-spacing:.1em; text-transform:uppercase; color:#334155; }
        .pa-table tbody tr { border-bottom:1px solid #111520; transition:background .1s; }
        .pa-table tbody tr:last-child { border-bottom:none; }
        .pa-table tbody tr:hover { background:#111824; }
        .pa-table td { padding:14px 16px; vertical-align:middle; }
        .pa-table .td-name { font-weight:600; color:#e2e8f0; }
        .pa-table .td-url { font-family:'JetBrains Mono','Fira Mono',monospace; font-size:11px; color:#6366f1; }
        .pa-table .td-meta { font-size:11px; color:#475569; }
        .pa-table .td-actions { display:flex; gap:6px; justify-content:flex-end; }

        /* ── Badges ── */
        .pa-badge { display:inline-flex; align-items:center; gap:5px; padding:3px 8px; border-radius:20px; font-size:10px; font-weight:700; letter-spacing:.04em; text-transform:uppercase; }
        .pa-badge-active { background:#052e16; color:#4ade80; border:1px solid #14532d; }
        .pa-badge-inactive { background:#1c1917; color:#78716c; border:1px solid #292524; }
        .pa-badge-shared { background:#0c1a2e; color:#60a5fa; border:1px solid #1e3a5f; }
        .pa-badge-dedicated { background:#1a0a2e; color:#c084fc; border:1px solid #3b1a5f; }
        .pa-badge-plan { background:#1c1011; color:#f87171; border:1px solid #3d1515; }
        .pa-dot { width:6px; height:6px; border-radius:50%; display:inline-block; }
        .pa-dot-green { background:#22c55e; box-shadow:0 0 6px #22c55e66; }
        .pa-dot-gray { background:#44403c; }

        /* ── Stats cards ── */
        .pa-stats-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(160px,1fr)); gap:12px; margin-bottom:24px; }
        .pa-stat-card { background:#0d1119; border:1px solid #1e2535; border-radius:10px; padding:18px 20px; }
        .pa-stat-label { font-size:10px; font-weight:700; letter-spacing:.1em; text-transform:uppercase; color:#334155; margin-bottom:8px; }
        .pa-stat-value { font-size:28px; font-weight:800; color:#f1f5f9; letter-spacing:-.02em; }
        .pa-stat-sub { font-size:11px; color:#475569; margin-top:3px; }

        /* ── Modal ultra-admin ── */
        .pa-modal-overlay { position:fixed; inset:0; background:rgba(0,0,0,.75); backdrop-filter:blur(4px); z-index:9999; display:flex; align-items:center; justify-content:center; padding:20px; }
        .pa-modal-overlay.hidden { display:none; }
        .pa-modal { background:#111520; border:1px solid #1e2535; border-radius:12px; width:100%; max-width:520px; overflow:hidden; }
        .pa-modal-header { display:flex; align-items:center; justify-content:space-between; padding:18px 22px; border-bottom:1px solid #1e2535; }
        .pa-modal-title { font-size:14px; font-weight:700; color:#f1f5f9; }
        .pa-modal-close { background:none; border:none; color:#475569; cursor:pointer; padding:4px; font-size:14px; border-radius:4px; }
        .pa-modal-close:hover { color:#94a3b8; background:#1e2535; }
        .pa-modal-body { padding:22px; }
        .pa-modal-footer { display:flex; justify-content:flex-end; gap:8px; padding:16px 22px; border-top:1px solid #1e2535; background:#0d1119; }

        /* ── Form ultra-admin ── */
        .pa-form-group { margin-bottom:16px; }
        .pa-form-row { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
        .pa-label { display:block; font-size:11px; font-weight:600; color:#475569; margin-bottom:5px; letter-spacing:.04em; text-transform:uppercase; }
        .pa-label .req { color:#6366f1; margin-left:2px; }
        .pa-input { width:100%; background:#0d1119; border:1px solid #1e2535; border-radius:7px; padding:9px 12px; font-size:12px; color:#e2e8f0; outline:none; transition:border .15s; box-sizing:border-box; }
        .pa-input:focus { border-color:#4f46e5; box-shadow:0 0 0 3px rgba(99,102,241,.15); }
        .pa-input::placeholder { color:#334155; }
        .pa-input.mono { font-family:'JetBrains Mono','Fira Mono',monospace; font-size:11px; }
        .pa-select { width:100%; background:#0d1119; border:1px solid #1e2535; border-radius:7px; padding:9px 12px; font-size:12px; color:#e2e8f0; outline:none; cursor:pointer; box-sizing:border-box; }
        .pa-select:focus { border-color:#4f46e5; }
        .pa-hint { font-size:10px; color:#334155; margin-top:4px; line-height:1.5; }
        .pa-db-section { background:#0a0d14; border:1px solid #1a2030; border-radius:8px; padding:14px; margin-top:4px; }
        .pa-db-section-title { font-size:10px; font-weight:700; letter-spacing:.08em; text-transform:uppercase; color:#475569; margin-bottom:10px; }

        /* ── Empty state ── */
        .pa-empty { text-align:center; padding:60px 20px; color:#334155; }
        .pa-empty i { font-size:36px; margin-bottom:12px; display:block; }
        .pa-empty p { font-size:13px; }

        /* ── Users list ── */
        .pa-users-list { max-height:320px; overflow-y:auto; }
        .pa-user-row { display:flex; align-items:center; justify-content:space-between; padding:10px 14px; border-bottom:1px solid #1e2535; }
        .pa-user-row:last-child { border-bottom:none; }
        .pa-user-name { font-size:12px; font-weight:600; color:#e2e8f0; }
        .pa-user-email { font-size:11px; color:#475569; font-family:monospace; }

        /* ── URL preview ── */
        .pa-url-preview { display:flex; align-items:center; gap:8px; background:#060910; border:1px solid #1e2535; border-radius:6px; padding:8px 12px; margin-top:6px; font-family:'JetBrains Mono','Fira Mono',monospace; font-size:12px; color:#6366f1; }
        .pa-url-preview i { color:#334155; font-size:10px; }
    `;
    document.head.appendChild(style);
}

// Aplica el fondo oscuro al app container mientras el platform admin está activo
function applyPlatformTheme(on) {
    const appEl = document.getElementById('app');
    if (!appEl) return;
    if (on) {
        appEl.style.background = '#0f1117';
        // Ocultar sidebar y topbar del SPA clínico
        const sidebar = document.getElementById('sidebar');
        const topbar  = document.querySelector('.topbar') || document.querySelector('header');
        if (sidebar) sidebar.style.display = 'none';
        if (topbar)  topbar.style.display  = 'none';
    } else {
        appEl.style.background = '';
        const sidebar = document.getElementById('sidebar');
        const topbar  = document.querySelector('.topbar') || document.querySelector('header');
        if (sidebar) sidebar.style.display = '';
        if (topbar)  topbar.style.display  = '';
    }
}

async function renderPlatformClinics(container) {
    injectPlatformStyles();

    // Carga de datos
    let clinics = [];
    try {
        const res = await apiFetch('/platform/clinics');
        if (!res.ok) throw new Error(res.error || 'Error');
        clinics = res.clinics || [];
        state._platformClinics = clinics;
    } catch(e) {
        container.innerHTML = `<div class="pa-empty"><i class="fa-solid fa-triangle-exclamation"></i><p>${e.message}</p></div>`;
        return;
    }

    const rows = clinics.length === 0
        ? `<tr><td colspan="7"><div class="pa-empty"><i class="fa-solid fa-hospital"></i><p>No hay clínicas registradas.</p></div></td></tr>`
        : clinics.map(c => {
            const url = `${c.slug}.odentara.com`;
            const dbBadge = c.dbType === 'dedicated'
                ? `<span class="pa-badge pa-badge-dedicated"><i class="fa-solid fa-database" style="font-size:8px"></i>Dedicada</span>`
                : `<span class="pa-badge pa-badge-shared"><i class="fa-solid fa-share-nodes" style="font-size:8px"></i>Compartida</span>`;
            const planBadge = c.plan
                ? `<span class="pa-badge pa-badge-plan">${c.plan.toUpperCase()}</span>` : '';
            return `
            <tr>
                <td class="td-name">
                    <div style="display:flex;align-items:center;gap:8px">
                        <span class="pa-dot ${c.active ? 'pa-dot-green' : 'pa-dot-gray'}"></span>
                        <div>
                            <div class="pa-table td-name" style="font-size:13px">${c.name}</div>
                            <div class="pa-table td-url">${url}</div>
                        </div>
                    </div>
                </td>
                <td><span class="pa-badge ${c.active ? 'pa-badge-active' : 'pa-badge-inactive'}">${c.active ? 'Activa' : 'Inactiva'}</span></td>
                <td>${dbBadge}${planBadge ? ' ' + planBadge : ''}</td>
                <td class="pa-table td-meta">
                    <span title="Usuarios"><i class="fa-solid fa-users" style="width:12px"></i> ${c.stats.users}</span> &nbsp;
                    <span title="Profesionales"><i class="fa-solid fa-user-doctor" style="width:12px"></i> ${c.stats.professionals}</span> &nbsp;
                    <span title="Pacientes"><i class="fa-solid fa-person" style="width:12px"></i> ${c.stats.patients}</span>
                </td>
                <td class="pa-table td-meta">${new Date(c.createdAt).toLocaleDateString('es-AR')}</td>
                <td>
                    <div class="pa-table td-actions">
                        <button class="pa-btn pa-btn-ghost pa-btn-sm pa-btn-icon" title="Ver usuarios" onclick="window.platformViewUsers(${c.id},'${c.name.replace(/'/g,"\\'")}')"><i class="fa-solid fa-users"></i></button>
                        <button class="pa-btn pa-btn-ghost pa-btn-sm pa-btn-icon" title="Crear admin" onclick="window.platformOpenAdminModal(${c.id})"><i class="fa-solid fa-user-plus"></i></button>
                        <button class="pa-btn pa-btn-ghost pa-btn-sm pa-btn-icon" title="Editar" onclick="window.platformEditClinic(${c.id})"><i class="fa-solid fa-pen"></i></button>
                        <button class="pa-btn ${c.active ? 'pa-btn-danger' : 'pa-btn-ghost'} pa-btn-sm pa-btn-icon" title="${c.active ? 'Desactivar' : 'Activar'}" onclick="window.platformToggleClinic(${c.id})">
                            <i class="fa-solid ${c.active ? 'fa-ban' : 'fa-circle-check'}"></i>
                        </button>
                    </div>
                </td>
            </tr>`;
        }).join('');

    container.innerHTML = `
    <div class="pa-root">
        ${renderPlatformShell('platform-clinics', `
            <div class="pa-page-header">
                <div>
                    <div class="pa-page-title">Clínicas</div>
                    <div class="pa-page-sub">${clinics.length} instancia${clinics.length !== 1 ? 's' : ''} registrada${clinics.length !== 1 ? 's' : ''}</div>
                </div>
                <button class="pa-btn pa-btn-primary" onclick="window.platformOpenNewClinicModal()">
                    <i class="fa-solid fa-plus"></i> Nueva clínica
                </button>
            </div>

            <div class="pa-table-wrap">
                <table class="pa-table">
                    <thead>
                        <tr>
                            <th>Clínica / URL</th>
                            <th>Estado</th>
                            <th>Base de datos</th>
                            <th>Recursos</th>
                            <th>Creada</th>
                            <th style="text-align:right">Acciones</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        `)}
    </div>

    ${renderPlatformClinicModal()}
    ${renderPlatformAdminModal()}
    `;
}

async function renderPlatformStats(container) {
    injectPlatformStyles();
    let s = {};
    try {
        const res = await apiFetch('/platform/stats');
        if (!res.ok) throw new Error(res.error);
        s = res.stats;
    } catch(e) {
        container.innerHTML = `<div class="pa-empty"><i class="fa-solid fa-triangle-exclamation"></i><p>${e.message}</p></div>`;
        return;
    }

    container.innerHTML = `
    <div class="pa-root">
        ${renderPlatformShell('platform-stats', `
            <div class="pa-page-header">
                <div>
                    <div class="pa-page-title">Estadísticas</div>
                    <div class="pa-page-sub">Resumen global de la plataforma</div>
                </div>
            </div>

            <div class="pa-stats-grid">
                ${[
                    { label:'Clínicas totales',    value: s.totalClinics,           sub:'instancias',         icon:'fa-hospital',       color:'#6366f1' },
                    { label:'Clínicas activas',    value: s.activeClinics,          sub:'en línea',           icon:'fa-circle-check',   color:'#22c55e' },
                    { label:'Usuarios',            value: s.totalUsers,             sub:'en toda la plataforma', icon:'fa-users',       color:'#60a5fa' },
                    { label:'Pacientes',           value: s.totalPatients,          sub:'registrados',        icon:'fa-person',         color:'#c084fc' },
                    { label:'Profesionales',       value: s.totalProfessionals,     sub:'activos',            icon:'fa-user-doctor',    color:'#fb923c' },
                    { label:'Turnos este mes',     value: s.appointmentsThisMonth,  sub:'en el mes actual',   icon:'fa-calendar-check', color:'#2dd4bf' },
                ].map(m => `
                    <div class="pa-stat-card">
                        <div class="pa-stat-label"><i class="fa-solid ${m.icon}" style="color:${m.color};margin-right:6px"></i>${m.label}</div>
                        <div class="pa-stat-value">${(m.value||0).toLocaleString('es-AR')}</div>
                        <div class="pa-stat-sub">${m.sub}</div>
                    </div>
                `).join('')}
            </div>
        `)}
    </div>`;
}

// Shell HTML compartido (topbar + sidebar + main) del ultra-admin
function renderPlatformShell(activeView, mainHtml) {
    const NAV = [
        { id:'platform-clinics', icon:'fa-hospital',  label:'Clínicas'      },
        { id:'platform-stats',   icon:'fa-chart-bar', label:'Estadísticas'  },
    ];
    const navHtml = NAV.map(n => `
        <div class="pa-nav-item ${n.id === activeView ? 'active' : ''}" onclick="loadView('${n.id}','${n.label}',{skipSync:true})">
            <i class="fa-solid ${n.icon}"></i> ${n.label}
        </div>
    `).join('');

    const user = state.user || {};
    return `
        <div class="pa-topbar">
            <div class="pa-topbar-brand">
                <div class="pa-diamond">◆</div>
                ODENTARA PLATFORM
            </div>
            <div class="pa-topbar-right">
                <span>${user.email || user.name || 'Platform Admin'}</span>
                <button class="pa-topbar-logout" onclick="window.logout()"><i class="fa-solid fa-right-from-bracket" style="font-size:10px;margin-right:4px"></i>Salir</button>
            </div>
        </div>
        <div class="pa-body">
            <div class="pa-sidebar">
                <div class="pa-nav-section">Gestión</div>
                ${navHtml}
            </div>
            <div class="pa-main">${mainHtml}</div>
        </div>
    `;
}

function renderPlatformClinicModal() {
    return `
    <div id="platform-clinic-modal" class="pa-modal-overlay hidden">
        <div class="pa-modal">
            <div class="pa-modal-header">
                <span class="pa-modal-title" id="platform-clinic-modal-title">Nueva clínica</span>
                <button class="pa-modal-close" onclick="window.platformCloseClinicModal()"><i class="fa-solid fa-xmark"></i></button>
            </div>
            <div class="pa-modal-body">
                <form id="platform-clinic-form" onsubmit="window.platformSaveClinic(event)">
                    <input type="hidden" id="platform-clinic-id">

                    <div class="pa-form-row">
                        <div class="pa-form-group" style="grid-column:1/-1">
                            <label class="pa-label">Nombre de la clínica <span class="req">*</span></label>
                            <input id="pcf-name" class="pa-input" placeholder="Clínica San Martín" required>
                        </div>
                        <div class="pa-form-group" style="grid-column:1/-1">
                            <label class="pa-label">Slug / Subdominio <span class="req">*</span></label>
                            <input id="pcf-slug" class="pa-input mono" placeholder="clinicasanmartin" required>
                            <div class="pa-url-preview"><i class="fa-solid fa-globe"></i><span id="pcf-url-preview">______.odentara.com</span></div>
                            <div class="pa-hint">Solo minúsculas y guiones. No se puede cambiar después de creado.</div>
                        </div>
                    </div>

                    <div class="pa-form-row">
                        <div class="pa-form-group">
                            <label class="pa-label">Teléfono</label>
                            <input id="pcf-phone" class="pa-input" placeholder="+54 261 ...">
                        </div>
                        <div class="pa-form-group">
                            <label class="pa-label">Email</label>
                            <input id="pcf-email" class="pa-input" type="email" placeholder="info@clinica.com">
                        </div>
                        <div class="pa-form-group" style="grid-column:1/-1">
                            <label class="pa-label">Dirección</label>
                            <input id="pcf-address" class="pa-input" placeholder="Av. San Martín 1234, Mendoza">
                        </div>
                        <div class="pa-form-group">
                            <label class="pa-label">Plan</label>
                            <select id="pcf-plan" class="pa-select">
                                <option value="">Sin plan</option>
                                <option value="starter">Starter</option>
                                <option value="pro">Pro</option>
                                <option value="enterprise">Enterprise</option>
                            </select>
                        </div>
                        <div class="pa-form-group">
                            <label class="pa-label">Notas internas</label>
                            <input id="pcf-notes" class="pa-input" placeholder="Opcional">
                        </div>
                    </div>

                    <!-- Base de datos -->
                    <div class="pa-form-group">
                        <label class="pa-label">Base de datos</label>
                        <select id="pcf-dbtype" class="pa-select" onchange="window.platformToggleDbUrl()">
                            <option value="shared">Compartida — misma instancia de Odentara</option>
                            <option value="dedicated">Dedicada — URL de conexión personalizada</option>
                        </select>
                        <div class="pa-hint">
                            <b>Compartida:</b> más simple, los datos se aislan por clínica dentro de la misma base. <br>
                            <b>Dedicada:</b> base de datos propia, máximo aislamiento, ideal para clínicas grandes.
                        </div>
                    </div>
                    <div id="pcf-db-url-section" class="pa-db-section" style="display:none">
                        <div class="pa-db-section-title"><i class="fa-solid fa-database" style="margin-right:6px"></i>Conexión dedicada</div>
                        <div class="pa-form-group" style="margin-bottom:0">
                            <label class="pa-label">DATABASE_URL <span class="req">*</span></label>
                            <input id="pcf-dburl" class="pa-input mono" placeholder="mysql://user:pass@host:3306/dbname">
                            <div class="pa-hint">La clínica usará esta conexión de forma exclusiva. Asegurate de que la base exista y esté accesible desde el servidor.</div>
                        </div>
                    </div>
                </form>
            </div>
            <div class="pa-modal-footer">
                <button class="pa-btn pa-btn-ghost" onclick="window.platformCloseClinicModal()">Cancelar</button>
                <button class="pa-btn pa-btn-primary" onclick="document.getElementById('platform-clinic-form').requestSubmit()">
                    <i class="fa-solid fa-check"></i> Crear clínica
                </button>
            </div>
        </div>
    </div>`;
}

function renderPlatformAdminModal() {
    return `
    <div id="platform-admin-modal" class="pa-modal-overlay hidden">
        <div class="pa-modal" style="max-width:420px">
            <div class="pa-modal-header">
                <span class="pa-modal-title">Crear administrador</span>
                <button class="pa-modal-close" onclick="window.platformCloseAdminModal()"><i class="fa-solid fa-xmark"></i></button>
            </div>
            <div class="pa-modal-body">
                <div style="background:#0a1525;border:1px solid #1e3a5f;border-radius:6px;padding:10px 12px;margin-bottom:16px;font-size:11px;color:#60a5fa;">
                    <i class="fa-solid fa-info-circle" style="margin-right:6px"></i>
                    El administrador recibirá acceso completo a la clínica como superadmin.
                </div>
                <form id="platform-admin-form" onsubmit="window.platformSaveAdmin(event)">
                    <input type="hidden" id="paf-clinic-id">
                    <div class="pa-form-group">
                        <label class="pa-label">Nombre completo <span class="req">*</span></label>
                        <input id="paf-name" class="pa-input" placeholder="Dr. Juan Pérez" required>
                    </div>
                    <div class="pa-form-group">
                        <label class="pa-label">Email <span class="req">*</span></label>
                        <input id="paf-email" class="pa-input" type="email" placeholder="admin@clinica.com" required>
                    </div>
                    <div class="pa-form-group">
                        <label class="pa-label">Contraseña inicial <span class="req">*</span></label>
                        <input id="paf-pass" class="pa-input mono" value="odentara123" required>
                        <div class="pa-hint">El usuario deberá cambiarla en su primer ingreso.</div>
                    </div>
                </form>
            </div>
            <div class="pa-modal-footer">
                <button class="pa-btn pa-btn-ghost" onclick="window.platformCloseAdminModal()">Cancelar</button>
                <button class="pa-btn pa-btn-primary" onclick="document.getElementById('platform-admin-form').requestSubmit()">
                    <i class="fa-solid fa-user-plus"></i> Crear admin
                </button>
            </div>
        </div>
    </div>`;
}

// ── Handlers ─────────────────────────────────────────────────────────────────

window.platformToggleDbUrl = function() {
    const type = document.getElementById('pcf-dbtype')?.value;
    const section = document.getElementById('pcf-db-url-section');
    if (section) section.style.display = type === 'dedicated' ? 'block' : 'none';
};

window.platformOpenNewClinicModal = function() {
    document.getElementById('platform-clinic-id').value = '';
    document.getElementById('platform-clinic-modal-title').textContent = 'Nueva clínica';
    document.getElementById('pcf-name').value    = '';
    document.getElementById('pcf-slug').value    = '';
    document.getElementById('pcf-phone').value   = '';
    document.getElementById('pcf-email').value   = '';
    document.getElementById('pcf-address').value = '';
    document.getElementById('pcf-plan').value    = '';
    document.getElementById('pcf-notes').value   = '';
    document.getElementById('pcf-dbtype').value  = 'shared';
    document.getElementById('pcf-dburl') && (document.getElementById('pcf-dburl').value = '');
    document.getElementById('pcf-slug').disabled = false;
    document.getElementById('pcf-db-url-section').style.display = 'none';
    document.getElementById('pcf-url-preview').textContent = '______.odentara.com';
    document.getElementById('platform-clinic-modal').classList.remove('hidden');
};

window.platformEditClinic = function(id) {
    const c = (state._platformClinics || []).find(x => x.id === id);
    if (!c) return;
    document.getElementById('platform-clinic-id').value = id;
    document.getElementById('platform-clinic-modal-title').textContent = 'Editar clínica';
    document.getElementById('pcf-name').value    = c.name    || '';
    document.getElementById('pcf-slug').value    = c.slug    || '';
    document.getElementById('pcf-phone').value   = c.phone   || '';
    document.getElementById('pcf-email').value   = c.email   || '';
    document.getElementById('pcf-address').value = c.address || '';
    document.getElementById('pcf-plan').value    = c.plan    || '';
    document.getElementById('pcf-notes').value   = c.notes   || '';
    document.getElementById('pcf-dbtype').value  = c.dbType  || 'shared';
    document.getElementById('pcf-dburl') && (document.getElementById('pcf-dburl').value = c.databaseUrl || '');
    document.getElementById('pcf-slug').disabled = true;
    document.getElementById('pcf-db-url-section').style.display = c.dbType === 'dedicated' ? 'block' : 'none';
    document.getElementById('pcf-url-preview').textContent = `${c.slug}.odentara.com`;
    document.getElementById('platform-clinic-modal').classList.remove('hidden');
};

window.platformCloseClinicModal = function() {
    document.getElementById('platform-clinic-modal').classList.add('hidden');
};

window.platformSaveClinic = async function(e) {
    e.preventDefault();
    const id      = document.getElementById('platform-clinic-id').value;
    const dbType  = document.getElementById('pcf-dbtype').value;
    const dbUrl   = document.getElementById('pcf-dburl')?.value?.trim() || null;

    if (dbType === 'dedicated' && !dbUrl) {
        showPlatformAlert('Ingresá la DATABASE_URL para la base de datos dedicada.', 'error'); return;
    }

    const body = {
        name:        document.getElementById('pcf-name').value.trim(),
        slug:        document.getElementById('pcf-slug').value.trim(),
        phone:       document.getElementById('pcf-phone').value.trim()   || null,
        email:       document.getElementById('pcf-email').value.trim()   || null,
        address:     document.getElementById('pcf-address').value.trim() || null,
        plan:        document.getElementById('pcf-plan').value           || null,
        notes:       document.getElementById('pcf-notes').value.trim()   || null,
        dbType,
        databaseUrl: dbType === 'dedicated' ? dbUrl : null,
    };

    try {
        const res = id
            ? await apiFetch(`/platform/clinics/${id}`, { method:'PUT',  body:JSON.stringify(body) })
            : await apiFetch('/platform/clinics',        { method:'POST', body:JSON.stringify(body) });
        if (!res.ok) throw new Error(res.error || 'Error al guardar');
        window.platformCloseClinicModal();
        await loadView('platform-clinics', 'Clínicas', { skipSync:true });
    } catch(err) {
        showPlatformAlert(err.message, 'error');
    }
};

window.platformToggleClinic = async function(id) {
    try {
        const res = await apiFetch(`/platform/clinics/${id}/toggle`, { method:'PATCH' });
        if (!res.ok) throw new Error(res.error || 'Error');
        await loadView('platform-clinics', 'Clínicas', { skipSync:true });
    } catch(err) {
        showPlatformAlert(err.message, 'error');
    }
};

window.platformOpenAdminModal = function(clinicId) {
    document.getElementById('paf-clinic-id').value = clinicId;
    document.getElementById('paf-name').value  = '';
    document.getElementById('paf-email').value = '';
    document.getElementById('paf-pass').value  = 'odentara123';
    document.getElementById('platform-admin-modal').classList.remove('hidden');
};

window.platformCloseAdminModal = function() {
    document.getElementById('platform-admin-modal').classList.add('hidden');
};

window.platformSaveAdmin = async function(e) {
    e.preventDefault();
    const clinicId = document.getElementById('paf-clinic-id').value;
    const body = {
        fullName: document.getElementById('paf-name').value.trim(),
        email:    document.getElementById('paf-email').value.trim(),
        password: document.getElementById('paf-pass').value,
    };
    try {
        const res = await apiFetch(`/platform/clinics/${clinicId}/admin`, { method:'POST', body:JSON.stringify(body) });
        if (!res.ok) throw new Error(res.error || 'Error');
        window.platformCloseAdminModal();
        showPlatformAlert(`Admin ${res.user.email} creado correctamente.`, 'success');
    } catch(err) {
        showPlatformAlert(err.message, 'error');
    }
};

window.platformViewUsers = async function(clinicId, clinicName) {
    try {
        const res = await apiFetch(`/platform/clinics/${clinicId}/users`);
        if (!res.ok) throw new Error(res.error);
        const users = res.users || [];

        // Crear modal inline
        const existing = document.getElementById('platform-users-modal');
        if (existing) existing.remove();
        const modal = document.createElement('div');
        modal.id = 'platform-users-modal';
        modal.className = 'pa-modal-overlay';
        modal.innerHTML = `
            <div class="pa-modal" style="max-width:560px">
                <div class="pa-modal-header">
                    <span class="pa-modal-title">${clinicName} — ${users.length} usuario${users.length !== 1 ? 's' : ''}</span>
                    <button class="pa-modal-close" onclick="document.getElementById('platform-users-modal').remove()"><i class="fa-solid fa-xmark"></i></button>
                </div>
                <div class="pa-users-list">
                    ${users.length === 0
                        ? '<div class="pa-empty" style="padding:30px"><i class="fa-solid fa-user-slash"></i><p>Sin usuarios</p></div>'
                        : users.map(u => `
                            <div class="pa-user-row">
                                <div>
                                    <div class="pa-user-name">${u.fullName}</div>
                                    <div class="pa-user-email">${u.email}</div>
                                </div>
                                <div style="display:flex;gap:6px;align-items:center">
                                    ${u.roles.map(r => `<span class="pa-badge pa-badge-shared">${r}</span>`).join('')}
                                    <span class="pa-badge ${u.active ? 'pa-badge-active' : 'pa-badge-inactive'}">${u.active ? '●' : '○'}</span>
                                </div>
                            </div>
                        `).join('')
                    }
                </div>
                <div class="pa-modal-footer">
                    <button class="pa-btn pa-btn-ghost" onclick="document.getElementById('platform-users-modal').remove()">Cerrar</button>
                </div>
            </div>`;
        document.body.appendChild(modal);
    } catch(err) {
        showPlatformAlert(err.message, 'error');
    }
};

function showPlatformAlert(msg, type = 'info') {
    const colors = { error:'#7f1d1d', success:'#052e16', info:'#0c1a2e' };
    const textColors = { error:'#fca5a5', success:'#4ade80', info:'#60a5fa' };
    const icons = { error:'fa-circle-exclamation', success:'fa-check-circle', info:'fa-info-circle' };
    const toast = document.createElement('div');
    toast.style.cssText = `position:fixed;bottom:24px;right:24px;z-index:99999;background:${colors[type]};border:1px solid ${textColors[type]}22;color:${textColors[type]};padding:12px 18px;border-radius:8px;font-size:12px;display:flex;align-items:center;gap:10px;max-width:340px;box-shadow:0 4px 20px rgba(0,0,0,.5)`;
    toast.innerHTML = `<i class="fa-solid ${icons[type]}"></i><span>${msg}</span>`;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
}

// Auto-slug y preview URL al tipear en el modal de clínica (se registra en el listener global de 'input')
// El listener global ya detecta pcf-name → actualiza pcf-slug
// Además actualizamos el preview de URL al cambiar el slug
document.addEventListener('input', function(e) {
    if (e.target.id === 'pcf-slug' || e.target.id === 'pcf-name') {
        const slugEl = document.getElementById('pcf-slug');
        const preview = document.getElementById('pcf-url-preview');
        if (slugEl && preview) {
            const slug = slugEl.value || '______';
            preview.textContent = `${slug}.odentara.com`;
        }
    }
});

// ── Fin Ultra-Admin Views ─────────────────────────────────────────────────────
