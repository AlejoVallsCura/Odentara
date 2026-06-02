<div align="center">
  <img src="landing/assets/odentara-logo.svg" alt="Odentara" width="180" />
  <h3>Sistema de gestión para clínicas odontológicas</h3>
  <p>Plataforma SaaS multi-tenant que centraliza turnos, pacientes, historias clínicas, facturación y gestión del equipo.</p>

  ![Node.js](https://img.shields.io/badge/Node.js-18+-339933?style=flat-square&logo=node.js&logoColor=white)
  ![Express](https://img.shields.io/badge/Express.js-5-000000?style=flat-square&logo=express&logoColor=white)
  ![Prisma](https://img.shields.io/badge/Prisma-ORM-2D3748?style=flat-square&logo=prisma&logoColor=white)
  ![MariaDB](https://img.shields.io/badge/MariaDB-MySQL-003545?style=flat-square&logo=mariadb&logoColor=white)
  ![Vanilla JS](https://img.shields.io/badge/Frontend-Vanilla%20JS-F7DF1E?style=flat-square&logo=javascript&logoColor=black)
  ![Cloudflare](https://img.shields.io/badge/Storage-Cloudflare%20R2-F38020?style=flat-square&logo=cloudflare&logoColor=white)

  **[🌐 Ver demo en vivo](#)** · **[📋 Reportar un bug](https://github.com/AlejoVallsCura/Odentara/issues)**
</div>

---

## Capturas de pantalla

<div align="center">

![Dashboard](/.github/screenshots/dashboard.png)

![Agenda de turnos](/.github/screenshots/turnos-calendario.png)

![Facturación y caja](/.github/screenshots/facturacion.png)

![Historia clínica y odontograma](/.github/screenshots/historia-clinica.png)

</div>

---

## Características principales

| Módulo | Descripción |
|--------|-------------|
| 📅 **Agenda de turnos** | Programación por profesional con disponibilidad, excepciones y recordatorios automáticos por WhatsApp/email |
| 👤 **Gestión de pacientes** | Fichas completas con búsqueda por DNI, nombre, teléfono o email |
| 🦷 **Historias clínicas** | Odontogramas digitales, tratamientos, notas y alergias por paciente y profesional |
| 🖼️ **Imágenes clínicas** | Carga y visualización de radiografías almacenadas en Cloudflare R2 con URLs firmadas |
| 💰 **Facturación y caja** | Registro de ingresos, pagos, deudas y ajustes con reportes mensuales |
| 👥 **Gestión de equipo** | Roles diferenciados: superadmin, admin, secretaria y profesional |
| 🏢 **Panel de plataforma** | Administración multi-clínica con estadísticas e impersonación |
| 🤖 **Secretar-IA** | Bot de WhatsApp con IA para reserva automática de turnos (servicio adicional) |
| 🌐 **Landing page** | Sitio de marketing con animaciones GSAP, scroll suave Lenis y formulario de contacto |

---

## Stack tecnológico

### Backend
- **Node.js + Express.js 5** — API REST con async/await nativo
- **Prisma ORM + MariaDB/MySQL** — esquema tipado, soft deletes, multitenancy
- **JWT + bcrypt** — autenticación segura con tokens revocables
- **Cloudflare R2** — almacenamiento de imágenes compatible con S3
- **Twilio** — notificaciones por WhatsApp/SMS
- **Nodemailer** — emails transaccionales con SMTP configurable
- **node-cron** — recordatorios automáticos de turnos

### Frontend
- **Vanilla JavaScript SPA** — sin framework, sin build step, carga instantánea
- **CSS personalizado** — diseño responsive con variables CSS, modo oscuro, animaciones

### Seguridad
- RBAC con 4 roles y scopes por profesional
- Rate limiting por endpoint (auth, API general, rutas sensibles)
- Helmet.js para headers HTTP seguros
- Audit log completo de todas las mutaciones
- Soft deletes — los datos médicos nunca se borran físicamente
- Cloudflare Turnstile para protección del login
- URLs de imágenes firmadas con HMAC (expiración de 1 hora)

---

## Arquitectura

```
odentara/
├── server/
│   ├── index.js              # Entrada del servidor, CORS, Helmet, rutas
│   ├── lib/                  # Auth, permisos, storage, email, cron, auditoría
│   ├── middleware/           # JWT, rate limiting, resolución de clínica
│   └── routes/               # Endpoints REST (turnos, pacientes, facturación…)
├── prisma/
│   ├── schema.prisma         # Esquema de base de datos
│   ├── seed.js               # Datos iniciales
│   └── migrations/           # Historial de migraciones
├── landing/                  # Sitio de marketing (GSAP + Lenis)
├── app.js                    # Frontend SPA (~5000 líneas)
├── index.html                # Shell HTML
└── styles.css                # Estilos globales
```

---

## Instalación local

```bash
# 1. Clonar
git clone https://github.com/AlejoVallsCura/Odentara.git
cd Odentara

# 2. Instalar dependencias
npm install

# 3. Configurar entorno
cp .env.local.example .env.local
# Editar .env.local con tus credenciales

# 4. Aplicar esquema de base de datos
npx prisma db push
npm run prisma:generate

# 5. Cargar datos iniciales
npm run seed

# 6. Iniciar en desarrollo
npm run dev
# → http://localhost:3001
```

### Variables de entorno requeridas

| Variable | Descripción |
|----------|-------------|
| `DATABASE_URL` | `mysql://user:pass@localhost:3306/odentara` |
| `JWT_SECRET` | Clave secreta para firmar tokens |
| `R2_ACCOUNT_ID` / `R2_ACCESS_KEY_ID` / etc. | Cloudflare R2 (imágenes clínicas) |
| `SMTP_*` | Configuración de email (opcional) |
| `TWILIO_*` | WhatsApp/SMS (opcional) |

Ver [.env.local.example](.env.local.example) para la lista completa.

---

## Planes de suscripción

| Plan | Precio | Profesionales | Imágenes clínicas | Facturación |
|------|--------|:---:|:---:|:---:|
| **Inicial** | USD 29/mes | 1 | ❌ | ❌ |
| **Clínica** | USD 49/mes | 3 | ✅ | ✅ |
| **Pro** | USD 89/mes | Ilimitados | ✅ | ✅ |

---

## Scripts

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Servidor de desarrollo con hot-reload |
| `npm start` | Servidor de producción |
| `npm run seed` | Carga roles y cuentas por defecto |
| `npm run prisma:migrate` | Aplica migraciones con historial |
| `npx prisma db push` | Aplica esquema sin historial (dev) |
| `npm run prisma:studio` | GUI visual de la base de datos |

---

## Licencia

© 2025 Alejo Valls Cura — Todos los derechos reservados.
