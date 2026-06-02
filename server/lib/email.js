/**
 * Módulo de email — usa nodemailer con SMTP configurable.
 *
 * Variables de entorno necesarias:
 *   SMTP_HOST     — ej. smtp.gmail.com | smtp.resend.com
 *   SMTP_PORT     — ej. 587 (TLS) | 465 (SSL)
 *   SMTP_SECURE   — "true" para SSL (puerto 465), "false" para TLS (587)
 *   SMTP_USER     — tu usuario SMTP
 *   SMTP_PASS     — tu contraseña SMTP (o App Password si usás Gmail)
 *   SMTP_FROM     — ej. "Odentara <noreply@odentara.com>"
 *   APP_URL       — ej. https://odentara.com (sin trailing slash)
 */

const nodemailer = require("nodemailer");

function isEmailConfigured() {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function createTransport() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

/**
 * Envía el email de recuperación de contraseña.
 * @param {{ to: string, resetUrl: string, userName: string }} opts
 */
async function sendPasswordResetEmail({ to, resetUrl, userName }) {
  if (!isEmailConfigured()) {
    // En desarrollo, solo logueamos el link para poder probarlo sin SMTP
    console.warn("[email] SMTP no configurado. Link de reset (solo desarrollo):");
    console.warn(`[email] ${resetUrl}`);
    return;
  }

  const transporter = createTransport();
  const fromName = process.env.SMTP_FROM || "Odentara <noreply@odentara.com>";

  await transporter.sendMail({
    from: fromName,
    to,
    subject: "Recuperar contraseña — Odentara",
    text: [
      `Hola ${userName},`,
      "",
      "Recibimos una solicitud para recuperar tu contraseña de Odentara.",
      "",
      "Hacé clic en el siguiente enlace para crear una nueva contraseña (válido por 1 hora):",
      "",
      resetUrl,
      "",
      "Si no solicitaste este cambio, podés ignorar este email. Tu contraseña no cambiará.",
      "",
      "— Equipo Odentara",
    ].join("\n"),
    html: `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#7c3aed,#a78bfa);padding:32px;text-align:center;">
              <span style="color:#fff;font-size:22px;font-weight:800;letter-spacing:-0.03em;">Odentara</span>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:36px 40px 28px;">
              <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#0f172a;letter-spacing:-0.02em;">
                Recuperar contraseña
              </h1>
              <p style="margin:0 0 24px;color:#64748b;font-size:15px;line-height:1.6;">
                Hola <strong style="color:#0f172a;">${userName}</strong>, recibimos una solicitud para restablecer la contraseña de tu cuenta.
              </p>
              <a href="${resetUrl}"
                 style="display:inline-block;background:linear-gradient(135deg,#7c3aed,#9333ea);color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:8px;font-size:15px;font-weight:600;letter-spacing:-0.01em;">
                Crear nueva contraseña
              </a>
              <p style="margin:24px 0 0;color:#94a3b8;font-size:13px;line-height:1.6;">
                Este enlace expira en <strong>1 hora</strong>. Si no solicitaste este cambio, ignorá este email — tu contraseña no se modificará.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:20px 40px 28px;border-top:1px solid #f1f5f9;">
              <p style="margin:0;color:#cbd5e1;font-size:12px;">
                Si el botón no funciona, copiá este link en tu navegador:<br>
                <a href="${resetUrl}" style="color:#7c3aed;word-break:break-all;">${resetUrl}</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
  });
}

/**
 * Envía el email de solicitud de demo desde la landing page.
 * @param {{ name: string, email: string, clinic: string, message: string }} opts
 */
async function sendContactEmail({ name, email, phone, clinic, message }) {
  const to = process.env.CONTACT_EMAIL || "contacto@odentara.com";
  const subject = `Nueva solicitud de demo Odentara - ${clinic}`;
  const body = [
    "Nueva solicitud desde la landing de Odentara.",
    "",
    `Nombre:      ${name}`,
    `Email:       ${email}`,
    `Teléfono:    ${phone || "No indicado"}`,
    `Consultorio: ${clinic}`,
    "",
    "Mensaje:",
    message || "Sin mensaje adicional.",
    "",
    `Fecha: ${new Date().toISOString()}`,
  ].join("\n");

  if (!isEmailConfigured()) {
    console.warn("[contact] SMTP no configurado. Solicitud recibida:");
    console.warn(body);
    return;
  }

  const transporter = createTransport();
  const fromName = process.env.SMTP_FROM || "Odentara Web <noreply@odentara.com>";

  await transporter.sendMail({
    from: fromName,
    to,
    replyTo: `${name} <${email}>`,
    subject,
    text: body,
    html: `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:40px 20px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;">
        <tr><td style="background:linear-gradient(135deg,#0f766e,#0b4f4a);padding:28px 32px;">
          <span style="color:#fff;font-size:20px;font-weight:800;letter-spacing:-0.03em;">Odentara</span>
          <span style="color:rgba(255,255,255,0.7);font-size:13px;margin-left:10px;">Nueva solicitud de demo</span>
        </td></tr>
        <tr><td style="padding:32px 40px 28px;">
          <p style="margin:0 0 20px;font-size:14px;color:#64748b;">Recibiste una consulta desde odentara.com</p>
          <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
            <tr><td style="padding:10px 0;border-bottom:1px solid #f1f5f9;font-size:13px;color:#94a3b8;width:110px;">Nombre</td><td style="padding:10px 0;border-bottom:1px solid #f1f5f9;font-size:14px;font-weight:600;color:#0f172a;">${name}</td></tr>
            <tr><td style="padding:10px 0;border-bottom:1px solid #f1f5f9;font-size:13px;color:#94a3b8;">Email</td><td style="padding:10px 0;border-bottom:1px solid #f1f5f9;font-size:14px;color:#0f172a;"><a href="mailto:${email}" style="color:#0f766e;">${email}</a></td></tr>
            <tr><td style="padding:10px 0;border-bottom:1px solid #f1f5f9;font-size:13px;color:#94a3b8;">Teléfono</td><td style="padding:10px 0;border-bottom:1px solid #f1f5f9;font-size:14px;color:#0f172a;">${phone || "No indicado"}</td></tr>
            <tr><td style="padding:10px 0;border-bottom:1px solid #f1f5f9;font-size:13px;color:#94a3b8;">Consultorio</td><td style="padding:10px 0;border-bottom:1px solid #f1f5f9;font-size:14px;font-weight:600;color:#0f172a;">${clinic}</td></tr>
          </table>
          ${message ? `<div style="margin-top:20px;padding:16px;background:#f8fafc;border-radius:8px;border-left:3px solid #0f766e;"><p style="margin:0;font-size:14px;color:#334155;line-height:1.6;">${message.replace(/\n/g, "<br>")}</p></div>` : ""}
        </td></tr>
        <tr><td style="padding:16px 40px 24px;border-top:1px solid #f1f5f9;">
          <p style="margin:0;color:#cbd5e1;font-size:12px;">Podés responder directamente a este email para contactar a ${name}.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
  });
}

const BUSINESS_TZ = "America/Buenos_Aires";

function formatAppointmentDateTime(startTime) {
  // startTime viene de MySQL como datetime naive (sin timezone) — representa hora local Argentina.
  // Prisma lo expone como Date UTC, por lo que hay que leerlo en UTC para no restar las 3h de offset.
  const dateStr = new Intl.DateTimeFormat("es-AR", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(startTime);
  const timeStr = new Intl.DateTimeFormat("es-AR", {
    timeZone: "UTC",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(startTime);
  const dateFormatted = dateStr.charAt(0).toUpperCase() + dateStr.slice(1);
  return { dateFormatted, timeStr };
}

/**
 * Envía recordatorio de turno al paciente por email.
 * @param {{ to: string, patientName: string, professionalName: string, clinicName: string, clinicPhone?: string, startTime: Date }} opts
 */
async function sendAppointmentReminderEmail({ to, patientName, professionalName, clinicName, clinicPhone, startTime }) {
  const { dateFormatted, timeStr } = formatAppointmentDateTime(startTime);

  if (!isEmailConfigured()) {
    console.log(`[reminders] SMTP no configurado. Recordatorio para ${patientName} (${to}) — ${dateFormatted} ${timeStr}`);
    return;
  }

  const transporter = createTransport();
  const fromName = process.env.SMTP_FROM || "Odentara <noreply@odentara.com>";

  await transporter.sendMail({
    from: fromName,
    to,
    subject: `Recordatorio de turno — ${dateFormatted}`,
    text: [
      `Hola ${patientName},`,
      "",
      "Te recordamos que tenés un turno programado:",
      "",
      `  Fecha:       ${dateFormatted}`,
      `  Hora:        ${timeStr}`,
      `  Profesional: ${professionalName}`,
      `  Clínica:     ${clinicName}`,
      clinicPhone ? `  Teléfono:    ${clinicPhone}` : "",
      "",
      "Si no podés asistir, por favor comunicáte con la clínica para reprogramar.",
      "",
      "— Equipo Odentara",
    ]
      .filter((l) => l !== undefined)
      .join("\n"),
    html: `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;">
          <tr>
            <td style="background:linear-gradient(135deg,#7c3aed,#a78bfa);padding:32px;text-align:center;">
              <span style="color:#fff;font-size:22px;font-weight:800;letter-spacing:-0.03em;">Odentara</span>
            </td>
          </tr>
          <tr>
            <td style="padding:36px 40px 28px;">
              <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#0f172a;letter-spacing:-0.02em;">
                Recordatorio de turno
              </h1>
              <p style="margin:0 0 28px;color:#64748b;font-size:15px;line-height:1.6;">
                Hola <strong style="color:#0f172a;">${patientName}</strong>, te recordamos que tenés un turno programado en <strong style="color:#0f172a;">${clinicName}</strong>.
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:10px;border:1px solid #e2e8f0;overflow:hidden;margin-bottom:24px;">
                <tr>
                  <td style="padding:16px 20px;border-bottom:1px solid #e2e8f0;">
                    <span style="display:block;font-size:11px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px;">Fecha</span>
                    <span style="font-size:16px;font-weight:700;color:#0f172a;">${dateFormatted}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:16px 20px;border-bottom:1px solid #e2e8f0;">
                    <span style="display:block;font-size:11px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px;">Hora</span>
                    <span style="font-size:16px;font-weight:700;color:#0f172a;">${timeStr} hs</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:16px 20px;${clinicPhone ? "border-bottom:1px solid #e2e8f0;" : ""}">
                    <span style="display:block;font-size:11px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px;">Profesional</span>
                    <span style="font-size:15px;font-weight:600;color:#0f172a;">${professionalName}</span>
                  </td>
                </tr>
                ${
                  clinicPhone
                    ? `<tr>
                  <td style="padding:16px 20px;">
                    <span style="display:block;font-size:11px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px;">Teléfono clínica</span>
                    <span style="font-size:15px;color:#0f172a;">${clinicPhone}</span>
                  </td>
                </tr>`
                    : ""
                }
              </table>
              <p style="margin:0;color:#94a3b8;font-size:13px;line-height:1.6;">
                Si no podés asistir, por favor comunicáte con la clínica para reprogramar tu turno.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 40px 28px;border-top:1px solid #f1f5f9;">
              <p style="margin:0;color:#cbd5e1;font-size:12px;">
                Este es un mensaje automático de Odentara. Por favor no respondas a este email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
  });
}

module.exports = { sendPasswordResetEmail, sendContactEmail, sendAppointmentReminderEmail, isEmailConfigured };
