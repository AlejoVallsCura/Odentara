# Odentara — API Reference

Base URL: `http://localhost:3001/api`

All responses follow the shape `{ ok: boolean, ... }`. Errors always include `{ ok: false, error: string }`.

**Auth header** (required by all protected routes):
```
Authorization: Bearer <jwt>
```

---

## Roles

| Code | Label |
|---|---|
| `superadmin` | Superadmin |
| `admin` | Administrador |
| `secretary` | Secretario |
| `professional` | Profesional |

**Permission helpers used throughout:**

| Helper | Roles |
|---|---|
| `canManagePatients` | superadmin, admin, secretary |
| `canEditPatient` | superadmin, admin, secretary, professional |
| `canDeletePatient` | superadmin only |
| `canViewProfessionals` | all roles |
| `canManageProfessionals` | superadmin, admin |
| `canManageProfessionalSchedules` | superadmin, admin, secretary |
| `canManageAppointments` | superadmin, admin, secretary |
| `canEditAppointments` | superadmin, admin, secretary, professional |
| `canViewClinicalData` | superadmin, professional |
| `canEditClinicalData` | superadmin, professional |
| `canViewBilling` | all roles |
| `canManageBilling` | superadmin, admin, secretary |

> **Scope filtering**: users with `professional` role (and no `canAccessWholeClinic`) only see data scoped to the professionals listed in their `UserProfessionalScope`.

---

## Auth — `/api/auth`

### `POST /api/auth/login`

Authenticate and receive a JWT.

**Auth required:** No

**Body**

| Field | Type | Required |
|---|---|---|
| `email` | string | Yes |
| `password` | string | Yes |

**Success `200`**
```json
{
  "ok": true,
  "token": "<jwt>",
  "user": { "id": 1, "email": "...", "fullName": "...", "roles": [...] },
  "permissions": { "roles": [...], "isSuperadmin": false, "canAccessWholeClinic": true, ... }
}
```

**Errors**

| Status | Condition |
|---|---|
| 400 | Missing email or password |
| 401 | Invalid credentials or inactive user |
| 500 | Database connection failure |

---

### `GET /api/auth/me`

Return the current authenticated user and their permission summary.

**Auth required:** Yes (any role)

**Success `200`**
```json
{
  "ok": true,
  "user": { "id": 1, "email": "...", "fullName": "...", "roles": [...] },
  "permissions": { ... }
}
```

**Errors**

| Status | Condition |
|---|---|
| 401 | Missing / invalid / expired token |

---

## Users — `/api/users`

### `GET /api/users`

List all active users with their roles and scoped professionals.

**Auth required:** Yes — roles: `superadmin`, `admin`

**Success `200`**
```json
{
  "ok": true,
  "users": [
    {
      "id": 1,
      "email": "...",
      "fullName": "...",
      "active": true,
      "roles": ["admin"],
      "permissions": { ... },
      "allowedProfessionals": [{ "id": 2, "fullName": "Dr. García" }]
    }
  ]
}
```

**Errors**

| Status | Condition |
|---|---|
| 401 | Not authenticated |
| 403 | Role not superadmin or admin |

---

### `POST /api/users`

Create a new user account.

**Auth required:** Yes — roles: `superadmin`, `admin`

**Body**

| Field | Type | Required | Notes |
|---|---|---|---|
| `fullName` | string | Yes | Also accepts `name` |
| `email` | string | Yes | Normalized to lowercase |
| `password` | string | Yes | Min 6 characters |
| `roles` | string[] | Yes | At least one. Accepted values: `superadmin`, `admin`/`administrador`, `secretary`/`secretario`, `professional`/`profesional` |
| `allowedProfessionalIds` | number[] | No | Also accepts `allowedProfessionals`. Scopes visibility to these professionals |

**Constraints:**
- Only `superadmin` can assign the `superadmin` role.
- Email must be unique.
- All `allowedProfessionalIds` must exist.

**Success `201`**
```json
{
  "ok": true,
  "user": { "id": 3, "email": "...", "fullName": "...", "roles": [...], "permissions": {...}, "allowedProfessionals": [...] },
  "message": "Usuario creado correctamente.",
  "meta": { "roleLabels": ["Profesional"] }
}
```

**Errors**

