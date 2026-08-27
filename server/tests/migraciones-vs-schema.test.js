// Guarda contra la deriva entre las migraciones y el schema (OD-OPS-03).
//
// La migración inicial creó índices únicos GLOBALES sobre email, dni y
// chartNumber; el schema pasó a declararlos por clínica y ninguna migración
// quitó los viejos. Resultado: una base creada desde cero con `prisma migrate
// deploy` no se comporta como producción — no permitiría el mismo DNI en dos
// clínicas.
//
// Nadie lo notó porque el historial se aplica a mano en phpMyAdmin y nunca se
// reconstruye desde cero. Esta prueba lo hace explícito: lee el SQL de las
// migraciones, calcula qué índices únicos quedarían vivos y los compara contra
// lo que declara schema.prisma.
//
// No reemplaza a levantar una MariaDB vacía en CI y correr migrate deploy, que
// es la verificación de verdad. Pero corre en 20 ms y atrapa el caso concreto
// que ya nos pasó.

"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const RAIZ = path.join(__dirname, "..", "..");
const DIR_MIGRACIONES = path.join(RAIZ, "prisma", "migrations");

function sqlDeLasMigraciones() {
  return fs
    .readdirSync(DIR_MIGRACIONES)
    .filter((nombre) => fs.existsSync(path.join(DIR_MIGRACIONES, nombre, "migration.sql")))
    .sort()
    .map((nombre) => fs.readFileSync(path.join(DIR_MIGRACIONES, nombre, "migration.sql"), "utf8"))
    .join("\n");
}

/**
 * Nombre que le pone Prisma a un índice compuesto: `Modelo_campo1_campo2_key`.
 *
 * MySQL no acepta identificadores de más de 64 caracteres, así que Prisma
 * recorta. Pasa de verdad en este schema:
 * ProfessionalAvailability(professionalId, weekday, startTime, endTime) da 68 y
 * termina como `..._startTime_en_key`. Sin contemplarlo, la prueba lo reportaba
 * como índice faltante cuando en realidad está.
 */
const LARGO_MAXIMO_IDENTIFICADOR = 64;

function nombreDeIndice(modelo, campos) {
  const completo = `${modelo}_${campos.join("_")}_key`;
  if (completo.length <= LARGO_MAXIMO_IDENTIFICADOR) return completo;
  const sufijo = "_key";
  return completo.slice(0, LARGO_MAXIMO_IDENTIFICADOR - sufijo.length) + sufijo;
}

/** Índices únicos que quedan vivos después de aplicar todas las migraciones. */
function indicesUnicosVivos() {
  const sql = sqlDeLasMigraciones();
  const vivos = new Set();

  for (const m of sql.matchAll(/UNIQUE INDEX\s+(?:IF NOT EXISTS\s+)?`([A-Za-z0-9_]+)`/g)) {
    vivos.add(m[1]);
  }
  for (const m of sql.matchAll(/DROP INDEX\s+(?:IF EXISTS\s+)?`?([A-Za-z0-9_]+)`?/g)) {
    vivos.delete(m[1]);
  }
  return vivos;
}

// Índices globales que la migración inicial creó y que contradicen el diseño
// multi-tenant. Si alguno vuelve a quedar vivo, esta prueba se pone en rojo.
const GLOBALES_PROHIBIDOS = [
  "User_email_key",
  "Patient_dni_key",
  "Patient_chartNumber_key",
  "Professional_email_key",
];

test("las migraciones no dejan vivo ningún índice único global sobre email, dni o chartNumber", () => {
  const vivos = indicesUnicosVivos();
  const sobrevivientes = GLOBALES_PROHIBIDOS.filter((nombre) => vivos.has(nombre));

  assert.deepEqual(
    sobrevivientes,
    [],
    `Estos índices globales quedan vivos y romperían el aislamiento por clínica: ${sobrevivientes.join(", ")}. ` +
      "Hay que agregar el DROP INDEX correspondiente en una migración."
  );
});

test("las migraciones crean los índices únicos por clínica que declara el schema", () => {
  const vivos = indicesUnicosVivos();
  const esperados = [
    "User_clinicId_email_key",
    "Patient_clinicId_dni_key",
    "Patient_clinicId_chartNumber_key",
  ];
  const faltantes = esperados.filter((nombre) => !vivos.has(nombre));

  assert.deepEqual(
    faltantes,
    [],
    `El schema declara unicidad por clínica pero ninguna migración crea: ${faltantes.join(", ")}.`
  );
});

test("cada @@unique compuesto del schema tiene su índice en las migraciones", () => {
  const schema = fs.readFileSync(path.join(RAIZ, "prisma", "schema.prisma"), "utf8");
  const vivos = indicesUnicosVivos();
  const faltantes = [];

  // Modelo actual mientras se recorre el schema, para poder armar el nombre que
  // usa Prisma: <Modelo>_<campo1>_<campo2>_key
  let modelo = null;
  for (const linea of schema.split("\n")) {
    const inicioModelo = linea.match(/^model\s+([A-Za-z0-9_]+)\s*\{/);
    if (inicioModelo) { modelo = inicioModelo[1]; continue; }

    const unico = linea.match(/@@unique\(\[([^\]]+)\]/);
    if (!unico || !modelo) continue;

    const campos = unico[1].split(",").map((c) => c.trim());
    if (campos.length < 2) continue; // solo interesan los compuestos

    const nombre = nombreDeIndice(modelo, campos);
    if (!vivos.has(nombre)) faltantes.push(nombre);
  }

  assert.deepEqual(
    faltantes,
    [],
    `Estos @@unique del schema no existen en ninguna migración: ${faltantes.join(", ")}. ` +
      "Una base creada desde cero no se comportaría como producción."
  );
});
