-- Migración: hacer NOT NULL las columnas clinicId en Professional, Patient, Appointment
-- Segura para correr SOLO después de que todos los registros tengan clinicId asignado
-- (la migración 20260519000000_add_multitenancy ya hizo el backfill a clinicId = 1)

-- Verificar que no hay NULLs antes de correr (opcional, para seguridad):
-- SELECT COUNT(*) FROM Professional WHERE clinicId IS NULL;
-- SELECT COUNT(*) FROM Patient WHERE clinicId IS NULL;
-- SELECT COUNT(*) FROM Appointment WHERE clinicId IS NULL;

-- 1. Professional.clinicId → NOT NULL
ALTER TABLE `Professional`
  MODIFY COLUMN `clinicId` INTEGER NOT NULL;

-- 2. Patient.clinicId → NOT NULL
ALTER TABLE `Patient`
  MODIFY COLUMN `clinicId` INTEGER NOT NULL;

-- 3. Appointment.clinicId → NOT NULL
ALTER TABLE `Appointment`
  MODIFY COLUMN `clinicId` INTEGER NOT NULL;

-- 4. Agregar foreign keys ahora que los valores son seguros
--    (omitir si ya existen o si la DB no las soporta bien)
ALTER TABLE `Professional`
  ADD CONSTRAINT `Professional_clinicId_fkey`
  FOREIGN KEY (`clinicId`) REFERENCES `Clinic`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `Patient`
  ADD CONSTRAINT `Patient_clinicId_fkey`
  FOREIGN KEY (`clinicId`) REFERENCES `Clinic`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `Appointment`
  ADD CONSTRAINT `Appointment_clinicId_fkey`
  FOREIGN KEY (`clinicId`) REFERENCES `Clinic`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
