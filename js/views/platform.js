// =============================================================================
// platform.js -- Vistas del panel de plataforma (ultra-admin / superadmin)
// Depende de: state.js, api.js, auth.js, db-local.js, ui.js
// =============================================================================

// ══════════════════════════════════════════════════════════════════════════════
// ULTRA-ADMIN (PLATFORM) VIEWS
// ══════════════════════════════════════════════════════════════════════════════

// Inyecta los estilos propios del ultra-admin (dark theme, completamente distinto al SPA clínico)
function injectPlatformStyles() {
    if (document.getElementById('platform-admin-styles')) return;
    const style = document.createElement('style');
    style.id = 'platform-admin-styles';
    style.textContent = `
        /* ── Anula los !important del SPA cuando el modo plataforma está activo ── */
        body.pa-mode #main-content,
        body.pa-mode #app-view main { background: #0f1117 !important; padding: 0 !important; }
        /* ── Layout ultra-admin ── */
        .pa-root { display:flex; flex-direction:column; min-height:100vh; background:#0f1117; color:#e2e8f0; font-family:'Inter',system-ui,sans-serif; }
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
        .pa-badge-active   { background:#052e16; color:#4ade80; border:1px solid #14532d; }
        .pa-badge-inactive { background:#1c1917; color:#78716c; border:1px solid #292524; }
        .pa-badge-shared   { background:#0c1a2e; color:#93c5fd; border:1px solid #1e3a5f; }
        .pa-badge-dedicated{ background:#1a0a2e; color:#c084fc; border:1px solid #3b1a5f; }
        .pa-badge-plan-inicial { background:#0a1f2e; color:#38bdf8; border:1px solid #0c4a6e; }
        .pa-badge-plan-clinica { background:#0f2d1a; color:#4ade80; border:1px solid #14532d; }
        .pa-badge-plan-pro     { background:#1e1a0a; color:#fbbf24; border:1px solid #78350f; }
        .pa-dot { width:6px; height:6px; border-radius:50%; display:inline-block; }
        .pa-dot-green { background:#22c55e; box-shadow:0 0 6px #22c55e66; }
        .pa-dot-gray { background:#44403c; }
        .pa-status-light { width:10px; height:10px; border-radius:50%; display:inline-block; flex-shrink:0; }
        .pa-status-light-on  { background:#22c55e; box-shadow:0 0 8px #22c55e99; }
        .pa-status-light-off { background:#ef4444; box-shadow:0 0 6px #ef444466; }

        /* ── Stats cards ── */
        .pa-stats-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(160px,1fr)); gap:12px; margin-bottom:24px; }
        .pa-stat-card { background:#0d1119; border:1px solid #1e2535; border-radius:10px; padding:18px 20px; }
        .pa-stat-label { font-size:10px; font-weight:700; letter-spacing:.1em; text-transform:uppercase; color:#334155; margin-bottom:8px; }
        .pa-stat-value { font-size:28px; font-weight:800; color:#f1f5f9; letter-spacing:-.02em; }
        .pa-stat-sub { font-size:11px; color:#475569; margin-top:3px; }

        /* ── Modal ultra-admin ── */
        .pa-modal-overlay { position:fixed; inset:0; background:rgba(0,0,0,.75); backdrop-filter:blur(4px); z-index:9999; display:flex; align-items:flex-start; justify-content:center; padding:20px; overflow-y:auto; }
        .pa-modal-overlay.hidden { display:none; }
        .pa-modal { background:#111520; border:1px solid #1e2535; border-radius:12px; width:100%; max-width:520px; overflow:hidden; display:flex; flex-direction:column; max-height:calc(100vh - 40px); margin:auto; }
        .pa-modal-header { display:flex; align-items:center; justify-content:space-between; padding:18px 22px; border-bottom:1px solid #1e2535; flex-shrink:0; }
        .pa-modal-title { font-size:14px; font-weight:700; color:#f1f5f9; }
        .pa-modal-close { background:none; border:none; color:#475569; cursor:pointer; padding:4px; font-size:14px; border-radius:4px; }
        .pa-modal-close:hover { color:#94a3b8; background:#1e2535; }
        .pa-modal-body { padding:22px; overflow-y:auto; flex:1; }
        .pa-modal-footer { display:flex; justify-content:flex-end; gap:8px; padding:16px 22px; border-top:1px solid #1e2535; background:#0d1119; flex-shrink:0; }

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
        .pa-select option { background:#161b27; color:#e2e8f0; }
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

        /* ── Resumen compacto (tira de clínicas) ── */
        .pa-summary-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(150px,1fr)); gap:12px; margin-bottom:20px; }
        .pa-num { font-variant-numeric: tabular-nums; }

        /* ── Toolbar / búsqueda ── */
        .pa-toolbar { display:flex; align-items:center; gap:12px; margin-bottom:14px; }
        .pa-search { position:relative; flex:1; max-width:380px; }
        .pa-search > i { position:absolute; left:12px; top:50%; transform:translateY(-50%); color:#334155; font-size:12px; pointer-events:none; }
        .pa-search input { padding-left:32px; }
        .pa-toolbar-count { font-size:11px; color:#475569; font-family:'JetBrains Mono','Fira Mono',monospace; margin-left:auto; }

        /* ── Acciones de fila + menú overflow ── */
        .pa-row-actions { display:flex; gap:6px; justify-content:flex-end; align-items:center; }
        .pa-menu { position:fixed; z-index:10000; min-width:184px; background:#111520; border:1px solid #1e2535; border-radius:9px; padding:5px; box-shadow:0 12px 34px rgba(0,0,0,.55); display:flex; flex-direction:column; gap:2px; }
        .pa-menu-item { display:flex; align-items:center; gap:9px; width:100%; text-align:left; background:none; border:none; color:#94a3b8; font-size:12px; font-weight:500; padding:8px 10px; border-radius:6px; cursor:pointer; transition:background .12s,color .12s; }
        .pa-menu-item i { width:14px; text-align:center; font-size:11px; color:#475569; }
        .pa-menu-item:hover { background:#1a2030; color:#e2e8f0; }
        .pa-menu-item:hover i { color:#94a3b8; }
        .pa-menu-item-danger { color:#fca5a5; }
        .pa-menu-item-danger i { color:#f87171; }
        .pa-menu-item-danger:hover { background:#2a1215; color:#fecaca; }
        .pa-menu-item-danger:hover i { color:#fca5a5; }
        .pa-menu-divider { height:1px; background:#1e2535; margin:4px 2px; }

        /* ── Gráficos (Estadísticas) ── */
        .pa-charts-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(280px,1fr)); gap:14px; margin-top:20px; }
        .pa-chart-card { background:#0d1119; border:1px solid #1e2535; border-radius:10px; padding:18px 20px; }
        .pa-chart-title { font-size:12px; font-weight:700; color:#94a3b8; letter-spacing:.02em; margin-bottom:16px; }
        .pa-chart-body { display:flex; align-items:center; gap:20px; }
        .pa-pie-donut { width:110px; height:110px; border-radius:50%; flex-shrink:0; position:relative; }
        .pa-pie-donut::after { content:''; position:absolute; inset:20px; border-radius:50%; background:#0d1119; }
        .pa-pie-legend { display:flex; flex-direction:column; gap:7px; flex:1; min-width:0; }
        .pa-legend-item { display:flex; align-items:center; gap:8px; font-size:11px; color:#94a3b8; }
        .pa-legend-dot { width:9px; height:9px; border-radius:50%; flex-shrink:0; }
        .pa-legend-label { flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .pa-legend-value { font-weight:700; color:#e2e8f0; font-variant-numeric:tabular-nums; }
        .pa-chart-empty { font-size:11px; color:#334155; text-align:center; padding:20px 0; }
        .pa-bar-chart { display:flex; align-items:flex-end; gap:10px; height:140px; padding-top:10px; }
        .pa-bar-col { flex:1; display:flex; flex-direction:column; align-items:center; justify-content:flex-end; height:100%; gap:6px; }
        .pa-bar-col .pa-bar-value { font-size:10px; color:#64748b; font-weight:700; }
        .pa-bar-col .pa-bar { width:100%; max-width:32px; background:linear-gradient(180deg,#6366f1,#4338ca); border-radius:4px 4px 0 0; min-height:2px; }
        .pa-bar-col .pa-bar-label { font-size:10px; color:#475569; }

        /* ── Responsive: tablet ──────────────────────────────────────────── */
        @media screen and (max-width: 1024px) {
            .pa-main { padding:20px; }
            .pa-charts-grid { grid-template-columns:1fr; }
        }

        /* ── Responsive: mobile ──────────────────────────────────────────────
           La sidebar de 200px fija dejaba ~109px de contenido en un celular.
           Acá pasa a ser una barra horizontal scrolleable arriba del contenido. */
        @media screen and (max-width: 900px) {
            .pa-body { flex-direction:column; }
            .pa-sidebar {
                width:100%; flex-direction:row; overflow-x:auto; overflow-y:hidden;
                padding:0; border-right:none; border-bottom:1px solid #1e2535;
                gap:0; -webkit-overflow-scrolling:touch; scrollbar-width:none;
            }
            .pa-sidebar::-webkit-scrollbar { display:none; }
            .pa-nav-section { display:none; }
            .pa-nav-item {
                white-space:nowrap; padding:13px 16px; border-left:none;
                border-bottom:2px solid transparent; font-size:13px;
            }
            .pa-nav-item.active { border-left-color:transparent; border-bottom-color:#6366f1; }
            .pa-main { padding:18px 14px; }

            .pa-topbar { padding:0 14px; height:48px; }
            .pa-topbar-brand { font-size:11px; }
            .pa-topbar-right { gap:10px; font-size:11px; }
            /* El email del admin come todo el ancho en pantallas chicas */
            .pa-topbar-right > span { max-width:130px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }

            .pa-page-header { flex-direction:column; align-items:stretch; gap:12px; }
            .pa-stats-grid { grid-template-columns:repeat(auto-fill,minmax(140px,1fr)); gap:10px; }
            .pa-stat-card { padding:14px 16px; }
            .pa-stat-value { font-size:22px; }

            /* Las tablas del panel tienen 7 columnas de datos densos. En celular
               se ocultan las secundarias y quedan solo las que importan para
               identificar la fila y actuar sobre ella. */
            /* Lo que quede ancho scrollea dentro de su propia caja, sin romper
               la página. (table-layout:fixed empeoraba el reparto de columnas.) */
            .pa-table-wrap { overflow-x:auto; -webkit-overflow-scrolling:touch; }
            .pa-table { min-width:0; }
            .pa-table th, .pa-table td { padding:10px 8px; font-size:11px; }

            /* Clínicas: Clínica/URL · Plan · Acciones */
            .pa-table-clinics th:nth-child(2), .pa-table-clinics td:nth-child(2),
            .pa-table-clinics th:nth-child(3), .pa-table-clinics td:nth-child(3),
            .pa-table-clinics th:nth-child(5), .pa-table-clinics td:nth-child(5),
            .pa-table-clinics th:nth-child(6), .pa-table-clinics td:nth-child(6) { display:none; }

            /* Cobros: Clínica · Estado del mes · Acción */
            .pa-table-subs th:nth-child(2), .pa-table-subs td:nth-child(2),
            .pa-table-subs th:nth-child(3), .pa-table-subs td:nth-child(3),
            .pa-table-subs th:nth-child(5), .pa-table-subs td:nth-child(5),
            .pa-table-subs th:nth-child(6), .pa-table-subs td:nth-child(6) { display:none; }

            /* Historial de pagos: Clínica · Período · Monto */
            .pa-table-payments th:nth-child(4), .pa-table-payments td:nth-child(4),
            .pa-table-payments th:nth-child(5), .pa-table-payments td:nth-child(5),
            .pa-table-payments th:nth-child(6), .pa-table-payments td:nth-child(6) { display:none; }

            /* Auditoría: Fecha · Usuario · Acción · (ver detalle) */
            .pa-table-audit th:nth-child(2), .pa-table-audit td:nth-child(2),
            .pa-table-audit th:nth-child(5), .pa-table-audit td:nth-child(5),
            .pa-table-audit th:nth-child(6), .pa-table-audit td:nth-child(6) { display:none; }

            /* Toolbar de filtros: cada control a ancho completo en vez de apretados */
            .pa-toolbar { flex-wrap:wrap; }
            .pa-toolbar .pa-select,
            .pa-toolbar .pa-input { max-width:none !important; flex:1 1 140px; }
            .pa-toolbar-count { margin-left:0; width:100%; }

            /* Objetivos táctiles: 23-25px era imposible de tocar con el dedo */
            .pa-btn { min-height:40px; padding:9px 16px; }
            .pa-btn-sm { min-height:36px; padding:8px 12px; }
            .pa-btn-icon { min-width:36px; }
            .pa-input, .pa-select { min-height:42px; font-size:16px; } /* 16px evita el zoom automático de iOS */

            .pa-modal { max-width:none; margin:0; max-height:calc(100vh - 20px); }
            .pa-modal-overlay { padding:10px; }
            .pa-form-row { grid-template-columns:1fr; }
            .pa-menu { min-width:170px; }
        }

        @media screen and (max-width: 480px) {
            .pa-main { padding:14px 10px; }
            .pa-stats-grid { grid-template-columns:1fr 1fr; }
            .pa-page-title { font-size:15px; }
        }
    `;
    document.head.appendChild(style);

    // ESC cierra cualquier modal de plataforma abierto
    document.addEventListener('keydown', function onPlatformEsc(e) {
        if (e.key !== 'Escape') return;
        const clinicModal = document.getElementById('platform-clinic-modal');
        const adminModal  = document.getElementById('platform-admin-modal');
        const usersModal  = document.getElementById('platform-users-modal');
        if (clinicModal && !clinicModal.classList.contains('hidden')) {
            window.platformCloseClinicModal?.(); return;
        }
        if (adminModal && !adminModal.classList.contains('hidden')) {
            window.platformCloseAdminModal?.(); return;
        }
        if (usersModal) {
            usersModal.remove(); return;
        }
    });
}

