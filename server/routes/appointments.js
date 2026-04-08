const express = require("express");

const prisma = require("../lib/prisma");
const { requireAuth } = require("../middleware/auth");
const {
  canAccessWholeClinic,
  getAccessibleProfessionalIds,
  canManageAppointments,
  canEditAppointments,
} = require("../lib/permissions");

const router = express.Router();

const VALID_STATUSES = new Set(["not_sent", "sent", "confirmed", "cancelled"]);
const VALID_CHANNELS = new Set(["whatsapp", "phone", "email", "manual"]);

function getTodayIsoLocal() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateOnly(dateStr) {
  const [year, month, day] = String(dateStr).split("-").map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
}

function formatLocalDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatLocalTime(date) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function parseDateTime(dateStr, timeStr) {
  const [year, month, day] = String(dateStr).split("-").map(Number);
  const [hours, minutes] = String(timeStr).split(":").map(Number);
  return new Date(year, (month || 1) - 1, day || 1, hours || 0, minutes || 0, 0, 0);
}

function timeToMinutes(timeStr = "") {
  const [hours, minutes] = String(timeStr).split(":").map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  return hours * 60 + minutes;
}

function currentMinutes() {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

function buildAppointmentAccessWhere(permissions) {
  if (canAccessWholeClinic(permissions)) {
    return {};
  }

  const ids = getAccessibleProfessionalIds(permissions);
  if (ids.length === 0) {
    return { id: -1 };
  }

  return {
    professionalId: { in: ids },
  };
}

function serializeAppointment(appointment) {
  return {
    id: appointment.id,
    patientId: appointment.patientId,
    professionalId: appointment.professionalId,
    createdByUserId: appointment.createdByUserId,
    date: appointment.date,
    startTime: appointment.startTime,
    durationMinutes: appointment.durationMinutes,
    status: appointment.status,
    isOverbook: appointment.isOverbook,
    confirmationChannel: appointment.confirmationChannel,
    confirmationSentAt: appointment.confirmationSentAt,
    confirmationResponseAt: appointment.confirmationResponseAt,
    cancellationReason: appointment.cancellationReason,
    notes: appointment.notes,
    createdAt: appointment.createdAt,
    updatedAt: appointment.updatedAt,
    patient: appointment.patient
      ? {
          id: appointment.patient.id,
          fullName: appointment.patient.fullName,
          dni: appointment.patient.dni,
          phone: appointment.patient.phone,
        }
      : null,
    professional: appointment.professional
      ? {
          id: appointment.professional.id,
          fullName: appointment.professional.fullName,
          color: appointment.professional.color,
        }
      : null,
    createdByUser: appointment.createdByUser
      ? {
          id: appointment.createdByUser.id,
          email: appointment.createdByUser.email,
          fullName: appointment.createdByUser.fullName,
        }
      : null,
  };
}

async function ensureAccessibleProfessional(permissions, professionalId) {
  if (canAccessWholeClinic(permissions)) {
    return true;
  }

  const ids = getAccessibleProfessionalIds(permissions);
  return ids.includes(professionalId);
}

async function validateAppointmentPayload(
  payload,
  permissions,
  currentAppointmentId = null,
  existingAppointment = null
) {
  if (!payload.patientId || !payload.professionalId || !payload.date || !payload.time) {
    return "Paciente, profesional, fecha y hora son obligatorios.";
  }

  if (!(await ensureAccessibleProfessional(permissions, payload.professionalId))) {
    return "No tenes acceso al profesional seleccionado.";
  }

  const patient = await prisma.patient.findUnique({
    where: { id: payload.patientId },
    select: { id: true },
  });

  if (!patient) {
    return "El paciente seleccionado no existe.";
  }

  const professional = await prisma.professional.findUnique({
    where: { id: payload.professionalId },
    select: { id: true, active: true },
  });

  if (!professional || !professional.active) {
    return "El profesional seleccionado no existe o está inactivo.";
  }

  const todayIso = getTodayIsoLocal();
  if (payload.date < todayIso) {
    return "No se pueden crear turnos para dias anteriores.";
  }

  if (payload.date === todayIso) {
    const selectedMinutes = timeToMinutes(payload.time);
    const keepsSameSlot =
      existingAppointment &&
      formatLocalDate(existingAppointment.date) === payload.date &&
      formatLocalTime(existingAppointment.startTime) === payload.time &&
      existingAppointment.professionalId === payload.professionalId &&
      existingAppointment.isOverbook === payload.isOverbook;

    if (
      selectedMinutes !== null &&
      selectedMinutes < currentMinutes() &&
      !payload.isOverbook &&
      !keepsSameSlot
    ) {
      return "Los horarios pasados de hoy solo admiten sobreturnos.";
    }
  }

  const existing = await prisma.appointment.findFirst({
    where: {
      professionalId: payload.professionalId,
      date: parseDateOnly(payload.date),
      startTime: parseDateTime(payload.date, payload.time),
      ...(currentAppointmentId ? { id: { not: currentAppointmentId } } : {}),
    },
    select: { id: true, isOverbook: true },
  });

  if (existing && !payload.isOverbook) {
    return "Ya existe un turno en ese horario para el profesional.";
  }

  return null;
}

router.get("/", requireAuth, async (req, res) => {
  try {
    const date = String(req.query.date || "").trim();
    const professionalId = req.query.professionalId ? Number(req.query.professionalId) : null;
    const patientSearch = String(req.query.q || "").trim();

    const filters = [];

    if (date) {
      filters.push({ date: parseDateOnly(date) });
    }

    if (professionalId) {
      filters.push({ professionalId });
    }

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
        AND: [buildAppointmentAccessWhere(req.permissions), ...filters],
      },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
      include: {
        patient: {
          select: { id: true, fullName: true, dni: true, phone: true },
        },
        professional: {
          select: { id: true, fullName: true, color: true },
        },
        createdByUser: {
          select: { id: true, email: true, fullName: true },
        },
      },
    });

    return res.json({
      ok: true,
      appointments: appointments.map(serializeAppointment),
    });
  } catch (_error) {
    return res.status(500).json({ ok: false, error: "No se pudieron listar los turnos." });
  }
});