| Status | Condition |
|---|---|
| 400 | Missing required fields, password too short, invalid roles, non-existent professional IDs |
| 403 | Non-superadmin trying to assign superadmin role |
| 409 | Email already exists |

---

### `DELETE /api/users/:id`

Soft-delete a user (sets `active = false`, `deletedAt = now()`). Writes audit log.

**Auth required:** Yes — role: `superadmin` only

**Route param:** `id` — user ID (integer)

**Constraints:** Cannot delete your own logged-in account.

**Success `200`**
```json
{ "ok": true, "message": "Usuario archivado correctamente." }
```

**Errors**

| Status | Condition |
|---|---|
| 400 | Attempting to delete own account |
| 403 | Not superadmin |
| 404 | User not found or already deleted |

---

## Patients — `/api/patients`

### `GET /api/patients`

List all active patients. Results are scoped to the user's access level.

**Auth required:** Yes (any role)

**Query params**

| Param | Type | Description |
|---|---|---|
| `q` | string | Search by name (normalized), DNI, or phone |

**Success `200`**
```json
{
  "ok": true,
  "patients": [
    {
      "id": 1,
      "fullName": "Juan Pérez",
      "normalizedName": "juan perez",
      "dni": "12345678",
      "birthDate": "1990-05-10T00:00:00.000Z",
      "phone": "...",
      "email": "...",
      "address": "...",
      "insuranceName": "...",
      "insurancePlan": "...",
      "credentialNumber": "...",
      "chartNumber": "...",
      "active": true,
      "createdAt": "...",
      "updatedAt": "...",
      "clinicalRecord": { "id": 1, "summaryNotes": "...", "allergies": "...", "medicalNotes": "...", "updatedAt": "..." },
      "stats": { "appointments": 3, "treatments": 2, "images": 1 }
    }
  ]
}
```

---

### `GET /api/patients/:id`

Get a single patient by ID.

**Auth required:** Yes (any role)

**Route param:** `id` — patient ID

**Success `200`** — same structure as item in list above.

**Errors**

| Status | Condition |
|---|---|
| 404 | Not found or outside access scope |

---

### `POST /api/patients`

Create a new patient. Also creates an empty `ClinicalRecord`.

**Auth required:** Yes — roles: `superadmin`, `admin`, `secretary`

**Body**

| Field | Type | Required | Notes |
|---|---|---|---|
| `fullName` | string | Yes | |
| `dni` | string | Yes | Non-digits stripped automatically |
| `birthDate` | string (ISO date) | No | |
| `phone` | string | No | |
| `email` | string | No | |
| `address` | string | No | |
| `insuranceName` | string | No | |
| `insurancePlan` | string | No | |
| `credentialNumber` | string | No | |
| `chartNumber` | string | No | Must be unique |
| `active` | boolean | No | Default: `true` |
| `summaryNotes` | string | No | Stored in ClinicalRecord |
| `allergies` | string | No | Stored in ClinicalRecord |
| `medicalNotes` | string | No | Stored in ClinicalRecord |

**Success `201`** — same structure as GET /:id.

**Errors**

| Status | Condition |
|---|---|
| 400 | Missing fullName or DNI |
| 403 | Insufficient role |
| 409 | Duplicate DNI or duplicate normalized name |

---

### `PUT /api/patients/:id`

Update a patient and their clinical record notes.

**Auth required:** Yes — roles: `superadmin`, `admin`, `secretary`, `professional`

**Route param:** `id` — patient ID

**Body** — same fields as POST. All fields are re-written; omitted optional fields become `null`.

**Success `200`** — same structure as GET /:id.

**Errors**

| Status | Condition |
|---|---|
| 400 | Missing required fields |
| 403 | Insufficient role |
| 404 | Patient not found or out of scope |
| 409 | Duplicate DNI or name conflict |

---

### `DELETE /api/patients/:id`

Soft-delete a patient (`active = false`, `deletedAt = now()`). Writes audit log.

**Auth required:** Yes — role: `superadmin` only

**Route param:** `id` — patient ID

**Success `200`**
```json
{ "ok": true, "message": "Paciente eliminado correctamente." }
```

**Errors**

| Status | Condition |
|---|---|
| 400 | Foreign-key constraint violation (related records exist) |
| 403 | Not superadmin |
| 404 | Not found or already deleted |

---

## Professionals — `/api/professionals`

