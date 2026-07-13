/**
 * Módulo de almacenamiento — Cloudflare R2 (compatible con S3).
 *
 * Variables de entorno requeridas:
 *   R2_ACCESS_KEY_ID      — Access Key del API token R2
 *   R2_SECRET_ACCESS_KEY  — Secret Key del API token R2
 *   R2_BUCKET_NAME        — Nombre del bucket (ej. odentara-images)
 *   R2_ENDPOINT           — https://<account_id>.r2.cloudflarestorage.com
 *
 * Estructura de keys en R2:
 *   clinics/{clinicId}/patients/{patientId}/images/{uuid}.jpg
 *   clinics/{clinicId}/patients/{patientId}/documents/{uuid}.pdf
 */

const { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } = require("@aws-sdk/client-s3");
const crypto = require("crypto");

const IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const DOCUMENT_MIME_TYPES = new Set(["application/pdf"]);
const ALLOWED_MIME_TYPES = new Set([...IMAGE_MIME_TYPES, ...DOCUMENT_MIME_TYPES]);

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

function extFromMime(mime) {
  const map = {
    "image/jpeg":      "jpg",
    "image/png":       "png",
    "image/webp":      "webp",
    "image/gif":       "gif",
    "application/pdf": "pdf",
  };
  return map[mime] || mime.split("/")[1] || "bin";
}

function folderFromMime(mime) {
  return DOCUMENT_MIME_TYPES.has(mime) ? "documents" : "images";
}

/**
 * Sube un archivo (imagen o PDF) en base64 a R2.
 * @param {{ base64: string, clinicId: number, patientId: number, mimeType?: string }} opts
 * @returns {Promise<{ key: string, mimeType: string }>}
 */
async function uploadFile({ base64, clinicId, patientId, mimeType = "image/jpeg" }) {
  if (!isStorageConfigured()) {
    throw new Error("R2 no está configurado. Verificá las variables de entorno R2_*.");
  }

  let buffer;
  let detectedMime = mimeType;

  if (base64.startsWith("data:")) {
    const match = base64.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) throw new Error("Formato de archivo inválido.");
    detectedMime = match[1];
    buffer = Buffer.from(match[2], "base64");
  } else {
    buffer = Buffer.from(base64, "base64");
  }

  if (!ALLOWED_MIME_TYPES.has(detectedMime)) {
    throw new Error(`Tipo de archivo no permitido: ${detectedMime}`);
  }

  const folder = folderFromMime(detectedMime);
  const ext    = extFromMime(detectedMime);
  const key    = `clinics/${clinicId}/patients/${patientId}/${folder}/${crypto.randomUUID()}.${ext}`;

  await createClient().send(new PutObjectCommand({
    Bucket:      process.env.R2_BUCKET_NAME,
    Key:         key,
    Body:        buffer,
    ContentType: detectedMime,
  }));

  return { key, mimeType: detectedMime };
}

// Alias retrocompatible
async function uploadImage(opts) {
  const result = await uploadFile(opts);
  return result.key;
}

/**
 * Descarga un objeto de R2 y devuelve { body: Buffer, contentType: string }.
 */
async function getFileStream(key) {
  const res = await createClient().send(new GetObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    Key:    key,
  }));
  const chunks = [];
  for await (const chunk of res.Body) chunks.push(chunk);
  return {
    body:        Buffer.concat(chunks),
    contentType: res.ContentType || "application/octet-stream",
  };
}

// Alias retrocompatible
const getImageStream = getFileStream;

/**
 * Elimina un archivo de R2.
 */
async function deleteFile(key) {
  if (!isStorageConfigured() || !key) return;
  await createClient().send(new DeleteObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    Key:    key,
  }));
}

const deleteImage = deleteFile;

/** Detecta si una imageUrl es una key de R2 (no un data: URL ni http externo) */
function isR2Key(imageUrl) {
  return imageUrl && !imageUrl.startsWith("data:") && !imageUrl.startsWith("http");
}

module.exports = {
  uploadFile, uploadImage,
  getFileStream, getImageStream,
  deleteFile, deleteImage,
  isR2Key, isStorageConfigured,
  ALLOWED_MIME_TYPES, IMAGE_MIME_TYPES, DOCUMENT_MIME_TYPES,
};
