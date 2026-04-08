require("dotenv").config();

const bcrypt = require("bcrypt");
const { PrismaClient, RoleCode } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const { Pool } = require("pg");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const DEFAULT_PASSWORD = "odentara123";

const roleLabels = {
  [RoleCode.superadmin]: "Superadmin",
  [RoleCode.admin]: "Administrador",
  [RoleCode.secretary]: "Secretaria",
  [RoleCode.professional]: "Profesional",
};

const professionals = [
  {
    fullName: "Dr. López",
    email: "lopez@odentara.com",
    specialty: "Odontologia general",
    color: "#14b8a6",
    schedules: [
      { weekday: 1, startTime: "08:00", endTime: "16:00", active: true },
      { weekday: 2, startTime: "08:00", endTime: "16:00", active: true },
      { weekday: 3, startTime: "08:00", endTime: "16:00", active: true },
      { weekday: 4, startTime: "08:00", endTime: "16:00", active: true },
      { weekday: 5, startTime: "08:00", endTime: "16:00", active: true },
    ],
  },
  {
    fullName: "Dra. Martínez",
    email: "martinez@odentara.com",
    specialty: "Ortodoncia",
    color: "#8b5cf6",
    schedules: [
      { weekday: 1, startTime: "09:00", endTime: "15:00", active: true },
      { weekday: 2, startTime: "09:00", endTime: "15:00", active: true },
      { weekday: 4, startTime: "09:00", endTime: "15:00", active: true },
      { weekday: 5, startTime: "09:00", endTime: "15:00", active: true },
    ],
  },
  {
    fullName: "Dr. Carlos Gómez",
    email: "carlos.gomez@odentara.com",
    specialty: "Cirugia oral",
    color: "#f97316",
    schedules: [
      { weekday: 1, startTime: "10:00", endTime: "18:00", active: true },
      { weekday: 2, startTime: "10:00", endTime: "18:00", active: true },
      { weekday: 3, startTime: "10:00", endTime: "18:00", active: true },
      { weekday: 4, startTime: "10:00", endTime: "18:00", active: true },
      { weekday: 5, startTime: "10:00", endTime: "18:00", active: true },
    ],
  },
];

const users = [
  {
    email: "admin@odentara.com",
    fullName: "Superadmin Odentara",
    roles: [RoleCode.superadmin],
    assignedProfessionalEmail: null,
    scopedProfessionalEmails: [],
  },
  {
    email: "lopez@odentara.com",
    fullName: "Dr. López",
    roles: [RoleCode.professional],
    assignedProfessionalEmail: "lopez@odentara.com",
    scopedProfessionalEmails: ["lopez@odentara.com"],
  },
  {
    email: "secretaria@odentara.com",
    fullName: "Secretaria General",
    roles: [RoleCode.secretary],
    assignedProfessionalEmail: null,
    scopedProfessionalEmails: [],
  },
  {
    email: "administracion@odentara.com",
    fullName: "Administrador General",
    roles: [RoleCode.admin],
    assignedProfessionalEmail: null,
    scopedProfessionalEmails: [],
  },
];

const patients = [
  {
    fullName: "María Gómez",
    dni: "34567890",
    birthDate: new Date("1994-09-19"),
    phone: "2616791598",
    email: "maria@example.com",
    address: "Primitivo de la Reta 513 Piso 8 Of 2 Ciudad",
    insuranceName: "Sancor",
    insurancePlan: "4000",
    credentialNumber: "182649000",
    chartNumber: "001",
    summaryNotes: "Paciente en seguimiento general.",
    allergies: "Penicilina",
    medicalNotes: "Control periodico.",
  },
  {
    fullName: "Juan Pérez",
    dni: "23456789",
    birthDate: new Date("1985-05-12"),
    phone: "2617001111",
    email: "juan@example.com",
    address: "San Martin 123",
    insuranceName: "OSDE",
    insurancePlan: "210",
    credentialNumber: "12345678",
    chartNumber: "002",
    summaryNotes: "Sin antecedentes relevantes.",
    allergies: null,
    medicalNotes: "Primera consulta.",
  },
  {
    fullName: "Laura Sánchez",
    dni: "45678901",
    birthDate: new Date("1990-04-20"),
    phone: "2611112222",
    email: "laura@example.com",
    address: "Av. Libertador 1234",
    insuranceName: "OSDE",
    insurancePlan: "310",
    credentialNumber: "98765432",
    chartNumber: "003",
    summaryNotes: "Ortodoncia activa.",
    allergies: null,
    medicalNotes: "Requiere seguimiento mensual.",
  },
  {
    fullName: "Diego Ramírez",
    dni: "56789012",
    birthDate: new Date("1988-08-05"),
    phone: "2613334444",
    email: "diego@example.com",
    address: "Calle Falsa 123",
    insuranceName: "Swiss Medical",
    insurancePlan: "SMG20",
    credentialNumber: "11122334",
    chartNumber: "004",
    summaryNotes: "Control de ortodoncia.",
    allergies: null,
    medicalNotes: "Revisar sangrado de encías.",
  },
];