### `GET /api/professionals`

List all active professionals with schedules and exceptions.

**Auth required:** Yes — roles: all (but professionals without `canAccessWholeClinic` only see their own scoped entries)

**Query params**

| Param | Type | Description |
|---|---|---|
| `q` | string | Search by name, specialty, or email |

**Success `200`**
```json
{
  "ok": true,
  "professionals": [
    {
      "id": 1,
      "fullName": "Dr. García",
      "specialty": "Ortodoncia",
      "email": "...",
      "phone": "...",
      "color": "#3b82f6",
      "active": true,
      "userId": 2,
      "createdAt": "...",
      "updatedAt": "...",
      "assignedUser": { "id": 2, "email": "...", "fullName": "..." },
      "schedules": [
        { "id": 1, "weekday": 1, "startTime": "09:00", "endTime": "17:00", "active": true }
      ],
      "exceptions": [
        { "id": 1, "date": "...", "type": "unavailable", "startTime": null, "endTime": null, "reason": "..." }
      ],
      "stats": { "appointments": 10, "treatments": 5 }
    }
  ]
}
```

---

### `GET /api/professionals/:id`

Get a single professional by ID.

**Auth required:** Yes — any role (scope-filtered)

**Route param:** `id` — professional ID

**Success `200`** — same structure as item in list above.

**Errors**

| Status | Condition |
|---|---|
| 403 | Not allowed to view professionals |
| 404 | Not found or out of scope |

---

### `POST /api/professionals`

Create a new professional with optional schedules and exceptions.

**Auth required:** Yes — roles: `superadmin`, `admin`

**Body**

| Field | Type | Required | Notes |
|---|---|---|---|
| `fullName` | string | Yes | |
| `specialty` | string | No | |
| `email` | string | No | Must be unique |
| `phone` | string | No | |
| `color` | string | No | CSS color string for calendar display |
| `active` | boolean | No | Default: `true` |
| `schedules` | Schedule[] | No | See below |
| `exceptions` | Exception[] | No | See below |

**Schedule object**

| Field | Type | Required |
|---|---|---|
| `weekday` | number (0=Sun … 6=Sat) | Yes |
| `startTime` | string (`HH:MM`) | Yes |
| `endTime` | string (`HH:MM`) | Yes |
| `active` | boolean | No (default `true`) |

**Exception object**

| Field | Type | Required | Notes |
|---|---|---|---|
| `date` | string (ISO date) | Yes | |
| `type` | `unavailable` \| `special_hours` | Yes | |
| `startTime` | string (`HH:MM`) | No | Required for `special_hours` |
| `endTime` | string (`HH:MM`) | No | Required for `special_hours` |
| `reason` | string | No | |

**Success `201`** — same structure as GET /:id.

**Errors**

| Status | Condition |
|---|---|
| 400 | Missing fullName |
| 403 | Insufficient role |
| 409 | Duplicate email |

---

### `PUT /api/professionals/:id`

Update a professional. Schedules and exceptions are **fully replaced** (delete-all + re-create).

**Auth required:** Yes — roles: `superadmin`, `admin`, `secretary`
- Only `superadmin`/`admin` can edit core data (name, specialty, email, phone, color, active).
- `secretary` can only update schedules and exceptions.

**Route param:** `id` — professional ID

**Body** — same fields as POST.

**Success `200`** — same structure as GET /:id.

**Errors**

| Status | Condition |
|---|---|
| 400 | Missing fullName |
| 403 | Insufficient role |
| 404 | Not found |
| 409 | Duplicate email |

---

### `DELETE /api/professionals/:id`

Soft-delete a professional (`active = false`, `deletedAt = now()`). Writes audit log.

**Auth required:** Yes — roles: `superadmin`, `admin`

**Route param:** `id` — professional ID

**Success `200`**
```json
{ "ok": true, "message": "Profesional eliminado correctamente." }
```

**Errors**

| Status | Condition |
|---|---|
| 400 | FK constraint — professional has related appointments or billing |
| 403 | Insufficient role |
| 404 | Not found |

---

## Appointments — `/api/appointments`

### `GET /api/appointments`

List appointments. Without filters returns all accessible appointments (no `deletedAt` filter — soft-deleted records are excluded via the absence of `deletedAt` in the findMany query).

