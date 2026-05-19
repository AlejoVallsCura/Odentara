/**
 * Módulo de almacenamiento — Cloudflare R2 (compatible con S3).
 *
 * Variables de entorno requeridas:
 *   R2_ACCOUNT_ID       — ID de la cuenta Cloudflare
 *   R2_ACCESS_KEY_ID    — Access Key del API token R2
 *   R2_SECRET_ACCESS_KEY — Secret Key del API token R2
 *   R2_BUCKET_NAME      — Nombre del bucket (ej. odentara-images)
 *   R2_ENDPOINT         — https://<account_id>.r2.cloudflarestorage.com
 */

const { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } = require("@aws-sdk/client-s3");
const crypto = require("crypto");

function isStorageConfigured() {
  return !!(
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_BUCKET_NAME &&
    process.env.R2_ENDPOINT
  );
}

function createClient() {
  return new S3Client({
    region: "auto",
    endpoint: process.env.R2_ENDPOINT,
    credentials: {
      accessKeyId:     process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
  });
}

/**
 * Sube una imagen (base64 o Buffer) a R2.
 * @param {{ base64: string, clinicId: number, patientId: number, mimeType?: string }} opts
 * @returns {Promise<string>} — key del objeto en R2 (ej. "clinics/1/patients/5/abc123.jpg")
 */
async function uploadImage({ base64, clinicId, patientId, mimeType = "image/jpeg" }) {
  if (!isStorageConfigured()) {
    throw new Error("R2 no está configurado. Verificá las variables de entorno R2_*.");
  }

  // Extraer el buffer desde base64 (acepta data:image/jpeg;base64,... o base64 puro)
  let buffer;
  let detectedMime = mimeType;

  if (base64.startsWith("data:")) {
    const match = base64.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) throw new Error("Formato de imagen inválido.");
    detectedMime = match[1];
    buffer = Buffer.from(match[2], "base64");
  } else {
    buffer = Buffer.from(base64, "base64");
  }

  const ext = detectedMime.split("/")[1]?.replace("jpeg", "jpg") || "jpg";
  const key = `clinics/${clinicId}/patients/${patientId}/${crypto.randomUUID()}.${ext}`;

  const client = createClient();
  await client.send(new PutObjectCommand({
    Bucket:      process.env.R2_BUCKET_NAME,
    Key:         key,
    Body:        buffer,
    ContentType: detectedMime,
  }));

  return key;
}

/**
 * Descarga un objeto de R2 y devuelve { body: Buffer, contentType: string }.
 * Usado por el endpoint proxy del servidor para evitar exponer R2 al navegador.
 * @param {string} key
 * @returns {Promise<{ body: Buffer, contentType: string }>}
 */
async function getImageStream(key) {
  const client = createClient();
  const res = await client.send(new GetObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    Key:    key,
  }));

  // Convertir el stream a Buffer
  const chunks = [];
  for await (const chunk of res.Body) chunks.push(chunk);
  return {
    body:        Buffer.concat(chunks),
    contentType: res.ContentType || "image/jpeg",
  };
}

/**
 * Elimina una imagen de R2.
 * @param {string} key
 */
async function deleteImage(key) {
  if (!isStorageConfigured() || !key) return;

  const client = createClient();
  await client.send(new DeleteObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    Key:    key,
  }));
}

/** Detecta si una imageUrl es una key de R2 (no un data: URL ni http externo) */
function isR2Key(imageUrl) {
  return imageUrl && !imageUrl.startsWith("data:") && !imageUrl.startsWith("http");
}

module.exports = { uploadImage, getImageStream, deleteImage, isR2Key, isStorageConfigured };
