/* Migration runner.
 *
 * Files in db/migrations named NNN_name.js run once each, in order, and are recorded in
 * schema_migrations. Runs on every start (only new files do anything) and via `npm run migrate`.
 * To change the schema, add a new file — never edit one that has already run.
 */
const fs = require('fs');
const path = require('path');
const db = require('./connection');
const logger = require('../utils/logger');

const DIR = path.join(__dirname, 'migrations');

function list() {
  return fs.readdirSync(DIR)
    .filter(f => /^\d{3}_[\w-]+\.js$/.test(f))
    .sort()
    .map(f => ({ version: f.slice(0, 3), file: f, mod: require(path.join(DIR, f)) }));
}

async function runMigrations() {
  const log = logger.child({ component: 'migrate' });
  await db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    applied_at TEXT NOT NULL
  );`);
  const done = new Set((await db.all('SELECT version FROM schema_migrations')).map(r => r.version));
  const pending = list().filter(m => !done.has(m.version));
  if (!pending.length) { log.debug('schema up to date'); return []; }

  for (const m of pending) {
    const started = Date.now();
    log.info('applying migration', { version: m.version, name: m.mod.name });
    try {
      await db.exec('BEGIN');
      await m.mod.up(db, log);
      await db.run('INSERT INTO schema_migrations (version, name, applied_at) VALUES (?,?,?)', [m.version, m.mod.name || m.file, new Date().toISOString()]);
      await db.exec('COMMIT');
    } catch (err) {
      await db.exec('ROLLBACK');
      log.error('migration failed — rolled back', { version: m.version, err });
      throw err;
    }
    log.info('migration applied', { version: m.version, ms: Date.now() - started });
  }
  return pending.map(m => m.version);
}

module.exports = { runMigrations };

if (require.main === module) {
  runMigrations()
    .then(v => { logger.info('migrations finished', { applied: v }); db.close(); })
    .catch(() => { db.close(); process.exit(1); });
}
