const express = require("express");
const bcrypt = require("bcrypt");

const prisma = require("../lib/prisma");
const { requireAuth } = require("../middleware/auth");
const { signToken } = require("../lib/auth");
const { invalidateClinicPrisma } = require("../lib/clinic-prisma");
const { getPlanPrice, refreshPlans } = require("../lib/plan-limits");
const { normalizarDescuento, calcularPrecio } = require("../../shared/plan-pricing");
const { normalizarMoneda, balanceGeneral } = require("../../shared/money");
const { logSecurityEvent } = require("../lib/security-logger");
const path = require("path");
const fs = require("fs");
const { emitirAutorizacion, reclamarAutorizacion } = require("../lib/single-use-token");
const { backupRoot } = require("../lib/backup-runner");
const {
  getSchedule,
  saveSchedule,
  ejecutarBackup,
  listarBackups,
} = require("../lib/backup-service");
const { alertaDeBackups } = require("../lib/backup-schedule-rules");
const { timestamp } = require("../lib/backup-runner");

const router = express.Router();

// Middleware: solo platform admin
function requirePlatformAdmin(req, res, next) {
  if (!req.permissions?.isPlatformAdmin) {
    return res.status(403).json({ ok: false, error: "Acceso restringido a administradores de plataforma." });
  }
  next();
}

// ── Eventos de seguridad ──────────────────────────────────────────────────────
// Accesos fallidos, bloqueos, rate limit y reseteos de contraseña. Sirve para
// responder "¿alguien intentó entrar donde no debía?", que antes era imposible
// porque los eventos solo existían en los logs rotativos del hosting.
router.get("/security-events", requireAuth, requirePlatformAdmin, async (req, res) => {
  try {
    const type = String(req.query.type || "").trim();
    const days = Math.min(90, Math.max(1, Number(req.query.days) || 7));
    const desde = new Date(Date.now() - days * 24 * 3600 * 1000);

    const where = { createdAt: { gte: desde }, ...(type ? { type } : {}) };

    const [events, porTipo] = await Promise.all([
      prisma.securityEvent.findMany({ where, orderBy: { createdAt: "desc" }, take: 200 }),
      prisma.securityEvent.groupBy({ by: ["type"], where, _count: { _all: true } }),
    ]);

    return res.json({
      ok: true,
      days,
      events,
      summary: porTipo
        .map((r) => ({ type: r.type, count: r._count._all }))
        .sort((a, b) => b.count - a.count),
    });
  } catch (_error) {
    return res.status(500).json({ ok: false, error: "No se pudieron cargar los eventos de seguridad." });
  }
});

// Desbloqueo manual: si alguien se quedó afuera y necesita entrar ya, sin
// esperar los 15 minutos ni pasar por recuperar contraseña.
router.post("/unlock-account", requireAuth, requirePlatformAdmin, async (req, res) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    if (!email) return res.status(400).json({ ok: false, error: "Falta el email." });

    const { count } = await prisma.user.updateMany({
      where: { email, deletedAt: null },
      data: { failedLoginAttempts: 0, lockedUntil: null },
    });
    if (count === 0) return res.status(404).json({ ok: false, error: "No hay cuentas con ese email." });

    logSecurityEvent("ACCOUNT_UNLOCKED", req, { email, porUsuario: req.user.id });
    return res.json({ ok: true, cuentas: count });
  } catch (_error) {
    return res.status(500).json({ ok: false, error: "No se pudo desbloquear la cuenta." });
  }
});

// ── Anuncios ──────────────────────────────────────────────────────────────────
// Avisos que ven todas las clínicas dentro de la app.
const ANNOUNCEMENT_LEVELS = new Set(["info", "warning", "urgent"]);

function parseAnnouncementBody(body, { partial = false } = {}) {
  const data = {};

  if (body.message !== undefined || !partial) {
    const message = String(body.message || "").trim();
    if (!message) return { error: "El mensaje no puede quedar vacío." };
    data.message = message.slice(0, 500);
  }

  if (body.level !== undefined || !partial) {
    const level = String(body.level || "info");
    if (!ANNOUNCEMENT_LEVELS.has(level)) return { error: "Tipo de aviso inválido." };
    data.level = level;
  }

  for (const field of ["startsAt", "endsAt"]) {
    if (body[field] === undefined && partial) continue;
    const date = new Date(body[field]);
    if (Number.isNaN(date.getTime())) return { error: "Las fechas de vigencia no son válidas." };
    data[field] = date;
  }

  if (data.startsAt && data.endsAt && data.endsAt <= data.startsAt) {
    return { error: "La fecha de fin tiene que ser posterior a la de inicio." };
  }

  if (body.dismissible !== undefined) data.dismissible = Boolean(body.dismissible);
  if (body.active !== undefined) data.active = Boolean(body.active);

  return { data };
}

router.get("/announcements", requireAuth, requirePlatformAdmin, async (_req, res) => {
  try {
    const announcements = await prisma.announcement.findMany({ orderBy: { startsAt: "desc" }, take: 100 });
    return res.json({ ok: true, announcements });
  } catch (_error) {
    return res.status(500).json({ ok: false, error: "No se pudieron cargar los avisos." });
  }
});

router.post("/announcements", requireAuth, requirePlatformAdmin, async (req, res) => {
  try {
    const { data, error } = parseAnnouncementBody(req.body || {});
    if (error) return res.status(400).json({ ok: false, error });
    const created = await prisma.announcement.create({ data });
    return res.json({ ok: true, announcement: created });
  } catch (_error) {
    return res.status(500).json({ ok: false, error: "No se pudo crear el aviso." });
  }
});

router.put("/announcements/:id", requireAuth, requirePlatformAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ ok: false, error: "ID de aviso inválido." });
    }
    const existing = await prisma.announcement.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ ok: false, error: "El aviso no existe." });

    const { data, error } = parseAnnouncementBody(req.body || {}, { partial: true });
    if (error) return res.status(400).json({ ok: false, error });
    // Al actualizar solo una de las dos fechas hay que validar contra la que ya
    // estaba guardada, si no se podría dejar un aviso que termina antes de empezar.
    const startsAt = data.startsAt || existing.startsAt;
    const endsAt = data.endsAt || existing.endsAt;
    if (endsAt <= startsAt) {
      return res.status(400).json({ ok: false, error: "La fecha de fin tiene que ser posterior a la de inicio." });
    }

    const updated = await prisma.announcement.update({ where: { id }, data });
    return res.json({ ok: true, announcement: updated });
  } catch (_error) {
    return res.status(500).json({ ok: false, error: "No se pudo actualizar el aviso." });
  }
});

