/**
 * Límites, features y precios por plan de Odentara.
 *
 * La configuración vive en la tabla `Plan` y se administra desde el panel de
 * plataforma. Acá se mantiene un snapshot en memoria porque estas funciones se
 * consultan en medio de handlers ya escritos de forma sincrónica: volverlas
 * asíncronas obligaría a agregar `await` en 16 llamadas repartidas en 6
 * archivos, y una sola omisión sería peligrosa —`getAiExtractionLimit(plan) === 0`
 * comparado contra una Promise da falso y habilitaría la IA en un plan que no
 * la incluye—. Con el snapshot, ninguna llamada cambia.
 *
 * El snapshot se refresca con un TTL corto en vez de cachearse para siempre
 * porque la app corre en varios procesos worker: si un worker se guardara el
 * precio viejo indefinidamente, dos clínicas verían importes distintos según
 * qué worker las atienda.
 *
 * `null`/`""` como plan = clínica sin plan asignado (prueba/desarrollo), sin
 * límites.
 */

const prisma = require("./prisma");

// Valores de respaldo, iguales a los que se insertan en la migración. Se usan
// si todavía no se cargó nada de la base o si la consulta falla: es preferible
// seguir operando con los límites conocidos antes que romper la app entera.
const FALLBACK_PLANS = {
  inicial: {
    label: "Inicial", priceMonthly: 45000, currency: "ARS",
    professionals: 1,
    adminUsers: false,        // no puede crear usuarios admin/secretary
    clinicalImages: false,    // sin imágenes clínicas
    billing: false,           // sin facturación
    aiExtractions: 0,         // sin importación con IA — solo carga manual
  },
  clinica: {
    label: "Clínica", priceMonthly: 75000, currency: "ARS",
    professionals: 3,
    adminUsers: true,
    clinicalImages: true,
    billing: true,
    aiExtractions: 100,
  },
  pro: {
    label: "Pro", priceMonthly: 125000, currency: "ARS",
    professionals: Infinity,
    adminUsers: true,
    clinicalImages: true,
    billing: true,
    aiExtractions: 500,
  },
};

const PLAN_CACHE_TTL_MS = 30_000;
let PLAN_CONFIG = { ...FALLBACK_PLANS };
let _loadedAt = 0;
let _loading = null;

// -1 en la base significa "ilimitado"; en memoria se representa como Infinity
// para que las comparaciones (`currentCount >= limit`) sigan funcionando igual.
function fromDbNumber(value) {
  return value === -1 ? Infinity : value;
}

function rowToConfig(row) {
  return {
    label: row.label,
    priceMonthly: Number(row.priceMonthly),
    currency: row.currency,
    professionals: fromDbNumber(row.professionals),
    aiExtractions: fromDbNumber(row.aiExtractions),
    adminUsers: row.adminUsers,
    clinicalImages: row.clinicalImages,
    billing: row.billing,
    sortOrder: row.sortOrder,
  };
}

/** Recarga el snapshot desde la base. Devuelve el snapshot vigente. */
async function refreshPlans() {
  try {
    const rows = await prisma.plan.findMany({ orderBy: { sortOrder: "asc" } });
    if (rows.length > 0) {
      const next = {};
      for (const row of rows) next[row.code] = rowToConfig(row);
      PLAN_CONFIG = next;
    }
    _loadedAt = Date.now();
  } catch (error) {
    // Se conserva el snapshot anterior (o el de respaldo) y se reintenta en la
    // próxima consulta: quedarse sin límites sería peor que usar datos de hace
    // unos segundos.
    console.error("[plan-limits] No se pudieron cargar los planes:", error.message);
    _loadedAt = Date.now();
  }
  return PLAN_CONFIG;
}

/**
 * Dispara una recarga en segundo plano si el snapshot venció. No bloquea: quien
 * llama sigue con los valores actuales y el próximo request ya usa los nuevos.
 */
function ensureFreshPlans() {
  if (Date.now() - _loadedAt < PLAN_CACHE_TTL_MS) return;
  if (_loading) return;
  _loading = refreshPlans().finally(() => { _loading = null; });
}

/** Snapshot actual, ya cargado. Para las pantallas que muestran los planes. */
function getAllPlans() {
  ensureFreshPlans();
  return PLAN_CONFIG;
}

/** Precio mensual vigente del plan (0 si no existe). */
function getPlanPrice(plan) {
  return getPlanConfig(plan).priceMonthly || 0;
}

// Clínicas sin plan (prueba/desarrollo) — sin límites.
const UNLIMITED_CONFIG = {
  professionals: Infinity,
  adminUsers: true,
  clinicalImages: true,
  billing: true,
  aiExtractions: Infinity,
};