> Note: the query does **not** add `deletedAt: null` explicitly, but soft-deleted records have `status: cancelled`.

**Auth required:** Yes (any role, scope-filtered by professional access)

**Query params**

| Param | Type | Description |
|---|---|---|
| `date` | string (`YYYY-MM-DD`) | Filter by exact date |
| `professionalId` | number | Filter by professional |
| `q` | string | Search by patient name or DNI |

**Success `200`**
```json
{
  "ok": true,
  "appointments": [
    {
      "id": 1,
      "patientId": 5,
      "professionalId": 2,
      "createdByUserId": 1,
      "date": "2026-04-25",
      "startTime": "09:00",
      "durationMinutes": 30,
      "status": "confirmed",
      "isOverbook": false,
      "confirmationChannel": "whatsapp",
      "confirmationSentAt": "...",
      "confirmationResponseAt": "...",
      "cancellationReason": null,
      "notes": null,
      "createdAt": "...",
      "updatedAt": "...",
      "patient": { "id": 5, "fullName": "...", "dni": "...", "phone": "..." },
      "professional": { "id": 2, "fullName": "...", "color": "..." },
      "createdByUser": { "id": 1, "email": "...", "fullName": "..." }
    }
  ]
}
```

---

### `GET /api/appointments/:id`

Get a single appointment.

**Auth required:** Yes (any role, scope-filtered)

**Route param:** `id` — appointment ID

**Success `200`** — `{ ok: true, appointment: { ... } }` (same shape as list item)

**Errors**

| Status | Condition |
|---|---|
| 404 | Not found or out of scope |

---

### `POST /api/appointments`

Create a new appointment with conflict and schedule validation.

**Auth required:** Yes — roles: `superadmin`, `admin`, `secretary`

**Body**

| Field | Type | Required | Notes |
|---|---|---|---|
| `patientId` | number | Yes | |
| `professionalId` | number | Yes | |
| `date` | string (`YYYY-MM-DD`) | Yes | Cannot be in the past |
| `time` | string (`HH:MM`) | Yes | Past time today only allowed for overbooking |
| `durationMinutes` | number | Yes | Regular: `30`, `60`, `90`, `120`. Overbook: `15` only |
| `isOverbook` | boolean | No | Default: `false` |
| `status` | `not_sent` \| `sent` \| `confirmed` \| `rescheduled` \| `cancelled` | No | Default: `not_sent` |
| `confirmationChannel` | `whatsapp` \| `phone` \| `email` \| `manual` | No | |
| `confirmationSentAt` | string (ISO datetime) | No | |
| `confirmationResponseAt` | string (ISO datetime) | No | |
| `cancellationReason` | string | No | |
| `notes` | string | No | |

**Validation rules:**
- Patient and professional must exist and not be soft-deleted.
- Professional must have an active availability schedule that covers the requested time + duration.
- No overlap with existing non-cancelled/non-rescheduled appointments (overbooking only conflicts with other overbooking slots).
- Only one overbooking per time slot per professional.

**Success `201`** — `{ ok: true, appointment: { ... } }`

**Errors**

| Status | Condition |
|---|---|
| 400 | Validation failure (past date, past time without overbook, bad duration, schedule mismatch, conflict) |
| 403 | Insufficient role or professional out of scope |

---

### `PUT /api/appointments/:id`

Update an existing appointment. All fields are optional; omitted fields retain current values.

**Auth required:** Yes — roles: `superadmin`, `admin`, `secretary`, `professional`

**Route param:** `id` — appointment ID

**Body** — same fields as POST (all optional). Same validation rules apply (edit excludes current record from conflict check).

**Success `200`** — `{ ok: true, appointment: { ... } }`

**Errors**

| Status | Condition |
|---|---|
| 400 | Validation failure |
| 403 | Insufficient role or professional out of scope |
| 404 | Not found or out of scope |

---

### `DELETE /api/appointments/:id`

Soft-delete an appointment (`status = cancelled`, `deletedAt = now()`). Writes audit log.

**Auth required:** Yes — roles: `superadmin`, `admin`, `secretary`

**Route param:** `id` — appointment ID

**Success `200`**
```json
{ "ok": true, "message": "Turno eliminado correctamente." }
```

**Errors**