const appointments = [
  {
    patientDni: "34567890",
    professionalEmail: "lopez@odentara.com",
    createdByEmail: "secretaria@odentara.com",
    date: new Date("2026-04-08T00:00:00"),
    startTime: new Date("2026-04-08T10:00:00"),
    durationMinutes: 60,
    status: "confirmed",
    isOverbook: false,
    confirmationChannel: "whatsapp",
    confirmationSentAt: new Date("2026-04-07T17:00:00"),
    confirmationResponseAt: new Date("2026-04-07T17:30:00"),
    notes: "Control general",
  },
  {
    patientDni: "23456789",
    professionalEmail: "lopez@odentara.com",
    createdByEmail: "secretaria@odentara.com",
    date: new Date("2026-04-08T00:00:00"),
    startTime: new Date("2026-04-08T11:00:00"),
    durationMinutes: 30,
    status: "sent",
    isOverbook: false,
    confirmationChannel: "whatsapp",
    confirmationSentAt: new Date("2026-04-07T18:00:00"),
    confirmationResponseAt: null,
    notes: "Limpieza",
  },
  {
    patientDni: "45678901",
    professionalEmail: "martinez@odentara.com",
    createdByEmail: "administracion@odentara.com",
    date: new Date("2026-04-09T00:00:00"),
    startTime: new Date("2026-04-09T09:30:00"),
    durationMinutes: 45,
    status: "not_sent",
    isOverbook: false,
    confirmationChannel: null,
    confirmationSentAt: null,
    confirmationResponseAt: null,
    notes: "Control ortodoncia",
  },
  {
    patientDni: "56789012",
    professionalEmail: "carlos.gomez@odentara.com",
    createdByEmail: "administracion@odentara.com",
    date: new Date("2026-04-09T00:00:00"),
    startTime: new Date("2026-04-09T15:00:00"),
    durationMinutes: 60,
    status: "confirmed",
    isOverbook: true,
    confirmationChannel: "manual",
    confirmationSentAt: null,
    confirmationResponseAt: new Date("2026-04-08T12:00:00"),
    notes: "Sobreturno por urgencia",
  },
];

const treatments = [
  {
    patientDni: "34567890",
    professionalEmail: "lopez@odentara.com",
    appointmentMatch: { date: "2026-04-08", time: "10:00" },
    tooth: "18",
    face: "M",
    sector: "2",
    authorizationNumber: "4",
    insuranceCode: "01.12.6",
    observations: "Caries",
    performedAt: new Date("2026-04-08T10:30:00"),
  },
];

const clinicalImages = [
  {
    patientDni: "34567890",
    uploadedByEmail: "lopez@odentara.com",
    imageUrl: "https://example.com/odentara/imagen-clinica-1.jpg",
    description: "Control inicial pieza 18",
    takenAt: new Date("2026-04-08T10:20:00"),
  },
];

const billingEntries = [
  {
    patientDni: "23456789",
    professionalEmail: "lopez@odentara.com",
    appointmentMatch: { date: "2026-04-08", time: "11:00" },
    createdByEmail: "secretaria@odentara.com",
    type: "income",
    amount: "12500.00",
    currency: "ARS",
    description: "Consulta Dr. López",
    date: new Date("2026-04-08T11:30:00"),
  },
  {
    patientDni: "34567890",
    professionalEmail: "lopez@odentara.com",
    appointmentMatch: { date: "2026-04-08", time: "10:00" },
    createdByEmail: "administracion@odentara.com",
    type: "debt",
    amount: "45000.00",
    currency: "ARS",
    description: "Tratamiento conducto",
    date: new Date("2026-04-08T12:00:00"),
  },
];

