const { loadEnv } = require("./lib/load-env");
loadEnv();

// --- Validación de variables de entorno obligatorias ---
// En produccion tambien se exige la clave de Turnstile. verifyTurnstile()
// devuelve true si no la encuentra —correcto en local, donde no hay claves—,
// pero esa variable no estaba aca: si se perdia en un deploy o no llegaba al
// worker, el login quedaba sin captcha y el proceso arrancaba sin una sola
// advertencia. La unica defensa restante es authLimiter, y su store vive en la
// memoria de cada worker, asi que el limite real se multiplica por la cantidad
// de workers (ver OD-AUTH-10 B en la auditoria).
const REQUIRED_ENV = ["DATABASE_URL", "JWT_SECRET"];
if (process.env.NODE_ENV === "production") REQUIRED_ENV.push("TURNSTILE_SECRET_KEY");
const missingEnv = REQUIRED_ENV.filter((key) => !process.env[key]);
if (missingEnv.length > 0) {
  console.error(
    `[STARTUP] Variables de entorno faltantes: ${missingEnv.join(", ")}. La app no puede iniciar.`
  );
  process.exit(1);
}

const path = require("path");
const dns = require("dns").promises;
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");

const prisma = require("./lib/prisma");
const { apiLimiter, sensitiveLimiter } = require("./middleware/rate-limit");
const clinicResolver = require("./middleware/clinic-resolver");
const { esRutaBloqueada } = require("./lib/public-paths");
const authRoutes = require("./routes/auth");
const announcementRoutes = require("./routes/announcements");
const appointmentRoutes = require("./routes/appointments");
const billingRoutes = require("./routes/billing");
const budgetRoutes = require("./routes/budgets");
const clinicalImageRoutes = require("./routes/clinical-images");
const clinicalRecordRoutes = require("./routes/clinical-records");
const clinicRoutes = require("./routes/clinic");
const contactRoutes = require("./routes/contact");
const patientRoutes = require("./routes/patients");
const prescriptionRoutes = require("./routes/prescriptions");
const professionalRoutes = require("./routes/professionals");
const treatmentRoutes = require("./routes/treatments");
const userRoutes = require("./routes/users");
const platformRoutes = require("./routes/platform");
const { startReminderScheduler, sendPendingReminders } = require("./lib/reminder-scheduler");
const { startBackupScheduler } = require("./lib/backup-scheduler");
const { startTokenPurgeScheduler } = require("./lib/token-revocation");
const { getMissingEmailVars } = require("./lib/email");

const app = express();
app.set("trust proxy", 1); // necesario para rate-limit detrás de reverse proxy (Hostinger, nginx)
// gzip para HTML/CSS/JS/JSON — reduce ~80% el peso de los assets.
//
// Los ZIP quedan afuera: un JPG o un PDF ya vienen comprimidos, así que
// gzipearlos quema CPU sin bajar el tamaño, y el buffer intermedio que agrega
// anula el streaming de la exportación de historias clínicas.
app.use(
  compression({
    filter: (req, res) => {
      const tipo = String(res.getHeader("Content-Type") || "");
      if (tipo.includes("application/zip")) return false;
      return compression.filter(req, res);
    },
  }),
);
const PORT = Number(process.env.PORT || 3001);
const HOST = "0.0.0.0";
const WEB_ROOT = path.resolve(__dirname, "..");
const LANDING_ROOT = path.resolve(__dirname, "..", "landing");

// Hostnames que sirven la landing pública (odentara.com)
const LANDING_HOSTNAMES = new Set(["odentara.com", "www.odentara.com"]);

function isLandingHost(req) {
  const host = (req.hostname || req.headers.host || "").split(":")[0].toLowerCase();
  return LANDING_HOSTNAMES.has(host);
}

