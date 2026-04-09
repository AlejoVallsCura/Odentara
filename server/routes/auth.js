const express = require("express");
const bcrypt = require("bcrypt");

const prisma = require("../lib/prisma");
const {
  normalizeEmail,
  signToken,
  serializeUser,
  buildPermissionSummary,
} = require("../lib/auth");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

async function getUserByEmail(email) {
  return prisma.user.findFirst({
    where: { email, deletedAt: null },
    include: {
      roles: { include: { role: true } },
      professionalScopes: true,
      assignedProfessional: true,
    },
  });
}

router.post("/login", async (req, res) => {
  try {
    const rawEmail = req.body?.email || "";
    const password = req.body?.password || "";
    const email = normalizeEmail(rawEmail);

    if (!email || !password) {
      return res.status(400).json({
        ok: false,
        error: "Email y contraseña son obligatorios.",
      });
    }

    const user = await getUserByEmail(email);

    if (!user || !user.active || !user.passwordHash) {
      return res.status(401).json({
        ok: false,
        error: "Credenciales invalidas.",
      });
    }

    const passwordOk = await bcrypt.compare(password, user.passwordHash);

    if (!passwordOk) {
      return res.status(401).json({
        ok: false,
        error: "Credenciales invalidas.",
      });
    }

    const token = signToken({
      userId: user.id,
      email: user.email,
      roles: user.roles.map((entry) => entry.role.code),
    });

    return res.json({
      ok: true,
      token,
      user: serializeUser(user),
      permissions: buildPermissionSummary(user),
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: "No se pudo iniciar sesion.",
    });
  }
});

router.get("/me", requireAuth, async (req, res) => {
  return res.json({
    ok: true,
    user: serializeUser(req.user),
    permissions: req.permissions,
  });
});

module.exports = router;
