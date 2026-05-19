// Crea o actualiza el usuario platform admin
// Ejecutar con: node prisma/create-platform-admin.js

const { loadEnv } = require('../server/lib/load-env');
loadEnv();
const prisma = require('../server/lib/prisma');
const bcrypt = require('bcrypt');

const PLATFORM_ADMIN_EMAIL = 'admin@odentara.app';
const PLATFORM_ADMIN_NAME  = 'Alejo Valls';
const PLATFORM_ADMIN_PASS  = 'odentara-platform-2024';

async function main() {
  console.log('Creando usuario platform admin...\n');

  const passwordHash = await bcrypt.hash(PLATFORM_ADMIN_PASS, 10);

  const user = await prisma.user.upsert({
    where: { email: PLATFORM_ADMIN_EMAIL },
    update: {
      isPlatformAdmin: true,
      clinicId: null,
      passwordHash,
      active: true,
    },
    create: {
      email:          PLATFORM_ADMIN_EMAIL,
      fullName:       PLATFORM_ADMIN_NAME,
      passwordHash,
      active:         true,
      isPlatformAdmin: true,
      clinicId:       null,
    },
  });

  console.log('✅ Platform admin creado/actualizado:');
  console.log(`   Email:    ${user.email}`);
  console.log(`   Password: ${PLATFORM_ADMIN_PASS}`);
  console.log(`   ID:       ${user.id}`);
  console.log('\nPodés cambiar la contraseña editando este script y volviendo a ejecutarlo.');
}

main().catch(console.error).finally(() => prisma.$disconnect());
