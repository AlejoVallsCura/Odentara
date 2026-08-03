// =============================================================================
// ai-clinical.service.js — Asistentes clínicos con IA (texto)
//   1. generatePatientSummary  → resumen/alerta pre-consulta desde la ficha
//   2. structureClinicalNote   → limpia una nota dictada por voz Y detecta
//                                 acciones de odontograma mencionadas (ej:
//                                 "pieza 26, arreglo pendiente" → pinta rojo)
// Usa Claude (Anthropic). Comparte modelo/config con la extracción por foto.
// =============================================================================

"use strict";

const Anthropic = require("@anthropic-ai/sdk");

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";

function isConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

// Ejecuta un mensaje de texto simple y devuelve el texto de la respuesta.
async function runText({ system, userText, maxTokens = 1200 }) {
  if (!isConfigured()) {
    const err = new Error("La función de IA no está configurada en el servidor.");
    err.code = "NOT_CONFIGURED";
    throw err;
  }
  const client = new Anthropic(); // lee ANTHROPIC_API_KEY del entorno
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    system,
    messages: [{ role: "user", content: [{ type: "text", text: userText }] }],
  });
  if (response.stop_reason === "refusal") {
    const err = new Error("La IA no pudo procesar el pedido.");
    err.code = "REFUSAL";
    throw err;
  }
  const block = (response.content || []).find((b) => b.type === "text");
  if (!block) {
    const err = new Error("La IA no devolvió texto.");
    err.code = "NO_OUTPUT";
    throw err;
  }
  return block.text.trim();
}

// ── 1. Resumen / alerta pre-consulta ──────────────────────────────────────────
const SUMMARY_SYSTEM = `Sos un asistente para odontólogos. A partir de la ficha de un paciente, generá un resumen BREVE y accionable para leer justo antes de atenderlo.

Formato de la respuesta (en español rioplatense, sin encabezados markdown):
- Primero, si hay riesgos médicos relevantes para odontología (alergias, anticoagulación/sangrado, enfermedades sistémicas, medicación, embarazo, etc.), listalos como alertas con el emoji ⚠️ al inicio de cada una. Sé conciso.
- Después, 2-4 líneas con el contexto clínico útil: último tratamiento, trabajos pendientes, presupuestos sin cerrar, o cualquier dato relevante.
- Si no hay datos suficientes, decilo en una línea.

Reglas:
- Máximo ~120 palabras. Directo, sin relleno.
- No inventes datos que no estén en la ficha.
- No des diagnósticos ni indicaciones de tratamiento — solo resumís lo que ya está registrado.`;

async function generatePatientSummary(dossier) {
  return runText({
    system: SUMMARY_SYSTEM,
    userText: `Ficha del paciente:\n\n${dossier}\n\nGenerá el resumen pre-consulta.`,
    maxTokens: 700,
  });
}

// ── 2. Estructurar nota clínica dictada por voz + detectar acciones de odontograma ──

// Valores de "kind" — deben coincidir exactamente con los estados del odontograma
// en el frontend (js/views/clinical.js: drawTeethRow / bindClinicalToothEvents).
const ODONTO_KINDS = [
  "caries", "restaurado", "ausente", "implante", "corona",
  "corona-implante", "sello", "endodoncia", "ortodoncia",
];

const NOTE_SCHEMA = {
  type: "object",
  properties: {
    note: { type: "string" },
    odontogramActions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          tooth: { type: "string" },
          kind: { type: "string", enum: ODONTO_KINDS },
          color: { type: "string", enum: ["rojo", "azul"] },
        },
        required: ["tooth", "kind", "color"],
        additionalProperties: false,
      },
    },
  },
  required: ["note", "odontogramActions"],
  additionalProperties: false,
};

