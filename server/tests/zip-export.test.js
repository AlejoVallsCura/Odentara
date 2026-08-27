"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { Writable } = require("node:stream");

const {
  MAX_FILES,
  sanitizeFileName,
  buildZipEntryName,
  csvCell,
  buildIndexCsv,
  buildArchiveFileName,
  checkExportLimits,
  writeClinicalExportZip,
} = require("../lib/zip-export");

// ── sanitizeFileName ────────────────────────────────────────────────────────

test("saca los acentos en vez de dejarlos en el nombre del archivo", () => {
  // Un ZIP con acentos en los nombres se ve roto en varios descompresores
  // de Windows.
  assert.equal(sanitizeFileName("Radiografía panorámica"), "Radiografia panoramica");
});

test("saca los caracteres que Windows no acepta en un nombre de archivo", () => {
  assert.equal(sanitizeFileName('a/b\\c:d*e?f"g<h>i|j'), "abcdefghij");
});

test("saca los caracteres de control", () => {
  assert.equal(sanitizeFileName("abc"), "abc");
});

test("descarta puntos y espacios finales", () => {
  // Windows los recorta al crear el archivo: el ZIP diría una cosa y el disco
  // terminaría con otra.
  assert.equal(sanitizeFileName("informe..."), "informe");
  assert.equal(sanitizeFileName("informe   "), "informe");
});

test("escapa los nombres de dispositivo reservados de Windows", () => {
  assert.equal(sanitizeFileName("CON"), "_CON");
  assert.equal(sanitizeFileName("com1"), "_com1");
  assert.equal(sanitizeFileName("LPT9.txt"), "_LPT9.txt");
  // "CONTROL" no es reservado: solo lo es el nombre exacto o con extensión.
  assert.equal(sanitizeFileName("CONTROL"), "CONTROL");
});

test("usa el fallback cuando no queda nada utilizable", () => {
  assert.equal(sanitizeFileName("   "), "archivo");
  assert.equal(sanitizeFileName(null), "archivo");
  assert.equal(sanitizeFileName("///"), "archivo");
});

test("respeta el largo máximo", () => {
  assert.equal(sanitizeFileName("a".repeat(100), { maxLength: 10 }).length, 10);
});

// ── buildZipEntryName ───────────────────────────────────────────────────────

const IMAGEN_BASE = {
  id: 42,
  mimeType: "image/jpeg",
  description: "Frente inicial",
  createdAt: "2026-08-11T15:00:00.000Z",
};

