/* weekly_efforts — one row per project per week */
const db = require('../db/connection');
const { now } = require('../utils/dates');
const { KEYS } = require('../domain/weekly');

const WeeklyEffort = {
  forProject: (pid) => db.all('SELECT * FROM weekly_efforts WHERE project_id = ? ORDER BY week_ending', [pid]),
  forWeek: (pid, wk) => db.get('SELECT * FROM weekly_efforts WHERE project_id = ? AND week_ending = ?', [pid, wk]),
  countForProject: async (pid) => (await db.get('SELECT COUNT(*) AS n FROM weekly_efforts WHERE project_id = ?', [pid])).n,
  upsert: async (pid, wk, d, userId, source) => {
    const cols = KEYS.concat(['remarks']).filter(k => d[k] !== undefined);
    const ex = await WeeklyEffort.forWeek(pid, wk);
    if (ex) {
      await db.run(`UPDATE weekly_efforts SET ${cols.map(c => c + '=?').join(',')}${cols.length ? ',' : ''} source=?, updated_by=?, updated_at=? WHERE id=?`,
        cols.map(c => d[c]).concat([source || ex.source || 'form', userId || null, now(), ex.id]));
      return ex.id;
    }
    const id = db.uid('wef');
    await db.run(`INSERT INTO weekly_efforts (id,project_id,week_ending,${cols.join(',')}${cols.length ? ',' : ''}source,updated_by,updated_at) VALUES (?,?,?,${cols.map(() => '?').join(',')}${cols.length ? ',' : ''}?,?,?)`,
      [id, pid, wk].concat(cols.map(c => d[c])).concat([source || 'form', userId || null, now()]));
    return id;
  }
};

module.exports = WeeklyEffort;