// Aplica el fondo oscuro al app container mientras el platform admin está activo
function applyPlatformTheme(on) {
    injectPlatformStyles(); // asegura que el <style> esté antes de aplicar la clase
    const sidebar     = document.getElementById('app-sidebar');
    const topbar      = document.querySelector('header');
    const mainContent = document.getElementById('main-content');
    if (on) {
        document.body.classList.add('pa-mode');
        if (sidebar)     sidebar.style.display = 'none';
        if (topbar)      topbar.style.display  = 'none';
        if (mainContent) { mainContent.style.padding = ''; mainContent.style.background = ''; }
    } else {
        document.body.classList.remove('pa-mode');
        if (sidebar)     sidebar.style.display = '';
        if (topbar)      topbar.style.display  = '';
        if (mainContent) { mainContent.style.padding = ''; mainContent.style.background = ''; }
    }
}

async function renderPlatformClinics(container) {
    injectPlatformStyles();

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

    // Resumen computado desde la lista ya cargada (sin API extra)
    const activas = clinics.filter(c => c.active).length;
    const sum = (k) => clinics.reduce((n, c) => n + (c.stats?.[k] || 0), 0);
    const summaryCards = [
        { label:'Clínicas',      value: clinics.length,        sub:`${activas} activa${activas!==1?'s':''}`, icon:'fa-hospital',    color:'#6366f1' },
        { label:'Pacientes',     value: sum('patients'),       sub:'en total', icon:'fa-person',      color:'#c084fc' },
        { label:'Profesionales', value: sum('professionals'),  sub:'en total', icon:'fa-user-doctor', color:'#fb923c' },
        { label:'Usuarios',      value: sum('users'),          sub:'en total', icon:'fa-users',       color:'#60a5fa' },
    ];
    const summaryHtml = clinics.length === 0 ? '' : `<div class="pa-summary-grid">${summaryCards.map(m => `
        <div class="pa-stat-card">
            <div class="pa-stat-label"><i class="fa-solid ${m.icon}" style="color:${m.color};margin-right:6px"></i>${m.label}</div>
            <div class="pa-stat-value pa-num">${(m.value||0).toLocaleString('es-AR')}</div>
            <div class="pa-stat-sub">${m.sub}</div>
        </div>`).join('')}</div>`;

    const rows = clinics.length === 0
        ? `<tr><td colspan="7"><div class="pa-empty"><i class="fa-solid fa-hospital"></i><p>No hay clínicas registradas.</p></div></td></tr>`
        : clinics.map(c => {
            const url = `${c.slug}.odentara.com`;
            const dbBadge = c.dbType === 'dedicated'
                ? `<span class="pa-badge pa-badge-dedicated"><i class="fa-solid fa-database" style="font-size:8px"></i>Dedicada</span>`
                : `<span class="pa-badge pa-badge-shared"><i class="fa-solid fa-share-nodes" style="font-size:8px"></i>Compartida</span>`;
            const planBadge = c.plan
                ? `<span class="pa-badge pa-badge-plan-${c.plan}">${c.plan.toUpperCase()}</span>`
                : `<span style="color:#334155;font-size:11px">—</span>`;
            const searchKey = `${c.name} ${url} ${c.notes || ''}`.toLowerCase().replace(/"/g,'&quot;');
            return `
            <tr data-clinic-row data-search="${searchKey}">
                <td class="td-name">
                    <div style="display:flex;align-items:center;gap:9px">
                        <span class="pa-status-light ${c.active ? 'pa-status-light-on' : 'pa-status-light-off'}" title="${c.active ? 'Activa' : 'Inactiva'}"></span>
                        <div>
                            <div style="font-size:13px;font-weight:600;color:#e2e8f0">${c.name}</div>
                            <div style="font-family:'JetBrains Mono','Fira Mono',monospace;font-size:11px;color:#6366f1">${url}</div>
                        </div>
                    </div>
                </td>
                <td style="font-size:12px;color:#94a3b8;max-width:180px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${c.notes ? c.notes.replace(/"/g,'&quot;') : ''}">${c.notes || '<span style="color:#334155">—</span>'}</td>
                <td>${dbBadge}</td>
                <td>${planBadge}</td>
                <td style="font-size:11px;color:#475569" class="pa-num">
                    <span title="Pacientes"><i class="fa-solid fa-person" style="width:12px"></i> ${c.stats.patients}</span> &nbsp;
                    <span title="Profesionales"><i class="fa-solid fa-user-doctor" style="width:12px"></i> ${c.stats.professionals}</span> &nbsp;
                    <span title="Usuarios"><i class="fa-solid fa-users" style="width:12px"></i> ${c.stats.users}</span>
                </td>
                <td style="font-size:11px;color:#475569" class="pa-num">${new Date(c.createdAt).toLocaleDateString('es-AR')}</td>
                <td>
                    <div class="pa-row-actions">
                        <button class="pa-btn pa-btn-primary pa-btn-sm" onclick="window.platformLoginAsClinic(${c.id},'${c.name.replace(/'/g,"\\'")}')">
                            <i class="fa-solid fa-right-to-bracket"></i> Ingresar
                        </button>
                        <button class="pa-btn pa-btn-ghost pa-btn-sm pa-btn-icon" title="Más acciones" onclick="window.platformRowMenu(event, ${c.id})">
                            <i class="fa-solid fa-ellipsis-vertical"></i>
                        </button>
                    </div>
                </td>
            </tr>`;
        }).join('');

    const toolbarHtml = clinics.length === 0 ? '' : `
        <div class="pa-toolbar">
            <div class="pa-search">
                <i class="fa-solid fa-magnifying-glass"></i>
                <input class="pa-input" type="search" placeholder="Buscar por nombre o URL..." oninput="window.platformFilterClinics(this.value)">
            </div>
            <span class="pa-toolbar-count" id="pa-clinics-count">${clinics.length} clínica${clinics.length !== 1 ? 's' : ''}</span>
        </div>`;

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

            ${summaryHtml}
            ${toolbarHtml}

            <div class="pa-table-wrap">
                <table class="pa-table pa-table-clinics">
                    <thead>
                        <tr>
                            <th>Clínica / URL</th>
                            <th>Notas</th>
                            <th>Base de datos</th>
                            <th>Plan</th>
                            <th>Recursos</th>
                            <th>Creada</th>
                            <th style="text-align:right">Acciones</th>
                        </tr>
                    </thead>
                    <tbody id="pa-clinics-tbody">${rows}</tbody>
                </table>
            </div>
        `)}
    </div>

    ${renderPlatformClinicModal()}
    ${renderPlatformAdminModal()}
    `;
}

// Construye un donut chart en CSS (conic-gradient) + leyenda a partir de
// entries = [{label, value, color}]. Sin dependencias externas.
function paPieChart(title, entries) {
    const total = entries.reduce((sum, e) => sum + e.value, 0);
    if (total === 0) {
        return `<div class="pa-chart-card"><div class="pa-chart-title">${title}</div><div class="pa-chart-empty">Sin datos todavía</div></div>`;
    }
    let acc = 0;
    const stops = entries.filter(e => e.value > 0).map(e => {
        const from = (acc / total) * 360;
        acc += e.value;
        const to = (acc / total) * 360;
        return `${e.color} ${from}deg ${to}deg`;
    }).join(', ');

    const legend = entries.filter(e => e.value > 0).map(e => `
        <div class="pa-legend-item">
            <span class="pa-legend-dot" style="background:${e.color}"></span>
            <span class="pa-legend-label">${e.label}</span>
            <span class="pa-legend-value">${e.value.toLocaleString('es-AR')}</span>
            <span style="color:#334155">${Math.round((e.value/total)*100)}%</span>
        </div>
    `).join('');

    return `
        <div class="pa-chart-card">
            <div class="pa-chart-title">${title}</div>
            <div class="pa-chart-body">
                <div class="pa-pie-donut" style="background:conic-gradient(${stops})"></div>
                <div class="pa-pie-legend">${legend}</div>
            </div>
        </div>`;
}

// Barras verticales simples a partir de entries = [{label, count}]
function paBarChart(title, entries) {
    const max = Math.max(1, ...entries.map(e => e.count));
    const bars = entries.map(e => `
        <div class="pa-bar-col">
            <span class="pa-bar-value">${e.count}</span>
            <div class="pa-bar" style="height:${Math.max(2, (e.count/max)*100)}%"></div>
            <span class="pa-bar-label">${e.label}</span>
        </div>
    `).join('');
    return `
        <div class="pa-chart-card">
            <div class="pa-chart-title">${title}</div>
            <div class="pa-bar-chart">${bars}</div>
        </div>`;
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

    const clinicsByPlan = s.clinicsByPlan || {};
    const clinicsByDbType = s.clinicsByDbType || {};
    const usersByRole = s.usersByRole || {};
    const appointmentsByStatus = s.appointmentsByStatus || {};
    const billingStatus = s.billingStatus || {};
    const patientsByMonth = s.patientsByMonth || [];

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
                    { label:'Clínicas totales',    value: s.totalClinics,           sub:'instancias',            icon:'fa-hospital',       color:'#6366f1' },
                    { label:'Clínicas activas',    value: s.activeClinics,          sub:'en línea',              icon:'fa-circle-check',   color:'#22c55e' },
                    { label:'Usuarios',            value: s.totalUsers,             sub:'en toda la plataforma', icon:'fa-users',          color:'#60a5fa' },
                    { label:'Pacientes',           value: s.totalPatients,          sub:'registrados',           icon:'fa-person',         color:'#c084fc' },
                    { label:'Profesionales',       value: s.totalProfessionals,     sub:'activos',               icon:'fa-user-doctor',    color:'#fb923c' },
                    { label:'Turnos este mes',     value: s.appointmentsThisMonth,  sub:'en el mes actual',      icon:'fa-calendar-check', color:'#2dd4bf' },
                    { label:'Ingresos aproximados', value: `$${(s.estimatedMonthlyRevenue||0).toLocaleString('es-AR')}`, sub:'por mes, según plan de c/clínica activa', icon:'fa-sack-dollar', color:'#facc15', raw:true },
                ].map(m => `
                    <div class="pa-stat-card">
                        <div class="pa-stat-label"><i class="fa-solid ${m.icon}" style="color:${m.color};margin-right:6px"></i>${m.label}</div>
                        <div class="pa-stat-value">${m.raw ? m.value : (m.value||0).toLocaleString('es-AR')}</div>
                        <div class="pa-stat-sub">${m.sub}</div>
                    </div>
                `).join('')}
            </div>

            <div class="pa-charts-grid">
                ${paPieChart('Clínicas por plan', [
                    { label:'Inicial',  value: clinicsByPlan.inicial||0,  color:'#38bdf8' },
                    { label:'Clínica',  value: clinicsByPlan.clinica||0,  color:'#4ade80' },
                    { label:'Pro',      value: clinicsByPlan.pro||0,      color:'#fbbf24' },
                    { label:'Sin plan', value: clinicsByPlan.sinPlan||0,  color:'#475569' },
                ])}

                ${paPieChart('Base de datos', [
                    { label:'Compartida', value: clinicsByDbType.shared||0,    color:'#60a5fa' },
                    { label:'Dedicada',   value: clinicsByDbType.dedicated||0, color:'#c084fc' },
                ])}

                ${paPieChart('Usuarios por rol', [
                    { label:'Superadmin',   value: usersByRole.superadmin||0,   color:'#818cf8' },
                    { label:'Profesional',  value: usersByRole.professional||0, color:'#2dd4bf' },
                    { label:'Secretario',   value: usersByRole.secretary||0,    color:'#fb923c' },
                    { label:'Admin',        value: usersByRole.admin||0,        color:'#f472b6' },
                ])}

                ${paPieChart('Turnos del mes por estado', [
                    { label:'Confirmado',  value: appointmentsByStatus.confirmed||0,   color:'#4ade80' },
                    { label:'Enviado',     value: appointmentsByStatus.sent||0,        color:'#60a5fa' },
                    { label:'Sin enviar',  value: appointmentsByStatus.not_sent||0,    color:'#94a3b8' },
                    { label:'Reprogramado',value: appointmentsByStatus.rescheduled||0, color:'#fbbf24' },
                    { label:'Cancelado',   value: appointmentsByStatus.cancelled||0,   color:'#f87171' },
                ])}

                ${paPieChart('Cobros del mes', [
                    { label:'Pagado',   value: billingStatus.paid||0,    color:'#4ade80' },
                    { label:'Pendiente',value: billingStatus.pending||0, color:'#fbbf24' },
                    { label:'Vencido',  value: billingStatus.overdue||0, color:'#f87171' },
                ])}

                ${paBarChart('Pacientes nuevos — últimos 6 meses', patientsByMonth.map(m => ({ label: m.label, count: m.count })))}
            </div>
        `)}
    </div>`;
}

