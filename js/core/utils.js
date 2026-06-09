// =============================================================================
// utils.js — Funciones utilitarias puras
// Sin dependencias externas. No accede a `state`, DOM ni APIs.
// =============================================================================

// -----------------------------------------------------------------------------
// Encoding / Mojibake
// -----------------------------------------------------------------------------

const MOJIBAKE_REPAIRS = [
    ['ContraseÃ±a', 'Contraseña'],
    ['ContraseÃƒÂ±a', 'Contraseña'],
    ['contraseÃ±a', 'contraseña'],
    ['contraseÃƒÂ±a', 'contraseña'],
    ['Centro odontolÃ³gico', 'Centro odontológico'],
    ['Centro odontolÃƒÂ³gico', 'Centro odontológico'],
    ['Cerrar sesiÃ³n', 'Cerrar sesión'],
    ['Cerrar sesiÃƒÂ³n', 'Cerrar sesión'],
    ['Horarios MÃ©dicos', 'Horarios Médicos'],
    ['Horarios MÃƒÂ©dicos', 'Horarios Médicos'],
    ['FacturaciÃ³n', 'Facturación'],
    ['FacturaciÃƒÂ³n', 'Facturación'],
    ['ConfiguraciÃ³n', 'Configuración'],
    ['ConfiguraciÃƒÂ³n', 'Configuración'],
    ['Historias ClÃ­nicas', 'Historias Clínicas'],
    ['Historias ClÃƒÂ­nicas', 'Historias Clínicas'],
    ['RecepciÃ³n', 'Recepción'],
    ['RecepciÃƒÂ³n', 'Recepción'],
    ['GestiÃ³n de Turnos', 'Gestión de Turnos'],
    ['GestiÃƒÂ³n de Turnos', 'Gestión de Turnos'],
    ['Agendas MÃ©dicas', 'Agendas Médicas'],
    ['Agendas MÃƒÂ©dicas', 'Agendas Médicas'],
    ['SecretarÃ­a', 'Secretaría'],
    ['SecretarÃƒÂ­a', 'Secretaría'],
    ['Completa email y contraseÃ±a.', 'Completa email y contraseña.'],
    ['Completa email y contraseÃƒÂ±a.', 'Completa email y contraseña.'],
    ['No se pudo iniciar sesiÃ³n.', 'No se pudo iniciar sesión.'],
    ['No se pudo iniciar sesiÃƒÂ³n.', 'No se pudo iniciar sesión.'],
    ['Se inyecta despuÃ©s', 'Se inyecta después'],
    ['Se inyecta despuÃƒÂ©s', 'Se inyecta después'],
    ['MÃ³dulo', 'Módulo'],
    ['MÃƒÂ³dulo', 'Módulo'],
    ['TelÃ©fono', 'Teléfono'],
    ['TelÃƒÂ©fono', 'Teléfono'],
    ['Tel�fono', 'Teléfono'],
    ['M�dicas', 'Médicas'],
    ['Cl�nica', 'Clínica'],
    ['AcciÃƒÂ³n', 'Acción'],
    ['AcciÃƒÆ\'Ã‚n', 'Acción'],
    ['AcciÃ³n', 'Acción'],
    ['OdontologÃ­a', 'Odontología'],
    ['OdontologÃƒÂ­a', 'Odontología'],
    ['odontolÃ³gica', 'odontológica'],
    ['odontolÃƒÂ³gica', 'odontológica'],
    ['odontolÃ³gico', 'odontológico'],
    ['odontolÃƒÂ³gico', 'odontológico'],
    ['AtenciÃ³n', 'Atención'],
    ['AtenciÃƒÂ³n', 'Atención'],
    ['dÃ­as', 'días'],
    ['dÃƒÂ­as', 'días'],
    ['dÃ­a', 'día'],
    ['dÃƒÂ­a', 'día'],
    ['pasÃ³', 'pasó'],
    ['pasÃƒÂ³', 'pasó'],
    ['vÃ¡lido', 'válido'],
    ['vÃƒÂ¡lido', 'válido'],
    ['MiÃ©rcoles', 'Miércoles'],
    ['MiÃƒÂ©rcoles', 'Miércoles'],
    ['SÃ¡bado', 'Sábado'],
    ['SÃƒÂ¡bado', 'Sábado'],
    ['MiÃ©', 'Mié'],
    ['MiÃƒÂ©', 'Mié'],
    ['SÃ¡b', 'Sáb'],
    ['SÃƒÂ¡b', 'Sáb'],
    ['quÃ©', 'qué'],
    ['quÃƒÂ©', 'qué'],
    ['PrÃ³ximos Turnos', 'Próximos Turnos'],
    ['PrÃƒÂ³ximos Turnos', 'Próximos Turnos'],
    ['DÃ­a', 'Día'],
    ['DÃƒÂ­a', 'Día'],
    ['D�a', 'Día'],
    ['Transacción', 'Transacción'],
    ['TransacciÃƒÂ³n', 'Transacción'],
    ['DescripciÃ³n', 'Descripción'],
    ['DescripciÃƒÂ³n', 'Descripción'],
    ['MÃ©dicas', 'Médicas'],
    ['MÃƒÂ©dicas', 'Médicas'],
    ['MÃ©dico', 'Médico'],
    ['MÃƒÂ©dico', 'Médico'],
    ['ClÃ­nica', 'Clínica'],
    ['ClÃƒÂ­nica', 'Clínica'],
    ['clÃ­nica', 'clínica'],
    ['clÃƒÂ­nica', 'clínica'],
    ['Ficha OdontolÃ³gica', 'Ficha Odontológica'],
    ['Ficha OdontolÃƒÂ³gica', 'Ficha Odontológica'],
    ['aÃ±os', 'años'],
    ['aÃƒÂ±os', 'años'],
    ['NÂ°', 'N°'],
    ['NÂº', 'Nº'],
    ['N�', 'N°'],
    ['Circulo OdontolÃ³gico', 'Círculo Odontológico'],
    ['CÃ­rculo OdontolÃ³gico', 'Círculo Odontológico'],
    ['Circulo OdontolÃƒÂ³gico', 'Círculo Odontológico'],
    ['CÃƒÂ­rculo OdontolÃƒÂ³gico', 'Círculo Odontológico'],
    ['Ficha ClÃ­nica OdontolÃ³gica', 'Ficha Clínica Odontológica'],
    ['Ficha ClÃƒÂ­nica OdontolÃƒÂ³gica', 'Ficha Clínica Odontológica'],
    ['RestauraciÃ³n', 'Restauración'],
    ['RestauraciÃƒÂ³n', 'Restauración'],
    ['AÃ±adir', 'Añadir'],
    ['AÃƒÂ±adir', 'Añadir'],
    ['AutorizaciÃ³n', 'Autorización'],
    ['AutorizaciÃƒÂ³n', 'Autorización'],
    ['CÃ³digo', 'Código'],
    ['CÃƒÂ³digo', 'Código'],
    ['vacÃ­o', 'vacío'],
    ['vacÃƒÂ­o', 'vacío'],
    ['podrÃ¡n', 'podrán'],
    ['podrÃƒÂ¡n', 'podrán'],
    ['segÃºn', 'según'],
    ['segÃƒÂºn', 'según'],
    ['LÃ³pez', 'López'],
    ['LÃƒÂ³pez', 'López'],
    ['MartÃ­nez', 'Martínez'],
    ['MartÃƒÂ­nez', 'Martínez'],
    ['GÃ³mez', 'Gómez'],
    ['GÃƒÂ³mez', 'Gómez'],
    ['MarÃ­a', 'María'],
    ['MarÃƒÂ­a', 'María'],
    ['PÃ©rez', 'Pérez'],
    ['PÃƒÂ©rez', 'Pérez'],
    ['SÃ¡nchez', 'Sánchez'],
    ['SÃƒÂ¡nchez', 'Sánchez'],
    ['RamÃ­rez', 'Ramírez'],
    ['RamÃƒÂ­rez', 'Ramírez'],
    ['SofÃ­a', 'Sofía'],
    ['SofÃƒÂ­a', 'Sofía'],
    ['MartÃ­n', 'Martín'],
    ['MartÃƒÂ­n', 'Martín'],
    ['Ãlvarez', 'Álvarez'],
    ['ÃƒÂlvarez', 'Álvarez'],
    ['LucÃ­a', 'Lucía'],
    ['LucÃƒÂ­a', 'Lucía'],
    ['FernÃ¡ndez', 'Fernández'],
    ['FernÃƒÂ¡ndez', 'Fernández'],
    ['MedifÃ©', 'Medifé'],
    ['MedifÃƒÂ©', 'Medifé'],
    ['CÃ³rdoba', 'Córdoba'],
    ['CÃƒÂ³rdoba', 'Córdoba'],
    ['EstrÃ©s', 'Estrés'],
    ['EstrÃƒÂ©s', 'Estrés'],
    ['DiabÃ©tico', 'Diabético'],
    ['DiabÃƒÂ©tico', 'Diabético'],
    ['Especialidad', 'Especialidad'],
    ['DuraciÃ³n', 'Duración'],
    ['DuraciÃƒÂ³n', 'Duración'],
    ['Observaciones Médicas / Alergias', 'Observaciones Médicas / Alergias'],
    ['Historia ClÃ­nica', 'Historia Clínica'],
    ['Historia ClÃƒÂ­nica', 'Historia Clínica'],
    ['ConstrucciÃ³n', 'Construcción'],
    ['ConstrucciÃƒÂ³n', 'Construcción'],
    ['Ã±', 'ñ'],
    ['ÃƒÂ±', 'ñ'],
    ['Ã¡', 'á'],
    ['ÃƒÂ¡', 'á'],
    ['Ã©', 'é'],
    ['ÃƒÂ©', 'é'],
    ['Ã­', 'í'],
    ['ÃƒÂ­', 'í'],
    ['Ã³', 'ó'],
    ['ÃƒÂ³', 'ó'],
    ['Ãº', 'ú'],
    ['ÃƒÂº', 'ú'],
    ['Ã', 'Á'],
    ['ÃƒÂ', 'Á'],
    ['Ã', 'É'],
    ['Ãƒâ€°', 'É'],
    ['Ã', 'Í'],
    ['ÃƒÂ', 'Í'],
    ['Ã"', 'Ó'],
    ['Ãƒâ€œ', 'Ó'],
    ['Ãš', 'Ú'],
    ['ÃƒÅ¡', 'Ú'],
    ['Â¿', '¿'],
    ['Â¡', '¡'],
    ['Â·', '·'],
    ['â†\'', '→'],
    ['â€"', '–'],
    ['�', '']
];

