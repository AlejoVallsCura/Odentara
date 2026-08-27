// Configuración de la propia clínica del usuario.
//
// Distinto de /api/platform/clinics, que es el panel del dueño de la plataforma
// y toca cualquier clínica. Acá cada clínica lee y edita lo suyo, y el clinicId
// sale del token — nunca del cuerpo del pedido, que sería elegir a quién editar.

const express = require("express");

const { requireAuth } = require("../middleware/auth");
const { requirePermission } = require("../middleware/require-permission");
const { canManageClinicMessages } = require("../lib/permissions");
const {
  MARCADORES,
  LARGO_MAXIMO,
  PLANTILLA_POR_DEFECTO,
  validateAppointmentTemplate,
} = require("../../shared/appointment-message");

const router = express.Router();

const puedeEditarMensajes = requirePermission(
  canManageClinicMessages,
  "No tenés permisos para editar los mensajes de la clínica."
);

/**
 * El platform admin no tiene clínica propia (clinicId null). No es un error de
 * permisos sino de contexto: no hay "su clínica" que configurar.
 */
function clinicaDelUsuario(req, res) {
  const clinicId = req.user?.clinicId;
  if (!clinicId) {
    res.status(400).json({
      ok: false,
      error: "Tu usuario no pertenece a una clínica.",
    });
    return null;
  }
  return clinicId;
}

// ── GET /settings ─────────────────────────────────────────────────────────────
// Devuelve la plantilla guardada más todo lo que la interfaz necesita para
// mostrar el editor: los marcadores válidos, el tope de largo y el texto por
// defecto. Así la pantalla no repite esas definiciones y no se desincronizan.
router.get("/settings", requireAuth, async (req, res) => {
  try {
    const clinicId = clinicaDelUsuario(req, res);
    if (!clinicId) return undefined;

    const clinic = await req.prisma.clinic.findUnique({
      where: { id: clinicId },
      select: { appointmentMessageTemplate: true },
    });

    return res.json({
      ok: true,
      settings: {
        appointmentMessageTemplate: clinic?.appointmentMessageTemplate || "",
        plantillaPorDefecto: PLANTILLA_POR_DEFECTO,
        marcadores: MARCADORES,
        largoMaximo: LARGO_MAXIMO,
        puedeEditar: canManageClinicMessages(req.permissions),
      },
    });
  } catch (_error) {
    return res.status(500).json({ ok: false, error: "No se pudo leer la configuración." });
  }
});

// ── PUT /settings ─────────────────────────────────────────────────────────────
router.put("/settings", requireAuth, puedeEditarMensajes, async (req, res) => {
  try {
    const clinicId = clinicaDelUsuario(req, res);
    if (!clinicId) return undefined;

    const bruto = req.body?.appointmentMessageTemplate;
    if (bruto !== undefined && bruto !== null && typeof bruto !== "string") {
      return res.status(400).json({ ok: false, error: "El mensaje debe ser texto." });
    }

    const plantilla = String(bruto ?? "").trim();

    // Solo el largo bloquea. Un marcador mal escrito se avisa pero se guarda: el
    // texto sigue siendo un mensaje válido, y quien lo escribió puede querer una
    // llave literal. Se devuelve el aviso para mostrarlo junto a la confirmación.
    const problemas = validateAppointmentTemplate(plantilla);
    const bloqueante = problemas.find((p) => p.includes("caracteres"));
    if (bloqueante) {
      return res.status(400).json({ ok: false, error: bloqueante });
    }

    await req.prisma.clinic.update({
      where: { id: clinicId },
      // Vacío se guarda como null: es "sin plantilla propia", que el renderizador
      // interpreta como "usar la de por defecto". Guardar "" haría lo mismo por
      // casualidad, pero null lo dice.
      data: { appointmentMessageTemplate: plantilla || null },
    });

    return res.json({
      ok: true,
      appointmentMessageTemplate: plantilla,
      avisos: problemas,
      message: plantilla
        ? "Mensaje de confirmación guardado."
        : "Mensaje restablecido al texto por defecto.",
    });
  } catch (_error) {
    return res.status(500).json({ ok: false, error: "No se pudo guardar la configuración." });
  }
});

module.exports = router;
