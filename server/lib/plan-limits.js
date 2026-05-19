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
  },
  clinica: {
    professionals: 3,
    adminUsers: true,
    clinicalImages: true,
    billing: true,
  },
  pro: {
    professionals: Infinity,
    adminUsers: true,
    clinicalImages: true,
    billing: true,
  },
};

/** Devuelve la config del plan, o defaults sin límites si no tiene plan asignado. */
function getPlanConfig(plan) {
  return PLAN_CONFIG[plan] || {
    professionals: Infinity,
    adminUsers: true,
    clinicalImages: true,
    billing: true,
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
};