router.delete("/announcements/:id", requireAuth, requirePlatformAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ ok: false, error: "ID de aviso inválido." });
    }
    await prisma.announcement.delete({ where: { id } });
    return res.json({ ok: true });
  } catch (_error) {
    return res.status(500).json({ ok: false, error: "No se pudo eliminar el aviso." });
  }
});

// ── Planes ────────────────────────────────────────────────────────────────────
// La configuración comercial (precio, cupo de IA, límites y features) vive en la
// tabla Plan para poder ajustarla desde el panel sin deploy.
//
// En la base, -1 representa "ilimitado" porque no se puede guardar Infinity.
// Hacia afuera se expone como null, que es lo que el frontend entiende.
const PLAN_EDITABLE_BOOLEANS = ["adminUsers", "clinicalImages", "billing"];

function serializePlan(row) {
  return {
    code: row.code,
    label: row.label,
    priceMonthly: Number(row.priceMonthly),
    currency: row.currency,
    professionals: row.professionals === -1 ? null : row.professionals,
    aiExtractions: row.aiExtractions === -1 ? null : row.aiExtractions,
    adminUsers: row.adminUsers,
    clinicalImages: row.clinicalImages,
    billing: row.billing,
    sortOrder: row.sortOrder,
    updatedAt: row.updatedAt,
  };
}

// null (ilimitado) se guarda como -1. Devuelve undefined si el valor no es
// utilizable, para no pisar el dato existente con basura.
function parseLimit(value) {
  if (value === null) return -1;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0) return undefined;
  return n;
}

router.get("/plans", requireAuth, requirePlatformAdmin, async (_req, res) => {
  try {
    const rows = await prisma.plan.findMany({ orderBy: { sortOrder: "asc" } });
    return res.json({ ok: true, plans: rows.map(serializePlan) });
  } catch (_error) {
    return res.status(500).json({ ok: false, error: "No se pudieron cargar los planes." });
  }
});

router.put("/plans/:code", requireAuth, requirePlatformAdmin, async (req, res) => {
  try {
    const code = String(req.params.code || "").trim();
    const existing = await prisma.plan.findUnique({ where: { code } });
    if (!existing) {
      return res.status(404).json({ ok: false, error: "El plan no existe." });
    }

    const data = {};

    if (req.body.label !== undefined) {
      const label = String(req.body.label).trim();
      if (!label) return res.status(400).json({ ok: false, error: "El nombre del plan no puede quedar vacío." });
      data.label = label.slice(0, 60);
    }

    if (req.body.priceMonthly !== undefined) {
      const price = Number(req.body.priceMonthly);
      if (!Number.isFinite(price) || price < 0) {
        return res.status(400).json({ ok: false, error: "El precio tiene que ser un número mayor o igual a cero." });
      }
      data.priceMonthly = Math.round(price * 100) / 100;
    }

    for (const field of ["professionals", "aiExtractions"]) {
      if (req.body[field] === undefined) continue;
      const parsed = parseLimit(req.body[field]);
      if (parsed === undefined) {
        return res.status(400).json({ ok: false, error: "Los límites tienen que ser números enteros de cero o más (o vacío para ilimitado)." });
      }
      data[field] = parsed;
    }

    for (const field of PLAN_EDITABLE_BOOLEANS) {
      if (req.body[field] !== undefined) data[field] = Boolean(req.body[field]);
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ ok: false, error: "No se recibió ningún cambio." });
    }

    const updated = await prisma.plan.update({ where: { code }, data });
    // Se refresca el snapshot de este worker en el acto. Los demás lo toman al
    // vencer su TTL, unos segundos después.
    await refreshPlans();
    return res.json({ ok: true, plan: serializePlan(updated) });
  } catch (_error) {
    return res.status(500).json({ ok: false, error: "No se pudo actualizar el plan." });
  }
});

// Ajuste porcentual sobre el precio de todos los planes de una sola vez
// (ej: "este mes sube 5%"). Se redondea a pesos enteros.
router.post("/plans/apply-increase", requireAuth, requirePlatformAdmin, async (req, res) => {
  try {
    const percent = Number(req.body?.percent);
    if (!Number.isFinite(percent) || percent <= -100 || percent > 100) {
      return res.status(400).json({ ok: false, error: "El porcentaje tiene que ser un número entre -100 y 100." });
    }
    if (percent === 0) {
      return res.status(400).json({ ok: false, error: "El porcentaje no puede ser cero." });
    }

    const rows = await prisma.plan.findMany();
    const factor = 1 + percent / 100;

    const updated = await prisma.$transaction(
      rows.map((row) => {
        const nuevo = Math.max(0, Math.round(Number(row.priceMonthly) * factor));
        return prisma.plan.update({ where: { code: row.code }, data: { priceMonthly: nuevo } });
      })
    );

    await refreshPlans();
    return res.json({
      ok: true,
      percent,
      plans: updated.sort((a, b) => a.sortOrder - b.sortOrder).map(serializePlan),
    });
  } catch (_error) {
    return res.status(500).json({ ok: false, error: "No se pudo aplicar el ajuste de precios." });
  }
});

// ── GET /api/platform/clinics ─────────────────────────────────────────────────
// Lista todas las clínicas con stats básicos
router.get("/clinics", requireAuth, requirePlatformAdmin, async (req, res) => {
  try {
    const clinics = await prisma.clinic.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: {
            users:         { where: { deletedAt: null, active: true } },
            professionals: { where: { deletedAt: null } },
            patients:      { where: { deletedAt: null } },
            appointments:  { where: { deletedAt: null } },
          },
        },
      },
    });

    return res.json({
      ok: true,
      clinics: clinics.map(serializeClinic),
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, error: "No se pudieron listar las clínicas." });
  }
});

// ── GET /api/platform/stats ───────────────────────────────────────────────────
// KPIs globales de la plataforma.
// Los montos de suscripción salen de la tabla Plan (getPlanPrice) y ya no de una
// constante: antes el mismo número estaba escrito acá, en el frontend del panel
// y en la landing, y bastaba tocar uno para que quedaran distintos entre sí.

