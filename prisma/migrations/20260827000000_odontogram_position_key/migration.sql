-- La cara de una pieza completa se guarda como NULL. En MariaDB, dos NULL no
-- colisionan dentro de un UNIQUE y podían existir varias entradas generales para
-- la misma pieza. La clave no nula permite reemplazar el odontograma dentro de
-- una transacción sin depender de esa semántica especial.
ALTER TABLE `OdontogramEntry`
  ADD COLUMN `positionKey` VARCHAR(32) NULL;

UPDATE `OdontogramEntry`
SET `positionKey` = CONCAT(`toothNumber`, '|', COALESCE(CAST(`face` AS CHAR), '_'));

-- Si la base ya acumuló duplicados con face NULL, conservar el más reciente
-- evita que la nueva restricción falle y mantiene la última observación visible.
DELETE duplicada
FROM `OdontogramEntry` AS duplicada
INNER JOIN `OdontogramEntry` AS conservada
  ON conservada.`clinicalRecordId` = duplicada.`clinicalRecordId`
  AND conservada.`toothNumber` = duplicada.`toothNumber`
  AND conservada.`positionKey` = duplicada.`positionKey`
  AND (
    conservada.`updatedAt` > duplicada.`updatedAt`
    OR (conservada.`updatedAt` = duplicada.`updatedAt` AND conservada.`id` > duplicada.`id`)
  );

ALTER TABLE `OdontogramEntry`
  MODIFY `positionKey` VARCHAR(32) NOT NULL,
  DROP INDEX `OdontogramEntry_clinicalRecordId_toothNumber_face_key`,
  ADD UNIQUE INDEX `OdontogramEntry_clinicalRecordId_positionKey_key` (`clinicalRecordId`, `positionKey`);