/** Devuelve la config del plan, o defaults sin límites si no tiene plan asignado. */
function getPlanConfig(plan) {
  // Punto de entrada de todas las comprobaciones de plan: acá se dispara la
  // recarga si el snapshot venció. No bloquea — devuelve los valores actuales y
  // el próximo request ya usa los recién leídos.
  ensureFreshPlans();
  // "Sin plan" y "plan que no existe" son cosas distintas y antes caian las dos
  // en UNLIMITED_CONFIG. Un codigo con un espacio de mas, un typo al cargarlo o
  // un plan renombrado desde el panel dejaba a esa clinica con Pro gratis,
  // incluidas las extracciones de IA, que son las que tienen costo por uso.
  if (plan === null || plan === undefined || plan === "") return UNLIMITED_CONFIG;

  const config = PLAN_CONFIG[plan];
  if (config) return config;

  // Fail closed: el plan mas restrictivo. Y se avisa, porque llegar aca significa
  // que hay una clinica apuntando a un plan inexistente.
  console.error(`[plan-limits] Plan desconocido "${plan}": se aplica el mas restrictivo.`);
  return PLAN_CONFIG.inicial || FALLBACK_PLANS.inicial;
}

/** Límite mensual de extracciones por IA del plan (0 = no incluido, Infinity = sin plan). */
function getAiExtractionLimit(plan) {
  return getPlanConfig(plan).aiExtractions;
}

/** Mes actual en formato "YYYY-MM" (para resetear la cuota mensual). */
function currentUsageMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Normaliza el objeto aiUsage al mes actual. Si el mes guardado no es el actual,
 * arranca de cero. Devuelve { month, count }.
 */
function normalizeAiUsage(rawUsage) {
  const month = currentUsageMonth();
  if (rawUsage && typeof rawUsage === "object" && rawUsage.month === month) {
    return { month, count: Number(rawUsage.count) || 0 };
  }
  return { month, count: 0 };
}

/**
 * Estado de la cuota de IA de una clínica.
 * @returns {{ allowed: boolean, limit: number, used: number, remaining: number, reason?: string }}
 */
function getAiQuotaStatus(plan, rawUsage) {
  const limit = getAiExtractionLimit(plan);
  if (limit === 0) {
    return { allowed: false, limit: 0, used: 0, remaining: 0, reason: "plan-not-included" };
  }
  const usage = normalizeAiUsage(rawUsage);
  const remaining = limit === Infinity ? Infinity : Math.max(0, limit - usage.count);
  return {
    allowed: remaining > 0,
    limit,
    used: usage.count,
    remaining,
    ...(remaining > 0 ? {} : { reason: "monthly-limit-reached" }),
  };
}

/**
 * Verifica si la clínica puede agregar un profesional más.
 * @param {string|null} plan
 * @param {number} currentCount — profesionales activos actuales
 * @returns {{ allowed: boolean, error?: string }}
 */
function checkProfessionalLimit(plan, currentCount) {
  const config = getPlanConfig(plan);
  if (currentCount >= config.professionals) {
    const limit = config.professionals;
    return {
      allowed: false,
      error: `Tu plan ${formatPlan(plan)} permite hasta ${limit} profesional${limit !== 1 ? 'es' : ''}. Para agregar más, actualizá tu plan.`,
    };
  }
  return { allowed: true };
}

/**
 * Verifica si la clínica puede crear usuarios admin/secretary.
 * @param {string|null} plan
 * @returns {{ allowed: boolean, error?: string }}
 */
function checkAdminUserLimit(plan) {
  const config = getPlanConfig(plan);
  if (!config.adminUsers) {
    return {
      allowed: false,
      error: `El plan ${formatPlan(plan)} no incluye usuarios administrativos. Solo podés usar el superadmin de la clínica. Actualizá al plan Clínica para agregar secretarias y admins.`,
    };
  }
  return { allowed: true };
}

/**
 * Verifica si la clínica puede usar imágenes clínicas.
 * @param {string|null} plan
 * @returns {{ allowed: boolean, error?: string }}
 */
function checkClinicalImagesFeature(plan) {
  const config = getPlanConfig(plan);
  if (!config.clinicalImages) {
    return {
      allowed: false,
      error: `Las imágenes clínicas no están incluidas en el plan ${formatPlan(plan)}. Actualizá al plan Clínica o Pro.`,
    };
  }
  return { allowed: true };
}

/**
 * Verifica si la clínica puede usar facturación.
 * @param {string|null} plan
 * @returns {{ allowed: boolean, error?: string }}
 */
function checkBillingFeature(plan) {
  const config = getPlanConfig(plan);
  if (!config.billing) {
    return {
      allowed: false,
      error: `La facturación y caja no están incluidas en el plan ${formatPlan(plan)}. Actualizá al plan Clínica o Pro.`,
    };
  }
  return { allowed: true };
}

function formatPlan(plan) {
  const names = { inicial: 'Inicial', clinica: 'Clínica', pro: 'Pro' };
  return names[plan] || plan || 'actual';
}

module.exports = {
  getPlanConfig,
  getAllPlans,
  getPlanPrice,
  refreshPlans,
  formatPlan,
  checkProfessionalLimit,
  checkAdminUserLimit,
  checkClinicalImagesFeature,
  checkBillingFeature,
  getAiExtractionLimit,
  getAiQuotaStatus,
  normalizeAiUsage,
  currentUsageMonth,
};
