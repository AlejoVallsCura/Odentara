-- Antecedentes médicos del paciente (cuestionario de casilleros de la ficha)
ALTER TABLE `Patient` ADD COLUMN `medicalHistory` JSON NULL;