router.get("/:id", requireAuth, async (req, res) => {
  try {
    const appointment = await prisma.appointment.findFirst({
      where: {
        id: Number(req.params.id),
        ...buildAppointmentAccessWhere(req.permissions),
      },
      include: {
        patient: {
          select: { id: true, fullName: true, dni: true, phone: true },
        },
        professional: {
          select: { id: true, fullName: true, color: true },
        },
        createdByUser: {
          select: { id: true, email: true, fullName: true },
        },
      },
    });

    if (!appointment) {
      return res.status(404).json({ ok: false, error: "Turno no encontrado o sin acceso." });
    }

    return res.json({
      ok: true,
      appointment: serializeAppointment(appointment),
    });
  } catch (_error) {
    return res.status(500).json({ ok: false, error: "No se pudo obtener el turno." });
  }
});

router.post("/", requireAuth, async (req, res) => {
  try {
    if (!canManageAppointments(req.permissions)) {
      return res.status(403).json({ ok: false, error: "No tenes permisos para crear turnos." });
    }

    const payload = {
      patientId: Number(req.body.patientId),
      professionalId: Number(req.body.professionalId),
      date: String(req.body.date || "").trim(),
      time: String(req.body.time || "").trim(),
      durationMinutes: Number(req.body.durationMinutes || 30),
      status: VALID_STATUSES.has(req.body.status) ? req.body.status : "not_sent",
      isOverbook: Boolean(req.body.isOverbook),
      confirmationChannel: VALID_CHANNELS.has(req.body.confirmationChannel)
        ? req.body.confirmationChannel
        : null,
      confirmationSentAt: req.body.confirmationSentAt ? new Date(req.body.confirmationSentAt) : null,
      confirmationResponseAt: req.body.confirmationResponseAt
        ? new Date(req.body.confirmationResponseAt)
        : null,
      cancellationReason: req.body.cancellationReason ? String(req.body.cancellationReason).trim() : null,
      notes: req.body.notes ? String(req.body.notes).trim() : null,
    };

    const validationError = await validateAppointmentPayload(payload, req.permissions);
    if (validationError) {
      return res.status(400).json({ ok: false, error: validationError });
    }

    const appointment = await prisma.appointment.create({
      data: {
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
      },
      include: {
        patient: {
          select: { id: true, fullName: true, dni: true, phone: true },
        },
        professional: {
          select: { id: true, fullName: true, color: true },
        },
        createdByUser: {
          select: { id: true, email: true, fullName: true },
        },
      },
    });

    return res.status(201).json({
      ok: true,
      appointment: serializeAppointment(appointment),
    });
  } catch (_error) {
    return res.status(500).json({ ok: false, error: "No se pudo crear el turno." });
  }
});

