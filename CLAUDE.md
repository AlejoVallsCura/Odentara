# CLAUDE.md — Odentara

## Reglas obligatorias
- **Nunca hard-delete.** Solo soft-delete (`deletedAt: new Date()`). Datos médicos = legalmente sensibles.
- **SaaS multitenancy.** Múltiples clínicas, datos aislados por `clinicId`. Cada query al backend filtra por `req.user.clinicId`.
- **Calidad > velocidad.** Código limpio, sin deuda técnica innecesaria.
- **Planes de límites** se definen en `server/lib/plan-limits.js`. Siempre importar desde ahí, nunca hardcodear en rutas.

## Stack
Express.js 5 + Prisma 7 + MariaDB | Frontend: Vanilla JS SPA (sin build step, sin framework)

## Comandos
```bash
npm run dev              # dev server con nodemon (hot-reload)
npm start                # producción
npm run seed             # roles, profesionales y cuentas por defecto
npm run prisma:migrate   # migraciones (requiere historial limpio)
npm run prisma:studio    # GUI de base de datos
npm run prisma:generate  # regenerar cliente tras cambios en schema
npx prisma db push       # aplicar schema sin historial de migraciones (útil en dev)
node prisma/create-platform-admin.js  # crear/resetear el platform admin
```

## Entorno
`.env.local` (carga primero) → `.env`. Variables requeridas: `DATABASE_URL`, `JWT_SECRET`.
Local: MariaDB/MySQL vía Laragon, puerto 3306, root sin password.
`DATABASE_URL=mysql://root:@localhost:3306/odentara_local`. Dev en puerto **3001**.

### Variables opcionales
```env
PORT=3001
APP_URL=http://localhost:3001          # base URL para links en emails
SMTP_HOST=smtp.gmail.com              # si no está configurado, el link de reset se imprime en consola
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=tu@gmail.com
SMTP_PASS=app-password
SMTP_FROM=Odentara <noreply@odentara.com>
```

## Arquitectura backend (`server/`)

### Archivos clave
| Archivo | Rol |
|---|---|
| `index.js` | Express setup, rutas, CORS, Helmet, static files |
| `lib/auth.js` | JWT signing/verify, serializeUser, buildPermissionSummary |
| `lib/permissions.js` | RBAC: hasRole, canManageProfessionals, canViewBilling, etc. |
| `lib/access.js` | Helpers de acceso a datos por clínica/profesional |
| `lib/audit.js` | AuditLog con snapshots before/after |
| `lib/prisma.js` | Cliente Prisma compartido |
| `lib/email.js` | Envío de emails con nodemailer (SMTP configurable) |
| `lib/plan-limits.js` | Límites y features por plan (inicial/clinica/pro) |
| `lib/security-logger.js` | Logger de eventos de seguridad (AUTH_FAILED, RATE_LIMIT, etc.) |
| `middleware/auth.js` | JWT middleware → `req.user`, `req.permissions` |
| `middleware/rate-limit.js` | Rate limiters: authLimiter, apiLimiter, sensitiveLimiter, forgotPasswordLimiter |
| `middleware/clinic-resolver.js` | Lee subdominio del hostname → `req.clinicSlug` |

### Rutas (`routes/`)
| Ruta | Descripción |
|---|---|
| `auth.js` | login, /me, forgot-password, reset-password |
| `appointments.js` | CRUD turnos |
| `patients.js` | CRUD pacientes |
| `professionals.js` | CRUD profesionales + disponibilidad |
| `treatments.js` | CRUD tratamientos |
| `clinical-records.js` | Fichas clínicas + odontograma |
| `clinical-images.js` | Imágenes clínicas |
| `billing.js` | Facturación y caja |
| `users.js` | CRUD usuarios de la clínica |
| `platform.js` | Panel de plataforma (solo platform admin) |

## Base de datos (Prisma + MariaDB)
- **Soft deletes:** `deletedAt` en casi todas las entidades. Siempre filtrar `deletedAt: null`.
- **RBAC:** tabla `UserRole` join entre `User` y `Role` (codes: `superadmin`, `admin`, `secretary`, `professional`).
- **Odontograma:** `OdontogramEntry` — estado clínico por diente/cara dentro de `ClinicalRecord`.
- **Reset de contraseña:** tabla `PasswordResetToken` (token único, expira en 1h, campo `usedAt`).
- **Auditoría:** todas las mutaciones importantes → `AuditLog`.
- Tras cambiar `schema.prisma`: `npx prisma db push` (dev) o `prisma:migrate` + `prisma:generate` (prod).
- Seed password: `odentara123`.

