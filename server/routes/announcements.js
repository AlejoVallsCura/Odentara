const express = require("express");

const prisma = require("../lib/prisma");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

// ── GET /api/announcements ────────────────────────────────────────────────────
// Avisos vigentes para mostrar dentro de la app. Lo consulta cada usuario en el
// refresco periódico, así que se apoya en el índice (active, startsAt, endsAt)
// y devuelve solo lo justo para pintar la barra.
//
// Se consulta contra `prisma` (la base de plataforma) y no contra req.prisma:
// los avisos son globales y las clínicas con base dedicada también tienen que
// verlos.
router.get("/", requireAuth, async (_req, res) => {
  try {
    const now = new Date();
    const announcements = await prisma.announcement.findMany({
      where: { active: true, startsAt: { lte: now }, endsAt: { gte: now } },
      orderBy: [{ level: "desc" }, { startsAt: "desc" }],
      select: { id: true, message: true, level: true, dismissible: true, endsAt: true },
      take: 5,
    });
    return res.json({ ok: true, announcements });
  } catch (_error) {
    // Un fallo acá no debe romper la app: sin avisos se sigue trabajando igual.
    return res.json({ ok: true, announcements: [] });
  }
});

module.exports = router;
