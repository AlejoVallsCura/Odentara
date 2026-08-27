-- Configuración de planes editable desde el panel de plataforma.
-- Reemplaza los valores que estaban hardcodeados en cinco lugares distintos.
CREATE TABLE Plan (
  code           VARCHAR(30)    NOT NULL,
  label          VARCHAR(60)    NOT NULL,
  priceMonthly   DECIMAL(10, 2) NOT NULL,
  currency       VARCHAR(3)     NOT NULL DEFAULT 'ARS',
  professionals  INT            NOT NULL,
  aiExtractions  INT            NOT NULL,
  adminUsers     BOOLEAN        NOT NULL DEFAULT TRUE,
  clinicalImages BOOLEAN        NOT NULL DEFAULT TRUE,
  billing        BOOLEAN        NOT NULL DEFAULT TRUE,
  sortOrder      INT            NOT NULL DEFAULT 0,
  updatedAt      DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (code)
);
CREATE INDEX Plan_sortOrder_idx ON Plan (sortOrder);

-- Valores actuales, para que nada cambie de comportamiento al aplicar esto.
-- En professionals, -1 significa ilimitado. En aiExtractions, 0 significa no incluido.
INSERT INTO Plan (code, label, priceMonthly, currency, professionals, aiExtractions, adminUsers, clinicalImages, billing, sortOrder, updatedAt) VALUES
  ('inicial', 'Inicial',  45000.00, 'ARS',  1,   0, FALSE, FALSE, FALSE, 1, CURRENT_TIMESTAMP(3)),
  ('clinica', 'Clínica',  75000.00, 'ARS',  3, 100, TRUE,  TRUE,  TRUE,  2, CURRENT_TIMESTAMP(3)),
  ('pro',     'Pro',     125000.00, 'ARS', -1, 500, TRUE,  TRUE,  TRUE,  3, CURRENT_TIMESTAMP(3));
