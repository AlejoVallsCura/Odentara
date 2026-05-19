-- Migración: agregar professionalId a ClinicalImage
-- Ejecutar en phpMyAdmin de Hostinger

-- 1. Agregar columna professionalId (nullable) a ClinicalImage
ALTER TABLE `ClinicalImage`
  ADD COLUMN `professionalId` INTEGER NULL AFTER `patientId`;

-- 2. Agregar índice compuesto (patientId, professionalId) para filtros eficientes
ALTER TABLE `ClinicalImage`
  ADD INDEX `ClinicalImage_patientId_professionalId_idx` (`patientId`, `professionalId`);

-- 3. Agregar foreign key hacia Professional
ALTER TABLE `ClinicalImage`
  ADD CONSTRAINT `ClinicalImage_professionalId_fkey`
  FOREIGN KEY (`professionalId`) REFERENCES `Professional`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