const MONTH_LABELS_ES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

router.get("/stats", requireAuth, requirePlatformAdmin, async (req, res) => {
  try {
    const now = new Date();
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      totalClinics, activeClinics, totalUsers, totalPatients, totalProfessionals,
      activeClinicPlans, activeClinicDbTypes, activeUsersWithRoles,
      appointmentsByStatusRaw, allActiveClinicsForBilling,
      cobrosDeSuscripcion, gastosDePlataforma,
    ] = await Promise.all([
      prisma.clinic.count(),
      prisma.clinic.count({ where: { active: true } }),
      prisma.user.count({ where: { isPlatformAdmin: false, deletedAt: null, active: true } }),
      prisma.patient.count({ where: { deletedAt: null } }),
      prisma.professional.count({ where: { deletedAt: null } }),
      prisma.clinic.findMany({ where: { active: true }, select: { plan: true, discountPercent: true } }),
      prisma.clinic.findMany({ where: { active: true }, select: { dbType: true } }),
      prisma.user.findMany({
        where: { isPlatformAdmin: false, deletedAt: null, active: true },
        select: { roles: { select: { role: { select: { code: true } } } } },
      }),
      prisma.appointment.groupBy({
        by: ["status"],
        where: { date: { gte: firstOfMonth }, deletedAt: null },
        _count: true,
      }),
      prisma.clinic.findMany({
        where: { active: true },
        select: { id: true, plan: true, createdAt: true, discountPercent: true },
      }),
      prisma.subscriptionPayment.findMany({ select: { amount: true, currency: true, paidAt: true } }),
      prisma.expense.findMany({ select: { amount: true, currency: true, paidAt: true } }),
    ]);

    const appointmentsThisMonth = appointmentsByStatusRaw.reduce((sum, r) => sum + r._count, 0);

    // ── Plata de verdad: lo cobrado y lo gastado ──
    //
    // Es distinto de "ingresos aproximados", que es una proyección del precio de
    // los planes. Esto es lo que efectivamente entró y salió, acumulado desde el
    // primer registro, y por moneda — que es la única forma en que el número
    // significa algo con pesos y dólares conviviendo.
    const balance = balanceGeneral(cobrosDeSuscripcion, gastosDePlataforma);

    const fechas = [
      ...cobrosDeSuscripcion.map((c) => c.paidAt),
      ...gastosDePlataforma.map((g) => g.paidAt),
    ].filter(Boolean);
    const acumuladoDesde = fechas.length
      ? new Date(Math.min(...fechas.map((f) => new Date(f).getTime())))
      : null;

    const inicioDeMes = firstOfMonth;
    const delMes = (items) => items.filter((i) => new Date(i.paidAt) >= inicioDeMes);
    const balanceDelMes = balanceGeneral(
      delMes(cobrosDeSuscripcion),
      delMes(gastosDePlataforma)
    );

    // Ingresos aproximados: suma del monto de plan de cada clínica activa, YA
    // CON SU DESCUENTO. Sumar los precios de lista daba un número que no se iba
    // a cobrar nunca, y encima crecía al regalar más — justo al revés.
    // Sigue siendo una estimación (no descuenta deuda ni cobros parciales); el
    // detalle real de pagos está en /platform/subscriptions.
    let estimatedMonthlyRevenue = 0;
    let monthlyDiscountGiven = 0;
    let discountedClinics = 0;
    for (const c of activeClinicPlans) {
      const { final, ahorro } = calcularPrecio(getPlanPrice(c.plan), c.discountPercent);
      estimatedMonthlyRevenue += final;
      monthlyDiscountGiven += ahorro;
      if (ahorro > 0) discountedClinics += 1;
    }

    // ── Clínicas por plan ──
    const clinicsByPlan = { inicial: 0, clinica: 0, pro: 0, sinPlan: 0 };
    for (const c of activeClinicPlans) {
      if (c.plan && clinicsByPlan[c.plan] !== undefined) clinicsByPlan[c.plan]++;
      else clinicsByPlan.sinPlan++;
    }

    // ── Clínicas por tipo de DB ──
    const clinicsByDbType = { shared: 0, dedicated: 0 };
    for (const c of activeClinicDbTypes) {
      clinicsByDbType[c.dbType === "dedicated" ? "dedicated" : "shared"]++;
    }

    // ── Usuarios por rol (jerarquía superadmin > professional > secretary > admin, un usuario cuenta 1 vez) ──
    const usersByRole = { superadmin: 0, professional: 0, secretary: 0, admin: 0 };
    const ROLE_PRIORITY = ["superadmin", "professional", "secretary", "admin"];
    for (const u of activeUsersWithRoles) {
      const codes = u.roles.map((r) => r.role.code);
      const primary = ROLE_PRIORITY.find((code) => codes.includes(code));
      if (primary) usersByRole[primary]++;
    }

    // ── Turnos del mes por estado ──
    const appointmentsByStatus = { not_sent: 0, sent: 0, confirmed: 0, rescheduled: 0, cancelled: 0 };
    for (const r of appointmentsByStatusRaw) {
      if (appointmentsByStatus[r.status] !== undefined) appointmentsByStatus[r.status] = r._count;
    }

    // ── Cobros del mes actual: pagado / pendiente / vencido ──
    const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const currentPeriodPayments = await prisma.subscriptionPayment.findMany({
      where: { period: currentPeriod },
      select: { clinicId: true },
    });
    const paidClinicIds = new Set(currentPeriodPayments.map((p) => p.clinicId));
    const billingStatus = { paid: 0, pending: 0, overdue: 0, sinCargo: 0 };
    for (const c of allActiveClinicsForBilling) {
      // Las bonificadas y las que no tienen plan no son un cobro del mes: no van
      // ni a pagado ni a pendiente. Contarlas como vencidas pintaba de rojo a
      // clinicas a las que se decidio no cobrarles.
      if (sinCargoMensual(c)) {
        billingStatus.sinCargo++;
      } else if (paidClinicIds.has(c.id)) {
        billingStatus.paid++;
      } else if (now.getDate() > 10) {
        billingStatus.overdue++;
      } else {
        billingStatus.pending++;
      }
    }

    // ── Pacientes nuevos por mes (últimos 6 meses) ──
    const patientsByMonth = [];
    for (let i = 5; i >= 0; i--) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      // eslint-disable-next-line no-await-in-loop
      const count = await prisma.patient.count({
        where: { createdAt: { gte: start, lt: end }, deletedAt: null },
      });
      patientsByMonth.push({ label: MONTH_LABELS_ES[start.getMonth()], count });
    }

    return res.json({
      ok: true,
      stats: {
        totalClinics,
        activeClinics,
        totalUsers,
        totalPatients,
        totalProfessionals,
        appointmentsThisMonth,
        estimatedMonthlyRevenue,
        monthlyDiscountGiven,
        discountedClinics,
        balance,
        balanceDelMes,
        acumuladoDesde,
        clinicsByPlan,
        clinicsByDbType,
        usersByRole,
        appointmentsByStatus,
        billingStatus,
        patientsByMonth,
      },
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, error: "No se pudieron obtener las estadísticas." });
  }
});

