const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const config = require("./config");
const routes = require("./routes");

function createApp() {
  const app = express();
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true }));
  app.use(
    cors({
      origin: config.corsOrigins,
      credentials: true
    })
  );
  app.use(
    rateLimit({
      windowMs: 60 * 1000,
      max: config.rateLimitPerMinute,
      standardHeaders: true,
      legacyHeaders: false,
      message: { detail: "Rate limit exceeded. Try again in a minute." }
    })
  );
  app.use(config.apiPrefix, routes);
  return app;
}

module.exports = {
  createApp
};
