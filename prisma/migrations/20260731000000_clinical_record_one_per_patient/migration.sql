-- IMPORTANTE: antes de correr este SQL, ejecutar por SSH:
--   node prisma/scripts/merge-clinical-records.js
-- Ese script fusiona los ClinicalRecord duplicados por paciente (uno por
-- profesional) en uno solo, combinando odontogramas y notas. Si hay
-- duplicados sin fusionar, el ADD UNIQUE de abajo va a fallar.

ALTER TABLE ClinicalRecord DROP INDEX ClinicalRecord_patientId_professionalId_key;
ALTER TABLE ClinicalRecord ADD UNIQUE INDEX ClinicalRecord_patientId_key (patientId);
