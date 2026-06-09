const express = require("express");

const { logDeleteAudit } = require("../lib/audit");
const { requireAuth } = require("../middleware/auth");
const {
  canManageAppointments,
  canEditAppointments,
} = require("../lib/permissions");
const { buildAppointmentAccessWhere } = require("../lib/access");
const {
  VALID_STATUSES,
  VALID_CHANNELS,
  APPOINTMENT_INCLUDE,
  parseDateOnly,
  formatLocalDate,
  formatLocalTime,
  parseDateTime,
  serializeAppointment,
  buildAppointmentPayload,
  validateAppointmentPayload,
} = require("../services/appointment.service");

const router = express.Router();

// ── GET / ─────────────────────────────────────────────────────────────────────
router.get("/", requireAuth, async (req, res) => {
  try {
    const prisma = req.prisma;
    const date = String(req.query.date || "").trim();
    const professionalId = req.query.professionalId ? Number(req.query.professionalId) : null;
    const patientSearch = String(req.query.q || "").trim();

    const filters = [];
    if (date) filters.push({ date: parseDateOnly(date) });
    if (professionalId) filters.push({ professionalId });
    if (patientSearch) {
      filters.push({
        patient: {
          OR: [
            { fullName: { contains: patientSearch, mode: "insensitive" } },
            { dni: { contains: patientSearch.replace(/\D/g, "") } },
          ],
        },
      });
    }

    const appointments = await prisma.appointment.findMany({
      where: {
        AND: [buildAppointmentAccessWhere(req.permissions, req.user.clinicId), ...filters],
      },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
      include: APPOINTMENT_INCLUDE,
    });

    return res.json({ ok: true, appointments: appointments.map(serializeAppointment) });
  } catch (_error) {
    return res.status(500).json({ ok: false, error: "No se pudieron listar los turnos." });
  }
});

// ── GET /:id ──────────────────────────────────────────────────────────────────
router.get("/:id", requireAuth, async (req, res) => {
  try {
    const prisma = req.prisma;
    const appointment = await prisma.appointment.findFirst({
      where: {
        id: Number(req.params.id),
        ...buildAppointmentAccessWhere(req.permissions, req.user.clinicId),
      },
      include: APPOINTMENT_INCLUDE,
    });

    if (!appointment) {
      return res.status(404).json({ ok: false, error: "Turno no encontrado o sin acceso." });
    }

    return res.json({ ok: true, appointment: serializeAppointment(appointment) });
  } catch (_error) {
    return res.status(500).json({ ok: false, error: "No se pudo obtener el turno." });
  }
});

// ── POST / ────────────────────────────────────────────────────────────────────
router.post("/", requireAuth, async (req, res) => {
  try {
    const prisma = req.prisma;
    if (!canManageAppointments(req.permissions)) {
      return res.status(403).json({ ok: false, error: "No tenes permisos para crear turnos." });
    }

    const payload = buildAppointmentPayload(req.body);

    const validationError = await validateAppointmentPayload(
      prisma, payload, req.permissions, req.user.clinicId
    );
    if (validationError) {
      return res.status(400).json({ ok: false, error: validationError });
    }

    const appointment = await prisma.appointment.create({
      data: {
        clinicId: req.user.clinicId,
        patientId: payload.patientId,
        professionalId: payload.professionalId,
        createdByUserId: req.user.id,
        date: parseDateOnly(payload.date),
        startTime: parseDateTime(payload.date, payload.time),
        durationMinutes: payload.durationMinutes,
        status: payload.status,
        isOverbook: payload.isOverbook,
        confirmationChannel: payload.confirmationChannel,
        confirmationSentAt: payload.confirmationSentAt,
        confirmationResponseAt: payload.confirmationResponseAt,
        cancellationReason: payload.cancellationReason,
        notes: payload.notes,
        deletedAt: null,
      },
      include: APPOINTMENT_INCLUDE,
    });

    return res.status(201).json({ ok: true, appointment: serializeAppointment(appointment) });
  } catch (_error) {
    return res.status(500).json({ ok: false, error: "No se pudo crear el turno." });
  }
});