// ── POST /api/platform/clinics ────────────────────────────────────────────────
// Crear una nueva clínica
router.post("/clinics", requireAuth, requirePlatformAdmin, async (req, res) => {
  try {
    const { name, slug, address, phone, email, plan, notes, discountPercent } = req.body;

    const descuento = leerDescuento(discountPercent);
    if (!descuento.ok) return res.status(400).json({ ok: false, error: descuento.error });
    const { dbType, databaseUrl, adminName, adminEmail, adminPassword } = req.body;

    if (!name || !slug) {
      return res.status(400).json({ ok: false, error: "Nombre y slug son obligatorios." });
    }

    const cleanSlug = String(slug).trim().toLowerCase().replace(/[^a-z0-9-]/g, "-");

    const existing = await prisma.clinic.findUnique({ where: { slug: cleanSlug } });
    if (existing) {
      return res.status(409).json({ ok: false, error: "Ya existe una clínica con ese slug." });
    }

    // Validar datos del superadmin si se proveen
    const createAdmin = adminName && adminEmail && adminPassword;
    if (createAdmin) {
      const existingUser = await prisma.user.findFirst({ where: { email: String(adminEmail).trim().toLowerCase(), deletedAt: null } });
      if (existingUser) {
        return res.status(409).json({ ok: false, error: "Ya existe un usuario con ese email de administrador." });
      }
    }

    const resolvedDbType = dbType === 'dedicated' ? 'dedicated' : 'shared';

    // Crear clínica y superadmin en una sola transacción
    const result = await prisma.$transaction(async (tx) => {
      const clinic = await tx.clinic.create({
        data: {
          name: String(name).trim(),
          slug: cleanSlug,
          address: address ? String(address).trim() : null,
          phone:   phone   ? String(phone).trim()   : null,
          email:   email   ? String(email).trim().toLowerCase() : null,
          plan:    plan    ? String(plan).trim()    : null,
          notes:   notes   ? String(notes).trim()   : null,
          discountPercent: descuento.valor,
          dbType:  resolvedDbType,
          databaseUrl: resolvedDbType === 'dedicated' && databaseUrl ? String(databaseUrl).trim() : null,
          active: true,
        },
        include: { _count: { select: { users: true, professionals: true, patients: true, appointments: true } } },
      });

      let adminUser = null;
      if (createAdmin) {
        const superadminRole = await tx.role.findUnique({ where: { code: "superadmin" } });
        if (!superadminRole) throw new Error("Rol superadmin no configurado en la plataforma.");

        const passwordHash = await bcrypt.hash(String(adminPassword), 10);
        adminUser = await tx.user.create({
          data: {
            email:           String(adminEmail).trim().toLowerCase(),
            fullName:        String(adminName).trim(),
            passwordHash,
            active:          true,
            isPlatformAdmin: false,
            clinicId:        clinic.id,
            roles: { create: { roleId: superadminRole.id } },
          },
          select: { id: true, email: true, fullName: true },
        });
      }

      return { clinic, adminUser };
    });

    return res.status(201).json({
      ok: true,
      clinic: serializeClinic(result.clinic),
      ...(result.adminUser && { adminUser: result.adminUser }),
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, error: e.message || "No se pudo crear la clínica." });
  }
});

// ── PUT /api/platform/clinics/:id ─────────────────────────────────────────────
// Editar datos de una clínica
router.put("/clinics/:id", requireAuth, requirePlatformAdmin, async (req, res) => {
  try {
    const clinicId = Number(req.params.id);
    const { name, address, phone, email, plan, notes, discountPercent } = req.body;

    const { dbType, databaseUrl } = req.body;

    const descuento = leerDescuento(discountPercent);
    if (!descuento.ok) return res.status(400).json({ ok: false, error: descuento.error });
    const clinic = await prisma.clinic.update({
      where: { id: clinicId },
      data: {
        name:        name    ? String(name).trim()    : undefined,
        address:     address     !== undefined ? (address     ? String(address).trim()                  : null) : undefined,
        phone:       phone       !== undefined ? (phone       ? String(phone).trim()                    : null) : undefined,
        email:       email       !== undefined ? (email       ? String(email).trim().toLowerCase()       : null) : undefined,
        plan:        plan        !== undefined ? (plan        ? String(plan).trim()                     : null) : undefined,
        notes:       notes       !== undefined ? (notes       ? String(notes).trim()                    : null) : undefined,
        discountPercent: discountPercent !== undefined ? descuento.valor : undefined,
        dbType:      dbType      !== undefined ? (dbType === 'dedicated' ? 'dedicated' : 'shared')              : undefined,
        databaseUrl: databaseUrl !== undefined ? (databaseUrl ? String(databaseUrl).trim()              : null) : undefined,
      },
      include: { _count: { select: { users: true, professionals: true, patients: true, appointments: true } } },
    });

    // Invalidar el cache de Prisma si se modificó la databaseUrl
    if (databaseUrl !== undefined) {
      invalidateClinicPrisma(clinicId);
    }

    return res.json({ ok: true, clinic: serializeClinic(clinic) });
  } catch (e) {
    if (e.code === "P2025") return res.status(404).json({ ok: false, error: "Clínica no encontrada." });
    console.error(e);
    return res.status(500).json({ ok: false, error: "No se pudo actualizar la clínica." });
  }
});

