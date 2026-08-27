const test = require("node:test");
const assert = require("node:assert/strict");

const { sanitizePath } = require("../lib/sanitize-path");

test("deja intacta una ruta sin query string", () => {
  assert.equal(sanitizePath({ originalUrl: "/api/patients/12" }), "/api/patients/12");
});

test("redacta el token de descarga de archivos clínicos", () => {
  // El caso que motivó la función: este token quedaba guardado tal cual en
  // la tabla securityEvent y servía para bajar el archivo durante una hora.
  const result = sanitizePath({
    originalUrl: "/api/clinical-images/serve/5?t=1786550400.9f2c1ab34de5",
  });
  assert.equal(result, "/api/clinical-images/serve/5?t=[REDACTED]");
  assert.ok(!result.includes("9f2c1ab34de5"));
});

test("redacta todos los valores, no solo el primero", () => {
  assert.equal(
    sanitizePath({ originalUrl: "/api/export?patientId=7&t=secreto&from=2026-01-01" }),
    "/api/export?patientId=[REDACTED]&t=[REDACTED]&from=[REDACTED]"
  );
});

test("redacta parámetros desconocidos sin necesidad de listarlos", () => {
  // Es la razón de redactar por defecto en vez de mantener una lista de
  // nombres sensibles: un parámetro nuevo queda cubierto solo.
  const result = sanitizePath({ originalUrl: "/api/x?parametroInventado=valor-secreto" });
  assert.ok(!result.includes("valor-secreto"));
});

test("colapsa claves repetidas en una sola", () => {
  assert.equal(sanitizePath({ originalUrl: "/api/x?id=1&id=2&id=3" }), "/api/x?id=[REDACTED]");
});

test("query string vacía devuelve solo el pathname", () => {
  assert.equal(sanitizePath({ originalUrl: "/api/x?" }), "/api/x");
});

test("no rompe con valores URL-encodeados ni con '?' dentro del valor", () => {
  assert.equal(
    sanitizePath({ originalUrl: "/api/x?q=a%20b&next=/otra?cosa=1" }),
    "/api/x?q=[REDACTED]&next=[REDACTED]"
  );
});

test("cae a req.path cuando no hay originalUrl", () => {
  assert.equal(sanitizePath({ path: "/api/y" }), "/api/y");
});

test("devuelve string vacío ante un req sin ruta", () => {
  assert.equal(sanitizePath({}), "");
  assert.equal(sanitizePath(undefined), "");
});