// ── Cobros de suscripción ─────────────────────────────────────────────────────
async function renderPlatformSubscriptions(container) {
    injectPlatformStyles();

    let data = { clinics: [], payments: [] };
    try {
        const res = await apiFetch('/platform/subscriptions');
        if (res.ok) { data = res; window._platformSubClinics = data.clinics; }
    } catch(e) { console.error(e); }

    const PLAN_AMOUNTS = { inicial: 45000, clinica: 75000, pro: 125000 };
    const PERIOD_LABELS = { '01':'Enero','02':'Febrero','03':'Marzo','04':'Abril','05':'Mayo','06':'Junio','07':'Julio','08':'Agosto','09':'Septiembre','10':'Octubre','11':'Noviembre','12':'Diciembre' };
    function periodLabel(p) { const [y,m] = p.split('-'); return `${PERIOD_LABELS[m]} ${y}`; }
    function now() { return new Date(); }
    const currentPeriod = `${now().getFullYear()}-${String(now().getMonth()+1).padStart(2,'0')}`;

    const rows = data.clinics.filter(c => c.active).map(c => {
        const suggested = PLAN_AMOUNTS[c.plan] || '—';
        let statusBadge, statusSort;
        if (c.currentPaid) {
            statusBadge = `<span class="pa-badge pa-badge-active">✓ Pagado</span>`;
            statusSort = 0;
        } else if (c.isOverdue) {
            statusBadge = `<span class="pa-badge" style="background:#7f1d1d;color:#fca5a5">⚠ Vencido</span>`;
            statusSort = 2;
        } else {
            statusBadge = `<span class="pa-badge" style="background:#78350f;color:#fde68a">Pendiente</span>`;
            statusSort = 1;
        }
        const owed = c.owedPeriods.length;
        const owedBadge = owed > 0
            ? `<span style="color:#f87171;font-size:11px;font-weight:600">${owed} mes${owed!==1?'es':''} adeudado${owed!==1?'s':''}</span>`
            : `<span style="color:#34d399;font-size:11px">Al día</span>`;
        const lastPay = c.lastPayment
            ? `<span style="font-size:11px;color:#94a3b8">$${Number(c.lastPayment.amount).toLocaleString('es-AR')} · ${periodLabel(c.lastPayment.period)}</span>`
            : `<span style="font-size:11px;color:#475569">Sin pagos</span>`;
        return { statusSort, html: `
            <tr>
                <td style="font-size:13px;font-weight:600;color:#e2e8f0">${c.name}</td>
                <td>${c.plan ? `<span class="pa-badge pa-badge-plan-${c.plan}">${c.plan.toUpperCase()}</span>` : '<span style="color:#475569;font-size:11px">Sin plan</span>'}</td>
                <td style="color:#94a3b8;font-size:12px">${suggested !== '—' ? `$${Number(suggested).toLocaleString('es-AR')}` : '—'}</td>
                <td>${statusBadge}</td>
                <td>${owedBadge}</td>
                <td>${lastPay}</td>
                <td style="text-align:right">
                    <button class="pa-btn pa-btn-primary pa-btn-sm" onclick="window.platformOpenPaymentModal(${c.id},'${c.name.replace(/'/g,"\\'")}','${c.plan||''}')">
                        <i class="fa-solid fa-plus"></i> Registrar pago
                    </button>
                </td>
            </tr>` };
    }).sort((a,b) => b.statusSort - a.statusSort);

    // Historial de pagos
    const historialRows = data.payments.slice(0,50).map(p => {
        const clinic = data.clinics.find(c => c.id === p.clinicId);
        return `<tr>
            <td style="font-size:12px;color:#e2e8f0">${clinic?.name || '—'}</td>
            <td style="font-size:12px;color:#94a3b8">${periodLabel(p.period)}</td>
            <td style="font-size:12px;font-weight:600;color:#34d399">$${Number(p.amount).toLocaleString('es-AR')}</td>
            <td style="font-size:11px;color:#94a3b8">${p.paymentMethod}</td>
            <td style="font-size:11px;color:#475569">${new Date(p.paidAt).toLocaleDateString('es-AR')}</td>
            <td style="font-size:11px;color:#475569">${escapeHtml(p.notes || '—')}</td>
            <td style="text-align:right">
                <button class="pa-btn pa-btn-ghost pa-btn-sm pa-btn-icon" title="Eliminar" style="color:#f87171" onclick="window.platformDeletePayment(${p.id})"><i class="fa-solid fa-trash"></i></button>
            </td>
        </tr>`;
    }).join('');

    const overdueCount = data.clinics.filter(c => c.active && c.isOverdue).length;
    const pendingCount = data.clinics.filter(c => c.active && !c.currentPaid && !c.isOverdue).length;
    const paidCount    = data.clinics.filter(c => c.active && c.currentPaid).length;

    container.innerHTML = `
    <div class="pa-root">
        ${renderPlatformShell('platform-subscriptions', `
            <div class="pa-page-header">
                <div>
                    <div class="pa-page-title">Cobros</div>
                    <div class="pa-page-sub">${periodLabel(currentPeriod)} · ${paidCount} pagado${paidCount!==1?'s':''} · ${pendingCount} pendiente${pendingCount!==1?'s':''} · ${overdueCount} vencido${overdueCount!==1?'s':''}</div>
                </div>
                <button class="pa-btn pa-btn-primary" onclick="window.platformOpenPaymentModal()">
                    <i class="fa-solid fa-plus"></i> Registrar pago
                </button>
            </div>

            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:24px">
                <div style="background:#0f2a1a;border:1px solid #166534;border-radius:10px;padding:16px">
                    <div style="font-size:11px;color:#6ee7b7;text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px">Pagaron este mes</div>
                    <div style="font-size:28px;font-weight:700;color:#34d399">${paidCount}</div>
                </div>
                <div style="background:#2a1f0a;border:1px solid #92400e;border-radius:10px;padding:16px">
                    <div style="font-size:11px;color:#fde68a;text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px">Pendientes (en plazo)</div>
                    <div style="font-size:28px;font-weight:700;color:#fbbf24">${pendingCount}</div>
                </div>
                <div style="background:#2a0f0f;border:1px solid #7f1d1d;border-radius:10px;padding:16px">
                    <div style="font-size:11px;color:#fca5a5;text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px">Vencidos (>10 del mes)</div>
                    <div style="font-size:28px;font-weight:700;color:#f87171">${overdueCount}</div>
                </div>
            </div>

            <div class="pa-table-wrap" style="margin-bottom:32px">
                <div style="font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#475569;padding:0 0 8px">Estado del mes actual</div>
                <table class="pa-table pa-table-subs">
                    <thead><tr>
                        <th>Clínica</th><th>Plan</th><th>Monto sugerido</th><th>Estado mes actual</th><th>Deuda acumulada</th><th>Último pago</th><th style="text-align:right">Acción</th>
                    </tr></thead>
                    <tbody>${rows.map(r=>r.html).join('') || '<tr><td colspan="7" style="text-align:center;color:#475569;padding:24px">Sin clínicas activas</td></tr>'}</tbody>
                </table>
            </div>

            <div class="pa-table-wrap">
                <div style="font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#475569;padding:0 0 8px">Historial de pagos</div>
                <table class="pa-table pa-table-payments">
                    <thead><tr><th>Clínica</th><th>Período</th><th>Monto</th><th>Método</th><th>Fecha</th><th>Notas</th><th></th></tr></thead>
                    <tbody>${historialRows || '<tr><td colspan="7" style="text-align:center;color:#475569;padding:24px">Sin pagos registrados aún</td></tr>'}</tbody>
                </table>
            </div>
        `)}
    </div>

    <!-- Modal registrar pago -->
    <div id="pa-payment-modal" class="pa-modal-overlay hidden" onclick="if(event.target===this)document.getElementById('pa-payment-modal').classList.add('hidden')">
        <div class="pa-modal" style="max-width:460px">
            <div class="pa-modal-header">
                <span class="pa-modal-title">Registrar pago</span>
                <button class="pa-modal-close" onclick="document.getElementById('pa-payment-modal').classList.add('hidden')"><i class="fa-solid fa-xmark"></i></button>
            </div>
            <div class="pa-modal-body">
                <form id="pa-payment-form" onsubmit="window.platformSavePayment(event)">
                    <div class="pa-form-group">
                        <label class="pa-label">Clínica <span class="req">*</span></label>
                        <select id="ppf-clinic" class="pa-select" required>
                            <option value="">Seleccioná una clínica...</option>
                        </select>
                    </div>
                    <div class="pa-form-row">
                        <div class="pa-form-group">
                            <label class="pa-label">Período <span class="req">*</span></label>
                            <input id="ppf-period" class="pa-input" type="month" required value="${currentPeriod}">
                        </div>
                        <div class="pa-form-group">
                            <label class="pa-label">Fecha de pago <span class="req">*</span></label>
                            <input id="ppf-paidat" class="pa-input" type="date" required value="${new Date().toISOString().slice(0,10)}">
                        </div>
                    </div>
                    <div class="pa-form-row">
                        <div class="pa-form-group">
                            <label class="pa-label">Monto (ARS) <span class="req">*</span></label>
                            <input id="ppf-amount" class="pa-input" type="number" min="1" step="0.01" placeholder="75000" required>
                        </div>
                        <div class="pa-form-group">
                            <label class="pa-label">Forma de pago <span class="req">*</span></label>
                            <select id="ppf-method" class="pa-select" required>
                                <option value="">Seleccioná...</option>
                                <option value="transferencia">Transferencia</option>
                                <option value="efectivo">Efectivo</option>
                                <option value="tarjeta">Tarjeta</option>
                                <option value="crypto">Crypto</option>
                                <option value="otro">Otro</option>
                            </select>
                        </div>
                    </div>
                    <div class="pa-form-group">
                        <label class="pa-label">Notas</label>
                        <input id="ppf-notes" class="pa-input" placeholder="Opcional">
                    </div>
                </form>
            </div>
            <div class="pa-modal-footer">
                <button class="pa-btn pa-btn-ghost" onclick="document.getElementById('pa-payment-modal').classList.add('hidden')">Cancelar</button>
                <button class="pa-btn pa-btn-primary" onclick="document.getElementById('pa-payment-form').requestSubmit()">
                    <i class="fa-solid fa-check"></i> Guardar pago
                </button>
            </div>
        </div>
    </div>`;
}