function getDatabaseDebugInfo() {
  try {
    const databaseUrl = String(process.env.DATABASE_URL || "");
    if (!databaseUrl) {
      return {
        hasDatabaseUrl: false,
      };
    }

    const parsedUrl = new URL(databaseUrl);
    return {
      hasDatabaseUrl: true,
      protocol: parsedUrl.protocol,
      host: parsedUrl.hostname,
      port: parsedUrl.port || "3306",
      database: parsedUrl.pathname.replace(/^\//, ""),
      user: decodeURIComponent(parsedUrl.username || ""),
    };
  } catch (error) {
    return {
      hasDatabaseUrl: true,
      parseError: error?.message || "Invalid DATABASE_URL",
    };
  }
}

// --- Security headers (helmet) ---
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        // Sin 'unsafe-inline': un XSS que inyecte una etiqueta <script> queda
        // bloqueado por el navegador. Para lograrlo, los cuatro bloques inline
        // que tenía index.html se movieron a js/boot/head.js y js/boot/tail.js.
        scriptSrc: ["'self'", "https://challenges.cloudflare.com"], // SPA + Turnstile
        // Los handlers onclick generados por la SPA (unos 140) siguen
        // necesitando esto. Es un permiso bastante más débil que el anterior:
        // un atacante ya no puede ejecutar código con solo inyectar HTML, tiene
        // que lograr además que la víctima haga clic en el elemento inyectado.
        // Quitarlo requiere pasar todo a delegación de eventos.
        scriptSrcAttr: ["'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
        imgSrc: ["'self'", "data:", "blob:", "https://challenges.cloudflare.com"],
        frameSrc: ["https://challenges.cloudflare.com"], // Turnstile usa iframe
        connectSrc: ["'self'", "https://challenges.cloudflare.com"],
      },
    },
    crossOriginEmbedderPolicy: false, // evita romper recursos externos
  })
);

const ALLOWED_ORIGIN_RE = /^https?:\/\/(localhost(:\d+)?|127\.0\.0\.1(:\d+)?|(.+\.)?odentara\.com)$/;
app.use(
  cors({
    origin: (origin, callback) => {
      // Las peticiones sin Origin (same-origin, Postman en dev, curl) se permiten siempre
      if (!origin) return callback(null, true);
      if (ALLOWED_ORIGIN_RE.test(origin)) return callback(null, true);
      callback(new Error("CORS: origen no permitido"));
    },
    credentials: true,
  })
);
// Límite grande solo para rutas con imágenes base64 — el resto usa 200kb para prevenir DoS por RAM.
// extract-photo manda HASTA 10 fotos en un solo request (a diferencia de
// clinical-images, que sube de a una): con 2000px de ancho máx. y calidad
// 0.85 cada JPEG puede rondar 3-4MB, y en base64 eso suma ~33% más — 10 fotos
// superaban fácil los 12mb y el request se rechazaba con "Error interno del
// servidor" (un PayloadTooLargeError genérico, ver el error handler abajo).
app.use((req, res, next) => {
  const isPhotoImport = req.path.startsWith("/api/patients/extract-photo");
  const isImageRoute = req.path.startsWith("/api/clinical-images");
  const limit = isPhotoImport ? "40mb" : isImageRoute ? "12mb" : "200kb";
  express.json({ limit })(req, res, next);
});
app.use(express.urlencoded({ extended: true, limit: "200kb" }));

// Bloquear acceso a código y archivos de desarrollo.
//
// La regla vive en lib/public-paths para poder probarla sin levantar el
// servidor; el detalle de por qué es lista blanca está documentado ahí.
app.use((req, res, next) => {
  if (esRutaBloqueada(req.path, { esLanding: isLandingHost(req) })) {
    return res.status(404).end();
  }
  next();
});

// Servir assets estáticos según hostname:
// odentara.com → landing/   |   app/clinic → WEB_ROOT
// CSS/JS/imágenes se cachean 7 días en el browser — el ?v= de index.html fuerza
// la descarga de versiones nuevas en cada deploy. El HTML nunca se cachea.
const STATIC_CACHE_OPTS = {
  maxAge: "7d",
  setHeaders: (res, filePath) => {
    if (filePath.endsWith(".html")) {
      res.setHeader("Cache-Control", "no-cache");
    }
  },
};
app.use((req, res, next) => {
  if (isLandingHost(req)) {
    return express.static(LANDING_ROOT, STATIC_CACHE_OPTS)(req, res, next);
  }
  express.static(WEB_ROOT, { extensions: ["html"], ...STATIC_CACHE_OPTS })(req, res, next);
});

