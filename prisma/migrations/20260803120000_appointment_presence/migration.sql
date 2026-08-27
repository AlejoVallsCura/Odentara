-- Presencia del paciente el día del turno (sala de espera / consultorio).
-- Antes vivía solo en el localStorage del navegador que la marcaba, así que el
-- estado no llegaba al resto del equipo: la secretaria marcaba "En sala" y el
-- profesional seguía viendo "Sin llegar".
ALTER TABLE Appointment
  ADD COLUMN presence ENUM('none', 'waiting', 'consulting', 'done') NOT NULL DEFAULT 'none',
  ADD COLUMN presenceUpdatedAt DATETIME(3) NULL;

-- El dashboard consulta la presencia de los turnos del día cada 20 segundos.
CREATE INDEX Appointment_clinicId_date_presence_idx ON Appointment (clinicId, date, presence);
