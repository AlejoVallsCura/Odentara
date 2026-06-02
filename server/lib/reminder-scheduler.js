const cron = require("node-cron");
const prisma = require("./prisma");
const { sendAppointmentReminderEmail } = require("./email");

// Horas de anticipación para enviar el recordatorio (por defecto 24h)
const REMINDER_HOURS = Number(process.env.REMINDER_HOURS_BEFORE || 24);
const BUSINESS_TZ = "America/Buenos_Aires";
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

      await sendAppointmentReminderEmail({
        to: appt.patient.email,
        patientName: appt.patient.fullName,
        professionalName: appt.professional.fullName,
        clinicName: appt.clinic.name,
        clinicPhone: appt.clinic.phone ?? undefined,
        startTime: appt.startTime,
      });

      console.log(`[reminders] ✓ ${appt.patient.fullName} <${appt.patient.email}>`);
    } catch (err) {
      console.error(`[reminders] Error en turno ${appt.id}:`, err.message);
    }
  }
}

function startReminderScheduler() {
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
