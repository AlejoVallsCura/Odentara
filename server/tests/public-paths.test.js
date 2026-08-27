// Qué se publica por HTTP y qué no.
//
// Estos tests existen porque el fallo ya ocurrió: WEB_ROOT es la raíz del repo,
// y en producción daban 200 `pacientes_test.csv` (30 filas con nombre, DNI,
// teléfono, email y dirección), `ARQUITECTURA.pdf`, `CLAUDE.md`, `PLAN-CODEX.md`
// y `package.json`. Sacarlos del ZIP no alcanza: basta con que alguien vuelva a
// dejar un archivo en la carpeta.
"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");

const { esRutaBloqueada } = require("../lib/public-paths");

test("los archivos que la app necesita se siguen sirviendo", () => {
  for (const ruta of [
    "/",
    "/index.html",
    "/app.js",
    "/sw.js",
    "/manifest.json",
    "/xlsx.full.min.js",
    "/favicon.svg",
  ]) {
    assert.equal(esRutaBloqueada(ruta), false, `${ruta} tiene que pasar`);
  }
});

test("las subcarpetas de assets se siguen sirviendo", () => {
  for (const ruta of [
    "/js/core/router.js",
    "/css/patches.css",
    "/icons/logo-principal-32.png",
    "/shared/money.js",
    "/img/foo.png",
    "/landing/index.html",
  ]) {
    assert.equal(esRutaBloqueada(ruta), false, `${ruta} tiene que pasar`);
  }
});

test("las rutas de Express sin extensión no se bloquean", () => {
  // La primera versión de la regla solo miraba que fuera un segmento de la raíz
  // y mataba estas tres, que están registradas más abajo en index.js.
  for (const ruta of ["/health", "/terminos", "/landing-preview"]) {
    assert.equal(esRutaBloqueada(ruta), false, `${ruta} es una ruta, no un archivo`);
  }
  assert.equal(esRutaBloqueada("/api/auth/login"), false);
});

test("no se publican datos de pacientes ni documentación interna", () => {
  for (const ruta of [
    "/pacientes_test.csv",
    "/ARQUITECTURA.pdf",
    "/CLAUDE.md",
    "/PLAN-CODEX.md",
    "/README.md",
    "/HANDOFF-UX-SESION.md",
    "/docs/BACKUP.md",
    "/backups/db/odentara-db-2026-08-25.sql.gz",
  ]) {
    assert.equal(esRutaBloqueada(ruta), true, `${ruta} NO se puede publicar`);
  }
});

test("no se publica el código del servidor ni sus herramientas", () => {
  for (const ruta of [
    "/server/index.js",
    "/prisma/schema.prisma",
    "/scripts/backup-db.js",
    "/scripts/restore-db.js",
    "/node_modules/express/index.js",
  ]) {
    assert.equal(esRutaBloqueada(ruta), true, `${ruta} NO se puede publicar`);
  }
});

test("no se publican los archivos de configuración del proyecto", () => {
  for (const ruta of [
    "/package.json",
    "/package-lock.json",
    "/prisma.config.ts",
    "/make_zip.ps1",
    "/odentara-deploy.zip",
  ]) {
    assert.equal(esRutaBloqueada(ruta), true, `${ruta} NO se puede publicar`);
  }
});

test("los archivos que empiezan con punto quedan afuera", () => {
  // `.env` no cae en la regla de archivo de raíz porque no tiene nombre antes
  // del punto: se descartaba solo. Lo encontró la prueba de la regla, no una
  // revisión a ojo.
  for (const ruta of ["/.env", "/.env.local", "/.gitignore", "/.htaccess", "/.git/config"]) {
    assert.equal(esRutaBloqueada(ruta), true, `${ruta} NO se puede publicar`);
  }
});

test("se deja pasar .well-known, por si hace falta para un certificado", () => {
  assert.equal(esRutaBloqueada("/.well-known/acme-challenge/token"), false);
});

test("un archivo nuevo en la raíz queda bloqueado por defecto", () => {
  // Es la razón de ser de la lista blanca: lo que se olvide alguien no se
  // publica solo.
  assert.equal(esRutaBloqueada("/notas-internas.txt"), true);
  assert.equal(esRutaBloqueada("/dump-pacientes.csv"), true);
  assert.equal(esRutaBloqueada("/credenciales.json"), true);
});

// ── La landing se sirve desde otra carpeta ──────────────────────────────────
//
// En odentara.com los estáticos salen de `landing/`, así que `/odentara.css` y
// `/odentara.js` PARECEN archivos sueltos de la raíz del repo pero no lo son.
// Aplicarles la lista blanca dejó la landing sin estilos ni JS en producción.

const LANDING = { esLanding: true };

test("los archivos de la landing se sirven en el host de la landing", () => {
  for (const ruta of ["/", "/index.html", "/odentara.css", "/odentara.js", "/terminos.html"]) {
    assert.equal(esRutaBloqueada(ruta, LANDING), false, `${ruta} es de la landing`);
  }
});

test("las subcarpetas de la landing también", () => {
  for (const ruta of ["/assets/logo-teal2-32.png", "/vendor/algo.js"]) {
    assert.equal(esRutaBloqueada(ruta, LANDING), false, `${ruta} es de la landing`);
  }
});

test("en la app, esos mismos nombres siguen bloqueados", () => {
  // La excepción es del host de la landing, no de los nombres: en la app un
  // `/odentara.css` suelto en la raíz no existe y no tiene por qué pasar.
  assert.equal(esRutaBloqueada("/odentara.css"), true);
  assert.equal(esRutaBloqueada("/terminos.html"), true);
});

test("ni en la landing se publica el código del servidor ni los secretos", () => {
  // La excepción afloja la lista blanca de archivos de raíz, nada más.
  for (const ruta of ["/server/index.js", "/backups/db/x.sql.gz", "/.env", "/scripts/backup-db.js"]) {
    assert.equal(esRutaBloqueada(ruta, LANDING), true, `${ruta} NO se publica ni en la landing`);
  }
});
