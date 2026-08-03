-- Uso mensual de importación con IA por clínica (para límites por plan)
ALTER TABLE `Clinic` ADD COLUMN `aiUsage` JSON NULL;