async function cleanupLegacyOdontaraDemoData() {
  const legacyUserEmails = [
    "admin@odontara.com",
    "lopez@odontara.com",
    "secretaria@odontara.com",
    "administracion@odontara.com",
  ];

  const legacyProfessionalEmails = [
    "lopez@odontara.com",
    "martinez@odontara.com",
    "carlos.gomez@odontara.com",
  ];

  const legacyProfessionals = await prisma.professional.findMany({
    where: {
      email: { in: legacyProfessionalEmails },
    },
    select: { id: true },
  });

  const legacyProfessionalIds = legacyProfessionals.map((item) => item.id);

  if (legacyProfessionalIds.length > 0) {
    await prisma.billingEntry.deleteMany({
      where: { professionalId: { in: legacyProfessionalIds } },
    });

    await prisma.treatment.deleteMany({
      where: { professionalId: { in: legacyProfessionalIds } },
    });

    await prisma.appointment.deleteMany({
      where: { professionalId: { in: legacyProfessionalIds } },
    });

    await prisma.userProfessionalScope.deleteMany({
      where: { professionalId: { in: legacyProfessionalIds } },
    });

    await prisma.professionalAvailability.deleteMany({
      where: { professionalId: { in: legacyProfessionalIds } },
    });

    await prisma.professionalScheduleException.deleteMany({
      where: { professionalId: { in: legacyProfessionalIds } },
    });

    await prisma.professional.deleteMany({
      where: { id: { in: legacyProfessionalIds } },
    });
  }

  const legacyUsers = await prisma.user.findMany({
    where: {
      email: { in: legacyUserEmails },
    },
    select: { id: true },
  });

  const legacyUserIds = legacyUsers.map((item) => item.id);

  if (legacyUserIds.length > 0) {
    await prisma.userProfessionalScope.deleteMany({
      where: { userId: { in: legacyUserIds } },
    });

    await prisma.userRole.deleteMany({
      where: { userId: { in: legacyUserIds } },
    });

    await prisma.user.deleteMany({
      where: { id: { in: legacyUserIds } },
    });
  }
}

async function upsertRoles() {
  for (const code of Object.values(RoleCode)) {
    await prisma.role.upsert({
      where: { code },
      update: { label: roleLabels[code] },
      create: { code, label: roleLabels[code] },
    });
  }
}

async function upsertProfessionals() {
  for (const professional of professionals) {
    const dbProfessional = await prisma.professional.upsert({
      where: { email: professional.email },
      update: {
        fullName: professional.fullName,
        email: professional.email,
        specialty: professional.specialty,
        color: professional.color,
      },
      create: {
        fullName: professional.fullName,
        email: professional.email,
        specialty: professional.specialty,
        color: professional.color,
      },
    });

    await prisma.professionalAvailability.deleteMany({
      where: { professionalId: dbProfessional.id },
    });

    if (professional.schedules?.length) {
      await prisma.professionalAvailability.createMany({
        data: professional.schedules.map((schedule) => ({
          professionalId: dbProfessional.id,
          ...schedule,
        })),
      });
    }
  }
}

async function upsertUsers() {
  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);

  for (const userData of users) {
    const user = await prisma.user.upsert({
      where: { email: userData.email },
      update: {
        fullName: userData.fullName,
        passwordHash,
        active: true,
      },
      create: {
        email: userData.email,
        fullName: userData.fullName,
        passwordHash,
        active: true,
      },
    });

    await prisma.userRole.deleteMany({ where: { userId: user.id } });

    for (const roleCode of userData.roles) {
      const role = await prisma.role.findUnique({ where: { code: roleCode } });
      await prisma.userRole.create({
        data: {
          userId: user.id,
          roleId: role.id,
        },
      });
    }

    await prisma.userProfessionalScope.deleteMany({ where: { userId: user.id } });

    for (const professionalEmail of userData.scopedProfessionalEmails) {
      const professional = await prisma.professional.findUnique({
        where: { email: professionalEmail },
      });

      if (professional) {
        await prisma.userProfessionalScope.create({
          data: {
            userId: user.id,
            professionalId: professional.id,
          },
        });
      }
    }

    if (userData.assignedProfessionalEmail) {
      const professional = await prisma.professional.findUnique({
        where: { email: userData.assignedProfessionalEmail },
      });

      if (professional) {
        await prisma.professional.update({
          where: { id: professional.id },
          data: { userId: user.id },
        });
      }
    }
  }
}