// ── PUT /:id ──────────────────────────────────────────────────────────────────
router.put("/:id", requireAuth, async (req, res) => {
  try {
    const prisma = req.prisma;
    if (!canEditAppointments(req.permissions)) {
      return res.status(403).json({ ok: false, error: "No tenes permisos para editar turnos." });
    }

    const appointmentId = Number(req.params.id);
    const existing = await prisma.appointment.findFirst({
      where: {
        id: appointmentId,
        ...buildAppointmentAccessWhere(req.permissions, req.user.clinicId),
      },
    });

    if (!existing) {
      return res.status(404).json({ ok: false, error: "Turno no encontrado o sin acceso." });
    }

    const payload = buildAppointmentPayload(req.body, existing);

    const validationError = await validateAppointmentPayload(
      prisma, payload, req.permissions, req.user.clinicId, appointmentId, existing
    );
    if (validationError) {
      return res.status(400).json({ ok: false, error: validationError });
    }

    const appointment = await prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        patientId: payload.patientId,
        professionalId: payload.professionalId,
        date: parseDateOnly(payload.date),
        startTime: parseDateTime(payload.date, payload.time),
        durationMinutes: payload.durationMinutes,
        status: payload.status,
        isOverbook: payload.isOverbook,
        confirmationChannel: payload.confirmationChannel,
        confirmationSentAt: payload.confirmationSentAt,
        confirmationResponseAt: payload.confirmationResponseAt,
        cancellationReason: payload.cancellationReason,
        notes: payload.notes,
        deletedAt: null,
      },
      include: APPOINTMENT_INCLUDE,
    });

    return res.json({ ok: true, appointment: serializeAppointment(appointment) });
  } catch (_error) {
    return res.status(500).json({ ok: false, error: "No se pudo actualizar el turno." });
  }
});

// ── PATCH /:id ────────────────────────────────────────────────────────────────
router.patch("/:id", requireAuth, async (req, res) => {
  try {
    const prisma = req.prisma;
    if (!canEditAppointments(req.permissions)) {
      return res.status(403).json({ ok: false, error: "No tenes permisos para editar turnos." });
    }

    const appointmentId = Number(req.params.id);
    const existing = await prisma.appointment.findFirst({
      where: {
        id: appointmentId,
        ...buildAppointmentAccessWhere(req.permissions, req.user.clinicId),
      },
    });

    if (!existing) {
      return res.status(404).json({ ok: false, error: "Turno no encontrado o sin acceso." });
    }

    const data = {};
    if (req.body.status !== undefined && VALID_STATUSES.has(req.body.status)) {
      data.status = req.body.status;
    }
    if (req.body.cancellationReason !== undefined) {
      data.cancellationReason = req.body.cancellationReason
        ? String(req.body.cancellationReason).trim()
        : null;
    }
    if (req.body.confirmationChannel !== undefined && VALID_CHANNELS.has(req.body.confirmationChannel)) {
      data.confirmationChannel = req.body.confirmationChannel;
    }
    if (req.body.confirmationSentAt !== undefined) {
      data.confirmationSentAt = req.body.confirmationSentAt
        ? new Date(req.body.confirmationSentAt)
        : null;
    }
    if (req.body.confirmationResponseAt !== undefined) {
      data.confirmationResponseAt = req.body.confirmationResponseAt
        ? new Date(req.body.confirmationResponseAt)
        : null;
    }
    if (req.body.notes !== undefined) {
      data.notes = req.body.notes ? String(req.body.notes).trim() : null;
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ ok: false, error: "No se enviaron campos para actualizar." });
    }

    const appointment = await prisma.appointment.update({
      where: { id: appointmentId },
      data,
      include: APPOINTMENT_INCLUDE,
    });

    return res.json({ ok: true, appointment: serializeAppointment(appointment) });
  } catch (_error) {
    return res.status(500).json({ ok: false, error: "No se pudo actualizar el turno." });
  }
});

// ── DELETE /:id ───────────────────────────────────────────────────────────────
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const prisma = req.prisma;
    if (!canManageAppointments(req.permissions)) {
      return res.status(403).json({ ok: false, error: "No tenes permisos para eliminar turnos." });
    }

    const appointment = await prisma.appointment.findFirst({
      where: {
        id: Number(req.params.id),
        ...buildAppointmentAccessWhere(req.permissions, req.user.clinicId),
      },
      select: { id: true },
    });

    if (!appointment) {
      return res.status(404).json({ ok: false, error: "Turno no encontrado o sin acceso." });
    }

    const existing = await prisma.appointment.findUnique({
      where: { id: appointment.id },
      include: { patient: true, professional: true },
    });

    await prisma.appointment.update({
      where: { id: appointment.id },
      data: { status: "cancelled", deletedAt: new Date() },
    });

    await logDeleteAudit(prisma, req.user.id, "Appointment", appointment.id, {
      appointment: existing,
    });

    return res.json({ ok: true, message: "Turno eliminado correctamente." });
  } catch (error) {
    const message =
      error?.code === "P2003"
        ? "No se puede eliminar el turno porque tiene registros relacionados."
        : "No se pudo eliminar el turno.";
    return res.status(400).json({ ok: false, error: message });
  }
});

module.exports = router;
