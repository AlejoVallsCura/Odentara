require("dotenv").config();

const express = require("express");
const cors = require("cors");

const prisma = require("./lib/prisma");
const authRoutes = require("./routes/auth");
const appointmentRoutes = require("./routes/appointments");
const billingRoutes = require("./routes/billing");
const clinicalImageRoutes = require("./routes/clinical-images");
const clinicalRecordRoutes = require("./routes/clinical-records");
const patientRoutes = require("./routes/patients");
const professionalRoutes = require("./routes/professionals");
const treatmentRoutes = require("./routes/treatments");
const userRoutes = require("./routes/users");

const app = express();
const PORT = Number(process.env.PORT || 3001);

app.use(
  cors({
    origin: true,
    credentials: true,
  })
);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

app.get("/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      ok: true,
      service: "odentara-api",
      database: "connected",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      service: "odentara-api",
      database: "disconnected",
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
app.use("/api/users", userRoutes);

app.use((req, res) => {
  res.status(404).json({
    ok: false,
    error: "Ruta no encontrada.",
  });
});

app.listen(PORT, () => {
  console.log(`Odentara API escuchando en http://localhost:${PORT}`);
});
