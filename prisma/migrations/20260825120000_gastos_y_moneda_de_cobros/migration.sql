-- Moneda en los cobros de suscripción.
--
-- Los gastos de la plataforma se cargan en pesos o dólares, así que el cobro
-- también necesita decir en qué moneda entró: sin eso el balance obligaría a
-- asumir una. Lo ya registrado queda en ARS, que es lo que era.
ALTER TABLE `SubscriptionPayment` ADD COLUMN `currency` VARCHAR(3) NOT NULL DEFAULT 'ARS';

-- Gastos de la plataforma.
--
-- Única tabla sin clinicId a propósito: son gastos del dueño de la plataforma
-- (hosting, dominio, API de IA, contador), no de ninguna clínica.
CREATE TABLE `Expense` (
  `id`          INT NOT NULL AUTO_INCREMENT,
  `description` VARCHAR(200) NOT NULL,
  `category`    VARCHAR(30) NOT NULL DEFAULT 'otros',
  `amount`      DECIMAL(12, 2) NOT NULL,
  `currency`    VARCHAR(3) NOT NULL DEFAULT 'ARS',
  `paidAt`      DATETIME(3) NOT NULL,
  `notes`       TEXT NULL,
  `createdAt`   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt`   DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `Expense_paidAt_idx` (`paidAt`),
  INDEX `Expense_category_idx` (`category`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