// ── PATCH /api/platform/clinics/:id/toggle ────────────────────────────────────
// Activar / desactivar clínica
router.patch("/clinics/:id/toggle", requireAuth, requirePlatformAdmin, async (req, res) => {
  try {
    const clinicId = Number(req.params.id);
    const existing = await prisma.clinic.findUnique({ where: { id: clinicId } });
    if (!existing) return res.status(404).json({ ok: false, error: "Clínica no encontrada." });

    const clinic = await prisma.clinic.update({
      where: { id: clinicId },
      data: { active: !existing.active },
      include: { _count: { select: { users: true, professionals: true, patients: true, appointments: true } } },
    });

    return res.json({ ok: true, clinic: serializeClinic(clinic) });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, error: "No se pudo cambiar el estado de la clínica." });
  }
});

// ── GET /api/platform/clinics/:id/users ───────────────────────────────────────
// Listar usuarios de una clínica
router.get("/clinics/:id/users", requireAuth, requirePlatformAdmin, async (req, res) => {
  try {
    const clinicId = Number(req.params.id);
    const users = await prisma.user.findMany({
      where: { clinicId, deletedAt: null },
      include: {
        roles: { include: { role: true } },
        assignedProfessional: { select: { id: true, fullName: true } },
      },
      orderBy: { fullName: "asc" },
    });

    return res.json({
      ok: true,
      users: users.map((u) => ({
        id:       u.id,
        email:    u.email,
        fullName: u.fullName,
        active:   u.active,
        roles:    u.roles.map((r) => r.role.code),
        assignedProfessional: u.assignedProfessional || null,
        createdAt: u.createdAt,
      })),
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, error: "No se pudieron obtener los usuarios." });
  }
});

// ── POST /api/platform/clinics/:id/admin ──────────────────────────────────────
// Crear el superadmin de una clínica nueva
router.post("/clinics/:id/admin", requireAuth, requirePlatformAdmin, async (req, res) => {
  try {
    const clinicId = Number(req.params.id);
    const { email, fullName, password } = req.body;

    if (!email || !fullName || !password) {
      return res.status(400).json({ ok: false, error: "Email, nombre y contraseña son obligatorios." });
    }

    const clinic = await prisma.clinic.findUnique({ where: { id: clinicId } });
    if (!clinic) return res.status(404).json({ ok: false, error: "Clínica no encontrada." });

    const existingUser = await prisma.user.findFirst({ where: { email: String(email).trim().toLowerCase(), deletedAt: null } });
    if (existingUser) return res.status(409).json({ ok: false, error: "Ya existe un usuario con ese email." });

    // Obtener el rol superadmin
    const superadminRole = await prisma.role.findUnique({ where: { code: "superadmin" } });
    if (!superadminRole) return res.status(500).json({ ok: false, error: "Rol superadmin no configurado en la plataforma." });

    const passwordHash = await bcrypt.hash(String(password), 10);

    const user = await prisma.user.create({
      data: {
        email:          String(email).trim().toLowerCase(),
        fullName:       String(fullName).trim(),
        passwordHash,
        active:         true,
        isPlatformAdmin: false,
        clinicId,
        roles: { create: { roleId: superadminRole.id } },
      },
      include: { roles: { include: { role: true } } },
    });

    return res.status(201).json({
      ok: true,
      user: {
        id:       user.id,
        email:    user.email,
        fullName: user.fullName,
        roles:    user.roles.map((r) => r.role.code),
        clinicId: user.clinicId,
      },
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, error: "No se pudo crear el administrador." });
  }
});

// ── POST /api/platform/login-as-clinic ────────────────────────────────────────
// Genera un token temporal para ingresar como superadmin de una clínica (impersonar)
router.post("/login-as-clinic", requireAuth, requirePlatformAdmin, async (req, res) => {
  try {
    const { clinicId } = req.body;
    if (!clinicId) return res.status(400).json({ ok: false, error: "clinicId es obligatorio." });

    // Buscar el primer superadmin de esa clínica
    const superadminRole = await prisma.role.findUnique({ where: { code: "superadmin" } });
    const adminUser = await prisma.user.findFirst({
      where: {
        clinicId: Number(clinicId),
        active: true,
        deletedAt: null,
        roles: { some: { roleId: superadminRole.id } },
      },
      include: {
        roles: { include: { role: true } },
        assignedProfessional: true,
        professionalScopes: true,
      },
    });

    if (!adminUser) {
      return res.status(404).json({ ok: false, error: "La clínica no tiene un superadmin activo." });
    }

    const { serializeUser } = require("../lib/auth");
    const token = signToken({ userId: adminUser.id, impersonatedBy: req.user.id }, { expiresIn: "2h" });

    // No se registra en AuditLog: los movimientos del Ultra Admin (incluido
    // este ingreso como impersonador) están excluidos de la auditoría a propósito.

    return res.json({ ok: true, token, user: serializeUser(adminUser) });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, error: "No se pudo ingresar a la clínica." });
  }
});

// ── DELETE /api/platform/clinics/:id ─────────────────────────────────────────
// Eliminación deshabilitada intencionalmente. Las clínicas solo pueden desactivarse o archivarse.
router.delete("/clinics/:id", requireAuth, requirePlatformAdmin, (req, res) => {
  return res.status(403).json({
    ok: false,
    error: "Las clínicas no pueden eliminarse. Usá desactivar o archivar.",
    code: "CLINIC_DELETE_DISABLED",
  });
});

// ── Cobros / Subscription payments ───────────────────────────────────────────

