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
              <div style="display:inline-flex;align-items:center;gap:10px;">
                <div style="width:36px;height:36px;background:rgba(255,255,255,0.2);border-radius:8px;display:inline-flex;align-items:center;justify-content:center;">
                  <span style="color:#fff;font-size:18px;">🦷</span>
                </div>
                <span style="color:#fff;font-size:20px;font-weight:700;letter-spacing:-0.02em;">Odentara</span>
              </div>
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

module.exports = { sendPasswordResetEmail, isEmailConfigured };
