// =============================================================================
// announcements.js — Avisos de plataforma dentro de la app
// Los publica el administrador desde el panel y los ve todo el equipo de todas
// las clínicas. Se traen en el refresco periódico que ya existe, así que un
// aviso publicado aparece solo, sin recargar.
// Depende de: api.js (apiFetch), state.js, utils.js (escapeHtml)
// =============================================================================

const ANNOUNCEMENT_DISMISSED_KEY = 'odentara_announcements_dismissed';

const ANNOUNCEMENT_STYLES = {
    info:    { bg: '#eff6ff', border: '#bfdbfe', text: '#1e40af', icon: 'fa-circle-info' },
    warning: { bg: '#fffbeb', border: '#fde68a', text: '#92400e', icon: 'fa-triangle-exclamation' },
    urgent:  { bg: '#fef2f2', border: '#fecaca', text: '#991b1b', icon: 'fa-circle-exclamation' },
};

function getDismissedAnnouncements() {
    try {
        const raw = JSON.parse(localStorage.getItem(ANNOUNCEMENT_DISMISSED_KEY));
        return Array.isArray(raw) ? raw : [];
    } catch (_e) {
        return [];
    }
}

// Se descarta por usuario y navegador, no en el servidor: el aviso es el mismo
// para todos y guardar un estado por persona no justifica una tabla.
window.dismissAnnouncement = function(id) {
    const dismissed = getDismissedAnnouncements();
    if (!dismissed.includes(id)) {
        dismissed.push(id);
        // Se recorta para que la lista no crezca sin límite con el tiempo.
        localStorage.setItem(ANNOUNCEMENT_DISMISSED_KEY, JSON.stringify(dismissed.slice(-50)));
    }
    const node = document.querySelector(`[data-announcement="${id}"]`);
    if (node) node.remove();
};

function renderAnnouncements(announcements) {
    const host = document.getElementById('platform-announcements');
    if (!host) return;

    const dismissed = getDismissedAnnouncements();
    const visibles = (announcements || []).filter(a => !(a.dismissible && dismissed.includes(a.id)));

    // Se compara antes de tocar el DOM: este render corre en cada refresco y
    // reescribirlo siempre haría parpadear la barra cada 20 segundos.
    const firma = visibles.map(a => `${a.id}:${a.level}`).join('|');
    if (host.dataset.firma === firma) return;
    host.dataset.firma = firma;

    if (visibles.length === 0) {
        host.innerHTML = '';
        return;
    }

    host.innerHTML = visibles.map(a => {
        const s = ANNOUNCEMENT_STYLES[a.level] || ANNOUNCEMENT_STYLES.info;
        const cerrar = a.dismissible
            ? `<button onclick="dismissAnnouncement(${a.id})" title="Cerrar aviso"
                 style="background:none;border:none;color:${s.text};opacity:.6;cursor:pointer;padding:2px 4px;font-size:14px;line-height:1">&times;</button>`
            : '';
        return `
        <div data-announcement="${a.id}" style="display:flex;align-items:center;gap:10px;padding:9px 16px;background:${s.bg};border-bottom:1px solid ${s.border};color:${s.text};font-size:13px">
            <i class="fa-solid ${s.icon}" style="flex-shrink:0"></i>
            <span style="flex:1;line-height:1.45">${escapeHtml(a.message)}</span>
            ${cerrar}
        </div>`;
    }).join('');
}

async function refreshAnnouncements() {
    if (!state.authToken) return;
    try {
        const res = await apiFetch('/announcements');
        renderAnnouncements(res.announcements || []);
    } catch (_e) {
        // Silencioso a propósito: que falle traer un aviso no debe molestar a
        // quien está trabajando ni ensuciar la pantalla con un error.
    }
}