// --- Resolución de subdominio de clínica ---
app.use(clinicResolver);

// --- Rate limiting global para todas las rutas /api ---
app.use("/api", apiLimiter);

// --- Precios públicos para la landing ---
// Sin autenticación y solo con lo que ya se muestra en la web pública: nombre,
// precio y moneda. Existe para que la landing tome los precios del panel en vez
// de tenerlos escritos a mano en el HTML, que era la causa de que quedaran
// desactualizados al cambiarlos en la plataforma.
//
// Va DESPUÉS del rate limiter a propósito: es público y consulta la base en cada
// request, así que sin límite sería una forma barata de saturar el servidor.
app.get("/api/public/plans", async (_req, res) => {
  try {
    const rows = await prisma.plan.findMany({ orderBy: { sortOrder: "asc" } });
    // Ventana corta a propósito: con un cache largo, cambiar un precio en el
    // panel y no verlo reflejado en la web parece un error del sistema. Un
    // minuto alcanza para amortiguar las visitas y mantiene la sensación de que
    // el cambio es inmediato.
    res.set("Cache-Control", "public, max-age=60");
    return res.json({
      ok: true,
      plans: rows.map((row) => ({
        code: row.code,
        label: row.label,
        priceMonthly: Number(row.priceMonthly),
        currency: row.currency,
      })),
    });
  } catch (_error) {
    // La landing tiene los precios actuales escritos como respaldo en el HTML,
    // así que si esto falla la página sigue mostrando algo coherente.
    return res.status(503).json({ ok: false, error: "No se pudieron obtener los planes." });
  }
});

app.get("/health", async (req, res) => {
  // En producción solo se expone el status básico (sin info de DB)
  const isProd = process.env.NODE_ENV === "production";

  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      ok: true,
      service: "odentara-api",
      database: "connected",
      timestamp: new Date().toISOString(),
      ...(isProd ? {} : { debug: getDatabaseDebugInfo() }),
    });
  } catch (error) {
    if (isProd) {
      return res.status(500).json({ ok: false, service: "odentara-api", database: "disconnected" });
    }

    let localhostLookup = null;
    try {
      localhostLookup = await dns.lookup("localhost");
    } catch (lookupError) {
      localhostLookup = { error: lookupError?.message || "DNS lookup failed" };
    }

    res.status(500).json({
      ok: false,
      service: "odentara-api",
      database: "disconnected",
      debug: { ...getDatabaseDebugInfo(), localhostLookup },
      error: error?.message || "Unknown database error",
      cause: error?.cause?.message || error?.cause?.originalMessage || error?.cause?.cause || null,
    });
  }
});

app.use("/api/auth", authRoutes);
app.use("/api/announcements", announcementRoutes);
app.use("/api/appointments", appointmentRoutes);
app.use("/api/billing", billingRoutes);
app.use("/api/budgets", budgetRoutes);
app.use("/api/clinical-images", clinicalImageRoutes);
app.use("/api/clinical-records", clinicalRecordRoutes);
app.use("/api/clinic", clinicRoutes);              // configuración de la propia clínica
app.use("/api/contact", contactRoutes);
app.use("/api/patients", patientRoutes);
app.use("/api/prescriptions", prescriptionRoutes);
app.use("/api/professionals", professionalRoutes);
app.use("/api/treatments", treatmentRoutes);
app.use("/api/users", sensitiveLimiter, userRoutes); // usuarios: límite estricto
app.use("/api/platform", platformRoutes);             // panel de plataforma (solo platform admin)

