# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev              # Start dev server with nodemon (hot-reload)
npm start                # Start production server
npm run seed             # Seed DB with default roles, professionals, and accounts
npm run prisma:migrate   # Run pending Prisma migrations
npm run prisma:studio    # Open Prisma Studio GUI
npm run prisma:generate  # Regenerate Prisma client after schema changes
```

There are no test or lint scripts configured.

## Environment

Copy `.env.local.example` to `.env.local` and set:
- `DATABASE_URL` — MariaDB connection string
- `JWT_SECRET` — secret for JWT signing
- `PORT` — server port (default 3000)

The app loads `.env.local` first, then `.env` (local takes precedence via `server/lib/load-env.js`).

## Architecture

**Odentara** is a dental practice management system. The stack is Express.js + Prisma + MariaDB for the backend, and a vanilla JS single-page app served from `app.js` / `index.html` on the frontend.

### Backend (`server/`)

- `index.js` — Express app setup: mounts all routes, applies CORS/JSON middleware, serves static frontend
- `lib/auth.js` — JWT signing and user serialization
- `lib/permissions.js` — Role-based permission checks (roles: `superadmin`, `admin`, `secretary`, `professional`)
- `lib/access.js` — Access control helpers used in route handlers
- `lib/audit.js` — Writes to `AuditLog` table on create/update/delete/login/logout with before/after snapshots
- `lib/prisma.js` — Shared Prisma client instance
- `middleware/auth.js` — JWT authentication middleware; attaches decoded user to `req.user`
- `routes/` — One file per domain: `auth`, `appointments`, `patients`, `professionals`, `treatments`, `clinical-records`, `clinical-images`, `billing`, `users`

### Database (Prisma + MariaDB)

Schema at `prisma/schema.prisma`. Key patterns:
- **Soft deletes**: `deletedAt` timestamp on most entities; queries must filter `deletedAt: null`
- **RBAC**: `UserRole` join table links users to roles; roles are checked via `lib/permissions.js`
- **Odontogram**: `ToothRecord` tracks per-tooth clinical status and face-level conditions
- **Auditing**: All mutations log to `AuditLog` via `lib/audit.js`

After changing `schema.prisma`, run `prisma:migrate` then `prisma:generate`.

Seed accounts (password: `odentara123`): admin and secretary users are created by `prisma/seed.js`.

### Frontend (`app.js`, `index.html`, `styles.css`)

Single-page app — all routing and rendering is handled client-side in `app.js`. No build step; the Express server serves these files as static assets.
