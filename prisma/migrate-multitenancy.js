// Script de migración manual para multi-tenancy
// Ejecutar con: node prisma/migrate-multitenancy.js

const { loadEnv } = require('../server/lib/load-env');
loadEnv();
const prisma = require('../server/lib/prisma');

async function run(sql) {
  try {
    await prisma.$executeRawUnsafe(sql);
  } catch (e) {
    if (e.message.includes('Duplicate') || e.message.includes('already exists') || e.message.includes("Can't DROP")) {
      console.log(`  [skip] ${e.message.substring(0, 80)}`);
    } else {
      throw e;
    }
  }
}

async function main() {
  console.log('=== Migración multi-tenancy Odentara ===\n');

  // 1. Crear tabla Clinic
  console.log('1. Creando tabla Clinic...');
  await run(`
    CREATE TABLE IF NOT EXISTS \`Clinic\` (
      \`id\`        INT AUTO_INCREMENT PRIMARY KEY,
      \`name\`      VARCHAR(191) NOT NULL,
      \`slug\`      VARCHAR(191) NOT NULL,
      \`address\`   VARCHAR(191),
      \`phone\`     VARCHAR(191),
      \`email\`     VARCHAR(191),
      \`logoUrl\`   VARCHAR(191),
      \`active\`    TINYINT(1) NOT NULL DEFAULT 1,
      \`plan\`      VARCHAR(191),
      \`notes\`     TEXT,
      \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      \`updatedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  console.log('  OK\n');

  // 2. Unique index en slug
  console.log('2. Index único en Clinic.slug...');
  await run(`ALTER TABLE \`Clinic\` ADD UNIQUE INDEX \`Clinic_slug_key\` (\`slug\`)`);
  await run(`ALTER TABLE \`Clinic\` ADD INDEX \`Clinic_active_idx\` (\`active\`)`);
  console.log('  OK\n');

  // 3. Insertar clínica default (id=1)
  console.log('3. Insertando clínica default...');
  await prisma.$executeRawUnsafe(`
    INSERT IGNORE INTO \`Clinic\` (\`id\`, \`name\`, \`slug\`, \`active\`, \`createdAt\`, \`updatedAt\`)
    VALUES (1, 'Clínica Principal', 'clinica-principal', 1, NOW(), NOW())
  `);
  console.log('  OK\n');

  // 4. Agregar campos a User
  console.log('4. Agregando campos a User...');
  await run(`ALTER TABLE \`User\` ADD COLUMN \`isPlatformAdmin\` TINYINT(1) NOT NULL DEFAULT 0`);
  await run(`ALTER TABLE \`User\` ADD COLUMN \`clinicId\` INT NULL`);
  await run(`ALTER TABLE \`User\` ADD INDEX \`User_clinicId_idx\` (\`clinicId\`)`);
  console.log('  OK\n');

  // 5. Agregar clinicId nullable a Professional, Patient, Appointment
  console.log('5. Agregando clinicId a Professional, Patient, Appointment...');
  await run(`ALTER TABLE \`Professional\` ADD COLUMN \`clinicId\` INT NULL`);
  await run(`ALTER TABLE \`Patient\` ADD COLUMN \`clinicId\` INT NULL`);
  await run(`ALTER TABLE \`Appointment\` ADD COLUMN \`clinicId\` INT NULL`);
  console.log('  OK\n');

  // 6. Asignar todos los registros existentes a la clínica 1
  console.log('6. Asignando registros existentes a clínica 1...');
  await prisma.$executeRawUnsafe(`UPDATE \`User\` SET \`clinicId\` = 1 WHERE \`clinicId\` IS NULL AND \`isPlatformAdmin\` = 0`);
  await prisma.$executeRawUnsafe(`UPDATE \`Professional\` SET \`clinicId\` = 1 WHERE \`clinicId\` IS NULL`);
  await prisma.$executeRawUnsafe(`UPDATE \`Patient\` SET \`clinicId\` = 1 WHERE \`clinicId\` IS NULL`);
  await prisma.$executeRawUnsafe(`UPDATE \`Appointment\` SET \`clinicId\` = 1 WHERE \`clinicId\` IS NULL`);
  console.log('  OK\n');

  // 7. Hacer NOT NULL Professional, Patient, Appointment
  console.log('7. Convirtiendo columnas a NOT NULL...');
  await run(`ALTER TABLE \`Professional\` MODIFY COLUMN \`clinicId\` INT NOT NULL`);
  await run(`ALTER TABLE \`Patient\` MODIFY COLUMN \`clinicId\` INT NOT NULL`);
  await run(`ALTER TABLE \`Appointment\` MODIFY COLUMN \`clinicId\` INT NOT NULL`);
  console.log('  OK\n');

  // 8. Agregar FKs
  console.log('8. Creando Foreign Keys...');
  await run(`ALTER TABLE \`User\` ADD CONSTRAINT \`User_clinicId_fkey\` FOREIGN KEY (\`clinicId\`) REFERENCES \`Clinic\`(\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE`);
  await run(`ALTER TABLE \`Professional\` ADD CONSTRAINT \`Professional_clinicId_fkey\` FOREIGN KEY (\`clinicId\`) REFERENCES \`Clinic\`(\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE`);
  await run(`ALTER TABLE \`Patient\` ADD CONSTRAINT \`Patient_clinicId_fkey\` FOREIGN KEY (\`clinicId\`) REFERENCES \`Clinic\`(\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE`);
  await run(`ALTER TABLE \`Appointment\` ADD CONSTRAINT \`Appointment_clinicId_fkey\` FOREIGN KEY (\`clinicId\`) REFERENCES \`Clinic\`(\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE`);
  console.log('  OK\n');

  // 9. Indexes adicionales
  console.log('9. Creando indexes...');
  await run(`ALTER TABLE \`Professional\` ADD INDEX \`Professional_clinicId_idx\` (\`clinicId\`)`);
  await run(`ALTER TABLE \`Professional\` ADD INDEX \`Professional_clinicId_active_idx\` (\`clinicId\`, \`active\`)`);
  await run(`ALTER TABLE \`Patient\` ADD INDEX \`Patient_clinicId_idx\` (\`clinicId\`)`);
  await run(`ALTER TABLE \`Patient\` ADD INDEX \`Patient_clinicId_active_deletedAt_idx\` (\`clinicId\`, \`active\`, \`deletedAt\`)`);
  await run(`ALTER TABLE \`Appointment\` ADD INDEX \`Appointment_clinicId_date_idx\` (\`clinicId\`, \`date\`)`);
  console.log('  OK\n');

  // 10. Ajustar unicidades de Patient (dni y chartNumber pasan a ser por clínica)
  console.log('10. Ajustando unicidades de Patient...');
  await run(`ALTER TABLE \`Patient\` DROP INDEX \`Patient_dni_key\``);
  await run(`ALTER TABLE \`Patient\` DROP INDEX \`Patient_chartNumber_key\``);
  await run(`ALTER TABLE \`Patient\` ADD UNIQUE INDEX \`Patient_clinicId_dni_key\` (\`clinicId\`, \`dni\`)`);
  await run(`ALTER TABLE \`Patient\` ADD UNIQUE INDEX \`Patient_clinicId_chartNumber_key\` (\`clinicId\`, \`chartNumber\`)`);
  console.log('  OK\n');

  // 11. Quitar unique de Professional.email (ahora es por clínica, sin constraint)
  console.log('11. Quitando unique de Professional.email...');
  await run(`ALTER TABLE \`Professional\` DROP INDEX \`Professional_email_key\``);
  console.log('  OK\n');

  console.log('=== Migración completada exitosamente ===');
}

main().catch((e) => {
  console.error('ERROR:', e.message);
  process.exit(1);
}).finally(() => prisma.$disconnect());
