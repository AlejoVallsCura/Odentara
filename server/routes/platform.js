const express = require("express");
const bcrypt = require("bcrypt");

const prisma = require("../lib/prisma");
const { requireAuth } = require("../middleware/auth");
const { signToken } = require("../lib/auth");

const router = express.Router();

// Middleware: solo platform admin
function requirePlatformAdmin(req, res, next) {
  if (!req.permissions?.isPlatformAdmin) {
    return res.status(403).json({ ok: false, error: "Acceso restringido a administradores de plataforma." });
  }
  next();
}

// ── GET /api/platform/clinics ─────────────────────────────────────────────────
// Lista todas las clínicas con stats básicos
router.get("/clinics", requireAuth, requirePlatformAdmin, async (req, res) => {
  try {
    const clinics = await prisma.clinic.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: {
            users:         true,
            professionals: true,
            patients:      true,
            appointments:  true,
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
// KPIs globales de la plataforma
router.get("/stats", requireAuth, requirePlatformAdmin, async (req, res) => {
  try {
    const [totalClinics, activeClinics, totalUsers, totalPatients, totalProfessionals] = await Promise.all([
      prisma.clinic.count(),
      prisma.clinic.count({ where: { active: true } }),
      prisma.user.count({ where: { isPlatformAdmin: false } }),
      prisma.patient.count({ where: { deletedAt: null } }),
      prisma.professional.count({ where: { deletedAt: null } }),
    ]);

    // Turnos este mes
    const now = new Date();
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const appointmentsThisMonth = await prisma.appointment.count({
      where: { date: { gte: firstOfMonth }, deletedAt: null },
    });

    return res.json({
      ok: true,
      stats: {
        totalClinics,
        activeClinics,
        totalUsers,
        totalPatients,
        totalProfessionals,
        appointmentsThisMonth,
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
    const { name, slug, address, phone, email, plan, notes } = req.body;
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
      const existingUser = await prisma.user.findUnique({ where: { email: String(adminEmail).trim().toLowerCase() } });
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
    const { name, address, phone, email, plan, notes } = req.body;

    const { dbType, databaseUrl } = req.body;
    const clinic = await prisma.clinic.update({
      where: { id: clinicId },
      data: {
        name:        name    ? String(name).trim()    : undefined,
        address:     address     !== undefined ? (address     ? String(address).trim()                  : null) : undefined,
        phone:       phone       !== undefined ? (phone       ? String(phone).trim()                    : null) : undefined,
        email:       email       !== undefined ? (email       ? String(email).trim().toLowerCase()       : null) : undefined,
        plan:        plan        !== undefined ? (plan        ? String(plan).trim()                     : null) : undefined,
        notes:       notes       !== undefined ? (notes       ? String(notes).trim()                    : null) : undefined,
        dbType:      dbType      !== undefined ? (dbType === 'dedicated' ? 'dedicated' : 'shared')              : undefined,
        databaseUrl: databaseUrl !== undefined ? (databaseUrl ? String(databaseUrl).trim()              : null) : undefined,
      },
      include: { _count: { select: { users: true, professionals: true, patients: true, appointments: true } } },
    });

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

    const existingUser = await prisma.user.findUnique({ where: { email: String(email).trim().toLowerCase() } });
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
    const token = signToken({ userId: adminUser.id });
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
      select: { id: true, name: true, plan: true, active: true, createdAt: true },
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

      const owedPeriods = periods.filter(p => !paidPeriods.has(p));
      const isOverdue = owedPeriods.includes(currentPeriod) && now.getDate() > 10;
      const currentPaid = paidPeriods.has(currentPeriod);

      return {
        ...c,
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
    const { clinicId, period, amount, paymentMethod, paidAt, notes } = req.body;

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
        paymentMethod: String(paymentMethod),
        paidAt:        paidAt ? new Date(paidAt) : new Date(),
        notes:         notes ? String(notes).trim() : null,
      },
      update: {
        amount:        parseFloat(amount),
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

// ── Helpers ───────────────────────────────────────────────────────────────────
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
    dbType:      clinic.dbType || 'shared',
    databaseUrl: clinic.databaseUrl || null,
    createdAt:   clinic.createdAt,
    updatedAt:   clinic.updatedAt,
    stats: {
      users:         clinic._count?.users         || 0,
      professionals: clinic._count?.professionals || 0,
      patients:      clinic._count?.patients      || 0,
      appointments:  clinic._count?.appointments  || 0,
    },
  };
}

module.exports = router;
