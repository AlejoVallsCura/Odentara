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

const prisma = require("./lib/prisma");
const { apiLimiter, sensitiveLimiter } = require("./middleware/rate-limit");
const clinicResolver = require("./middleware/clinic-resolver");
const authRoutes = require("./routes/auth");
const appointmentRoutes = require("./routes/appointments");
const billingRoutes = require("./routes/billing");
const clinicalImageRoutes = require("./routes/clinical-images");
const clinicalRecordRoutes = require("./routes/clinical-records");
const patientRoutes = require("./routes/patients");
const professionalRoutes = require("./routes/professionals");
const treatmentRoutes = require("./routes/treatments");
const userRoutes = require("./routes/users");
const platformRoutes = require("./routes/platform");

const app = express();
app.set("trust proxy", 1); // necesario para rate-limit detrás de reverse proxy (Hostinger, nginx)
const PORT = Number(process.env.PORT || 3001);
const HOST = "0.0.0.0";
const WEB_ROOT = path.resolve(__dirname, "..");

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
        scriptSrc: ["'self'", "'unsafe-inline'"], // necesario para el SPA
        // Helmet 8 incluye "script-src-attr 'none'" por defecto, lo que bloquea
        // todos los onclick="..." del HTML generado dinámicamente. El SPA usa
        // event handlers inline extensivamente, así que permitimos 'unsafe-inline'.
        scriptSrcAttr: ["'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
        imgSrc: ["'self'", "data:", "blob:"],
        connectSrc: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false, // evita romper recursos externos
  })
);

app.use(
  cors({
    origin: true,
    credentials: true,
  })
);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(WEB_ROOT, { extensions: ["html"] }));

// --- Resolución de subdominio de clínica ---
app.use(clinicResolver);

// --- Rate limiting global para todas las rutas /api ---
app.use("/api", apiLimiter);

app.get("/health", async (_req, res) => {
  const debugInfo = getDatabaseDebugInfo();

  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      ok: true,
      service: "odentara-api",
      database: "connected",
      debug: debugInfo,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    let localhostLookup = null;

    try {
      localhostLookup = await dns.lookup("localhost");
    } catch (lookupError) {
      localhostLookup = {
        error: lookupError?.message || "DNS lookup failed",
      };
    }

    res.status(500).json({
      ok: false,
      service: "odentara-api",
      database: "disconnected",
      debug: {
        ...debugInfo,
        localhostLookup,
      },
      error: error?.message || "Unknown database error",
      cause:
        error?.cause?.message ||
        error?.cause?.originalMessage ||
        error?.cause?.cause ||
        null,
    });
  }
});

app.use("/api/auth", authRoutes);
app.use("/api/appointments", appointmentRoutes);
app.use("/api/billing", billingRoutes);
app.use("/api/clinical-images", clinicalImageRoutes);
app.use("/api/clinical-records", clinicalRecordRoutes);
app.use("/api/patients", patientRoutes);
app.use("/api/professionals", professionalRoutes);
app.use("/api/treatments", treatmentRoutes);
app.use("/api/users", sensitiveLimiter, userRoutes); // usuarios: límite estricto
app.use("/api/platform", platformRoutes);             // panel de plataforma (solo platform admin)

app.get("/", (_req, res) => {
  res.sendFile(path.join(WEB_ROOT, "index.html"));
});

app.get(/^\/(?!api\/).*/, (_req, res) => {
  res.sendFile(path.join(WEB_ROOT, "index.html"));
});

app.use((req, res) => {
  res.status(404).json({
    ok: false,
    error: "Ruta no encontrada.",
  });
});

app.listen(PORT, HOST, () => {
  console.log(`Odentara escuchando en http://${HOST}:${PORT}`);
});
