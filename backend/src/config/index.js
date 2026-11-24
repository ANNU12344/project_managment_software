/* Application configuration — the only place that reads process.env.
 * Every other module imports from here, so a missing or unsafe setting is caught once, at start-up.
 */
const path = require('path');
require('dotenv').config({ quiet: true });

const ROOT = path.resolve(__dirname, '..', '..', '..');      // repository root
const env = (process.env.NODE_ENV || 'development').toLowerCase();
const isProd = env === 'production';

const str = (k, d) => (process.env[k] === undefined || process.env[k] === '' ? d : String(process.env[k]));
const num = (k, d) => { const v = Number(str(k, d)); return Number.isFinite(v) ? v : d; };
const bool = (k, d) => { const v = str(k, null); return v === null ? d : /^(1|true|yes|on)$/i.test(v); };
const resolvePath = p => (path.isAbsolute(p) ? p : path.resolve(ROOT, p));

const DEV_SECRET = 'dev-only-change-me';

const config = {
  env,
  isProd,
  root: ROOT,
  publicDir: path.join(ROOT, 'frontend'),        // the front end the app serves (index.html, js/, css/, assets/)

  server: {
    port: num('PORT', 8080),
    trustProxy: num('TRUST_PROXY', 1),           // Azure App Service terminates TLS in front of the app
    jsonLimit: str('JSON_LIMIT', '2mb')
  },

  db: {
    driver: 'sqlite',
    sqlitePath: resolvePath(str('SQLITE_PATH', './data/dcc.sqlite'))
  },

  session: {
    name: 'dcc.sid',
    secret: str('SESSION_SECRET', DEV_SECRET),
    cookieSecure: bool('COOKIE_SECURE', false),
    maxAgeMs: num('SESSION_MAX_AGE_HOURS', 8) * 60 * 60 * 1000
  },

  uploads: {
    workbookMaxBytes: 8 * 1024 * 1024,
    fileMaxBytes: 10 * 1024 * 1024
  },

  jobs: {
    snapshotInProcess: bool('SNAPSHOT_IN_PROCESS', true)
  },

  log: {
    level: str('LOG_LEVEL', isProd ? 'info' : 'debug').toLowerCase(),
    format: str('LOG_FORMAT', isProd ? 'json' : 'pretty').toLowerCase()
  },

  seed: {
    password: str('SEED_PASSWORD', 'Uneecops@2026')
  },

  ai: {
    endpoint: str('AZURE_OPENAI_ENDPOINT', '').replace(/\/+$/, ''),
    deployment: str('AZURE_OPENAI_DEPLOYMENT', ''),
    apiVersion: str('AZURE_OPENAI_API_VERSION', '2024-10-21'),
    apiKey: str('AZURE_OPENAI_API_KEY', ''),
    timeoutMs: num('AZURE_OPENAI_TIMEOUT_MS', 25000)
  }
};

/* Refuse to start in production with settings that would be unsafe there. */
function validate() {
  const problems = [];
  if (config.isProd) {
    if (config.session.secret === DEV_SECRET || config.session.secret.length < 32)
      problems.push('SESSION_SECRET must be set to a random string of at least 32 characters');
    if (!config.session.cookieSecure) problems.push('COOKIE_SECURE must be true in production');
  }
  if (['error', 'warn', 'info', 'debug'].indexOf(config.log.level) < 0) problems.push('LOG_LEVEL must be error, warn, info or debug');
  if (problems.length) {
    const e = new Error('Invalid configuration:\n  - ' + problems.join('\n  - '));
    e.code = 'config_invalid';
    throw e;
  }
}

module.exports = Object.assign(config, { validate });
