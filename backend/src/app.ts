import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth.js";
import applicationRoutes from "./routes/applications.js";

const app = express();

app.use(cors({ origin: process.env.FRONTEND_URL || "http://localhost:5173" }));
app.use(express.json());

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/applications", applicationRoutes);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: "Not found." });
});

export default app;
