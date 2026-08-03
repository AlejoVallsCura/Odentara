// Fusiona los ClinicalRecord duplicados por paciente (uno por profesional)
// en UN solo registro compartido, antes de aplicar el nuevo
// @@unique([patientId]) en el schema.
//
// Por paciente con más de un registro:
//   - Se elige como "sobreviviente" el de fecha de creación más antigua
//     (para no romper referencias externas si las hubiera).
//   - odontogramEntries: se combinan todas; si dos registros marcaron el
//     mismo diente+cara, gana la entrada con updatedAt más reciente.
//   - summaryNotes / allergies / medicalNotes: se concatenan los textos no
//     vacíos de todos los registros (separados por " | "), sin duplicar
//     si el texto es idéntico.
//   - Los registros sobrantes se borran (con eliminación en cascada de sus
//     odontogramEntries originales, ya reubicadas).
//
// Uso: node prisma/scripts/merge-clinical-records.js [--dry-run]

require("../../server/lib/load-env").loadEnv();
const prisma = require("../../server/lib/prisma");

const DRY_RUN = process.argv.includes("--dry-run");

function mergeText(values) {
  const seen = new Set();
  const parts = [];
  for (const v of values) {
    const t = (v || "").trim();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    parts.push(t);
  }
  return parts.join(" | ");
}

async function main() {
  const grouped = await prisma.clinicalRecord.groupBy({
    by: ["patientId"],
    _count: { id: true },
  });
  const duplicated = grouped.filter((g) => g._count.id > 1);

  console.log(`Pacientes con registros clínicos duplicados: ${duplicated.length}`);
  if (DRY_RUN) console.log("(modo --dry-run: no se escribe nada)\n");

  for (const { patientId } of duplicated) {
    const records = await prisma.clinicalRecord.findMany({
      where: { patientId },
      include: { odontogramEntries: true },
      orderBy: { createdAt: "asc" },
    });

    const survivor = records[0];
    const rest = records.slice(1);

    console.log(`\nPaciente ${patientId}: fusionando ${records.length} registros en el #${survivor.id}`);

    // Combinar odontograma: clave = toothNumber + face, gana el más reciente
    const toothMap = new Map();
    for (const rec of records) {
      for (const entry of rec.odontogramEntries) {
        const key = `${entry.toothNumber}::${entry.face || ""}`;
        const current = toothMap.get(key);
        if (!current || entry.updatedAt > current.updatedAt) {
          toothMap.set(key, entry);
        }
      }
    }

    const mergedNotes = mergeText(records.map((r) => r.summaryNotes));
    const mergedAllergies = mergeText(records.map((r) => r.allergies));
    const mergedMedicalNotes = mergeText(records.map((r) => r.medicalNotes));

    console.log(`  odontograma: ${toothMap.size} piezas combinadas (de ${records.reduce((s, r) => s + r.odontogramEntries.length, 0)} entradas originales)`);
    if (mergedNotes) console.log(`  notas fusionadas: "${mergedNotes.slice(0, 60)}${mergedNotes.length > 60 ? "…" : ""}"`);
    if (mergedAllergies) console.log(`  alergias fusionadas: "${mergedAllergies.slice(0, 60)}${mergedAllergies.length > 60 ? "…" : ""}"`);

    if (DRY_RUN) continue;

    await prisma.$transaction(async (tx) => {
      // Reescribir el odontograma del sobreviviente con el resultado fusionado
      await tx.odontogramEntry.deleteMany({ where: { clinicalRecordId: survivor.id } });
      if (toothMap.size > 0) {
        await tx.odontogramEntry.createMany({
          data: [...toothMap.values()].map((e) => ({
            clinicalRecordId: survivor.id,
            toothNumber: e.toothNumber,
            face: e.face,
            status: e.status,
          })),
        });
      }

      await tx.clinicalRecord.update({
        where: { id: survivor.id },
        data: {
          summaryNotes: mergedNotes || null,
          allergies: mergedAllergies || null,
          medicalNotes: mergedMedicalNotes || null,
        },
      });

      // Borrar los registros sobrantes (cascada borra sus odontogramEntries,
      // que ya fueron reubicadas arriba)
      await tx.clinicalRecord.deleteMany({
        where: { id: { in: rest.map((r) => r.id) } },
      });
    });

    console.log(`  ✓ fusionado, registros ${rest.map((r) => r.id).join(", ")} eliminados`);
  }

  console.log(DRY_RUN ? "\n(dry-run) Nada se escribió." : "\nListo.");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
