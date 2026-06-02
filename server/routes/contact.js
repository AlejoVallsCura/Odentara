const express = require("express");
const { sendContactEmail } = require("../lib/email");
const { contactLimiter } = require("../middleware/rate-limit");

const router = express.Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.post("/", contactLimiter, async (req, res) => {
  // Honeypot — si viene relleno es un bot
  if (req.body?.website) {
    return res.json({ ok: true });
  }

  const name    = String(req.body?.name    || "").trim();
  const email   = String(req.body?.email   || "").trim();
  const phone   = String(req.body?.phone   || "").trim();
  const clinic  = String(req.body?.clinic  || "").trim();
  const message = String(req.body?.message || "").trim();

  if (!name || !email || !clinic) {
    return res.status(422).json({ ok: false, error: "Completa nombre, email y consultorio." });
  }

  if (!EMAIL_RE.test(email)) {
    return res.status(422).json({ ok: false, error: "Email invalido." });
  }

  try {
    await sendContactEmail({ name, email, phone, clinic, message });
    return res.json({ ok: true });
  } catch (err) {
    console.error("[contact] Error enviando email:", err.message);
    // Devolvemos ok:true igual para no perder el lead — el log queda en servidor
    return res.json({ ok: true, emailSent: false });
  }
});

module.exports = router;