| Status | Condition |
|---|---|
| 400 | FK constraint or generic failure |
| 403 | Insufficient role |
| 404 | Not found or out of scope |

---

## Clinical Records — `/api/clinical-records`

One `ClinicalRecord` per patient. Contains clinical notes and the full odontogram. The odontogram entries are **fully replaced** on every PUT.

### `GET /api/clinical-records/:patientId`

Get a patient's clinical record including all odontogram entries.

**Auth required:** Yes — roles: `superadmin`, `professional`

**Route param:** `patientId` — patient ID

**Success `200`**
```json
{
  "ok": true,
  "patient": { "id": 5, "fullName": "...", "dni": "..." },
  "record": {
    "id": 1,
    "patientId": 5,
    "summaryNotes": "...",
    "allergies": "...",
    "medicalNotes": "...",
    "updatedAt": "...",
    "odontogramEntries": [
      { "id": 1, "toothNumber": "11", "face": "M", "status": "caries", "updatedAt": "..." }
    ]
  }
}
```

`record` is `null` if no clinical record has been created yet.

**Tooth face values:** `M`, `D`, `V`, `P`, `O`, `I`, `L`
**Odontogram status values:** `healthy`, `caries`, `restored`, `absent`

**Errors**

| Status | Condition |
|---|---|
| 403 | Insufficient role |
| 404 | Patient not found or out of scope |

---

### `PUT /api/clinical-records/:patientId`

Upsert the clinical record and fully replace all odontogram entries.

**Auth required:** Yes — roles: `superadmin`, `professional`

**Route param:** `patientId` — patient ID

**Body**

| Field | Type | Required | Notes |
|---|---|---|---|
| `summaryNotes` | string \| null | No | |
| `allergies` | string \| null | No | |
| `medicalNotes` | string \| null | No | |
| `odontogramEntries` | OdontogramEntry[] | No | Replaces all existing entries |

**OdontogramEntry object**

| Field | Type | Required | Notes |
|---|---|---|---|
| `toothNumber` | string | Yes | e.g. `"11"`, `"48"` |
| `status` | `healthy` \| `caries` \| `restored` \| `absent` | Yes | |
| `face` | `M` \| `D` \| `V` \| `P` \| `O` \| `I` \| `L` \| null | No | |

**Success `200`**
```json
{ "ok": true, "record": { ... } }
```

**Errors**

| Status | Condition |
|---|---|
| 403 | Insufficient role |
| 404 | Patient not found or out of scope |

---

## Treatments — `/api/treatments`

### `GET /api/treatments`

List treatments. Scope-filtered by patient and professional access.

**Auth required:** Yes — roles: `superadmin`, `professional`

**Query params**

| Param | Type | Description |
|---|---|---|
| `patientId` | number | Filter to a specific patient |

**Success `200`**
```json
{
  "ok": true,
  "treatments": [
    {
      "id": 1,
      "patientId": 5,
      "professionalId": 2,
      "appointmentId": 10,
      "createdByUserId": 1,
      "tooth": "16",
      "face": "O",
      "sector": null,
      "authorizationNumber": "AUTH-001",
      "insuranceCode": "IC-123",
      "observations": "Restauración compuesta",
      "performedAt": "2026-04-25T00:00:00.000Z",
      "patient": { "id": 5, "fullName": "...", "dni": "..." },
      "professional": { "id": 2, "fullName": "..." }
    }
  ]
}
```

---

### `POST /api/treatments`

Record a new treatment.

**Auth required:** Yes — roles: `superadmin`, `professional`

**Body**

| Field | Type | Required | Notes |
|---|---|---|---|
| `patientId` | number | Yes | |
| `professionalId` | number | No | Must be in user's scope if provided |
| `appointmentId` | number | No | Must belong to patient and be in scope |
| `tooth` | string | No | Tooth number/code |
| `face` | string | No | Free text (not enum-validated here) |
| `sector` | string | No | |
| `authorizationNumber` | string | No | |
| `insuranceCode` | string | No | |
| `observations` | string | No | |
| `performedAt` | string (ISO datetime) | No | Default: now |

**Success `201`** — `{ ok: true, treatment: { ... } }`

**Errors**

| Status | Condition |
|---|---|
| 403 | Insufficient role, professional out of scope, appointment out of scope |
| 404 | Patient not found |

---

### `PUT /api/treatments/:id`