window.platformOpenPaymentModal = async function(clinicId, clinicName, plan) {
    const modal = document.getElementById('pa-payment-modal');
    if (!modal) return;

    // Si no hay datos en memoria, hacer fetch fresco
    if (!window._platformSubClinics || window._platformSubClinics.length === 0) {
        try {
            const res = await apiFetch('/platform/subscriptions');
            if (res.ok) window._platformSubClinics = res.clinics || [];
        } catch(e) { console.error('[platformOpenPaymentModal] fetch failed', e); }
    }

    // Poblar el select con las clínicas activas
    const sel = document.getElementById('ppf-clinic');
    if (sel) {
        const clinics = (window._platformSubClinics || []).filter(c => c.active);
        sel.innerHTML = '<option value="">Seleccioná una clínica...</option>' +
            clinics.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
        if (clinicId) sel.value = clinicId;
    }

    const PLAN_AMOUNTS = { inicial: 45000, clinica: 75000, pro: 125000 };
    const amountInput = document.getElementById('ppf-amount');
    if (amountInput && plan && PLAN_AMOUNTS[plan]) amountInput.value = PLAN_AMOUNTS[plan];
    else if (amountInput && clinicId) {
        const c = (window._platformSubClinics || []).find(x => x.id === Number(clinicId));
        if (c?.plan && PLAN_AMOUNTS[c.plan]) amountInput.value = PLAN_AMOUNTS[c.plan];
    }

    modal.classList.remove('hidden');
    sel?.focus();
};

