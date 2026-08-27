// Reescribe los `fullName` de pacientes ya cargados al mismo formato que ahora
// aplica `getPatientPayload`: "Primera Letra Mayúscula".
//
// El cambio en el servicio solo afecta lo que se escribe de acá en adelante. Sin
// esta pasada, una clínica que ya cargó pacientes en MAYÚSCULA sigue viendo el
// listado mezclado para siempre.
//
// De paso recalcula `normalizedName` (la clave de búsqueda sin acentos): si
// alguna fila quedó con un valor viejo o inconsistente, este es el momento de
// arreglarlo, porque una clave de búsqueda desincronizada hace que un paciente
// no aparezca al buscarlo.
//
// Uso:
//   node prisma/scripts/normalize-patient-names.js --dry-run
//   node prisma/scripts/normalize-patient-names.js
//
// En el server hay que exportar DATABASE_URL a mano y usar la ruta completa de
// node — ver docs/BACKUP.md, mismo tema.
//
// Correr DESPUÉS de un backup verificado. Toca todas las filas de Patient.

require("../../server/lib/load-env").loadEnv();
const prisma = require("../../server/lib/prisma");
const {
  toDisplayCasePatientName,
  normalizePatientName,
} = require("../../server/services/patient.service");

const DRY_RUN = process.argv.includes("--dry-run");

/**
 * Repara nombres con "mojibake": texto UTF-8 que en algún momento se leyó como
 * Latin-1 y quedó guardado así. Se ve como "Pablo FernÃ¡ndez" en vez de "Pablo
 * Fernández", y aparece cuando se importa un Excel/CSV guardado con la
 * codificación equivocada.
 *
 * Hay que arreglarlo ANTES de capitalizar, no después: sobre el texto roto, el
 * paso de mayúsculas produce "Fernã¡ndez", que es peor y ya no se puede revertir
 * automáticamente.
 *
 * La reparación es reinterpretar los bytes como UTF-8. Solo se acepta si el
 * resultado no vuelve a tener marcas de mojibake ni caracteres de reemplazo —
 * ante la duda se devuelve el original, porque romper un nombre sano es peor que
 * dejar uno roto.
 */
const MARCAS_MOJIBAKE = /[ÃÂ][-¿]/;

function repararMojibake(texto) {
  if (!MARCAS_MOJIBAKE.test(texto)) return texto;

  const reinterpretado = Buffer.from(texto, "latin1").toString("utf8");

  if (reinterpretado.includes("�") || MARCAS_MOJIBAKE.test(reinterpretado)) {
    return texto;
  }
  return reinterpretado;
}

async function main() {
  const pacientes = await prisma.patient.findMany({
    select: { id: true, clinicId: true, fullName: true, normalizedName: true },
    orderBy: { id: "asc" },
  });

  console.log(`${pacientes.length} pacientes en la base.`);
  if (DRY_RUN) console.log("Modo --dry-run: no se escribe nada.\n");

  const cambios = [];

  for (const paciente of pacientes) {
    const reparado = repararMojibake(paciente.fullName || "");
    const nombreNuevo = toDisplayCasePatientName(reparado);
    const claveNueva = normalizePatientName(nombreNuevo);

    // Un nombre que ya está bien no se toca: evita mover `updatedAt` de filas
    // que no cambiaron, que es lo que después ensucia cualquier auditoría de
    // "qué se modificó ese día".
    if (nombreNuevo === paciente.fullName && claveNueva === paciente.normalizedName) {
      continue;
    }

    // Un nombre que se vacía al normalizar significa que la fila tenía basura
    // (o solo espacios). Se avisa y se saltea: dejar el paciente sin nombre es
    // peor que dejarlo mal escrito.
    if (!nombreNuevo) {
      console.warn(`  ! id ${paciente.id}: el nombre queda vacío al normalizar, se omite`);
      continue;
    }

    cambios.push({
      id: paciente.id,
      clinicId: paciente.clinicId,
      antes: paciente.fullName,
      despues: nombreNuevo,
      claveNueva,
    });
  }

  if (cambios.length === 0) {
    console.log("No hay nada que cambiar.");
    return;
  }

  console.log(`\n${cambios.length} pacientes a corregir:\n`);
  for (const c of cambios.slice(0, 50)) {
    console.log(`  [clínica ${c.clinicId}] ${c.antes}  →  ${c.despues}`);
  }
  if (cambios.length > 50) console.log(`  … y ${cambios.length - 50} más`);

  if (DRY_RUN) {
    console.log("\n--dry-run: no se escribió nada. Sacá el flag para aplicarlo.");
    return;
  }

  console.log("\nAplicando…");
  let aplicados = 0;
  for (const c of cambios) {
    await prisma.patient.update({
      where: { id: c.id },
      data: { fullName: c.despues, normalizedName: c.claveNueva },
    });
    aplicados += 1;
  }

  console.log(`Listo: ${aplicados} pacientes actualizados.`);
}

main()
  .catch((error) => {
    console.error(`\nFALLÓ: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
