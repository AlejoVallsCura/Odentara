-- Descuento por clínica sobre el precio del plan.
--
-- Porcentaje y no monto fijo: así el acuerdo sobrevive a los aumentos de precio
-- sin renegociarse solo. NULL = sin descuento; 100.00 = bonificada, no paga.
ALTER TABLE `Clinic` ADD COLUMN `discountPercent` DECIMAL(5, 2) NULL;
