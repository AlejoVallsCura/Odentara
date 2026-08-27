-- Unicidad por clínica: pone el historial de migraciones al día con el schema.
--
-- La migración inicial creó índices únicos GLOBALES sobre email, dni y
-- chartNumber, y ninguna migración posterior los quitó. Pero el schema declara
-- desde hace tiempo unicidad POR CLÍNICA:
--
--   migración inicial              schema.prisma hoy
--   ─────────────────────────────  ───────────────────────────────
--   User_email_key(email)          @@unique([clinicId, email])
--   Patient_dni_key(dni)           @@unique([clinicId, dni])
--   Patient_chartNumber_key(...)   @@unique([clinicId, chartNumber])
--   Professional_email_key(email)  (ya no es único)
--
-- Con los índices globales, dos clínicas NO pueden tener un paciente con el
-- mismo DNI ni un usuario con el mismo email. Es justo lo contrario de lo que
-- dice CLAUDE.md ("el mismo email puede existir en dos clínicas, por eso se
-- busca con findFirst"), y rompe la premisa multi-tenant.
--
-- Importa por dos motivos distintos:
--   1. Recuperación ante desastre: una base creada desde cero con `prisma
--      migrate deploy` no se comporta como producción.
--   2. Si producción todavía tiene los globales, el día que dos clínicas
--      compartan un DNI el alta falla, y el error no va a explicar por qué.
--
-- ES SEGURA DE CORRER ESTÉ COMO ESTÉ LA BASE. Todo va con IF EXISTS / IF NOT
-- EXISTS (MariaDB 10.1.4+), así que si el cambio ya se aplicó a mano en algún
-- momento, esta migración no hace nada y no falla.
--
-- No puede perder datos: los índices globales son MÁS estrictos que los
-- compuestos, así que cualquier fila que hoy exista ya cumple el compuesto.

-- ── User ─────────────────────────────────────────────────────────────────────
ALTER TABLE `User` DROP INDEX IF EXISTS `User_email_key`;
CREATE UNIQUE INDEX IF NOT EXISTS `User_clinicId_email_key` ON `User`(`clinicId`, `email`);

-- ── Patient ──────────────────────────────────────────────────────────────────
ALTER TABLE `Patient` DROP INDEX IF EXISTS `Patient_dni_key`;
CREATE UNIQUE INDEX IF NOT EXISTS `Patient_clinicId_dni_key` ON `Patient`(`clinicId`, `dni`);

ALTER TABLE `Patient` DROP INDEX IF EXISTS `Patient_chartNumber_key`;
-- chartNumber admite NULL y en MariaDB dos NULL no colisionan dentro de un
-- UNIQUE: eso es lo buscado, varios pacientes sin número de ficha conviven.
CREATE UNIQUE INDEX IF NOT EXISTS `Patient_clinicId_chartNumber_key` ON `Patient`(`clinicId`, `chartNumber`);

-- ── Professional ─────────────────────────────────────────────────────────────
-- El schema ya no declara el email del profesional como único: dos clínicas
-- pueden tener al mismo odontólogo, y hasta dentro de una clínica el email es
-- un dato de contacto, no una identidad.
ALTER TABLE `Professional` DROP INDEX IF EXISTS `Professional_email_key`;