async function upsertPatients() {
  for (const patient of patients) {
    await prisma.patient.upsert({
      where: { dni: patient.dni },
      update: {
        fullName: patient.fullName,
        normalizedName: patient.fullName
          .trim()
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/\s+/g, " "),
        birthDate: patient.birthDate,
        phone: patient.phone,
        email: patient.email,
        address: patient.address,
        insuranceName: patient.insuranceName,
        insurancePlan: patient.insurancePlan,
        credentialNumber: patient.credentialNumber,
        chartNumber: patient.chartNumber,
        active: true,
      },
      create: {
        fullName: patient.fullName,
        normalizedName: patient.fullName
          .trim()
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/\s+/g, " "),
        dni: patient.dni,
        birthDate: patient.birthDate,
        phone: patient.phone,
        email: patient.email,
        address: patient.address,
        insuranceName: patient.insuranceName,
        insurancePlan: patient.insurancePlan,
        credentialNumber: patient.credentialNumber,
        chartNumber: patient.chartNumber,
        active: true,
      },
    });

    const dbPatient = await prisma.patient.findUnique({
      where: { dni: patient.dni },
      include: { clinicalRecord: true },
    });

    if (dbPatient?.clinicalRecord) {
      await prisma.clinicalRecord.update({
        where: { patientId: dbPatient.id },
        data: {
          summaryNotes: patient.summaryNotes,
          allergies: patient.allergies,
          medicalNotes: patient.medicalNotes,
        },
      });
    } else if (dbPatient) {
      await prisma.clinicalRecord.create({
        data: {
          patientId: dbPatient.id,
          summaryNotes: patient.summaryNotes,
          allergies: patient.allergies,
          medicalNotes: patient.medicalNotes,
        },
      });
    }
  }
}

async function upsertAppointments() {
  for (const appointment of appointments) {
    const patient = await prisma.patient.findUnique({
      where: { dni: appointment.patientDni },
    });
    const professional = await prisma.professional.findUnique({
      where: { email: appointment.professionalEmail },
    });
    const createdByUser = await prisma.user.findUnique({
      where: { email: appointment.createdByEmail },
    });

    if (!patient || !professional) {
      continue;
    }

    const existing = await prisma.appointment.findFirst({
      where: {
        patientId: patient.id,
        professionalId: professional.id,
        date: appointment.date,
        startTime: appointment.startTime,
      },
    });

    if (existing) {
      await prisma.appointment.update({
        where: { id: existing.id },
        data: {
          durationMinutes: appointment.durationMinutes,
          status: appointment.status,
          isOverbook: appointment.isOverbook,
          confirmationChannel: appointment.confirmationChannel,
          confirmationSentAt: appointment.confirmationSentAt,
          confirmationResponseAt: appointment.confirmationResponseAt,
          notes: appointment.notes,
          createdByUserId: createdByUser?.id || null,
        },
      });
      continue;
    }

    await prisma.appointment.create({
      data: {
        patientId: patient.id,
        professionalId: professional.id,
        createdByUserId: createdByUser?.id || null,
        date: appointment.date,
        startTime: appointment.startTime,
        durationMinutes: appointment.durationMinutes,
        status: appointment.status,
        isOverbook: appointment.isOverbook,
        confirmationChannel: appointment.confirmationChannel,
        confirmationSentAt: appointment.confirmationSentAt,
        confirmationResponseAt: appointment.confirmationResponseAt,
        notes: appointment.notes,
      },
    });
  }
}