// Rutas de dev/debug — solo en desarrollo
if (process.env.NODE_ENV !== "production") {
  // Preview de landing desde localhost sin necesitar el dominio odentara.com
  app.use("/landing-preview", express.static(LANDING_ROOT));
  app.get("/landing-preview", (_req, res) => res.sendFile(path.join(LANDING_ROOT, "index.html")));

  app.post("/api/debug/send-reminders", async (_req, res) => {
    try {
      await sendPendingReminders();
      res.json({ ok: true, message: "Recordatorios procesados. Revisá la consola." });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });
}

// ── Rutas HTML ────────────────────────────────────────────────────────────────
// Landing (odentara.com): sirve index.html y terminos.html desde landing/
// App/clínicas (app.odentara.com, clinica.odentara.com): sirve SPA desde WEB_ROOT
// El HTML se sirve siempre con no-cache para que cada deploy llegue de inmediato.

const sendHtml = (res, filePath) =>
  res.sendFile(filePath, { headers: { "Cache-Control": "no-cache" } });

app.get("/", (req, res) => {
  if (isLandingHost(req)) {
    return sendHtml(res, path.join(LANDING_ROOT, "index.html"));
  }
  sendHtml(res, path.join(WEB_ROOT, "index.html"));
});

app.get("/terminos", (req, res) => {
  if (isLandingHost(req)) {
    return sendHtml(res, path.join(LANDING_ROOT, "terminos.html"));
  }
  sendHtml(res, path.join(WEB_ROOT, "index.html"));
});

app.get(/^\/(?!api\/).*/, (req, res) => {
  if (isLandingHost(req)) {
    return sendHtml(res, path.join(LANDING_ROOT, "index.html"));
  }
  sendHtml(res, path.join(WEB_ROOT, "index.html"));
});

app.use((req, res) => {
  res.status(404).json({
    ok: false,
    error: "Ruta no encontrada.",
  });
});

// ── Error handler global ──────────────────────────────────────────────────────
// Captura errores no manejados en middlewares async (Express 5 los propaga).
// Sin esto, Express puede devolver stack traces al cliente en producción.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  const isProd = process.env.NODE_ENV === "production";
  console.error("[ERROR]", err);

  // El body-parser rechaza el request con esto cuando supera el límite de
  // express.json({limit}) — sin este caso especial, llegaba al cliente como
  // "Error interno del servidor" sin explicar qué pasó ni qué hacer.
  if (err.type === "entity.too.large" || err.status === 413) {
    return res.status(413).json({
      ok: false,
      error: "Las imágenes son demasiado pesadas para enviar juntas. Probá con menos fotos por tanda, o con fotos de menor resolución.",
      code: "PAYLOAD_TOO_LARGE",
    });
  }

  res.status(err.status || 500).json({
    ok: false,
    error: isProd ? "Error interno del servidor." : (err.message || "Error desconocido."),
  });
});

app.listen(PORT, HOST, () => {
  console.log(`Odentara escuchando en http://${HOST}:${PORT}`);
  startReminderScheduler();
  // Backup automático. Es seguro arrancarlo en todos los workers: la reserva de
  // turno por unicidad de BackupRun.slot hace que solo uno lo ejecute.
  startBackupScheduler();
  // Las revocaciones y las autorizaciones de descarga ya vencidas no sirven
  // para nada: se limpian al arrancar y cada seis horas, para que un worker
  // que quede levantado semanas no deje crecer las tablas indefinidamente.
  startTokenPurgeScheduler();

  // El envío de mails falla en silencio por diseño (recuperar contraseña
  // devuelve 200 aunque no mande nada, para no revelar qué mails existen). Si
  // este worker arrancó sin las variables de SMTP, hay que enterarse acá y no
  // cuando alguien no pueda recuperar su cuenta.
  const missingEmailVars = getMissingEmailVars();
  if (missingEmailVars.length > 0) {
    console.error(
      `[email] SMTP INCOMPLETO — faltan ${missingEmailVars.join(", ")}. ` +
      "No se van a enviar mails de recuperación de contraseña ni recordatorios."
    );
  } else {
    console.log(`[email] SMTP configurado (${process.env.SMTP_HOST})`);
  }
});

// ── Prevenir crashes silenciosos ──────────────────────────────────────────────
// Node.js termina el proceso si hay un unhandledRejection no capturado.
// Logueamos el error y seguimos — el healthcheck de Hostinger reiniciará si es fatal.
process.on("unhandledRejection", (reason, promise) => {
  console.error("[UNHANDLED REJECTION]", promise, "reason:", reason);
});

process.on("uncaughtException", (err) => {
  console.error("[UNCAUGHT EXCEPTION]", err);
  // No terminamos el proceso — Express ya maneja la mayoría de los errores async
});
