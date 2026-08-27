// =============================================================================
// patient-extraction.service.js — Extracción de pacientes desde fotos con IA
// Usa la API de Claude (visión + salida estructurada) para leer fichas de papel
// o listados impresos y devolver pacientes en formato estructurado.
// =============================================================================

"use strict";

const Anthropic = require("@anthropic-ai/sdk");

// Modelo por defecto: Sonnet 5 — mejor balance precisión/costo para leer fichas.
// Tiene visión de alta resolución (texto chico y denso) con costo bajo. Se puede
// subir a claude-opus-4-8 (máxima precisión, ~2x costo) o bajar a claude-haiku-4-5
// (más barato, menos preciso en OCR) con la variable ANTHROPIC_MODEL.
const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";

const VALID_MEDIA_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const MAX_IMAGES = 10;

// Claves del cuestionario médico — deben coincidir con patient.service.js y el frontend.
const MH_BOOL_KEYS = [
  "cardiacos", "presionAlta", "presionBaja", "hepatitis", "ulcerasEstomago",
  "diabetes", "asma", "venereasSida", "fiebreReumatica", "epilepsia",
  "desmayos", "problemasHepaticos", "embarazo", "examenHiv", "problemasRenales",
  "servicioUrgencia", "bajoTratamiento", "reaccionAlergica", "sangradoExcesivo",
  "tomaMedicamentos", "fuma",
];
const MH_TEXT_KEYS = ["bajoTratamientoCual", "reaccionAlergicaCual", "medicamentosCuales"];

// Sub-schema del cuestionario médico (todos los campos requeridos por structured outputs).
// `hasQuestionnaire` es explícito y decidido por el modelo (¿la imagen tiene
// este cuestionario de Sí/No, sí o no?) — NO se infiere de las respuestas.
// Antes se usaba "¿hay al menos un true o un texto?" como proxy de "hay
// cuestionario", pero eso descarta por error un cuestionario real donde el
// paciente contestó "No" a todo (perfectamente posible y válido).
const MEDICAL_HISTORY_SCHEMA = {
  type: "object",
  properties: {
    hasQuestionnaire: { type: "boolean" },
    ...Object.fromEntries(MH_BOOL_KEYS.map((k) => [k, { type: "boolean" }])),
    ...Object.fromEntries(MH_TEXT_KEYS.map((k) => [k, { type: "string" }])),
  },
  required: ["hasQuestionnaire", ...MH_BOOL_KEYS, ...MH_TEXT_KEYS],
  additionalProperties: false,
};

// Esquema estricto: la respuesta siempre es JSON válido con esta forma.
const PATIENT_SCHEMA = {
  type: "object",
  properties: {
    patients: {
      type: "array",
      items: {
        type: "object",
        properties: {
          fullName:      { type: "string" },
          dni:           { type: "string" },
          phone:         { type: "string" },
          email:         { type: "string" },
          address:       { type: "string" },
          insuranceName: { type: "string" },
          insurancePlan: { type: "string" },
          credentialNumber: { type: "string" },
          birthDate:     { type: "string" },
          medicalHistory: MEDICAL_HISTORY_SCHEMA,
        },
        required: [
          "fullName", "dni", "phone", "email",
          "address", "insuranceName", "insurancePlan", "credentialNumber", "birthDate",
          "medicalHistory",
        ],
        additionalProperties: false,
      },
    },
  },
  required: ["patients"],
  additionalProperties: false,
};