const NOTE_SYSTEM = `Sos un asistente para odontólogos. Recibís una transcripción cruda de una nota dictada por voz (puede tener errores de transcripción, muletillas, o números mal escritos).

Tarea 1 — nota clínica (campo "note"):
- Convertí el dictado en una nota clínica prolija, lista para pegar en la historia.
- Corregí terminología odontológica mal transcripta (ej: "pieza treinta y seis" → "pieza 36"; "endodoncia", "composite", "exodoncia", etc.).
- Redactá en español, claro y profesional, en pasado (registro de lo realizado).
- No inventes procedimientos ni datos que no estén en el dictado.
- Si el dictado es muy corto o ininteligible, devolvé lo poco que se entienda, sin rellenar.

Tarea 2 — acciones de odontograma (campo "odontogramActions"):
- Si el dictado menciona una pieza dental específica (número FDI de 2 dígitos: 11-18, 21-28, 31-38, 41-48 en adultos; 51-55, 61-65, 71-75, 81-85 en niños) junto con un tratamiento, generá UNA acción por cada mención.
- tooth: el número de pieza en formato FDI, como string (ej: "26"). Si dicen "pieza veintiseis" o "diente 2 6", interpretalo como "26".
- kind — mapeo de lo que se dice a estos valores exactos:
  - "caries", "arreglo pendiente", "arreglo por hacer", "para arreglar" → "caries"
  - "restaurado", "arreglo hecho", "ya arreglado", "obturado" → "restaurado"
  - "ausente", "extraído", "falta la pieza", "exodoncia realizada" → "ausente"
  - "implante" (sin corona todavía) → "implante"
  - "corona", "corona sobre diente" → "corona"
  - "corona sobre implante" → "corona-implante"
  - "sellante", "sello" → "sello"
  - "endodoncia", "tratamiento de conducto" → "endodoncia"
  - "ortodoncia", "brackets" → "ortodoncia"
- color: si el dictado indica que el trabajo está PENDIENTE/por hacer/a realizar → "rojo". Si indica que YA ESTÁ HECHO/realizado/completado → "azul". Si no queda claro, usá "rojo" (pendiente) por defecto.
- Si el dictado NO menciona ninguna pieza con tratamiento, devolvé odontogramActions como array vacío []. No inventes piezas que no se mencionaron.`;

async function structureClinicalNote(transcript) {
  const clean = String(transcript || "").trim().slice(0, 4000);
  if (!clean) {
    const err = new Error("No se recibió texto para estructurar.");
    err.code = "INVALID_INPUT";
    throw err;
  }

  if (!isConfigured()) {
    const err = new Error("La función de IA no está configurada en el servidor.");
    err.code = "NOT_CONFIGURED";
    throw err;
  }
  const client = new Anthropic();
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1400,
    system: NOTE_SYSTEM,
    output_config: { format: { type: "json_schema", schema: NOTE_SCHEMA } },
    messages: [{
      role: "user",
      content: [{ type: "text", text: `Transcripción cruda del dictado:\n\n"${clean}"\n\nDevolvé la nota clínica estructurada y las acciones de odontograma detectadas.` }],
    }],
  });
  if (response.stop_reason === "refusal") {
    const err = new Error("La IA no pudo procesar el pedido.");
    err.code = "REFUSAL";
    throw err;
  }
  const block = (response.content || []).find((b) => b.type === "text");
  if (!block) {
    const err = new Error("La IA no devolvió texto.");
    err.code = "NO_OUTPUT";
    throw err;
  }

  let parsed;
  try {
    parsed = JSON.parse(block.text);
  } catch (_e) {
    const err = new Error("No se pudo interpretar la respuesta de la IA.");
    err.code = "PARSE_ERROR";
    throw err;
  }

  const validTeeth = new Set([
    11,12,13,14,15,16,17,18, 21,22,23,24,25,26,27,28,
    31,32,33,34,35,36,37,38, 41,42,43,44,45,46,47,48,
    51,52,53,54,55, 61,62,63,64,65, 71,72,73,74,75, 81,82,83,84,85,
  ]);
  const odontogramActions = (Array.isArray(parsed.odontogramActions) ? parsed.odontogramActions : [])
    .filter((a) => a && ODONTO_KINDS.includes(a.kind) && ["rojo", "azul"].includes(a.color) && validTeeth.has(Number(a.tooth)))
    .map((a) => ({ tooth: String(Number(a.tooth)), kind: a.kind, color: a.color }))
    .slice(0, 20);

  return { note: String(parsed.note || "").trim(), odontogramActions };
}

module.exports = {
  isConfigured,
  generatePatientSummary,
  structureClinicalNote,
};
