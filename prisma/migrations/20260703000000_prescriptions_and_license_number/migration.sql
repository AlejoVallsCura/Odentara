-- Matrícula profesional (obligatoria para emitir recetas)
ALTER TABLE `Professional`
    ADD COLUMN IF NOT EXISTS `licenseNumber` VARCHAR(191) NULL;

-- Recetas digitales
CREATE TABLE IF NOT EXISTS `Prescription` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `patientId` INTEGER NOT NULL,
    `professionalId` INTEGER NOT NULL,
    `createdByUserId` INTEGER NULL,
    `diagnosis` TEXT NULL,
    `medications` TEXT NOT NULL,
    `instructions` TEXT NULL,
    `issuedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `deletedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Prescription_patientId_issuedAt_idx`(`patientId`, `issuedAt`),
    INDEX `Prescription_professionalId_issuedAt_idx`(`professionalId`, `issuedAt`),
    INDEX `Prescription_deletedAt_idx`(`deletedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `Prescription`
    ADD CONSTRAINT `Prescription_patientId_fkey` FOREIGN KEY (`patientId`) REFERENCES `Patient`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `Prescription`
    ADD CONSTRAINT `Prescription_professionalId_fkey` FOREIGN KEY (`professionalId`) REFERENCES `Professional`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `Prescription`
    ADD CONSTRAINT `Prescription_createdByUserId_fkey` FOREIGN KEY (`createdByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