function repairMojibakeString(value) {
    if (typeof value !== 'string' || !value) return value;
    let repaired = value;
    for (let pass = 0; pass < 4; pass += 1) {
        let changedInPass = false;
        for (const [from, to] of MOJIBAKE_REPAIRS) {
            if (repaired.includes(from)) {
                repaired = repaired.split(from).join(to);
                changedInPass = true;
            }
        }
        if (!changedInPass) break;
    }
    repaired = repaired
        .replace(/\?\s*Eliminar/g, '¿Eliminar')
        .replace(/^\?/, '¿')
        .replace(/\s+\?/g, '?');
    return repaired;
}

function repairDomText(root = document.body) {
    if (!root) return;

    const textWalker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let textNode = textWalker.nextNode();
    while (textNode) {
        const repaired = repairMojibakeString(textNode.nodeValue);
        if (repaired !== textNode.nodeValue) textNode.nodeValue = repaired;
        textNode = textWalker.nextNode();
    }

    root.querySelectorAll?.('*').forEach((el) => {
        ['title', 'placeholder', 'aria-label', 'value'].forEach((attr) => {
            if (!el.hasAttribute(attr)) return;
            const current = el.getAttribute(attr);
            const repaired = repairMojibakeString(current);
            if (repaired !== current) el.setAttribute(attr, repaired);
        });
    });
}

