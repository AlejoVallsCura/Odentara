-- Autorizaciones de un solo uso para URLs que no pueden llevar header de
-- autorización (descargas por navegación, salto entre subdominios).
--
-- Reemplaza las firmas sin estado que usaban la descarga del backup y el canje
-- de sesión: esas eran REUTILIZABLES dentro de su ventana y viajan en la query
-- string, o sea que quedan en los logs del reverse proxy.
--
-- La tabla no guarda datos de pacientes: solo el nombre de un archivo de backup
-- o el id del usuario que pidió el canje, y las filas se borran al vencer.

CREATE TABLE IF NOT EXISTS `SingleUseToken` (
  `token`     VARCHAR(64)  NOT NULL,
  `scope`     VARCHAR(40)  NOT NULL,
  `payload`   JSON         NOT NULL,
  `usedAt`    DATETIME(3)  NULL,
  `expiresAt` DATETIME(3)  NOT NULL,
  `createdAt` DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`token`),
  INDEX `SingleUseToken_expiresAt_idx` (`expiresAt`),
  INDEX `SingleUseToken_scope_expiresAt_idx` (`scope`, `expiresAt`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
