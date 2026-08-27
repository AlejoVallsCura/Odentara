const cron = require("node-cron");
const prisma = require("./prisma");
const { sendAppointmentReminderEmail } = require("./email");

// Horas de anticipación para enviar el recordatorio (por defecto 24h)
const REMINDER_HOURS = Number(process.env.REMINDER_HOURS_BEFORE || 24);
const { BUSINESS_TIME_ZONE: BUSINESS_TZ } = require("./business-time");
const SEND_FROM_HOUR = 7;
const SEND_FROM_MINUTE = 30;
const SEND_UNTIL_HOUR = 21;

function isWithinSendingHours() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const hour = Number(parts.find((p) => p.type === "hour").value);
  const minute = Number(parts.find((p) => p.type === "minute").value);
  const totalMinutes = hour * 60 + minute;
  return totalMinutes >= SEND_FROM_HOUR * 60 + SEND_FROM_MINUTE && totalMinutes < SEND_UNTIL_HOUR * 60;
}

async function sendPendingReminders() {
  if (!isWithinSendingHours()) return;

  const now = new Date();
  const windowEnd = new Date(now.getTime() + REMINDER_HOURS * 60 * 60 * 1000);

  const appointments = await prisma.appointment.findMany({
    where: {
      deletedAt: null,
      status: "not_sent",
      confirmationSentAt: null,
      startTime: { gte: now, lte: windowEnd },
      patient: {
        deletedAt: null,
        email: { not: null },
      },
    },
    include: {
      patient: { select: { fullName: true, email: true } },
      professional: { select: { fullName: true } },
      clinic: { select: { name: true, phone: true } },
    },
  });

  if (appointments.length === 0) return;

  console.log(`[reminders] ${appointments.length} turno(s) para notificar...`);

  for (const appt of appointments) {
    try {
      // Reserva atómica: solo procede si confirmationSentAt sigue siendo null.
      // Evita doble envío si dos instancias corren al mismo tiempo (ej: durante deploy).
      const claimed = await prisma.appointment.updateMany({
        where: { id: appt.id, confirmationSentAt: null },
        data: {
          confirmationSentAt: new Date(),
          confirmationChannel: "email",
          status: "sent",
        },
      });

      if (claimed.count === 0) {
        console.log(`[reminders] Turno ${appt.id} ya procesado por otra instancia, omitiendo.`);
        continue;
      }

      try {
        await sendAppointmentReminderEmail({
          to: appt.patient.email,
          patientName: appt.patient.fullName,
          professionalName: appt.professional.fullName,
          clinicName: appt.clinic.name,
          clinicPhone: appt.clinic.phone ?? undefined,
          startTime: appt.startTime,
        });
        console.log(`[reminders] ✓ ${appt.patient.fullName} <${appt.patient.email}>`);
      } catch (emailErr) {
        // Si el envío falla, revertir para que el scheduler lo reintente.
        // Va "not_sent" y no "pending": ese valor no existe en AppointmentStatus,
        // así que la reversión fallaba, el error moría en el .catch de abajo y el
        // turno quedaba marcado como avisado sin que el mail hubiera salido —
        // nunca se reintentaba y nadie se enteraba.
        console.error(`[reminders] Error enviando email para turno ${appt.id}:`, emailErr.message);
        await prisma.appointment.updateMany({
          where: { id: appt.id },
          data: { confirmationSentAt: null, confirmationChannel: null, status: "not_sent" },
        }).catch((e) => console.error(`[reminders] Error al revertir turno ${appt.id}:`, e.message));
      }
    } catch (err) {
      console.error(`[reminders] Error en turno ${appt.id}:`, err.message);
    }
  }
}

// Los recordatorios automáticos por mail están APAGADOS: la confirmación de
// turnos se hace por WhatsApp desde el dashboard, que es manual y a cargo de la
// secretaria. El código se conserva funcionando —no comentado— para poder
// encenderlo cuando haga falta, poniendo REMINDERS_EMAIL_ENABLED=true en el
// entorno. No requiere tocar código ni volver a deployar.
function remindersEnabled() {
  return String(process.env.REMINDERS_EMAIL_ENABLED || "").toLowerCase() === "true";
}

function startReminderScheduler() {
  if (!remindersEnabled()) {
    console.log("[reminders] Recordatorios por mail desactivados (REMINDERS_EMAIL_ENABLED no está en true). La confirmación se hace por WhatsApp.");
    return;
  }

  // Ejecuta cada 15 minutos
  cron.schedule("*/15 * * * *", async () => {
    try {
      await sendPendingReminders();
    } catch (err) {
      console.error("[reminders] Error en scheduler:", err.message);
    }
  });

  console.log(`[reminders] Scheduler iniciado — recordatorios ${REMINDER_HOURS}h antes del turno`);
}

module.exports = { startReminderScheduler, sendPendingReminders };