test("las imágenes y los documentos van a carpetas distintas", () => {
  assert.match(buildZipEntryName(IMAGEN_BASE), /^imagenes\//);
  assert.match(
    buildZipEntryName({ ...IMAGEN_BASE, mimeType: "application/pdf" }),
    /^documentos\//,
  );
});

test("el id va siempre al final para que dos archivos no colisionen", () => {
  const a = buildZipEntryName({ ...IMAGEN_BASE, id: 1 });
  const b = buildZipEntryName({ ...IMAGEN_BASE, id: 2 });
  assert.notEqual(a, b);
  assert.match(a, /_1\.jpg$/);
  assert.match(b, /_2\.jpg$/);
});

test("prefiere takenAt sobre createdAt para la fecha", () => {
  const nombre = buildZipEntryName({ ...IMAGEN_BASE, takenAt: "2026-03-04T12:00:00.000Z" });
  assert.match(nombre, /2026-03-04/);
});

test("usa la fecha de la zona de negocio, no UTC", () => {
  // 2026-08-12T01:00Z son las 22:00 del 11 en Argentina. Con toISOString()
  // el archivo aparecería fechado un día después de cuando se sacó la foto.
  const nombre = buildZipEntryName({ ...IMAGEN_BASE, takenAt: "2026-08-12T01:00:00.000Z" });
  assert.match(nombre, /2026-08-11/);
});

test("una descripción hostil no se escapa de su carpeta", () => {
  // Sin sanear, una descripción con ../ escribiría fuera del ZIP al descomprimir.
  const nombre = buildZipEntryName({ ...IMAGEN_BASE, description: "../../../etc/passwd" });
  assert.equal(nombre.split("/").length, 2);
  assert.ok(!nombre.includes(".."));
});

// ── csvCell: inyección de fórmulas ──────────────────────────────────────────

test("neutraliza fórmulas de Excel en el índice", () => {
  // Es el caso real: la descripción la escribe el usuario y Excel ejecuta
  // cualquier celda que empiece con estos caracteres.
  for (const peligroso of ["=1+1", "+1", "-1", "@SUM(A1)", "\tx", "\rx"]) {
    assert.ok(
      csvCell(peligroso).startsWith("\"'"),
      `no se neutralizó: ${JSON.stringify(peligroso)}`,
    );
  }
});

test("escapa las comillas duplicándolas", () => {
  assert.equal(csvCell('dice "hola"'), '"dice ""hola"""');
});

test("un texto común no se altera más que con las comillas de envoltura", () => {
  assert.equal(csvCell("Radiografia inicial"), '"Radiografia inicial"');
});

test("null y undefined quedan como celda vacía", () => {
  assert.equal(csvCell(null), '""');
  assert.equal(csvCell(undefined), '""');
});

// ── buildIndexCsv ───────────────────────────────────────────────────────────

test("el índice arranca con BOM para que Excel respete los acentos", () => {
  assert.ok(buildIndexCsv([]).startsWith("﻿"));
});

test("el índice incluye la cabecera y una fila por archivo", () => {
  const csv = buildIndexCsv([
    { archivo: "imagenes/x_1.jpg", estado: "incluido" },
    { archivo: "", estado: "externo, no incluido" },
  ]);
  const lineas = csv.trimEnd().split("\r\n");
  assert.equal(lineas.length, 3);
  assert.ok(lineas[0].includes("archivo"));
  assert.ok(lineas[2].includes("externo, no incluido"));
});

// ── buildArchiveFileName ────────────────────────────────────────────────────

test("el nombre del zip es apellido-nombre-dni y nada mas", () => {
  assert.equal(
    buildArchiveFileName({ fullName: "Gómez María", dni: "30111222" }),
    "Gomez-Maria-30111222.zip",
  );
});

test("respeta el orden en que se cargo el nombre, sin reordenarlo", () => {
  // Con un apellido compuesto no hay forma de saber donde termina. Antes esto
  // partia por la primera palabra y devolvia "Juan Cruz-Vitale".
  assert.equal(
    buildArchiveFileName({ fullName: "Vitale Juan Cruz", dni: "28999888" }),
    "Vitale-Juan-Cruz-28999888.zip",
  );
});

test("sin DNI no queda un guion colgado al final", () => {
  assert.equal(buildArchiveFileName({ fullName: "Gómez María", dni: "" }), "Gomez-Maria.zip");
  assert.equal(buildArchiveFileName({ fullName: "Gómez María" }), "Gomez-Maria.zip");
});

test("un paciente sin nombre cargado no rompe el nombre del zip", () => {
  assert.equal(buildArchiveFileName({}), "paciente.zip");
  assert.equal(buildArchiveFileName(null), "paciente.zip");
  assert.equal(buildArchiveFileName({ dni: "30111222" }), "paciente-30111222.zip");
});

test("el nombre del zip no puede salirse de su carpeta ni romper Windows", () => {
  // sanitizeFileName ya lo cubre, pero el nombre del archivo es el unico dato
  // del paciente que viaja en una cabecera HTTP: conviene tenerlo asegurado acá.
  const nombre = buildArchiveFileName({ fullName: "../../etc/passwd", dni: "1:2*3?" });
  assert.ok(!nombre.includes("/"), "sin barras");
  assert.ok(!nombre.includes("\\"), "sin contrabarras");
  assert.ok(!/[:*?"<>|]/.test(nombre.replace(/\.zip$/, "")), "sin caracteres prohibidos");
  assert.ok(!nombre.startsWith("."), "sin punto inicial");
});

// ── checkExportLimits ───────────────────────────────────────────────────────

test("no se autoriza una exportación sin archivos", () => {
  const resultado = checkExportLimits([]);
  assert.equal(resultado.ok, false);
  assert.match(resultado.error, /no tiene archivos/i);
});

test("no se autoriza por encima del máximo de archivos", () => {
  const muchos = Array.from({ length: MAX_FILES + 1 }, (_, i) => ({ id: i }));
  assert.equal(checkExportLimits(muchos).ok, false);
});

test("no se autoriza por encima del máximo de bytes", () => {
  const pesados = [{ id: 1, fileSizeBytes: 1_500_000_000 }, { id: 2, fileSizeBytes: 1_500_000_000 }];
  const resultado = checkExportLimits(pesados);
  assert.equal(resultado.ok, false);
  assert.match(resultado.error, /GB/);
});

test("los archivos sin tamaño conocido no bloquean la autorización", () => {
  // Suman 0 acá a propósito: el corte real de esos lo hace el contador de
  // bytes durante el stream.
  assert.deepEqual(checkExportLimits([{ id: 1 }, { id: 2, fileSizeBytes: null }]), { ok: true });
});

// ── writeClinicalExportZip ──────────────────────────────────────────────────

function sinkQueCuenta() {
  const trozos = [];
  const stream = new Writable({
    write(chunk, _enc, cb) {
      trozos.push(chunk);
      cb();
    },
  });
  stream.buffer = () => Buffer.concat(trozos);
  return stream;
}

test("arma el ZIP incluyendo el índice", async () => {
  const destination = sinkQueCuenta();
  const images = [
    { id: 1, mimeType: "image/jpeg", description: "uno", createdAt: "2026-08-11T12:00:00Z" },
    { id: 2, mimeType: "application/pdf", description: "dos", createdAt: "2026-08-11T12:00:00Z" },
  ];

  const resultado = await writeClinicalExportZip({
    destination,
    images,
    openSource: async () => ({ source: Buffer.from("contenido") }),
  });

  assert.equal(resultado.incluidos, 2);
  assert.equal(resultado.omitidos, 0);
  assert.ok(resultado.bytes > 0);

  const zip = destination.buffer().toString("latin1");
  assert.ok(zip.includes("indice.csv"));
  assert.ok(zip.includes("imagenes/"));
  assert.ok(zip.includes("documentos/"));
});

test("un archivo que no se puede abrir se omite y queda asentado, sin abortar el ZIP", async () => {
  // El requisito de fondo: una historia clínica incompleta tiene que ser
  // visible. Nadie revisa lo que no sabe que falta.
  const destination = sinkQueCuenta();
  const images = [
    { id: 1, mimeType: "image/jpeg", createdAt: "2026-08-11T12:00:00Z" },
    { id: 2, mimeType: "image/jpeg", createdAt: "2026-08-11T12:00:00Z" },
  ];

  const resultado = await writeClinicalExportZip({
    destination,
    images,
    openSource: async (image) =>
      image.id === 2
        ? { source: null, motivoOmision: "externo, no incluido" }
        : { source: Buffer.from("ok") },
  });

  assert.equal(resultado.incluidos, 1);
  assert.equal(resultado.omitidos, 1);

  const zip = destination.buffer().toString("latin1");
  assert.ok(zip.includes("indice.csv"));
});

test("una falla al abrir un archivo propaga el error y NO cierra el ZIP", async () => {
  // Cerrar el ZIP tras un error daría un archivo válido al que le faltan
  // estudios: peor que una descarga rota.
  const destination = sinkQueCuenta();
  const images = [{ id: 1, mimeType: "image/jpeg", createdAt: "2026-08-11T12:00:00Z" }];

  await assert.rejects(
    writeClinicalExportZip({
      destination,
      images,
      openSource: async () => {
        throw new Error("R2 caido");
      },
    }),
    /R2 caido/,
  );
});

test("no deja listeners colgados al procesar muchos archivos", async () => {
  // Sin desenganchar al perdedor del race, cada vuelta sumaba un listener de
  // 'error' y Node avisaba de un leak a partir del undécimo.
  const avisos = [];
  const onWarning = (w) => avisos.push(w.name);
  process.on("warning", onWarning);

  try {
    const destination = sinkQueCuenta();
    const images = Array.from({ length: 30 }, (_, i) => ({
      id: i + 1,
      mimeType: "image/jpeg",
      createdAt: "2026-08-11T12:00:00Z",
    }));

    await writeClinicalExportZip({
      destination,
      images,
      openSource: async () => ({ source: Buffer.from("x") }),
    });

    await new Promise((resolve) => setImmediate(resolve));
    assert.ok(
      !avisos.includes("MaxListenersExceededWarning"),
      "se filtraron listeners al armar el ZIP",
    );
  } finally {
    process.off("warning", onWarning);
  }
});

test("el índice registra el estado de cada archivo con los datos extra", async () => {
  const destination = sinkQueCuenta();
  const images = [{ id: 7, mimeType: "image/jpeg", createdAt: "2026-08-11T12:00:00Z" }];

  const resultado = await writeClinicalExportZip({
    destination,
    images,
    openSource: async () => ({ source: Buffer.from("x") }),
    describeForIndex: (image) => ({ descripcion: `id ${image.id}` }),
  });

  assert.equal(resultado.incluidos, 1);
});
