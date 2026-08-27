-- Avisos de plataforma visibles en todas las clínicas (mantenimiento, caídas,
-- backups). La vigencia va por fechas para poder dejarlos programados.
CREATE TABLE Announcement (
  id          INT          NOT NULL AUTO_INCREMENT,
  message     TEXT         NOT NULL,
  level       ENUM('info', 'warning', 'urgent') NOT NULL DEFAULT 'info',
  startsAt    DATETIME(3)  NOT NULL,
  endsAt      DATETIME(3)  NOT NULL,
  dismissible BOOLEAN      NOT NULL DEFAULT TRUE,
  active      BOOLEAN      NOT NULL DEFAULT TRUE,
  createdAt   DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updatedAt   DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id)
);

-- Índice para la consulta que corre en cada refresco: los avisos activos y vigentes.
CREATE INDEX Announcement_active_startsAt_endsAt_idx ON Announcement (active, startsAt, endsAt);