const SYSTEM_PROMPT = `Sos un asistente que extrae datos de pacientes de fichas odontológicas de papel o listados impresos, para cargarlos en un sistema de gestión.

Si la imagen está rotada (de costado o al revés), interpretala igual —
girá mentalmente el texto antes de leerlo, no la des por ilegible solo
por la orientación.

Reglas — datos de contacto:
- Extraé UNA entrada por paciente. Si la imagen tiene un listado, devolvé todos.
- fullName: nombre y apellido completos del paciente.
- dni: solo los dígitos del documento (sin puntos ni espacios).
- phone: solo dígitos del teléfono/celular.
- birthDate: en formato YYYY-MM-DD si podés inferirlo; si no, dejalo vacío.
- email, address, insuranceName (obra social), insurancePlan (plan): completá si están presentes.
- credentialNumber: el número de afiliado/credencial de la obra social. En las
  fichas de papel suele estar rotulado "Afiliado N°", "N° de afiliado",
  "Credencial" o "Socio N°", en el mismo renglón que la obra social. Copialo tal
  cual, con las barras y los guiones que tenga (por ejemplo "1343329/00"): no es
  un número a normalizar, es un identificador.
- Si un campo no está en la imagen, devolvé una cadena vacía "" — NUNCA inventes datos.
- Si un dato es ilegible o dudoso, dejalo vacío en vez de adivinar.
- No incluyas encabezados de tabla ni texto que no sea un paciente.

Reglas — antecedentes médicos (campo medicalHistory):
- hasQuestionnaire: true si la imagen tiene este cuestionario médico de
  Sí/No (aunque el paciente haya contestado "No" a absolutamente todo —
  eso sigue siendo un cuestionario completado, no lo confundas con que
  "no hay cuestionario"). false solo si la imagen es un listado de
  contactos u otro papel que directamente no incluye este cuestionario.
- Estos cuestionarios suelen tener DOS casilleros por fila, uno bajo un
  encabezado "SI" y otro bajo un encabezado "NO" (a veces con las columnas
  invertidas: "NO" a la izquierda y "SI" a la derecha — NUNCA asumas el
  orden, siempre verificá contra el encabezado real de esa columna).
- Para cada fila, seguí este proceso EXACTO antes de decidir true/false:
  1. Ubicá el encabezado de columna ("SI" / "NO") que está más arriba,
     en la cabecera de la tabla.
  2. Trazá una línea vertical imaginaria desde ese encabezado hacia abajo
     hasta la fila que estás leyendo, para saber bajo qué columna cae
     cada uno de los dos casilleros de esa fila.
  3. Recién ahí fijate cuál de los DOS casilleros tiene la marca (una X,
     un tilde, un casillero relleno/sombreado, o cualquier trazo dentro
     del cuadrado) — el otro casillero de la fila queda vacío.
  4. Si el casillero marcado cae bajo la columna "SI" → true. Si cae bajo
     "NO" → false.
- Un casillero marcado significa CUALQUIER trazo visible adentro (X,
  tilde, garabato, relleno) — no busques un tipo de marca en particular.
- Si por brillo, sombra, foto de costado o baja calidad no podés
  determinar con confianza cuál de los dos casilleros de una fila está
  marcado, dejá esa fila en false (no marcado) en vez de adivinar — es
  preferible un antecedente en blanco que uno invertido.
- Campos de texto (bajoTratamientoCual, reaccionAlergicaCual, medicamentosCuales): el detalle escrito si lo hay; cadena vacía "" si no.
- Mapeo de casilleros: cardiacos=problemas cardíacos, presionAlta=presión alta, presionBaja=presión baja, ulcerasEstomago=úlceras de estómago, venereasSida=venéreas/SIDA, fiebreReumatica=fiebre reumática, epilepsia=epilepsia/convulsiones, problemasHepaticos=problemas hepáticos, examenHiv=examen HIV, problemasRenales=problemas renales, servicioUrgencia=asociado a servicio de urgencia, bajoTratamiento=bajo tratamiento médico, reaccionAlergica=reacciones alérgicas a medicamentos, sangradoExcesivo=sangra en exceso, tomaMedicamentos=toma medicamentos, fuma=fuma.
- Si la imagen NO tiene cuestionario médico (es solo un listado de contactos), poné TODOS los booleanos en false y los textos en "".`;

function isConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

function validateImages(rawImages) {
  if (!Array.isArray(rawImages) || rawImages.length === 0) {
    return { error: "No se recibieron imágenes." };
  }
  if (rawImages.length > MAX_IMAGES) {
    return { error: `Máximo ${MAX_IMAGES} imágenes por extracción.` };
  }
  const images = [];
  for (const img of rawImages) {
    const mediaType = String(img?.mediaType || "").toLowerCase();
    const data = typeof img?.data === "string" ? img.data.trim() : "";
    if (!VALID_MEDIA_TYPES.has(mediaType)) {
      return { error: "Formato de imagen no soportado (usá JPG, PNG o WEBP)." };
    }
    if (!data) {
      return { error: "Una de las imágenes está vacía." };
    }
    images.push({ mediaType, data });
  }
  return { images };
}

