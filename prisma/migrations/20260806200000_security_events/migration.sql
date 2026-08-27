-- Eventos de seguridad persistidos. Antes solo iban a console.warn y se perdían
-- con la rotación de logs del hosting.
CREATE TABLE SecurityEvent (
  id        INT          NOT NULL AUTO_INCREMENT,
  type      VARCHAR(40)  NOT NULL,
  ip        VARCHAR(45)  NULL,
  method    VARCHAR(10)  NULL,
  path      VARCHAR(255) NULL,
  userAgent TEXT         NULL,
  email     VARCHAR(255) NULL,
  details   JSON         NULL,
  createdAt DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id)
);
CREATE INDEX SecurityEvent_createdAt_idx ON SecurityEvent (createdAt);
CREATE INDEX SecurityEvent_type_createdAt_idx ON SecurityEvent (type, createdAt);
CREATE INDEX SecurityEvent_email_createdAt_idx ON SecurityEvent (email, createdAt);

-- Bloqueo temporal de cuenta por intentos fallidos. El límite por IP no frena a
-- un atacante que rota direcciones.
ALTER TABLE User
  ADD COLUMN failedLoginAttempts INT NOT NULL DEFAULT 0,
  ADD COLUMN lockedUntil DATETIME(3) NULL;