Update an existing treatment. All fields optional; omitted values retain current data.

**Auth required:** Yes — roles: `superadmin`, `professional`

**Route param:** `id` — treatment ID

**Body** — same optional fields as POST (excluding `patientId`, which cannot change).

**Success `200`** — `{ ok: true, treatment: { ... } }`

**Errors**

| Status | Condition |
|---|---|
| 403 | Insufficient role or scope violation |
| 404 | Not found or out of scope |

---

### `DELETE /api/treatments/:id`

Soft-delete a treatment (`deletedAt = now()`). Writes audit log.

**Auth required:** Yes — roles: `superadmin`, `professional`

**Route param:** `id` — treatment ID

**Success `200`**
```json
{ "ok": true, "message": "Tratamiento eliminado correctamente." }
```

**Errors**

| Status | Condition |
|---|---|
| 400 | Generic failure |
| 403 | Insufficient role |
| 404 | Not found or out of scope |

---

## Clinical Images — `/api/clinical-images`

Images are stored as base64 data URLs (or any URL string) in a `LongText` column. No separate file upload — the URL is sent directly in the JSON body.

### `GET /api/clinical-images`

List clinical images. Scope-filtered.

**Auth required:** Yes — roles: `superadmin`, `professional`

**Query params**

| Param | Type | Description |
|---|---|---|
| `patientId` | number | Filter to a specific patient |

**Success `200`**
```json
{
  "ok": true,
  "images": [
    {
      "id": 1,
      "patientId": 5,
      "uploadedByUserId": 1,
      "imageUrl": "data:image/png;base64,...",
      "description": "Rx panorámica",
      "takenAt": "2026-04-01T00:00:00.000Z",
      "createdAt": "..."
    }
  ]
}
```

---

### `POST /api/clinical-images`

Upload one or more clinical images for a patient.

**Auth required:** Yes — roles: `superadmin`, `professional`

**Body — single image**

| Field | Type | Required | Notes |
|---|---|---|---|
| `patientId` | number | Yes | |
| `imageUrl` | string | Yes | Data URL or URL |
| `description` | string | No | |
| `takenAt` | string (ISO datetime) | No | |

**Body — batch upload**

```json
{
  "patientId": 5,
  "images": [
    { "imageUrl": "...", "description": "...", "takenAt": "..." },
    { "imageUrl": "..." }
  ]
}
```

When `images` array is provided, each item is processed individually. Items without `imageUrl` are skipped.

**Success `201`**
```json
{ "ok": true, "images": [ { ... } ] }
```

**Errors**

| Status | Condition |
|---|---|
| 403 | Insufficient role |
| 404 | Patient not found or out of scope |

---

### `PUT /api/clinical-images/:id`

Update an image's metadata. `imageUrl` can also be changed.

**Auth required:** Yes — roles: `superadmin`, `professional`

**Route param:** `id` — image ID

**Body**

| Field | Type | Required | Notes |
|---|---|---|---|
| `imageUrl` | string | No | |
| `description` | string \| null | No | |
| `takenAt` | string (ISO datetime) \| null | No | |

**Success `200`** — `{ ok: true, image: { ... } }`

**Errors**

| Status | Condition |
|---|---|
| 403 | Insufficient role |
| 404 | Not found or out of scope |

---

### `DELETE /api/clinical-images/:id`

Soft-delete a clinical image (`deletedAt = now()`). Writes audit log.

**Auth required:** Yes — roles: `superadmin`, `professional`

**Route param:** `id` — image ID

**Success `200`**
```json
{ "ok": true, "message": "Imagen clínica eliminada correctamente." }
```

**Errors**

| Status | Condition |
|---|---|
| 400 | Generic failure |
| 403 | Insufficient role |
| 404 | Not found or out of scope |

---

## Billing — `/api/billing`

### `GET /api/billing`

List billing entries. Scope-filtered: professionals without `canAccessWholeClinic` only see entries for their accessible professionals.

**Auth required:** Yes — all roles

**Query params**

| Param | Type | Description |
|---|---|---|
| `patientId` | number | Filter to a specific patient |

