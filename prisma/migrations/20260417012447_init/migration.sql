-- CreateTable
CREATE TABLE `User` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `email` VARCHAR(191) NOT NULL,
    `passwordHash` VARCHAR(191) NULL,
    `fullName` VARCHAR(191) NOT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `deletedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `User_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Role` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` ENUM('superadmin', 'admin', 'secretary', 'professional') NOT NULL,
    `label` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Role_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `UserRole` (
    `userId` INTEGER NOT NULL,
    `roleId` INTEGER NOT NULL,
    `assignedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `UserRole_roleId_idx`(`roleId`),
    PRIMARY KEY (`userId`, `roleId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Professional` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `fullName` VARCHAR(191) NOT NULL,
    `specialty` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NULL,
    `color` VARCHAR(191) NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `deletedAt` DATETIME(3) NULL,
    `userId` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Professional_email_key`(`email`),
    UNIQUE INDEX `Professional_userId_key`(`userId`),
    INDEX `Professional_fullName_idx`(`fullName`),
    INDEX `Professional_active_idx`(`active`),
    INDEX `Professional_deletedAt_idx`(`deletedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `UserProfessionalScope` (
    `userId` INTEGER NOT NULL,
    `professionalId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `UserProfessionalScope_professionalId_idx`(`professionalId`),
    PRIMARY KEY (`userId`, `professionalId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Patient` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `fullName` VARCHAR(191) NOT NULL,
    `normalizedName` VARCHAR(191) NOT NULL,
    `dni` VARCHAR(191) NOT NULL,
    `birthDate` DATETIME(3) NULL,
    `phone` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `address` VARCHAR(191) NULL,
    `insuranceName` VARCHAR(191) NULL,
    `insurancePlan` VARCHAR(191) NULL,
    `credentialNumber` VARCHAR(191) NULL,
    `chartNumber` VARCHAR(191) NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `deletedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Patient_dni_key`(`dni`),
    UNIQUE INDEX `Patient_chartNumber_key`(`chartNumber`),
    INDEX `Patient_fullName_idx`(`fullName`),
    INDEX `Patient_normalizedName_idx`(`normalizedName`),
    INDEX `Patient_phone_idx`(`phone`),
    INDEX `Patient_deletedAt_idx`(`deletedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Appointment` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `patientId` INTEGER NOT NULL,
    `professionalId` INTEGER NOT NULL,
    `createdByUserId` INTEGER NULL,
    `date` DATETIME(3) NOT NULL,
    `startTime` DATETIME(3) NOT NULL,
    `durationMinutes` INTEGER NOT NULL,
    `status` ENUM('not_sent', 'sent', 'confirmed', 'rescheduled', 'cancelled') NOT NULL DEFAULT 'not_sent',
    `isOverbook` BOOLEAN NOT NULL DEFAULT false,
    `confirmationChannel` ENUM('whatsapp', 'phone', 'email', 'manual') NULL,
    `confirmationSentAt` DATETIME(3) NULL,
    `confirmationResponseAt` DATETIME(3) NULL,
    `cancellationReason` VARCHAR(191) NULL,
    `notes` VARCHAR(191) NULL,
    `deletedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Appointment_patientId_date_idx`(`patientId`, `date`),
    INDEX `Appointment_professionalId_date_idx`(`professionalId`, `date`),
    INDEX `Appointment_status_date_idx`(`status`, `date`),
    INDEX `Appointment_date_startTime_idx`(`date`, `startTime`),
    INDEX `Appointment_deletedAt_idx`(`deletedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProfessionalAvailability` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `professionalId` INTEGER NOT NULL,
    `weekday` INTEGER NOT NULL,
    `startTime` VARCHAR(191) NOT NULL,
    `endTime` VARCHAR(191) NOT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ProfessionalAvailability_professionalId_weekday_idx`(`professionalId`, `weekday`),
    UNIQUE INDEX `ProfessionalAvailability_professionalId_weekday_startTime_en_key`(`professionalId`, `weekday`, `startTime`, `endTime`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProfessionalScheduleException` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `professionalId` INTEGER NOT NULL,
    `date` DATETIME(3) NOT NULL,
    `type` ENUM('unavailable', 'special_hours') NOT NULL,
    `startTime` VARCHAR(191) NULL,
    `endTime` VARCHAR(191) NULL,
    `reason` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ProfessionalScheduleException_professionalId_date_idx`(`professionalId`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ClinicalRecord` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `patientId` INTEGER NOT NULL,
    `summaryNotes` VARCHAR(191) NULL,
    `allergies` VARCHAR(191) NULL,
    `medicalNotes` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ClinicalRecord_patientId_key`(`patientId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `OdontogramEntry` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `clinicalRecordId` INTEGER NOT NULL,
    `toothNumber` VARCHAR(191) NOT NULL,
    `face` ENUM('M', 'D', 'V', 'P', 'O', 'I', 'L') NULL,
    `status` ENUM('healthy', 'caries', 'restored', 'absent') NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `OdontogramEntry_clinicalRecordId_toothNumber_idx`(`clinicalRecordId`, `toothNumber`),
    UNIQUE INDEX `OdontogramEntry_clinicalRecordId_toothNumber_face_key`(`clinicalRecordId`, `toothNumber`, `face`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Treatment` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `patientId` INTEGER NOT NULL,
    `professionalId` INTEGER NULL,
    `appointmentId` INTEGER NULL,
    `createdByUserId` INTEGER NULL,
    `tooth` VARCHAR(191) NULL,
    `face` VARCHAR(191) NULL,
    `sector` VARCHAR(191) NULL,
    `authorizationNumber` VARCHAR(191) NULL,
    `insuranceCode` VARCHAR(191) NULL,
    `observations` VARCHAR(191) NULL,
    `performedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `deletedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Treatment_patientId_performedAt_idx`(`patientId`, `performedAt`),
    INDEX `Treatment_professionalId_performedAt_idx`(`professionalId`, `performedAt`),
    INDEX `Treatment_appointmentId_idx`(`appointmentId`),
    INDEX `Treatment_deletedAt_idx`(`deletedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ClinicalImage` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `patientId` INTEGER NOT NULL,
    `uploadedByUserId` INTEGER NULL,
    `imageUrl` LONGTEXT NOT NULL,
    `description` VARCHAR(191) NULL,
    `takenAt` DATETIME(3) NULL,
    `deletedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ClinicalImage_patientId_createdAt_idx`(`patientId`, `createdAt`),
    INDEX `ClinicalImage_deletedAt_idx`(`deletedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BillingEntry` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `patientId` INTEGER NOT NULL,
    `professionalId` INTEGER NOT NULL,
    `appointmentId` INTEGER NULL,
    `createdByUserId` INTEGER NULL,
    `type` ENUM('income', 'debt', 'payment', 'adjustment') NOT NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'ARS',
    `description` VARCHAR(191) NULL,
    `date` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `BillingEntry_patientId_date_idx`(`patientId`, `date`),
    INDEX `BillingEntry_professionalId_date_idx`(`professionalId`, `date`),
    INDEX `BillingEntry_type_date_idx`(`type`, `date`),
    INDEX `BillingEntry_deletedAt_idx`(`deletedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AuditLog` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NULL,
    `entityType` VARCHAR(191) NOT NULL,
    `entityId` VARCHAR(191) NOT NULL,
    `action` ENUM('create', 'update', 'delete', 'login', 'logout') NOT NULL,
    `beforeData` JSON NULL,
    `afterData` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AuditLog_entityType_entityId_idx`(`entityType`, `entityId`),
    INDEX `AuditLog_userId_createdAt_idx`(`userId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `UserRole` ADD CONSTRAINT `UserRole_roleId_fkey` FOREIGN KEY (`roleId`) REFERENCES `Role`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserRole` ADD CONSTRAINT `UserRole_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Professional` ADD CONSTRAINT `Professional_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserProfessionalScope` ADD CONSTRAINT `UserProfessionalScope_professionalId_fkey` FOREIGN KEY (`professionalId`) REFERENCES `Professional`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserProfessionalScope` ADD CONSTRAINT `UserProfessionalScope_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Appointment` ADD CONSTRAINT `Appointment_patientId_fkey` FOREIGN KEY (`patientId`) REFERENCES `Patient`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Appointment` ADD CONSTRAINT `Appointment_professionalId_fkey` FOREIGN KEY (`professionalId`) REFERENCES `Professional`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Appointment` ADD CONSTRAINT `Appointment_createdByUserId_fkey` FOREIGN KEY (`createdByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProfessionalAvailability` ADD CONSTRAINT `ProfessionalAvailability_professionalId_fkey` FOREIGN KEY (`professionalId`) REFERENCES `Professional`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProfessionalScheduleException` ADD CONSTRAINT `ProfessionalScheduleException_professionalId_fkey` FOREIGN KEY (`professionalId`) REFERENCES `Professional`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ClinicalRecord` ADD CONSTRAINT `ClinicalRecord_patientId_fkey` FOREIGN KEY (`patientId`) REFERENCES `Patient`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OdontogramEntry` ADD CONSTRAINT `OdontogramEntry_clinicalRecordId_fkey` FOREIGN KEY (`clinicalRecordId`) REFERENCES `ClinicalRecord`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Treatment` ADD CONSTRAINT `Treatment_patientId_fkey` FOREIGN KEY (`patientId`) REFERENCES `Patient`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Treatment` ADD CONSTRAINT `Treatment_professionalId_fkey` FOREIGN KEY (`professionalId`) REFERENCES `Professional`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Treatment` ADD CONSTRAINT `Treatment_appointmentId_fkey` FOREIGN KEY (`appointmentId`) REFERENCES `Appointment`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Treatment` ADD CONSTRAINT `Treatment_createdByUserId_fkey` FOREIGN KEY (`createdByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ClinicalImage` ADD CONSTRAINT `ClinicalImage_patientId_fkey` FOREIGN KEY (`patientId`) REFERENCES `Patient`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ClinicalImage` ADD CONSTRAINT `ClinicalImage_uploadedByUserId_fkey` FOREIGN KEY (`uploadedByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BillingEntry` ADD CONSTRAINT `BillingEntry_patientId_fkey` FOREIGN KEY (`patientId`) REFERENCES `Patient`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BillingEntry` ADD CONSTRAINT `BillingEntry_professionalId_fkey` FOREIGN KEY (`professionalId`) REFERENCES `Professional`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BillingEntry` ADD CONSTRAINT `BillingEntry_appointmentId_fkey` FOREIGN KEY (`appointmentId`) REFERENCES `Appointment`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BillingEntry` ADD CONSTRAINT `BillingEntry_createdByUserId_fkey` FOREIGN KEY (`createdByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AuditLog` ADD CONSTRAINT `AuditLog_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