// Procesa el cuestionario médico extraído. Si detecta un cuestionario real
// (al menos un "Sí" o algún texto), devuelve TODAS las respuestas — incluidos
// los "No" (false) — para que el formulario pueda pre-marcar las casillas NO.
// Si viene todo vacío (ej: un listado de contactos sin cuestionario), devuelve
// null para no crear antecedentes vacíos.
function compactMedicalHistory(raw) {
  if (!raw || typeof raw !== "object") return null;
  // Confiamos en lo que dice el modelo sobre si vio un cuestionario, no en si
  // las respuestas dieron algún "true" — un cuestionario real contestado
  // "No" a todo es igual de válido y no debe descartarse como si no existiera.
  if (!raw.hasQuestionnaire) return null;
  const out = {};
  for (const k of MH_BOOL_KEYS) {
    out[k] = Boolean(raw[k]);
  }
  for (const k of MH_TEXT_KEYS) {
    const v = raw[k] ? String(raw[k]).trim().slice(0, 500) : "";
    if (v) out[k] = v;
  }
  return out;
}

// Normaliza los pacientes extraídos: trim + dni/phone solo dígitos. Descarta
// filas sin nombre (el resto de la validación la hace /patients/import).
function normalizeExtracted(patients) {
  if (!Array.isArray(patients)) return [];
  const trim = (v, max) => (v ? String(v).trim().slice(0, max) : "");
  return patients
    .map((p) => ({
      fullName:      trim(p.fullName, 255),
      dni:           String(p.dni || "").replace(/\D/g, "").slice(0, 20),
      phone:         String(p.phone || "").replace(/[^\d+]/g, "").slice(0, 30),
      email:         trim(p.email, 255).toLowerCase(),
      address:       trim(p.address, 500),
      insuranceName: trim(p.insuranceName, 255),
      insurancePlan: trim(p.insurancePlan, 255),
      // Sin quitarle nada: la barra de "1343329/00" es parte del número de afiliado.
      credentialNumber: trim(p.credentialNumber, 100),
      birthDate:     /^\d{4}-\d{2}-\d{2}$/.test(String(p.birthDate || "").trim())
                       ? String(p.birthDate).trim()
                       : "",
      medicalHistory: compactMedicalHistory(p.medicalHistory),
    }))
    .filter((p) => p.fullName);
}

async function extractPatientsFromImages(rawImages) {
  if (!isConfigured()) {
    const err = new Error("La extracción por foto no está configurada en el servidor.");
    err.code = "NOT_CONFIGURED";
    throw err;
  }

  const { images, error } = validateImages(rawImages);
  if (error) {
    const err = new Error(error);
    err.code = "INVALID_INPUT";
    throw err;
  }

  const client = new Anthropic(); // lee ANTHROPIC_API_KEY del entorno

  const content = images.map((img) => ({
    type: "image",
    source: { type: "base64", media_type: img.mediaType, data: img.data },
  }));
  content.push({
    type: "text",
    text: "Extraé todos los pacientes que aparezcan en estas imágenes.",
  });

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 16000,
    system: SYSTEM_PROMPT,
    output_config: { format: { type: "json_schema", schema: PATIENT_SCHEMA } },
    messages: [{ role: "user", content }],
  });

  if (response.stop_reason === "refusal") {
    const err = new Error("La IA no pudo procesar la imagen.");
    err.code = "REFUSAL";
    throw err;
  }

  // Si la respuesta se cortó por límite de tokens, el JSON queda incompleto —
  // avisamos con un mensaje claro en vez del genérico de parseo.
  if (response.stop_reason === "max_tokens") {
    const err = new Error("La imagen tiene demasiados pacientes para procesar de una vez. Probá con menos filas o dividí el listado en varias fotos.");
    err.code = "TOO_LARGE";
    throw err;
  }

  const textBlock = (response.content || []).find((b) => b.type === "text");
  if (!textBlock) {
    const err = new Error("La IA no devolvió datos legibles.");
    err.code = "NO_OUTPUT";
    throw err;
  }

  let parsed;
  try {
    parsed = JSON.parse(textBlock.text);
  } catch (_e) {
    const err = new Error("No se pudo interpretar la respuesta de la IA.");
    err.code = "PARSE_ERROR";
    throw err;
  }

  return normalizeExtracted(parsed.patients);
}

module.exports = {
  isConfigured,
  extractPatientsFromImages,
  MAX_IMAGES,
};
