-- Revocación de tokens persistente (antes vivía en un Map en memoria, que no
-- servía con varios workers: el logout solo afectaba al proceso que lo atendía).
CREATE TABLE RevokedToken (
  jti       VARCHAR(32) NOT NULL,
  expiresAt DATETIME(3) NOT NULL,
  createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (jti)
);
CREATE INDEX RevokedToken_expiresAt_idx ON RevokedToken (expiresAt);

-- Corte de sesiones por usuario: al cambiar la contraseña se sella esta fecha y
-- todos los tokens emitidos antes dejan de valer.
ALTER TABLE User ADD COLUMN sessionsValidFrom DATETIME(3) NULL;

-- Los tokens de reseteo pasan a guardarse hasheados (SHA-256 hex = 64 chars).
-- Se borran los existentes en vez de migrarlos: no se puede derivar el hash sin
-- el token original, duran 1 hora y quien tenga uno pendiente puede pedirlo de
-- nuevo desde "Olvidé mi contraseña".
DELETE FROM PasswordResetToken;
ALTER TABLE PasswordResetToken DROP INDEX PasswordResetToken_token_key;
ALTER TABLE PasswordResetToken CHANGE COLUMN token tokenHash VARCHAR(64) NOT NULL;
CREATE UNIQUE INDEX PasswordResetToken_tokenHash_key ON PasswordResetToken (tokenHash);
