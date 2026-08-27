-- Tamaño de cada archivo clínico. Permite validar el peso total de una
-- exportación ANTES de empezar a armar el ZIP, en vez de descubrirlo a mitad
-- de la descarga. Nullable: los archivos anteriores a esta columna no lo
-- tienen y para esos manda el contador de bytes durante el stream.
ALTER TABLE ClinicalImage
  ADD COLUMN fileSizeBytes INT NULL;

-- Autorización de un solo uso para descargar el ZIP de un paciente.
-- El token es opaco: los parámetros de la exportación viven en esta tabla y no
-- en la URL, así no hay nada manipulable ni nada sensible que pueda quedar
-- registrado en los logs de acceso del reverse proxy.
CREATE TABLE ClinicalExportToken (
  token     VARCHAR(64) NOT NULL,
  clinicId  INT         NOT NULL,
  userId    INT         NOT NULL,
  patientId INT         NOT NULL,
  imageIds  JSON        NOT NULL,
  usedCount INT         NOT NULL DEFAULT 0,
  expiresAt DATETIME(3) NOT NULL,
  createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (token)
);
CREATE INDEX ClinicalExportToken_expiresAt_idx ON ClinicalExportToken (expiresAt);
