const path = require("path");
const dotenv = require("dotenv");

dotenv.config();

const projectRoot = path.resolve(__dirname, "..");

function parseBool(value, fallback) {
  if (value == null || value === "") {
    return fallback;
  }
  return String(value).toLowerCase() === "true";
}

function parseIntValue(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function databaseFileFromUrl(rawUrl) {
  const url = rawUrl || "sqlite:///./coaching.db";
  if (url.startsWith("sqlite:///")) {
    return path.resolve(projectRoot, url.replace("sqlite:///", ""));
  }
  if (url.startsWith("sqlite://")) {
    return path.resolve(projectRoot, url.replace("sqlite://", ""));
  }
  return path.resolve(projectRoot, "coaching.db");
}

const config = {
  appName: process.env.APP_NAME || "Coaching Management System API",
  environment: process.env.ENVIRONMENT || "development",
  apiPrefix: process.env.API_PREFIX || "/api/v1",
  secretKey: process.env.SECRET_KEY || "change-me-in-env",
  algorithm: process.env.ALGORITHM || "HS256",
  accessTokenExpireMinutes: parseIntValue(process.env.ACCESS_TOKEN_EXPIRE_MINUTES, 30),
  refreshTokenExpireMinutes: parseIntValue(process.env.REFRESH_TOKEN_EXPIRE_MINUTES, 60 * 24 * 7),
  databaseUrl: process.env.DATABASE_URL || "sqlite:///./coaching.db",
  databaseFile: databaseFileFromUrl(process.env.DATABASE_URL),
  storageDir: path.resolve(projectRoot, process.env.STORAGE_DIR || "./storage"),
  corsOrigins: (process.env.CORS_ORIGINS || "http://localhost:5173,http://127.0.0.1:5173")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean),
  rateLimitPerMinute: parseIntValue(process.env.RATE_LIMIT_PER_MINUTE, 120),
  runScheduler: parseBool(process.env.RUN_SCHEDULER, true),
  smtpHost: process.env.SMTP_HOST || "",
  smtpPort: parseIntValue(process.env.SMTP_PORT, 587),
  smtpUser: process.env.SMTP_USER || "",
  smtpPassword: process.env.SMTP_PASSWORD || "",
  smtpSender: process.env.SMTP_SENDER || "",
  port: parseIntValue(process.env.PORT, 8000)
};

module.exports = config;
