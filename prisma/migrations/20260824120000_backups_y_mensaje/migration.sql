-- Plantilla del mensaje de confirmación, por clínica.
-- Null = usa el texto por defecto del código.
ALTER TABLE `Clinic` ADD COLUMN `appointmentMessageTemplate` TEXT NULL;

-- Configuración del backup automático. Una sola fila.
CREATE TABLE `BackupSchedule` (
  `id`        INTEGER      NOT NULL DEFAULT 1,
  `enabled`   BOOLEAN      NOT NULL DEFAULT false,
  `frequency` VARCHAR(16)  NOT NULL DEFAULT 'daily',
  `hour`      INTEGER      NOT NULL DEFAULT 3,
  `minute`    INTEGER      NOT NULL DEFAULT 0,
  `weekday`   INTEGER      NOT NULL DEFAULT 1,
  `keepLast`  INTEGER      NOT NULL DEFAULT 10,
  `updatedAt` DATETIME(3)  NOT NULL,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Historial. `slot` UNIQUE es lo que evita que varios workers corran el mismo
-- backup programado a la vez: el primero que inserta gana, los demás chocan.
CREATE TABLE `BackupRun` (
  `id`          INTEGER      NOT NULL AUTO_INCREMENT,
  `slot`        VARCHAR(40)  NOT NULL,
  `trigger`     VARCHAR(16)  NOT NULL DEFAULT 'manual',
  `status`      VARCHAR(16)  NOT NULL DEFAULT 'running',
  `startedAt`   DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `finishedAt`  DATETIME(3)  NULL,
  `fileName`    VARCHAR(255) NULL,
  `bytes`       INTEGER      NULL,
  `totalRows`   INTEGER      NULL,
  `totalTables` INTEGER      NULL,
  `error`       TEXT         NULL,
  `userId`      INTEGER      NULL,
  UNIQUE INDEX `BackupRun_slot_key`(`slot`),
  INDEX `BackupRun_startedAt_idx`(`startedAt`),
  INDEX `BackupRun_status_idx`(`status`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Fila única de configuración, desactivada hasta que alguien la prenda.
INSERT INTO `BackupSchedule` (`id`, `enabled`, `updatedAt`) VALUES (1, false, NOW(3));