// GET /api/platform/subscriptions  → payments + deuda calculada por clínica
router.get("/subscriptions", requireAuth, requirePlatformAdmin, async (req, res) => {
  try {
    const clinics = await prisma.clinic.findMany({
      select: { id: true, name: true, plan: true, active: true, createdAt: true, discountPercent: true },
      orderBy: { name: "asc" },
    });

    const payments = await prisma.subscriptionPayment.findMany({
      orderBy: [{ period: "desc" }, { createdAt: "desc" }],
    });

    // Calcular períodos adeudados por cada clínica
    const now = new Date();
    const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    const paymentsByClinic = {};
    for (const p of payments) {
      if (!paymentsByClinic[p.clinicId]) paymentsByClinic[p.clinicId] = [];
      paymentsByClinic[p.clinicId].push(p);
    }

    const clinicSummaries = clinics.map(c => {
      const paid = paymentsByClinic[c.id] || [];
      const paidPeriods = new Set(paid.map(p => p.period));

      // El monto sugerido del cobro sale del servidor ya descontado. Si el panel
      // sugiriera el precio de lista, cada mes habria que acordarse a mano de
      // restarle el descuento a esa clinica — y el mes que alguien se olvide, le
      // cobra de mas a un cliente que tiene un acuerdo.
      const precio = calcularPrecio(getPlanPrice(c.plan), c.discountPercent);

      // Generar períodos desde creación hasta hoy
      const start = new Date(c.createdAt);
      start.setDate(1);
      const periods = [];
      const cur = new Date(start);
      while (cur <= now) {
        const period = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}`;
        periods.push(period);
        cur.setMonth(cur.getMonth() + 1);
      }

      // Sin cargo mensual no hay deuda posible: ni periodos adeudados ni vencido.
      const sinCargo = precio.final <= 0;

      const owedPeriods = sinCargo ? [] : periods.filter(p => !paidPeriods.has(p));
      const isOverdue = !sinCargo && owedPeriods.includes(currentPeriod) && now.getDate() > 10;
      const currentPaid = paidPeriods.has(currentPeriod);

      return {
        ...c,
        sinCargo,
        discountPercent: precio.porcentaje,
        planPrice:       precio.base,
        discountAmount:  precio.ahorro,
        planPriceFinal:  precio.final,
        bonificada:      precio.bonificada,
        createdAt: c.createdAt,
        paidPeriods: [...paidPeriods].sort().reverse(),
        owedPeriods: owedPeriods.sort().reverse(),
        currentPeriod,
        currentPaid,
        isOverdue,
        totalOwed: owedPeriods.length,
        lastPayment: paid[0] || null,
      };
    });

    return res.json({ ok: true, clinics: clinicSummaries, payments });
  } catch (e) {
    console.error("[subscriptions GET]", e);
    return res.status(500).json({ ok: false, error: "Error al obtener cobros." });
  }
});

// POST /api/platform/subscriptions  → registrar pago
router.post("/subscriptions", requireAuth, requirePlatformAdmin, async (req, res) => {
  try {
    const { clinicId, period, amount, paymentMethod, paidAt, notes, currency } = req.body;
    const moneda = normalizarMoneda(currency);

    if (!clinicId || !period || !amount || !paymentMethod) {
      return res.status(400).json({ ok: false, error: "Faltan campos obligatorios." });
    }
    if (!/^\d{4}-\d{2}$/.test(period)) {
      return res.status(400).json({ ok: false, error: "Período inválido (formato YYYY-MM)." });
    }

    const clinic = await prisma.clinic.findUnique({ where: { id: Number(clinicId) } });
    if (!clinic) return res.status(404).json({ ok: false, error: "Clínica no encontrada." });

    const payment = await prisma.subscriptionPayment.upsert({
      where: { clinicId_period: { clinicId: Number(clinicId), period } },
      create: {
        clinicId:      Number(clinicId),
        period,
        amount:        parseFloat(amount),
        currency:      moneda,
        paymentMethod: String(paymentMethod),
        paidAt:        paidAt ? new Date(paidAt) : new Date(),
        notes:         notes ? String(notes).trim() : null,
      },
      update: {
        amount:        parseFloat(amount),
        currency:      moneda,
        paymentMethod: String(paymentMethod),
        paidAt:        paidAt ? new Date(paidAt) : new Date(),
        notes:         notes ? String(notes).trim() : null,
      },
    });

    return res.status(201).json({ ok: true, payment });
  } catch (e) {
    console.error("[subscriptions POST]", e);
    return res.status(500).json({ ok: false, error: "Error al registrar el pago." });
  }
});

// DELETE /api/platform/subscriptions/:id  → eliminar pago (corrección)
router.delete("/subscriptions/:id", requireAuth, requirePlatformAdmin, async (req, res) => {
  try {
    await prisma.subscriptionPayment.delete({ where: { id: Number(req.params.id) } });
    return res.json({ ok: true });
  } catch (e) {
    if (e.code === "P2025") return res.status(404).json({ ok: false, error: "Pago no encontrado." });
    return res.status(500).json({ ok: false, error: "Error al eliminar el pago." });
  }
});

// ── GET /api/platform/audit-logs ──────────────────────────────────────────────
// Auditoría de movimientos hacia la base de datos, filtrable por clínica, usuario,
// tipo de entidad y acción. No incluye movimientos del Ultra Admin ni los hechos
// mientras impersona una clínica — esos directamente no se registran (ver
// server/lib/audit-writer.js).
router.get("/audit-logs", requireAuth, requirePlatformAdmin, async (req, res) => {
  try {
    const { clinicId, userId, entityType, action, dateFrom, dateTo } = req.query;
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 30));

    // Nunca mostrar movimientos atribuidos al Ultra Admin, ni siquiera los que
    // hayan quedado registrados por versiones anteriores de la auditoría.
    const where = { user: { isNot: { isPlatformAdmin: true } } };
    if (clinicId) where.clinicId = Number(clinicId);
    if (userId) where.userId = Number(userId);
    if (entityType) where.entityType = String(entityType);
    if (action) where.action = String(action);
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(`${dateFrom}T00:00:00`);
      if (dateTo) where.createdAt.lte = new Date(`${dateTo}T23:59:59`);
    }

    const [total, logs, clinics, entityTypes] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { user: { select: { id: true, fullName: true, email: true } } },
      }),
      prisma.clinic.findMany({ select: { id: true, name: true } }),
      prisma.auditLog.findMany({ distinct: ["entityType"], select: { entityType: true }, orderBy: { entityType: "asc" } }),
    ]);

    const clinicNameById = new Map(clinics.map((c) => [c.id, c.name]));

    return res.json({
      ok: true,
      total,
      page,
      pageSize,
      entityTypes: entityTypes.map((e) => e.entityType),
      logs: logs.map((log) => ({
        id: log.id,
        action: log.action,
        entityType: log.entityType,
        entityId: log.entityId,
        createdAt: log.createdAt,
        clinicId: log.clinicId,
        clinicName: log.clinicId ? clinicNameById.get(log.clinicId) || null : null,
        user: log.user ? { id: log.user.id, fullName: log.user.fullName, email: log.user.email } : null,
        beforeData: log.beforeData,
        afterData: log.afterData,
      })),
    });
  } catch (e) {
    console.error("[audit-logs GET]", e);
    return res.status(500).json({ ok: false, error: "No se pudo obtener la auditoría." });
  }
});

// ── Helpers ───────────────────────────────────────────────────────────────────
/**
 * Lee el descuento que llega por la API.
 *
 * A diferencia de normalizarDescuento(), que ante algo raro devuelve null y
 * sigue, aca un valor fuera de rango es un ERROR explicito. Es la diferencia
 * entre las dos capas: en el calculo, un descuento ilegible tiene que degradar a
 * "sin descuento" antes que romper una pantalla; en el alta, quien escribio 150
 * necesita enterarse de que no se guardo lo que queria, no descubrir despues que
 * quedo en 100.
 *
 * Devuelve { ok: true, valor } con valor null | numero, o { ok: false, error }.
 */
function leerDescuento(entrada) {
  if (entrada === null || entrada === undefined || entrada === "") return { ok: true, valor: null };

  const numero = typeof entrada === "number" ? entrada : Number(String(entrada).replace(",", "."));
  if (!Number.isFinite(numero)) {
    return { ok: false, error: "El descuento tiene que ser un numero." };
  }
  if (numero === 0) return { ok: true, valor: null };
  if (numero < 0.1 || numero > 100) {
    return { ok: false, error: "El descuento va de 0,1% a 100%." };
  }
  return { ok: true, valor: normalizarDescuento(numero) };
}

/**
 * Precio de una clinica: el de su plan, menos su descuento.
 *
 * Sale de la tabla Plan (getPlanPrice), asi que un aumento de precio se refleja
 * solo y el porcentaje de descuento sigue valiendo lo mismo en proporcion.
 */
function precioDeClinica(clinic) {
  const descuento = normalizarDescuento(clinic.discountPercent);
  const { base, ahorro, final, bonificada } = calcularPrecio(getPlanPrice(clinic.plan), descuento);
  return {
    discountPercent: descuento,
    planPrice:       base,
    discountAmount:  ahorro,
    planPriceFinal:  final,
    bonificada,
  };
}

/**
 * Una clinica que paga $0 no puede adeudar nada.
 *
 * El calculo de periodos adeudados solo miraba si existia un pago registrado, y
 * para una clinica bonificada al 100% ese pago NUNCA va a existir: no hay nada
 * que cobrarle. Resultado: las bonificadas aparecian "VENCIDO" con meses de
 * deuda acumulada, que es exactamente lo contrario de lo que significa
 * bonificarlas. Lo mismo pasaba con las que todavia no tienen plan asignado.
 *
 * Limitacion conocida: se usa el precio de HOY para todos los periodos, porque
 * no se guarda cuanto costaba el plan en cada mes. Una clinica que pago seis
 * meses y recien ahora se bonifica pierde de vista esa deuda vieja. Guardar el
 * precio por periodo es la solucion real, pero no vale la pena hasta que haya
 * historia que proteger.
 */
function sinCargoMensual(clinic) {
  return precioDeClinica(clinic).planPriceFinal <= 0;
}

function serializeClinic(clinic) {
  return {
    id:          clinic.id,
    name:        clinic.name,
    slug:        clinic.slug,
    address:     clinic.address,
    phone:       clinic.phone,
    email:       clinic.email,
    logoUrl:     clinic.logoUrl,
    active:      clinic.active,
    plan:        clinic.plan,
    notes:       clinic.notes,
    // El precio se manda calculado y no solo el porcentaje: el descuento lo
    // aplica una sola implementacion, la del servidor, y el panel muestra lo
    // mismo que se va a cobrar. Recalcularlo en el navegador es la forma de que
    // un dia digan cosas distintas.
    ...precioDeClinica(clinic),
    dbType:         clinic.dbType || 'shared',
    hasDedicatedDb: !!clinic.databaseUrl,
    createdAt:      clinic.createdAt,
    updatedAt:   clinic.updatedAt,
    stats: {
      users:         clinic._count?.users         || 0,
      professionals: clinic._count?.professionals || 0,
      patients:      clinic._count?.patients      || 0,
      appointments:  clinic._count?.appointments  || 0,
    },
  };
}

// ── Gastos de la plataforma ───────────────────────────────────────────────────
// Lo que cuesta hacer funcionar Odentara. No pasan por access.js ni llevan
// clinicId: son del dueño de la plataforma, no de una clínica.

const CATEGORIAS_GASTO = new Set([
  "hosting", "dominio", "ia", "software", "marketing", "contador", "impuestos", "otros",
]);

function leerGasto(cuerpo) {
  const descripcion = String(cuerpo.description || "").trim();
  if (!descripcion) return { ok: false, error: "Poné una descripción del gasto." };

  const monto = Number(String(cuerpo.amount).replace(",", "."));
  if (!Number.isFinite(monto) || monto <= 0) {
    return { ok: false, error: "El monto tiene que ser un número mayor a cero." };
  }

  const fecha = cuerpo.paidAt ? new Date(cuerpo.paidAt) : new Date();
  if (Number.isNaN(fecha.getTime())) return { ok: false, error: "La fecha no es válida." };

  const categoria = String(cuerpo.category || "otros").trim().toLowerCase();

  return {
    ok: true,
    datos: {
      description: descripcion.slice(0, 200),
      // Una categoría desconocida cae en "otros" en vez de rechazar la carga:
      // el gasto igual pasó, y perderlo es peor que clasificarlo mal.
      category: CATEGORIAS_GASTO.has(categoria) ? categoria : "otros",
      amount: Math.round(monto * 100) / 100,
      currency: normalizarMoneda(cuerpo.currency),
      paidAt: fecha,
      notes: cuerpo.notes ? String(cuerpo.notes).trim() : null,
    },
  };
}

router.get("/expenses", requireAuth, requirePlatformAdmin, async (_req, res) => {
  try {
    const [gastos, cobros] = await Promise.all([
      prisma.expense.findMany({ orderBy: [{ paidAt: "desc" }, { id: "desc" }], take: 500 }),
      prisma.subscriptionPayment.findMany({ select: { amount: true, currency: true } }),
    ]);

    return res.json({
      ok: true,
      expenses: gastos.map(serializeExpense),
      categorias: [...CATEGORIAS_GASTO],
      // El balance viaja con la lista para que la pantalla no tenga que volver a
      // sumar: es el mismo cálculo que usa Estadísticas, del módulo compartido.
      balance: balanceGeneral(cobros, gastos),
    });
  } catch (e) {
    console.error("[expenses GET]", e);
    return res.status(500).json({ ok: false, error: "No se pudieron leer los gastos." });
  }
});

router.post("/expenses", requireAuth, requirePlatformAdmin, async (req, res) => {
  try {
    const leido = leerGasto(req.body || {});
    if (!leido.ok) return res.status(400).json({ ok: false, error: leido.error });

    const gasto = await prisma.expense.create({ data: leido.datos });
    return res.status(201).json({ ok: true, expense: serializeExpense(gasto) });
  } catch (e) {
    console.error("[expenses POST]", e);
    return res.status(500).json({ ok: false, error: "No se pudo registrar el gasto." });
  }
});

router.delete("/expenses/:id", requireAuth, requirePlatformAdmin, async (req, res) => {
  try {
    await prisma.expense.delete({ where: { id: Number(req.params.id) } });
    return res.json({ ok: true });
  } catch (e) {
    if (e.code === "P2025") return res.status(404).json({ ok: false, error: "Gasto no encontrado." });
    console.error("[expenses DELETE]", e);
    return res.status(500).json({ ok: false, error: "No se pudo borrar el gasto." });
  }
});

function serializeExpense(gasto) {
  return {
    id: gasto.id,
    description: gasto.description,
    category: gasto.category,
    // Decimal de Prisma no sobrevive a JSON.stringify como número: sin esto la
    // pantalla recibe un objeto y muestra "[object Object]" donde va el monto.
    amount: Number(gasto.amount),
    currency: gasto.currency,
    paidAt: gasto.paidAt,
    notes: gasto.notes,
  };
}

// ── Backups ───────────────────────────────────────────────────────────────────
// El backup es de toda la base, no de una clínica: todas comparten esquema y
// archivo. Por eso vive en el panel de plataforma y no en la configuración de
// cada clínica.

router.get("/backups", requireAuth, requirePlatformAdmin, async (_req, res) => {
  try {
    const [schedule, backups] = await Promise.all([getSchedule(), listarBackups()]);
    return res.json({
      ok: true,
      schedule,
      backups,
      // El aviso lo calcula el servidor y no la pantalla: es la misma función
      // pura que cubren los tests, y así no depende de que el navegador vuelva
      // a razonar sobre fechas y frecuencias.
      alerta: alertaDeBackups(backups, new Date(), schedule),
      carpeta: path.join(backupRoot(), "db"),
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: "No se pudo leer el historial de backups." });
  }
});

router.post("/backups", requireAuth, requirePlatformAdmin, async (req, res) => {
  // El slot lleva la marca temporal completa: un backup manual nunca debe chocar
  // con otro ni con el automático.
  const slot = `manual-${timestamp()}`;
  try {
    const schedule = await getSchedule();
    const run = await ejecutarBackup({
      slot,
      trigger: "manual",
      userId: req.user.id,
      keepLast: schedule.keepLast,
    });
    if (!run) {
      return res.status(409).json({ ok: false, error: "Ya hay un backup corriendo en este momento." });
    }
    return res.json({ ok: true, run, message: "Backup creado." });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: `El backup falló: ${String(error.message || error).slice(0, 300)}`,
    });
  }
});

router.put("/backups/schedule", requireAuth, requirePlatformAdmin, async (req, res) => {
  try {
    const schedule = await saveSchedule(req.body || {});
    return res.json({ ok: true, schedule, message: "Programación guardada." });
  } catch (error) {
    return res.status(500).json({ ok: false, error: "No se pudo guardar la programación." });
  }
});

// Descarga en dos pasos: primero se pide un permiso de vida corta con el token
// de sesión, después el navegador navega a la URL firmada. Hace falta porque una
// descarga por navegación no lleva el header Authorization.
//
// Cinco minutos y un scope propio: aunque la URL quede en el historial o en un
// log de proxy, deja de servir enseguida y no vale para ninguna otra ruta.
router.post("/backups/:archivo/download-token", requireAuth, requirePlatformAdmin, async (req, res) => {
  const archivo = path.basename(String(req.params.archivo || ""));
  const completo = path.join(backupRoot(), "db", archivo);

  if (!archivo.endsWith(".sql.gz") || !fs.existsSync(completo)) {
    return res.status(404).json({ ok: false, error: "Ese backup ya no está disponible." });
  }

  // Autorización de UN SOLO USO guardada en base, no una firma sin estado. La
  // anterior era replicable durante los 5 minutos, y la URL con el token queda
  // en los logs del reverse proxy: cualquiera que la leyera ahí se bajaba la
  // base entera. El nombre del archivo va en el payload, así que en la URL no
  // queda nada manipulable.
  const token = await emitirAutorizacion({
    scope: "backup-download",
    payload: { archivo },
    ttlSegundos: 300,
  });
  return res.json({ ok: true, url: `/api/platform/backups/download?t=${token}` });
});

router.get("/backups/download", async (req, res) => {
  // El nombre del archivo ya NO viaja en la URL: sale del payload que se guardó
  // al emitir la autorización. Antes venía en el path y había que desconfiar de
  // él aunque estuviera firmado; ahora directamente no es manipulable.
  const payload = await reclamarAutorizacion({
    scope: "backup-download",
    token: String(req.query.t || ""),
  });

  if (!payload) {
    return res.status(403).json({
      ok: false,
      error: "Este enlace de descarga ya se usó o venció. Generalo de nuevo.",
    });
  }

  // basename igual, por si la fila se escribió alguna vez con una ruta.
  const archivo = path.basename(String(payload.archivo || ""));

  const completo = path.join(backupRoot(), "db", archivo);
  if (!archivo.endsWith(".sql.gz") || !fs.existsSync(completo)) {
    return res.status(404).json({ ok: false, error: "Ese backup ya no está disponible." });
  }

  logSecurityEvent("BACKUP_DOWNLOADED", req, { archivo });
  return res.download(completo, archivo);
});

module.exports = router;
