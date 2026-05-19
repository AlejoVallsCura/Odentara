-- Migración: agregar soporte multi-clínica a schema existente
-- Segura para correr sobre la DB de Hostinger (20260424201952_init_mysql)

-- 1. Crear tabla Clinic
CREATE TABLE IF NOT EXISTS `Clinic` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `address` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `logoUrl` VARCHAR(191) NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `plan` VARCHAR(191) NULL,
    `notes` TEXT NULL,
    `dbType` VARCHAR(191) NOT NULL DEFAULT 'shared',
    `databaseUrl` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    UNIQUE INDEX `Clinic_slug_key`(`slug`),
    INDEX `Clinic_active_idx`(`active`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 2. Crear tabla SubscriptionPayment
CREATE TABLE IF NOT EXISTS `SubscriptionPayment` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `clinicId` INTEGER NOT NULL,
    `period` VARCHAR(7) NOT NULL,
    `amount` DECIMAL(10, 2) NOT NULL,
    `paymentMethod` VARCHAR(50) NOT NULL,
    `paidAt` DATETIME(3) NOT NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE INDEX `SubscriptionPayment_clinicId_period_key`(`clinicId`, `period`),
    INDEX `SubscriptionPayment_clinicId_idx`(`clinicId`),
    INDEX `SubscriptionPayment_period_idx`(`period`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 3. Agregar columnas a User (si no existen)
ALTER TABLE `User`
    ADD COLUMN IF NOT EXISTS `isPlatformAdmin` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS `clinicId` INTEGER NULL;

-- 4. Agregar columnas a Professional (si no existen)
ALTER TABLE `Professional`
    ADD COLUMN IF NOT EXISTS `clinicId` INTEGER NULL;

-- 5. Agregar columnas a Patient (si no existen)
ALTER TABLE `Patient`
    ADD COLUMN IF NOT EXISTS `clinicId` INTEGER NULL;

-- 6. Agregar columnas a Appointment (si no existen)
ALTER TABLE `Appointment`
    ADD COLUMN IF NOT EXISTS `clinicId` INTEGER NULL;

-- 7. Insertar clínica por defecto para datos existentes
INSERT IGNORE INTO `Clinic` (`id`, `name`, `slug`, `active`, `dbType`, `updatedAt`)
VALUES (1, 'Odentara', 'odentara', true, 'shared', NOW());

-- 8. Asignar clínica 1 a todos los registros existentes
UPDATE `User` SET `clinicId` = 1 WHERE `clinicId` IS NULL AND `isPlatformAdmin` = false;
UPDATE `Professional` SET `clinicId` = 1 WHERE `clinicId` IS NULL;
UPDATE `Patient` SET `clinicId` = 1 WHERE `clinicId` IS NULL;
UPDATE `Appointment` SET `clinicId` = 1 WHERE `clinicId` IS NULL;

-- 9. Foreign keys (opcionales, agregar solo si la DB las soporta bien)
ALTER TABLE `SubscriptionPayment`
    ADD CONSTRAINT `SubscriptionPayment_clinicId_fkey`
    FOREIGN KEY (`clinicId`) REFERENCES `Clinic`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
