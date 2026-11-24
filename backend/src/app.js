/* The Express application: middleware, API, static front end, error handling.
 * Built here and started in server.js, so tests can import the app without listening.
 */
const path = require('path');
const express = require('express');
const config = require('./config');
const db = require('./db/connection');
const requestLogger = require('./middlewares/request-logger');
const securityHeaders = require('./middlewares/security-headers');
const { sessionMiddleware } = require('./middlewares/session');
const { errorHandler } = require('./middlewares/error-handler');
const apiRoutes = require('./routes');

function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', config.server.trustProxy);       // Azure App Service terminates TLS at the front end

  app.use(requestLogger);
  app.use(securityHeaders);
  app.use(express.json({ limit: config.server.jsonLimit }));
  app.use(express.urlencoded({ extended: true }));

  /* liveness / readiness — no session needed */
  app.get('/api/health', async (req, res) => {
    try {
      await db.get('SELECT 1 AS ok');
      res.json({ ok: true, driver: db.driver, at: new Date().toISOString() });
    } catch (err) {
      req.log.error('health check failed', { err });
      res.status(503).json({ ok: false, error: 'database_unavailable' });
    }
  });

  app.use('/api', sessionMiddleware, apiRoutes);

  /* front end: static files, then the SPA shell for any other GET */
  app.use(express.static(config.publicDir, { maxAge: config.isProd ? '1h' : 0 }));
  app.use((req, res, next) => {
    if (req.method !== 'GET') return next();
    res.sendFile(path.join(config.publicDir, 'index.html'));
  });

  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
