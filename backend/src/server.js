const { createApp } = require("./app");
const config = require("./config");
const { initializeSchema } = require("./db");
const { ensureStorageDirs, runFeeReminders } = require("./services");

let reminderTimer = null;

async function start() {
  await initializeSchema();
  ensureStorageDirs();
  if (config.runScheduler) {
    reminderTimer = setInterval(() => {
      runFeeReminders(new Date().toISOString().slice(0, 10)).catch(() => {});
    }, 30 * 60 * 1000);
  }
  const app = createApp();
  const server = app.listen(config.port, () => {
    process.stdout.write(`Server listening on port ${config.port}\n`);
  });

  const shutdown = () => {
    if (reminderTimer) {
      clearInterval(reminderTimer);
    }
    server.close(() => process.exit(0));
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

start().catch((error) => {
  process.stderr.write(`Failed to start server: ${error.message}\n`);
  process.exit(1);
});
