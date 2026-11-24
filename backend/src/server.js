/* Entry point: validate config, open the database, run migrations, start HTTP and the scheduler,
 * and shut down cleanly on SIGTERM / SIGINT (Azure App Service and Docker send SIGTERM).
 */
const config = require('./config');
const logger = require('./utils/logger');

process.on('unhandledRejection', (reason) => {
  logger.error('unhandled promise rejection', { err: reason instanceof Error ? reason : new Error(String(reason)) });
});
process.on('uncaughtException', (err) => {
  logger.error('uncaught exception — exiting', { err });
  process.exit(1);
});

async function start() {
  config.validate();
  const db = require('./db/connection');
  const { runMigrations } = require('./db/migrate');
  const { createApp } = require('./app');
  const { sessionStore } = require('./middlewares/session');

  db.open();
  await runMigrations();

  const users = await require('./models').User.all();
  if (!users.length) logger.warn('empty database — run `npm run seed` to create users and sample projects');

  const stopScheduler = config.jobs.snapshotInProcess ? require('./jobs/snapshot.job').start() : null;

  const app = createApp();
  const server = app.listen(config.server.port, () => {
    logger.info('server listening', { port: config.server.port, env: config.env, db: db.driver, url: `http://localhost:${config.server.port}` });
  });
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      logger.error(`port ${config.server.port} is already in use by another program (often an older copy of this app still running). ` +
        `Stop that program, or start this one on another port: set PORT in .env, or in PowerShell: $env:PORT="8081"; npm run dev`);
    } else logger.error('server could not start', { err });
    process.exit(1);
  });

  let closing = false;
  const shutdown = (signal) => {
    if (closing) return;
    closing = true;
    logger.info('shutting down', { signal });
    if (stopScheduler) stopScheduler();
    server.close(() => {
      sessionStore.close();
      db.close();
      logger.info('shutdown complete');
      process.exit(0);
    });
    setTimeout(() => { logger.warn('forced shutdown after timeout'); process.exit(1); }, 10000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  return server;
}

if (require.main === module) {
  start().catch(err => {
    logger.error('failed to start', { err });
    process.exit(1);
  });
}

module.exports = { start };