router.put("/:id", requireAuth, async (req, res) => {
  try {
    if (!canEditAppointments(req.permissions)) {
      return res.status(403).json({ ok: false, error: "No tenes permisos para editar turnos." });
    }

    const appointmentId = Number(req.params.id);
    const existing = await prisma.appointment.findFirst({
      where: {
        id: appointmentId,
        ...buildAppointmentAccessWhere(req.permissions),
      },
    });

    if (!existing) {
      return res.status(404).json({ ok: false, error: "Turno no encontrado o sin acceso." });
    }

    const payload = {
      patientId: Number(req.body.patientId ?? existing.patientId),
      professionalId: Number(req.body.professionalId ?? existing.professionalId),
      date: String(req.body.date || formatLocalDate(existing.date)).trim(),
      time: String(req.body.time || formatLocalTime(existing.startTime)).trim(),
      durationMinutes: Number(req.body.durationMinutes ?? existing.durationMinutes),
      status: VALID_STATUSES.has(req.body.status) ? req.body.status : existing.status,
      isOverbook: req.body.isOverbook !== undefined ? Boolean(req.body.isOverbook) : existing.isOverbook,
      confirmationChannel: req.body.confirmationChannel
        ? VALID_CHANNELS.has(req.body.confirmationChannel)
          ? req.body.confirmationChannel
          : null
        : existing.confirmationChannel,
      confirmationSentAt:
        req.body.confirmationSentAt !== undefined
          ? req.body.confirmationSentAt
            ? new Date(req.body.confirmationSentAt)
            : null
          : existing.confirmationSentAt,
      confirmationResponseAt:
        req.body.confirmationResponseAt !== undefined
          ? req.body.confirmationResponseAt
            ? new Date(req.body.confirmationResponseAt)
            : null
          : existing.confirmationResponseAt,
      cancellationReason:
        req.body.cancellationReason !== undefined
          ? req.body.cancellationReason
            ? String(req.body.cancellationReason).trim()
            : null
          : existing.cancellationReason,
      notes:
        req.body.notes !== undefined ? (req.body.notes ? String(req.body.notes).trim() : null) : existing.notes,
    };

    const validationError = await validateAppointmentPayload(
      payload,
      req.permissions,
      appointmentId,
      existing
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
      },
      include: {
        patient: {
          select: { id: true, fullName: true, dni: true, phone: true },
        },
        professional: {
          select: { id: true, fullName: true, color: true },
        },
        createdByUser: {
          select: { id: true, email: true, fullName: true },
        },
      },
    });

    return res.json({
      ok: true,
      appointment: serializeAppointment(appointment),
    });
  } catch (_error) {
    return res.status(500).json({ ok: false, error: "No se pudo actualizar el turno." });
  }
});

router.delete("/:id", requireAuth, async (req, res) => {
  try {
    if (!canManageAppointments(req.permissions)) {
      return res.status(403).json({ ok: false, error: "No tenes permisos para eliminar turnos." });
    }

    const appointment = await prisma.appointment.findFirst({
      where: {
        id: Number(req.params.id),
        ...buildAppointmentAccessWhere(req.permissions),
      },
      select: { id: true },
    });

    if (!appointment) {
      return res.status(404).json({ ok: false, error: "Turno no encontrado o sin acceso." });
    }

    await prisma.appointment.delete({
      where: { id: appointment.id },
    });

    return res.json({
      ok: true,
      message: "Turno eliminado correctamente.",
    });
  } catch (error) {
    const message =
      error?.code === "P2003"
        ? "No se puede eliminar el turno porque tiene registros relacionados."
        : "No se pudo eliminar el turno.";
    return res.status(400).json({ ok: false, error: message });
  }
});

module.exports = router;
