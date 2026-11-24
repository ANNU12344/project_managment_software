/* config — key / JSON value settings (health_weights, metric_baseline) */
const db = require('../db/connection');

const AppConfig = {
  get: async (k, dflt) => { const r = await db.get('SELECT v FROM config WHERE k=?', [k]); return r ? JSON.parse(r.v) : dflt; },
  set: async (k, v) => {
    const ex = await db.get('SELECT k FROM config WHERE k=?', [k]);
    if (ex) return db.run('UPDATE config SET v=? WHERE k=?', [JSON.stringify(v), k]);
    return db.run('INSERT INTO config (k,v) VALUES (?,?)', [k, JSON.stringify(v)]);
  }
};

module.exports = AppConfig;
