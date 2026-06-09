-- Soporte para documentos PDF en historia clínica
-- Agrega mimeType y fileName a ClinicalImage

ALTER TABLE `ClinicalImage`
  ADD COLUMN `mimeType` VARCHAR(50) NOT NULL DEFAULT 'image/jpeg' AFTER `imageUrl`,
  ADD COLUMN `fileName` VARCHAR(255) NULL AFTER `mimeType`;

CREATE INDEX `ClinicalImage_mimeType_idx` ON `ClinicalImage`(`mimeType`);
