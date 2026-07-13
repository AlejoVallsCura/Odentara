-- Presupuestos de tratamiento
CREATE TABLE IF NOT EXISTS `Budget` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `patientId` INTEGER NOT NULL,
    `professionalId` INTEGER NOT NULL,
    `createdByUserId` INTEGER NULL,
    `billingEntryId` INTEGER NULL,
    `title` VARCHAR(191) NOT NULL,
    `items` TEXT NOT NULL,
    `discount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `total` DECIMAL(12, 2) NOT NULL,
    `currency` VARCHAR(3) NOT NULL DEFAULT 'ARS',
    `notes` TEXT NULL,
    `issuedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `deletedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Budget_billingEntryId_key`(`billingEntryId`),
    INDEX `Budget_patientId_issuedAt_idx`(`patientId`, `issuedAt`),
    INDEX `Budget_deletedAt_idx`(`deletedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `Budget`
    ADD CONSTRAINT `Budget_patientId_fkey` FOREIGN KEY (`patientId`) REFERENCES `Patient`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `Budget`
    ADD CONSTRAINT `Budget_professionalId_fkey` FOREIGN KEY (`professionalId`) REFERENCES `Professional`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `Budget`
    ADD CONSTRAINT `Budget_createdByUserId_fkey` FOREIGN KEY (`createdByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `Budget`
    ADD CONSTRAINT `Budget_billingEntryId_fkey` FOREIGN KEY (`billingEntryId`) REFERENCES `BillingEntry`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
