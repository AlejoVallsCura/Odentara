# Odentara

Sistema de gestión para clínicas odontológicas. Plataforma SaaS multi-tenant que centraliza turnos, pacientes, historias clínicas, facturación y gestión del equipo en una sola aplicación.

## Características principales

- **Agenda de turnos** — Programación por profesional con control de disponibilidad, excepciones y recordatorios automáticos por WhatsApp/email
- **Gestión de pacientes** — Fichas completas con búsqueda por DNI, nombre, teléfono o email
- **Historias clínicas** — Odontogramas digitales, tratamientos, notas y alergias por paciente y profesional
- **Imágenes clínicas** — Carga y visualización de radiografías e imágenes almacenadas en Cloudflare R2
- **Facturación y caja** — Registro de ingresos, pagos, deudas y ajustes con reportes mensuales
- **Gestión de equipo** — Roles diferenciados: superadmin, admin, secretaria y profesional con control de acceso granular
- **Panel de plataforma** — Administración multi-clínica con estadísticas, impersonación y seguimiento de suscripciones
- **Landing page** — Sitio de marketing separado con animaciones GSAP y formulario de contacto

## Stack tecnológico

**Backend**
- Node.js + Express.js 5
- Prisma ORM + MariaDB/MySQL
- JWT con bcrypt para autenticación
- Cloudflare R2 para almacenamiento de imágenes
- Twilio para notificaciones WhatsApp/SMS
- Nodemailer para emails
- node-cron para recordatorios automáticos

**Frontend**
- Vanilla JavaScript (SPA sin framework)
- CSS personalizado con soporte de modo oscuro y diseño responsive

**Seguridad**
- RBAC con 4 roles y scopes por profesional
- Rate limiting por endpoint
- Helmet.js para headers de seguridad
- Audit log completo de mutaciones
- Soft deletes (los datos médicos nunca se borran físicamente)
- URLs de imágenes firmadas con HMAC (expiración de 1 hora)

## Requisitos

- Node.js >= 18.0.0
- MariaDB o MySQL

## Instalación

```bash
# Clonar el repositorio
git clone https://github.com/tu-usuario/odentara.git
cd odentara

# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.local.example .env.local
# Editar .env.local con tus credenciales

# Aplicar migraciones y generar cliente Prisma
npm run prisma:migrate

# Cargar datos iniciales (roles y cuenta de plataforma)
npm run seed

# Iniciar en modo desarrollo
npm run dev
```

## Variables de entorno

Ver [.env.local.example](.env.local.example) para la lista completa. Las principales:

| Variable | Descripción |
|---|---|
| `DATABASE_URL` | Cadena de conexión a MariaDB |
| `JWT_SECRET` | Clave secreta para firmar tokens |
| `R2_*` | Credenciales de Cloudflare R2 |
| `SMTP_*` | Configuración de email |
| `TWILIO_*` | Credenciales de Twilio (opcional) |

## Scripts disponibles

| Comando | Descripción |
|---|---|
| `npm run dev` | Servidor de desarrollo con hot-reload |
| `npm start` | Servidor de producción |
| `npm run seed` | Carga datos iniciales |
| `npm run prisma:migrate` | Aplica migraciones de base de datos |
| `npm run prisma:studio` | Abre GUI de Prisma para inspeccionar la DB |

## Estructura del proyecto

```
odentara/
├── server/
│   ├── index.js              # Entrada del servidor
│   ├── lib/                  # Auth, permisos, storage, email, cron
│   ├── middleware/           # JWT, rate limiting, resolución de clínica
│   └── routes/               # Endpoints de la API REST
├── prisma/
│   ├── schema.prisma         # Esquema de base de datos
│   ├── seed.js               # Datos iniciales
│   └── migrations/           # Historial de migraciones
├── landing/                  # Sitio de marketing
├── app.js                    # Frontend SPA
├── index.html                # Shell HTML del frontend
└── styles.css                # Estilos globales
```

## Planes de suscripción

| Plan | Precio | Profesionales | Imágenes | Facturación |
|---|---|---|---|---|
| Inicial | USD 29/mes | 1 | No | No |
| Clínica | USD 49/mes | 3 | Sí | Sí |
| Pro | USD 89/mes | Ilimitados | Sí | Sí |

## Licencia

Este proyecto es de uso privado. Todos los derechos reservados.