**Success `200`**
```json
{
  "ok": true,
  "entries": [
    {
      "id": 1,
      "patientId": 5,
      "professionalId": 2,
      "appointmentId": 10,
      "createdByUserId": 1,
      "type": "income",
      "amount": "5000.00",
      "currency": "ARS",
      "description": "Consulta",
      "date": "2026-04-25",
      "patient": { "id": 5, "fullName": "...", "dni": "..." },
      "professional": { "id": 2, "fullName": "..." }
    }
  ]
}
```

---

### `POST /api/billing`

Create a new billing entry.

**Auth required:** Yes — roles: `superadmin`, `admin`, `secretary`

**Body**

| Field | Type | Required | Notes |
|---|---|---|---|
| `patientId` | number | Yes | |
| `professionalId` | number | Yes | Required — cannot create entry without assigning a professional |
| `type` | `income` \| `debt` \| `payment` \| `adjustment` | Yes | |
| `amount` | number | Yes | Decimal with 2 places (stored as `DECIMAL(12,2)`) |
| `date` | string (`YYYY-MM-DD`) | No | Default: today (UTC noon) |
| `appointmentId` | number | No | Must belong to patient and be in scope |
| `currency` | string | No | Default: `ARS`. Uppercased automatically |
| `description` | string | No | |

**Success `201`** — `{ ok: true, entry: { ... } }`

**Errors**

| Status | Condition |
|---|---|
| 400 | Invalid type, missing professional |
| 403 | Insufficient role, professional or appointment out of scope |
| 404 | Patient not found |

---

### `PUT /api/billing/:id`

Update a billing entry. All fields optional; omitted values retain current data.

**Auth required:** Yes — roles: `superadmin`, `admin`, `secretary`

**Route param:** `id` — billing entry ID

**Body** — same optional fields as POST (excluding `patientId`).

**Success `200`** — `{ ok: true, entry: { ... } }`

**Errors**

| Status | Condition |
|---|---|
| 400 | Missing professional |
| 403 | Insufficient role or scope violation |
| 404 | Not found or out of scope |

---

### `DELETE /api/billing/:id`

Soft-delete a billing entry (`deletedAt = now()`). Writes audit log.

**Auth required:** Yes — roles: `superadmin`, `admin`, `secretary`

**Route param:** `id` — billing entry ID

**Success `200`**
```json
{ "ok": true, "message": "Movimiento eliminado correctamente." }
```

**Errors**

| Status | Condition |
|---|---|
| 400 | Generic failure |
| 403 | Insufficient role |
| 404 | Not found or out of scope |

---

## Health Check

### `GET /health`

**Auth required:** No

**Success `200`**
```json
{
  "ok": true,
  "service": "odentara-api",
  "database": "connected",
  "debug": { "hasDatabaseUrl": true, "protocol": "mysql:", "host": "...", "port": "3306", "database": "...", "user": "..." },
  "timestamp": "2026-04-25T12:00:00.000Z"
}
```

**Error `500`** — when DB is unreachable:
```json
{
  "ok": false,
  "service": "odentara-api",
  "database": "disconnected",
  "debug": { ... },
  "error": "...",
  "cause": "..."
}
```

---

## Soft Delete — Summary

All delete operations in this API are soft-deletes. No records are physically removed.

| Entity | Fields set on delete |
|---|---|
| `User` | `active = false`, `deletedAt = now()` |
| `Patient` | `active = false`, `deletedAt = now()` |
| `Professional` | `active = false`, `deletedAt = now()` |
| `Appointment` | `status = cancelled`, `deletedAt = now()` |
| `Treatment` | `deletedAt = now()` |
| `ClinicalImage` | `deletedAt = now()` |
| `BillingEntry` | `deletedAt = now()` |

All list and detail queries filter `deletedAt: null` (or use access-scoped where clauses that exclude deleted records).

Every soft-delete also writes an entry to `AuditLog` with `action = delete` and a snapshot of the data before deletion.

---

## Audit Log

The `AuditLog` table is write-only from the API. All mutations (create/update/delete/login/logout) are tracked automatically by `lib/audit.js`. There is no endpoint to query audit logs directly.

| Field | Description |
|---|---|
| `userId` | User who performed the action |
| `entityType` | e.g. `Patient`, `Appointment`, `Treatment` |
| `entityId` | String ID of the affected record |
| `action` | `create`, `update`, `delete`, `login`, `logout` |
| `beforeData` | JSON snapshot before the change |
| `afterData` | JSON snapshot after the change |