window.platformSavePayment = async function(e) {
    e.preventDefault();
    const btn = e.target.closest('.pa-modal')?.querySelector('.pa-btn-primary') || document.querySelector('#pa-payment-modal .pa-btn-primary');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; }
    try {
        const res = await apiFetch('/platform/subscriptions', {
            method: 'POST',
            body: JSON.stringify({
                clinicId:      Number(document.getElementById('ppf-clinic').value),
                period:        document.getElementById('ppf-period').value,
                amount:        parseFloat(document.getElementById('ppf-amount').value),
                paymentMethod: document.getElementById('ppf-method').value,
                paidAt:        document.getElementById('ppf-paidat').value,
                notes:         document.getElementById('ppf-notes').value,
            }),
        });
        if (!res.ok) throw new Error(res.error || 'Error');
        document.getElementById('pa-payment-modal').classList.add('hidden');
        const content = document.querySelector('.pa-root')?.parentElement;
        if (content) renderPlatformSubscriptions(content);
        else loadView('platform-subscriptions', 'Cobros', { skipSync: true });
    } catch(err) {
        showPlatformAlert(err.message, 'error');
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-check"></i> Guardar pago'; }
    }
};

window.platformDeletePayment = async function(id) {
    if (!await showConfirm('¿Eliminar este registro de pago?', { title: 'Eliminar pago', variant: 'danger', confirmText: 'Eliminar' })) return;
    try {
        const res = await apiFetch(`/platform/subscriptions/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error(res.error);
        loadView('platform-subscriptions', 'Cobros', { skipSync: true });
    } catch(err) {
        showPlatformAlert(err.message, 'error');
    }
};

// Shell HTML compartido (topbar + sidebar + main) del ultra-admin
function renderPlatformShell(activeView, mainHtml) {
    const NAV = [
        { id:'platform-clinics',       icon:'fa-hospital',        label:'Clínicas'      },
        { id:'platform-subscriptions', icon:'fa-dollar-sign',     label:'Cobros'        },
        { id:'platform-stats',         icon:'fa-chart-bar',       label:'Estadísticas'  },
        { id:'platform-audit',         icon:'fa-clipboard-list',  label:'Auditoría'     },
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
    <div id="platform-clinic-modal" class="pa-modal-overlay hidden" onclick="if(event.target===this)window.platformCloseClinicModal()">
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
                            <label class="pa-label">Notas internas</label>
                            <input id="pcf-notes" class="pa-input" placeholder="Ej: nombre real del dueño, datos de contacto interno...">
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
                        <div class="pa-form-group" style="grid-column:1/-1">
                            <label class="pa-label">Plan</label>
                            <select id="pcf-plan" class="pa-select">
                                <option value="">Sin plan (ilimitado)</option>
                                <option value="inicial">Inicial — $45.000/mes · 1 prof · carga manual (sin IA)</option>
                                <option value="clinica">Clínica — $75.000/mes · 3 prof · IA 100 fichas/mes</option>
                                <option value="pro">Pro — $125.000/mes · ilimitado · IA 500 fichas/mes</option>
                            </select>
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

                    <!-- Superadmin inicial (solo al crear) -->
                    <div id="pcf-admin-section" class="pa-db-section" style="margin-top:16px">
                        <div class="pa-db-section-title"><i class="fa-solid fa-user-shield" style="margin-right:6px"></i>Superadmin inicial</div>
                        <div class="pa-hint" style="margin-bottom:12px">Se creará automáticamente con acceso total a esta clínica.</div>
                        <div class="pa-form-row">
                            <div class="pa-form-group" style="grid-column:1/-1">
                                <label class="pa-label">Nombre completo <span class="req">*</span></label>
                                <input id="pcf-admin-name" class="pa-input" placeholder="Dr. Juan García" required>
                            </div>
                            <div class="pa-form-group">
                                <label class="pa-label">Email <span class="req">*</span></label>
                                <input id="pcf-admin-email" class="pa-input" type="email" placeholder="admin@clinica.com" required>
                            </div>
                            <div class="pa-form-group">
                                <label class="pa-label">Contraseña inicial <span class="req">*</span></label>
                                <div style="position:relative">
                                    <input id="pcf-admin-pass" class="pa-input" type="password" value="odentara123" required style="padding-right:38px">
                                    <button type="button" onclick="const i=document.getElementById('pcf-admin-pass');i.type=i.type==='password'?'text':'password';this.querySelector('i').className='fa-solid '+(i.type==='password'?'fa-eye':'fa-eye-slash')" style="position:absolute;right:10px;top:50%;transform:translateY(-50%);background:none;border:none;color:#94a3b8;cursor:pointer;padding:2px"><i class="fa-solid fa-eye"></i></button>
                                </div>
                            </div>
                        </div>
                    </div>
                </form>
            </div>
            <div class="pa-modal-footer">
                <button class="pa-btn pa-btn-ghost" onclick="window.platformCloseClinicModal()">Cancelar</button>
                <button id="pcf-submit-btn" class="pa-btn pa-btn-primary" onclick="document.getElementById('platform-clinic-form').requestSubmit()">
                    <i class="fa-solid fa-check"></i> Crear clínica
                </button>
            </div>
        </div>
    </div>`;
}

function renderPlatformAdminModal() {
    return `
    <div id="platform-admin-modal" class="pa-modal-overlay hidden" onclick="if(event.target===this)window.platformCloseAdminModal()">
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
                        <div style="position:relative">
                            <input id="paf-pass" class="pa-input mono" type="password" value="odentara123" required style="padding-right:38px">
                            <button type="button" onclick="const i=document.getElementById('paf-pass');i.type=i.type==='password'?'text':'password';this.querySelector('i').className='fa-solid '+(i.type==='password'?'fa-eye':'fa-eye-slash')" style="position:absolute;right:10px;top:50%;transform:translateY(-50%);background:none;border:none;color:#94a3b8;cursor:pointer;padding:2px"><i class="fa-solid fa-eye"></i></button>
                        </div>
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
    const sb = document.getElementById('pcf-submit-btn');
    if (sb) sb.innerHTML = '<i class="fa-solid fa-check"></i> Crear clínica';
    document.getElementById('pcf-name').value    = '';
    document.getElementById('pcf-slug').value    = '';
    document.getElementById('pcf-phone').value   = '';
    document.getElementById('pcf-email').value   = '';
    document.getElementById('pcf-address').value = '';
    document.getElementById('pcf-plan').value    = '';
    document.getElementById('pcf-notes').value   = '';
    document.getElementById('pcf-dbtype').value  = 'shared';
    const dburlEl = document.getElementById('pcf-dburl');
    if (dburlEl) dburlEl.value = '';
    document.getElementById('pcf-slug').disabled = false;
    document.getElementById('pcf-db-url-section').style.display = 'none';
    document.getElementById('pcf-url-preview').textContent = '______.odentara.com';
    // Campos del superadmin inicial
    document.getElementById('pcf-admin-name').value  = '';
    document.getElementById('pcf-admin-email').value = '';
    document.getElementById('pcf-admin-pass').value  = 'odentara123';
    document.getElementById('pcf-admin-section').style.display = 'block';
    const adminInputs = document.querySelectorAll('#pcf-admin-name, #pcf-admin-email, #pcf-admin-pass');
    adminInputs.forEach(el => el.required = true);
    document.getElementById('platform-clinic-modal').classList.remove('hidden');
};

window.platformEditClinic = function(id) {
    const c = (state._platformClinics || []).find(x => x.id === id);
    if (!c) return;
    document.getElementById('platform-clinic-id').value = id;
    document.getElementById('platform-clinic-modal-title').textContent = 'Editar clínica';
    const sb = document.getElementById('pcf-submit-btn');
    if (sb) sb.innerHTML = '<i class="fa-solid fa-save"></i> Guardar cambios';
    document.getElementById('pcf-name').value    = c.name    || '';
    document.getElementById('pcf-slug').value    = c.slug    || '';
    document.getElementById('pcf-phone').value   = c.phone   || '';
    document.getElementById('pcf-email').value   = c.email   || '';
    document.getElementById('pcf-address').value = c.address || '';
    document.getElementById('pcf-plan').value    = c.plan    || '';
    document.getElementById('pcf-notes').value   = c.notes   || '';
    document.getElementById('pcf-dbtype').value  = c.dbType  || 'shared';
    const dburlEl = document.getElementById('pcf-dburl');
    if (dburlEl) dburlEl.value = c.databaseUrl || '';
    document.getElementById('pcf-slug').disabled = true;
    document.getElementById('pcf-db-url-section').style.display = c.dbType === 'dedicated' ? 'block' : 'none';
    document.getElementById('pcf-url-preview').textContent = `${c.slug}.odentara.com`;
    // Al editar no se crea superadmin
    document.getElementById('pcf-admin-section').style.display = 'none';
    const adminInputs = document.querySelectorAll('#pcf-admin-name, #pcf-admin-email, #pcf-admin-pass');
    adminInputs.forEach(el => el.required = false);
    document.getElementById('platform-clinic-modal').classList.remove('hidden');
};

window.platformCloseClinicModal = function() {
    document.getElementById('platform-clinic-modal').classList.add('hidden');
};

window.platformSaveClinic = async function(e) {
    e.preventDefault();
    const id      = document.getElementById('platform-clinic-id').value;
    const dbType  = document.getElementById('pcf-dbtype').value;
    const dburlEl = document.getElementById('pcf-dburl');
    const dbUrl   = dburlEl ? dburlEl.value.trim() : null;

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

    // Al crear, incluir datos del superadmin inicial
    if (!id) {
        body.adminName     = document.getElementById('pcf-admin-name').value.trim();
        body.adminEmail    = document.getElementById('pcf-admin-email').value.trim();
        body.adminPassword = document.getElementById('pcf-admin-pass').value;
    }

    try {
        const res = id
            ? await apiFetch(`/platform/clinics/${id}`, { method:'PUT',  body:JSON.stringify(body) })
            : await apiFetch('/platform/clinics',        { method:'POST', body:JSON.stringify(body) });
        if (!res.ok) throw new Error(res.error || 'Error al guardar');
        window.platformCloseClinicModal();
        await loadView('platform-clinics', 'Clínicas', { skipSync:true });
        // Toast informativo post-creación
        if (!id) {
            const adminInfo = res.adminUser ? ` · Superadmin: ${res.adminUser.email}` : '';
            showPlatformAlert(`Clínica "${res.clinic.name}" creada${adminInfo}`, 'success');
        } else {
            showPlatformAlert('Clínica actualizada correctamente.', 'success');
        }
    } catch(err) {
        showPlatformAlert(err.message, 'error');
    }
};

window.platformToggleClinic = async function(id) {
    const clinic = (state._platformClinics || []).find(x => x.id === id);
    const isActive = clinic?.active ?? true;
    const action = isActive ? 'desactivar' : 'activar';
    const confirmed = await showConfirm(
        `¿Querés ${action} la clínica "${clinic?.name || id}"? ${isActive ? 'Los usuarios no podrán ingresar mientras esté inactiva.' : ''}`,
        { title: isActive ? 'Desactivar clínica' : 'Activar clínica', variant: isActive ? 'danger' : 'info',
          confirmText: isActive ? 'Sí, desactivar' : 'Sí, activar' }
    );
    if (!confirmed) return;
    try {
        const res = await apiFetch(`/platform/clinics/${id}/toggle`, { method:'PATCH' });
        if (!res.ok) throw new Error(res.error || 'Error');
        await loadView('platform-clinics', 'Clínicas', { skipSync:true });
    } catch(err) {
        showPlatformAlert(err.message, 'error');
    }
};

// Eliminación de clínicas deshabilitada intencionalmente.
// Las clínicas solo pueden desactivarse o archivarse, nunca eliminarse.
window.platformDeleteClinic = function() {
    showPlatformAlert('Las clínicas no pueden eliminarse. Podés desactivarlas o archivarlas.', 'error');
};

window.platformLoginAsClinic = async function(clinicId, clinicName) {
    // Verificar contra el servidor que el token actual pertenece a un platform admin
    try {
        const me = await apiFetch('/auth/me');
        if (!me?.permissions?.isPlatformAdmin) {
            // El token actual no es de platform admin — intentar restaurar desde backup
            const backup = localStorage.getItem('odentara_platform_auth_backup');
            if (backup) {
                const backupAuth = JSON.parse(backup);
                if (backupAuth?.token) {
                    state.authToken = backupAuth.token;
                    const me2 = await apiFetch('/auth/me');
                    if (me2?.permissions?.isPlatformAdmin) {
                        saveAuthSession(backupAuth.token, me2.user);
                        localStorage.removeItem('odentara_platform_auth_backup');
                    } else {
                        showPlatformAlert('No tenés permisos de administrador de plataforma. Iniciá sesión con tu cuenta de plataforma.', 'error');
                        return;
                    }
                } else {
                    showPlatformAlert('No tenés permisos de administrador de plataforma.', 'error');
                    return;
                }
            } else {
                showPlatformAlert(`Esta cuenta (${me?.user?.email || ''}) no es administrador de plataforma. Cerrá sesión e ingresá con la cuenta correcta.`, 'error');
                return;
            }
        }
    } catch(verifyErr) {
        showPlatformAlert('No se pudo verificar la sesión: ' + (verifyErr.message || 'error'), 'error');
        return;
    }

    // Buscar el superadmin de la clínica para mostrarlo en el confirm
    let adminLabel = 'el superadmin';
    try {
        const usersRes = await apiFetch(`/platform/clinics/${clinicId}/users`);
        if (usersRes.ok) {
            const superadmin = (usersRes.users || []).find(u => u.roles.includes('superadmin') && u.active);
            if (superadmin) adminLabel = superadmin.email;
        }
    } catch(_) { /* silencioso */ }

    const confirmed = await showConfirm(
        `Vas a ingresar a "${clinicName}" como <strong>${adminLabel}</strong>. Tu sesión de plataforma quedará guardada y podrás volver desde el banner superior.`,
        { title: 'Ingresar como clínica', variant: 'info', confirmText: 'Ingresar' }
    );
    if (!confirmed) return;
    try {
        const res = await apiFetch('/platform/login-as-clinic', { method: 'POST', body: JSON.stringify({ clinicId }) });
        if (!res.ok) throw new Error(res.error || 'No se pudo ingresar a la clínica.');
        // Guardar token de plataforma para poder volver
        const platformAuth = JSON.parse(localStorage.getItem('odentara_auth_v1') || '{}');
        localStorage.setItem('odentara_platform_auth_backup', JSON.stringify(platformAuth));
        // Aplicar el token de la clínica
        const auth = { token: res.token, user: res.user };
        localStorage.setItem('odentara_auth_v1', JSON.stringify(auth));
        state.user = res.user;
        state.authToken = res.token;
        // Limpiar snapshot de localStorage de la clínica anterior y cargar el de la nueva
        localStorage.removeItem('odentara_db_v6');
        await syncBackendSnapshotToLocalDb();
        applyPlatformTheme(false);
        await loadView('dashboard');
        showToast(`Ingresaste como ${res.user.fullName || res.user.email} en ${clinicName}`, 'success');
    } catch(err) {
        showPlatformAlert(err.message || 'Error al ingresar a la clínica.', 'error');
    }
};

window.returnToPlatform = async function() {
    const backup = localStorage.getItem('odentara_platform_auth_backup');
    if (!backup) return;

    // Revocar el token de clínica actual
    if (state.authToken) {
        try { await apiFetch('/auth/logout', { method: 'POST' }); } catch (_) {}
    }

    const auth = JSON.parse(backup);
    localStorage.removeItem('odentara_platform_auth_backup');
    localStorage.removeItem('odentara_db_v6');

    // Si estamos en subdominio de clínica → redirigir a app.odentara.com con exchange code
    const loginUrl = getAppLoginUrl();
    if (_getCurrentClinicSlug() && loginUrl) {
        state.authToken = auth.token;
        try {
            const exRes = await apiFetch('/auth/exchange', { method: 'POST' });
            if (exRes.ok && exRes.code) {
                window.location.href = `${loginUrl}?__exchange=${encodeURIComponent(exRes.code)}`;
                return;
            }
        } catch (_) {}
        // Fallback: ir a app sin exchange (tendrá que loguearse de nuevo)
        window.location.href = loginUrl;
        return;
    }

    // En app.odentara.com → restaurar sesión directamente
    localStorage.setItem('odentara_auth_v1', backup);
    state.user = mapApiUserToLegacyUser(auth.user);
    state.authToken = auth.token;
    loadView('platform-clinics', 'Clínicas', { skipSync: true });
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
                                    <div class="pa-user-name">${escapeHtml(u.fullName)}</div>
                                    <div class="pa-user-email">${escapeHtml(u.email)}</div>
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

// Filtra la tabla de clínicas del lado del cliente (sin tocar el server)
window.platformFilterClinics = function(term) {
    const t = (term || '').trim().toLowerCase();
    let visible = 0;
    document.querySelectorAll('#pa-clinics-tbody tr[data-clinic-row]').forEach(row => {
        const match = (row.dataset.search || '').includes(t);
        row.style.display = match ? '' : 'none';
        if (match) visible++;
    });
    const countEl = document.getElementById('pa-clinics-count');
    if (countEl) countEl.textContent = `${visible} clínica${visible !== 1 ? 's' : ''}`;
};

// Menú de acciones secundarias por clínica (overflow ⋯)
window.platformCloseRowMenu = function() {
    document.getElementById('pa-row-menu')?.remove();
    document.removeEventListener('click', window.platformCloseRowMenu);
    document.removeEventListener('scroll', window.platformCloseRowMenu, true);
};

window.platformRowMenu = function(event, clinicId) {
    event.stopPropagation();
    const c = (state._platformClinics || []).find(x => x.id === clinicId);
    if (!c) return;
    const btn = event.currentTarget;
    // Si el menú ya está abierto para este botón, alternar (cerrar)
    if (document.getElementById('pa-row-menu')) { window.platformCloseRowMenu(); return; }

    const esc = s => String(s).replace(/'/g, "\\'");
    const menu = document.createElement('div');
    menu.className = 'pa-menu';
    menu.id = 'pa-row-menu';
    menu.innerHTML = `
        <button class="pa-menu-item" onclick="window.platformCloseRowMenu();window.platformViewUsers(${c.id},'${esc(c.name)}')"><i class="fa-solid fa-users"></i> Ver usuarios</button>
        <button class="pa-menu-item" onclick="window.platformCloseRowMenu();window.platformOpenAdminModal(${c.id})"><i class="fa-solid fa-user-plus"></i> Crear admin</button>
        <button class="pa-menu-item" onclick="window.platformCloseRowMenu();window.platformEditClinic(${c.id})"><i class="fa-solid fa-pen"></i> Editar clínica</button>
        <div class="pa-menu-divider"></div>
        <button class="pa-menu-item ${c.active ? 'pa-menu-item-danger' : ''}" onclick="window.platformCloseRowMenu();window.platformToggleClinic(${c.id})">
            <i class="fa-solid ${c.active ? 'fa-ban' : 'fa-circle-check'}"></i> ${c.active ? 'Desactivar' : 'Activar'}
        </button>`;
    document.body.appendChild(menu);

    // Posicionar fijo, alineado a la derecha del botón, sin salirse de la pantalla
    const r = btn.getBoundingClientRect();
    const mw = menu.offsetWidth || 184;
    const mh = menu.offsetHeight || 160;
    let top = r.bottom + 4;
    if (top + mh > window.innerHeight - 8) top = r.top - mh - 4; // abrir hacia arriba si no entra
    menu.style.top = Math.max(8, top) + 'px';
    menu.style.left = Math.max(8, r.right - mw) + 'px';

    // Cerrar al hacer click afuera o al scrollear (en el próximo tick para no capturar este click)
    setTimeout(() => {
        document.addEventListener('click', window.platformCloseRowMenu);
        document.addEventListener('scroll', window.platformCloseRowMenu, true);
    }, 0);
};

function showPlatformAlert(msg, type = 'info') {
    const colors     = { error:'#7f1d1d',  success:'#052e16', info:'#0c1a2e' };
    const textColors = { error:'#fca5a5',  success:'#4ade80', info:'#60a5fa' };
    const icons      = { error:'fa-circle-exclamation', success:'fa-check-circle', info:'fa-info-circle' };
    const toast = document.createElement('div');
    toast.style.cssText = `position:fixed;bottom:24px;right:24px;z-index:99999;background:${colors[type]};border:1px solid ${textColors[type]}22;color:${textColors[type]};padding:12px 18px;border-radius:8px;font-size:12px;display:flex;align-items:center;gap:10px;max-width:340px;box-shadow:0 4px 20px rgba(0,0,0,.5)`;
    toast.innerHTML = `<i class="fa-solid ${icons[type]}"></i><span>${msg}</span>`;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
}

// ── Auditoría ─────────────────────────────────────────────────────────────────
async function renderPlatformAudit(container) {
    injectPlatformStyles();

    if (!window._platformAuditFilters) {
        window._platformAuditFilters = { clinicId:'', userId:'', entityType:'', action:'', dateFrom:'', dateTo:'', page:1 };
    }
    const filters = window._platformAuditFilters;

    let clinics = [];
    try {
        const res = await apiFetch('/platform/clinics');
        if (res.ok) clinics = res.clinics;
    } catch(e) { console.error(e); }

    let users = [];
    if (filters.clinicId) {
        try {
            const res = await apiFetch(`/platform/clinics/${filters.clinicId}/users`);
            if (res.ok) users = res.users;
        } catch(e) { console.error(e); }
    }

    const qs = new URLSearchParams();
    if (filters.clinicId) qs.set('clinicId', filters.clinicId);
    if (filters.userId) qs.set('userId', filters.userId);
    if (filters.entityType) qs.set('entityType', filters.entityType);
    if (filters.action) qs.set('action', filters.action);
    if (filters.dateFrom) qs.set('dateFrom', filters.dateFrom);
    if (filters.dateTo) qs.set('dateTo', filters.dateTo);
    qs.set('page', filters.page || 1);
    qs.set('pageSize', 30);

    let data = { logs: [], total: 0, page: 1, pageSize: 30, entityTypes: [] };
    try {
        const res = await apiFetch(`/platform/audit-logs?${qs.toString()}`);
        if (res.ok) data = res;
    } catch(e) { console.error(e); }

    window._platformAuditLogs = data.logs; // para el modal de detalle

    const ACTION_LABELS = { create:'Creación', update:'Modificación', delete:'Eliminación', login:'Ingreso', logout:'Salida' };
    const ACTION_COLORS = { create:'#34d399', update:'#60a5fa', delete:'#f87171', login:'#a5b4fc', logout:'#94a3b8' };

    const rows = data.logs.map(log => {
        const color = ACTION_COLORS[log.action] || '#94a3b8';
        const label = ACTION_LABELS[log.action] || log.action;
        return `<tr>
            <td style="font-size:11px;color:#475569;white-space:nowrap">${new Date(log.createdAt).toLocaleString('es-AR')}</td>
            <td style="font-size:12px;color:#e2e8f0">${escapeHtml(log.clinicName || '—')}</td>
            <td>
                <div style="font-size:12px;font-weight:600;color:#e2e8f0">${escapeHtml(log.user?.fullName || '—')}</div>
                <div style="font-size:10px;color:#475569">${escapeHtml(log.user?.email || '')}</div>
            </td>
            <td><span class="pa-badge" style="background:${color}22;color:${color};border:1px solid ${color}44">${label}</span></td>
            <td style="font-size:12px;color:#94a3b8">${escapeHtml(log.entityType)}</td>
            <td style="font-size:11px;color:#475569;font-family:'JetBrains Mono','Fira Mono',monospace">#${escapeHtml(String(log.entityId))}</td>
            <td style="text-align:right">
                <button class="pa-btn pa-btn-ghost pa-btn-sm pa-btn-icon" title="Ver detalle" onclick="window.platformShowAuditDetail(${log.id})"><i class="fa-solid fa-eye"></i></button>
            </td>
        </tr>`;
    }).join('');

    const totalPages = Math.max(1, Math.ceil(data.total / data.pageSize));
    const currentPage = data.page || 1;

    const clinicOptions = clinics.map(c => `<option value="${c.id}" ${String(c.id)===String(filters.clinicId)?'selected':''}>${escapeHtml(c.name)}</option>`).join('');
    const userOptions = users.map(u => `<option value="${u.id}" ${String(u.id)===String(filters.userId)?'selected':''}>${escapeHtml(u.fullName)}</option>`).join('');
    const entityOptions = (data.entityTypes || []).map(t => `<option value="${t}" ${t===filters.entityType?'selected':''}>${escapeHtml(t)}</option>`).join('');
    const hasFilters = !!(filters.clinicId || filters.userId || filters.entityType || filters.action || filters.dateFrom || filters.dateTo);

    container.innerHTML = `
    <div class="pa-root">
        ${renderPlatformShell('platform-audit', `
            <div class="pa-page-header">
                <div>
                    <div class="pa-page-title">Auditoría</div>
                    <div class="pa-page-sub">${data.total} movimiento${data.total !== 1 ? 's' : ''} hacia la base de datos</div>
                </div>
            </div>

            <div class="pa-toolbar" style="flex-wrap:wrap;row-gap:10px">
                <select class="pa-select" style="max-width:190px" onchange="window.platformAuditSetFilter('clinicId', this.value)">
                    <option value="">Todas las clínicas</option>
                    ${clinicOptions}
                </select>
                <select class="pa-select" style="max-width:190px" onchange="window.platformAuditSetFilter('userId', this.value)" ${!filters.clinicId ? 'disabled title="Elegí una clínica primero"' : ''}>
                    <option value="">Todos los usuarios</option>
                    ${userOptions}
                </select>
                <select class="pa-select" style="max-width:160px" onchange="window.platformAuditSetFilter('entityType', this.value)">
                    <option value="">Todo tipo</option>
                    ${entityOptions}
                </select>
                <select class="pa-select" style="max-width:150px" onchange="window.platformAuditSetFilter('action', this.value)">
                    <option value="">Toda acción</option>
                    <option value="create" ${filters.action==='create'?'selected':''}>Creación</option>
                    <option value="update" ${filters.action==='update'?'selected':''}>Modificación</option>
                    <option value="delete" ${filters.action==='delete'?'selected':''}>Eliminación</option>
                </select>
                <input type="date" class="pa-input" style="max-width:150px" value="${filters.dateFrom || ''}" onchange="window.platformAuditSetFilter('dateFrom', this.value)">
                <input type="date" class="pa-input" style="max-width:150px" value="${filters.dateTo || ''}" onchange="window.platformAuditSetFilter('dateTo', this.value)">
                ${hasFilters ? `<button class="pa-btn pa-btn-ghost pa-btn-sm" onclick="window.platformAuditClearFilters()"><i class="fa-solid fa-xmark"></i> Limpiar</button>` : ''}
            </div>

            <div class="pa-table-wrap">
                <table class="pa-table pa-table-audit">
                    <thead><tr>
                        <th>Fecha</th><th>Clínica</th><th>Usuario</th><th>Acción</th><th>Entidad</th><th>ID</th><th></th>
                    </tr></thead>
                    <tbody>
                        ${rows || `<tr><td colspan="7"><div class="pa-empty"><i class="fa-solid fa-clipboard-list"></i><p>No hay movimientos registrados con estos filtros.</p></div></td></tr>`}
                    </tbody>
                </table>
            </div>

            <div class="pa-toolbar" style="margin-top:14px">
                <button class="pa-btn pa-btn-ghost pa-btn-sm" ${currentPage<=1?'disabled':''} onclick="window.platformAuditGoPage(${currentPage-1})"><i class="fa-solid fa-chevron-left"></i> Anterior</button>
                <span class="pa-toolbar-count">Página ${currentPage} de ${totalPages}</span>
                <button class="pa-btn pa-btn-ghost pa-btn-sm" ${currentPage>=totalPages?'disabled':''} onclick="window.platformAuditGoPage(${currentPage+1})">Siguiente <i class="fa-solid fa-chevron-right"></i></button>
            </div>
        `)}
    </div>`;
}

window.platformAuditSetFilter = function(key, value) {
    window._platformAuditFilters = window._platformAuditFilters || {};
    window._platformAuditFilters[key] = value;
    if (key === 'clinicId') window._platformAuditFilters.userId = ''; // resetear usuario al cambiar de clínica
    window._platformAuditFilters.page = 1;
    loadView('platform-audit', 'Auditoría', { skipSync: true });
};

window.platformAuditClearFilters = function() {
    window._platformAuditFilters = { clinicId:'', userId:'', entityType:'', action:'', dateFrom:'', dateTo:'', page:1 };
    loadView('platform-audit', 'Auditoría', { skipSync: true });
};

window.platformAuditGoPage = function(page) {
    if (page < 1) return;
    window._platformAuditFilters.page = page;
    loadView('platform-audit', 'Auditoría', { skipSync: true });
};

window.platformShowAuditDetail = function(id) {
    const log = (window._platformAuditLogs || []).find(l => l.id === id);
    if (!log) return;
    const overlay = document.createElement('div');
    overlay.className = 'pa-modal-overlay';
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
    overlay.innerHTML = `
        <div class="pa-modal" style="max-width:640px">
            <div class="pa-modal-header">
                <span class="pa-modal-title">Detalle del movimiento #${log.id}</span>
                <button class="pa-modal-close" onclick="this.closest('.pa-modal-overlay').remove()"><i class="fa-solid fa-xmark"></i></button>
            </div>
            <div class="pa-modal-body">
                <div style="font-size:11px;color:#475569;margin-bottom:10px">
                    ${new Date(log.createdAt).toLocaleString('es-AR')} · ${escapeHtml(log.entityType)} #${escapeHtml(String(log.entityId))} · ${escapeHtml(log.clinicName || 'Sin clínica')}
                </div>
                ${log.beforeData ? `<div class="pa-label" style="margin-top:10px">Antes</div><pre style="background:#0a0d14;border:1px solid #1e2535;border-radius:8px;padding:12px;font-size:11px;color:#94a3b8;overflow:auto;max-height:220px">${escapeHtml(JSON.stringify(log.beforeData, null, 2))}</pre>` : ''}
                ${log.afterData ? `<div class="pa-label" style="margin-top:10px">Después</div><pre style="background:#0a0d14;border:1px solid #1e2535;border-radius:8px;padding:12px;font-size:11px;color:#94a3b8;overflow:auto;max-height:220px">${escapeHtml(JSON.stringify(log.afterData, null, 2))}</pre>` : ''}
            </div>
        </div>`;
    document.body.appendChild(overlay);
};

// ── Fin Ultra-Admin Views ─────────────────────────────────────────────────────
