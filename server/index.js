const { loadEnv } = require("./lib/load-env");
loadEnv();

// --- Validación de variables de entorno obligatorias ---
const REQUIRED_ENV = ["DATABASE_URL", "JWT_SECRET"];
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
const authRoutes = require("./routes/auth");
const appointmentRoutes = require("./routes/appointments");
const billingRoutes = require("./routes/billing");
const budgetRoutes = require("./routes/budgets");
const clinicalImageRoutes = require("./routes/clinical-images");
const clinicalRecordRoutes = require("./routes/clinical-records");
const contactRoutes = require("./routes/contact");
const patientRoutes = require("./routes/patients");
const prescriptionRoutes = require("./routes/prescriptions");
const professionalRoutes = require("./routes/professionals");
const treatmentRoutes = require("./routes/treatments");
const userRoutes = require("./routes/users");
const platformRoutes = require("./routes/platform");
const { startReminderScheduler, sendPendingReminders } = require("./lib/reminder-scheduler");

const app = express();
app.set("trust proxy", 1); // necesario para rate-limit detrás de reverse proxy (Hostinger, nginx)
app.use(compression()); // gzip para HTML/CSS/JS/JSON — reduce ~80% el peso de los assets
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
        scriptSrc: ["'self'", "'unsafe-inline'", "https://challenges.cloudflare.com"], // SPA + Turnstile
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
// Límite grande solo para imágenes base64 — el resto usa 200kb para prevenir DoS por RAM
app.use((req, res, next) => {
  const isImageRoute = req.path.startsWith("/api/clinical-images");
  express.json({ limit: isImageRoute ? "10mb" : "200kb" })(req, res, next);
});
app.use(express.urlencoded({ extended: true, limit: "200kb" }));

// Bloquear acceso a directorios de código fuente del servidor
app.use((req, res, next) => {
  if (/^\/(server|prisma|node_modules)(\/|$)/i.test(req.path)) {
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
app.use("/api/appointments", appointmentRoutes);
app.use("/api/billing", billingRoutes);
app.use("/api/budgets", budgetRoutes);
app.use("/api/clinical-images", clinicalImageRoutes);
app.use("/api/clinical-records", clinicalRecordRoutes);
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
  res.status(err.status || 500).json({
    ok: false,
    error: isProd ? "Error interno del servidor." : (err.message || "Error desconocido."),
  });
});

app.listen(PORT, HOST, () => {
  console.log(`Odentara escuchando en http://${HOST}:${PORT}`);
  startReminderScheduler();
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
