ALTER TABLE AuditLog ADD COLUMN clinicId INT NULL;
CREATE INDEX AuditLog_clinicId_createdAt_idx ON AuditLog (clinicId, createdAt);
