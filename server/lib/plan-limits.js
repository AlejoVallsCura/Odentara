/**
 * Límites y features por plan de Odentara.
 *
 * Plans:
 *   inicial  — USD 29/mes  — 1 profesional, sin usuarios admin, sin imágenes ni facturación
 *   clinica  — USD 49/mes  — 3 profesionales, usuarios admin, todo incluido
 *   pro      — USD 89/mes  — ilimitados, todo incluido
 *   null/""  — sin plan    — sin límites (clínicas de prueba / desarrollo)
 */

const PLAN_CONFIG = {
  inicial: {
    professionals: 1,
    adminUsers: false,        // no puede crear usuarios admin/secretary
    clinicalImages: false,    // sin imágenes clínicas
    billing: false,           // sin facturación
    aiExtractions: 0,         // sin importación con IA — solo carga manual
  },
  clinica: {
    professionals: 3,
    adminUsers: true,
    clinicalImages: true,
    billing: true,
    aiExtractions: 100,       // hasta 100 pacientes/mes por foto con IA
  },
  pro: {
    professionals: Infinity,
    adminUsers: true,
    clinicalImages: true,
    billing: true,
    aiExtractions: 500,       // hasta 500 pacientes/mes por foto con IA
  },
};

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
  return PLAN_CONFIG[plan] || UNLIMITED_CONFIG;
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
  checkProfessionalLimit,
  checkAdminUserLimit,
  checkClinicalImagesFeature,
  checkBillingFeature,
  getAiExtractionLimit,
  getAiQuotaStatus,
  normalizeAiUsage,
  currentUsageMonth,
};