### Campos relevantes en Clinic
```
slug        — identificador único (URL-safe)
plan        — "inicial" | "clinica" | "pro" | null
dbType      — "shared" | "dedicated"
databaseUrl — solo si dbType = "dedicated"
active      — boolean
```

## Sistema de planes

Definido en `server/lib/plan-limits.js`. Se aplica en el backend, no en el frontend.

| Plan | Profesionales | Usuarios admin | Imágenes clínicas | Facturación |
|---|---|---|---|---|
| `inicial` | 1 | ❌ solo superadmin | ❌ | ❌ |
| `clinica` | 3 | ✅ | ✅ | ✅ |
| `pro` | ∞ | ✅ | ✅ | ✅ |
| sin plan | ∞ | ✅ | ✅ | ✅ |

Los errores de plan devuelven `{ ok: false, error: "...", code: "PLAN_LIMIT" }`.

## Platform Admin (ultra-admin)
- **Email:** `admin@odentara.app`
- **Password:** `odentara-platform-2024`
- **Script de reset:** `node prisma/create-platform-admin.js`
- El platform admin ve el panel de plataforma (gestión de clínicas, stats, impersonar clínicas).
- Campo `isPlatformAdmin: true` en el modelo `User`, sin `clinicId`.
- Rutas: `GET/POST/PUT/PATCH/DELETE /api/platform/clinics`, `GET /api/platform/stats`, `POST /api/platform/login-as-clinic`.

## Frontend (`app.js`, `index.html`, `styles.css`)
SPA client-side puro. **El frontend consume la API REST** (`/api/*`) — no hay localStorage como fuente de verdad para datos del servidor.

### Arquitectura del SPA
- `state` — objeto global con usuario, vista actual, datos en memoria
- `loadView(id, title)` — renderiza la vista correspondiente
- `apiFetch(path, opts)` — wrapper de fetch con token JWT automático
- `showModal / closeModal` — sistema de modales reutilizable
- `showConfirm(msg, opts)` — modal de confirmación custom (reemplaza `window.confirm`)
- `showToast(msg, type)` — notificaciones toast

### Mobile responsive
- Sidebar se oculta en ≤1024px con `transform: translateX(-104%) !important`
- `#app-view.sidebar-open aside` lo muestra
- `setSidebarOpen(bool)` / `isMobileLayout()` controlan el estado
- Hamburger: `#sidebar-toggle`, backdrop: `#sidebar-backdrop`, close btn: `#sidebar-close-btn`
- Nav items cierran el sidebar automáticamente en mobile (`isMobileLayout()`)

### Recuperación de contraseña
- Link "¿Olvidaste tu contraseña?" en el login → panel de email
- `POST /api/auth/forgot-password` → genera token, envía email (o loguea el link en consola si SMTP no está configurado)
- URL del email: `APP_URL?resetToken=xxx` → el SPA detecta el param, muestra formulario de nueva contraseña
- `POST /api/auth/reset-password` → valida token, actualiza hash, marca token como usado

## Rate Limiting
- **Login:** 10 intentos fallidos / 15 min / IP (no cuenta los exitosos)
- **Forgot password:** 5 requests / hora / IP
- **API general:** 600 req / 15 min / IP
- **Rutas sensibles (users):** 200 req / 15 min / IP
- **En desarrollo (localhost): el rate limit se saltea automáticamente.**

## Despliegue (próximos pasos)
1. Comprar dominio `odentara.com` + wildcard DNS `*.odentara.com`
2. Elegir hosting: Railway / Render / VPS (DigitalOcean)
3. SSL wildcard con Let's Encrypt (DNS challenge)
4. Configurar variables de entorno de producción (`.env.production.example` como guía)
5. JWT_SECRET: mínimo 64 chars aleatorios en producción
6. Configurar SMTP para emails transaccionales (recomendado: Resend)

## Arquitectura de subdominos (futuro)
Hoy: un solo dominio, `clinicId` del JWT aísla los datos.
Futuro: `clinicax.odentara.com` → `clinic-resolver.js` lee el slug del hostname → redirige post-login con cookie `.odentara.com`.