// -----------------------------------------------------------------------------
// HTML / XSS
// -----------------------------------------------------------------------------

const _HTML_ESCAPE_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

function escapeHtml(value) {
    return repairMojibakeString(String(value ?? '')).replace(/[&<>"']/g, (c) => _HTML_ESCAPE_MAP[c]);
}

// -----------------------------------------------------------------------------
// Colores
// -----------------------------------------------------------------------------

function normalizeHexColor(value, fallback = '#6366f1') {
    const raw = String(value || '').trim();
    if (/^#[0-9a-fA-F]{6}$/.test(raw)) return raw.toLowerCase();
    if (/^#[0-9a-fA-F]{3}$/.test(raw)) {
        const [, r, g, b] = raw;
        return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
    }
    return fallback;
}

function getContrastingTextColor(hexColor) {
    const hex = normalizeHexColor(hexColor, '#6366f1');
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.62 ? '#111827' : '#ffffff';
}

// -----------------------------------------------------------------------------
// Normalización de datos
// -----------------------------------------------------------------------------

function normalizeIdentityEmail(email = '') {
    return String(email).trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function normalizeDni(dni = '') {
    return String(dni).replace(/\D/g, '');
}

function normalizePatientName(name = '') {
    return String(name)
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/\s+/g, ' ');
}

// -----------------------------------------------------------------------------
// Fechas y tiempo (zona horaria del negocio: America/Buenos_Aires)
// -----------------------------------------------------------------------------

const BUSINESS_TIME_ZONE = 'America/Buenos_Aires';

function getBusinessNowParts() {
    const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: BUSINESS_TIME_ZONE,
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
    });
    const parts = formatter.formatToParts(new Date());
    const v = Object.fromEntries(parts.map((p) => [p.type, p.value]));
    return {
        year: Number(v.year), month: Number(v.month), day: Number(v.day),
        hour: Number(v.hour), minute: Number(v.minute)
    };
}

function getTodayIsoLocal() {
    const { year, month, day } = getBusinessNowParts();
    return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function formatDateToLocalIso(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function parseLocalIsoDate(dateStr) {
    if (!dateStr) return new Date();
    const [year, month, day] = String(dateStr).split('-').map(Number);
    return new Date(year, (month || 1) - 1, day || 1);
}

function timeToMinutes(timeStr = '') {
    const [hours, minutes] = timeStr.split(':').map(Number);
    if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
    return hours * 60 + minutes;
}

function getCurrentMinutes() {
    const { hour, minute } = getBusinessNowParts();
    return hour * 60 + minute;
}

function isPastDate(dateStr) {
    return Boolean(dateStr) && dateStr < getTodayIsoLocal();
}

function isTodayDate(dateStr) {
    return Boolean(dateStr) && dateStr === getTodayIsoLocal();
}

function normalizeDateLabel(str) {
    if (!str) return str;
    const s = str.toLowerCase();
    return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatDashboardDateLabel(dateStr) {
    if (!dateStr) return '';
    const date = parseLocalIsoDate(dateStr);
    return normalizeDateLabel(date.toLocaleDateString('es-AR', {
        weekday: 'long', day: 'numeric', month: 'long'
    }));
}

// -----------------------------------------------------------------------------
// Misceláneas
// -----------------------------------------------------------------------------

function deepClone(value) {
    return JSON.parse(JSON.stringify(value));
}
