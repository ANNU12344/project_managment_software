/* SQLite connection (better-sqlite3).
 *
 * The methods are async on purpose: models and services are written against this promise API,
 * so the engine can later be swapped (e.g. Azure SQL) by replacing this one file.
 * Ids are app-generated, dates are ISO strings, booleans are 0/1 integers.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const config = require('../config');
const logger = require('../utils/logger');

let db = null;

function open() {
  if (db) return db;
  const Database = require('better-sqlite3');
  fs.mkdirSync(path.dirname(config.db.sqlitePath), { recursive: true });
  db = new Database(config.db.sqlitePath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  logger.info('database opened', { driver: 'sqlite', path: config.db.sqlitePath });
  return db;
}

/* 'prj' -> 'prj_1c28efbe003541a1aa11' */
function uid(prefix) {
  return (prefix ? prefix + '_' : '') + crypto.randomUUID().replace(/-/g, '').slice(0, 20);
}

const conn = () => db || open();

module.exports = {
  driver: 'sqlite',
  uid,
  open,
  async all(sql, params = []) { return conn().prepare(sql).all(params); },
  async get(sql, params = []) { return conn().prepare(sql).get(params) || null; },
  async run(sql, params = []) { const r = conn().prepare(sql).run(params); return { changes: r.changes }; },
  async exec(sqlText) { conn().exec(sqlText); },
  /* Synchronous transaction: fn receives the raw better-sqlite3 handle and must not await. */
  transaction(fn) { return conn().transaction(fn)(conn()); },
  close() { if (db) { db.close(); db = null; logger.info('database closed'); } }
};