async function upsertTreatments() {
  for (const treatment of treatments) {
    const patient = await prisma.patient.findUnique({ where: { dni: treatment.patientDni } });
    const professional = await prisma.professional.findUnique({ where: { email: treatment.professionalEmail } });
    if (!patient) continue;

    let appointment = null;
    if (treatment.appointmentMatch && professional) {
      appointment = await prisma.appointment.findFirst({
        where: {
          patientId: patient.id,
          professionalId: professional.id,
          date: new Date(`${treatment.appointmentMatch.date}T00:00:00`),
          startTime: new Date(`${treatment.appointmentMatch.date}T${treatment.appointmentMatch.time}:00`),
        },
      });
    }

    const existing = await prisma.treatment.findFirst({
      where: {
        patientId: patient.id,
        tooth: treatment.tooth,
        observations: treatment.observations,
      },
    });

    if (existing) continue;

    await prisma.treatment.create({
      data: {
        patientId: patient.id,
        professionalId: professional?.id || null,
        appointmentId: appointment?.id || null,
        tooth: treatment.tooth,
        face: treatment.face,
        sector: treatment.sector,
        authorizationNumber: treatment.authorizationNumber,
        insuranceCode: treatment.insuranceCode,
        observations: treatment.observations,
        performedAt: treatment.performedAt,
      },
    });
  }
}

async function upsertClinicalImages() {
  for (const image of clinicalImages) {
    const patient = await prisma.patient.findUnique({ where: { dni: image.patientDni } });
    const user = await prisma.user.findUnique({ where: { email: image.uploadedByEmail } });
    if (!patient) continue;

    const existing = await prisma.clinicalImage.findFirst({
      where: { patientId: patient.id, imageUrl: image.imageUrl },
    });
    if (existing) continue;

    await prisma.clinicalImage.create({
      data: {
        patientId: patient.id,
        uploadedByUserId: user?.id || null,
        imageUrl: image.imageUrl,
        description: image.description,
        takenAt: image.takenAt,
      },
    });
  }
}

async function upsertBillingEntries() {
  for (const entry of billingEntries) {
    const patient = await prisma.patient.findUnique({ where: { dni: entry.patientDni } });
    const professional = entry.professionalEmail
      ? await prisma.professional.findUnique({ where: { email: entry.professionalEmail } })
      : null;
    const createdBy = entry.createdByEmail
      ? await prisma.user.findUnique({ where: { email: entry.createdByEmail } })
      : null;
    if (!patient) continue;

    let appointment = null;
    if (entry.appointmentMatch && professional) {
      appointment = await prisma.appointment.findFirst({
        where: {
          patientId: patient.id,
          professionalId: professional.id,
          date: new Date(`${entry.appointmentMatch.date}T00:00:00`),
          startTime: new Date(`${entry.appointmentMatch.date}T${entry.appointmentMatch.time}:00`),
        },
      });
    }

    const existing = await prisma.billingEntry.findFirst({
      where: {
        patientId: patient.id,
        type: entry.type,
        description: entry.description,
      },
    });
    if (existing) continue;

    await prisma.billingEntry.create({
      data: {
        patientId: patient.id,
        professionalId: professional?.id || null,
        appointmentId: appointment?.id || null,
        createdByUserId: createdBy?.id || null,
        type: entry.type,
        amount: entry.amount,
        currency: entry.currency,
        description: entry.description,
        date: entry.date,
      },
    });
  }
}

async function main() {
  await cleanupLegacyOdontaraDemoData();
  await upsertRoles();
  await upsertProfessionals();
  await upsertUsers();
  await upsertPatients();
  await upsertAppointments();
  await upsertTreatments();
  await upsertClinicalImages();
  await upsertBillingEntries();

  console.log("Seed completado.");
  console.log("Usuarios de prueba:");
  console.log(`- admin@odentara.com / ${DEFAULT_PASSWORD}`);
  console.log(`- lopez@odentara.com / ${DEFAULT_PASSWORD}`);
  console.log(`- secretaria@odentara.com / ${DEFAULT_PASSWORD}`);
  console.log(`- administracion@odentara.com / ${DEFAULT_PASSWORD}`);
}

main()
  .catch((error) => {
    console.error("Error ejecutando seed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
