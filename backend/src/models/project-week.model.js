/* project_weeks — the whole project as it stood at the end of a week (JSON) */
const db = require('../db/connection');
const { now } = require('../utils/dates');

const ProjectWeek = {
  forProject: (pid) => db.all('SELECT week_ending, data, saved_at FROM project_weeks WHERE project_id=? ORDER BY week_ending', [pid]),
  get: (pid, wk) => db.get('SELECT data, saved_at FROM project_weeks WHERE project_id=? AND week_ending=?', [pid, wk]),
  all: () => db.all('SELECT project_id, week_ending, data FROM project_weeks ORDER BY week_ending'),
  save: async (pid, wk, data, userId) => {
    const ex = await db.get('SELECT id FROM project_weeks WHERE project_id = ? AND week_ending = ?', [pid, wk]);
    if (ex) return db.run('UPDATE project_weeks SET data = ?, saved_at = ?, saved_by = ? WHERE id = ?', [data, now(), userId || null, ex.id]);
    return db.run('INSERT INTO project_weeks (id, project_id, week_ending, data, saved_at, saved_by) VALUES (?,?,?,?,?,?)',
      [db.uid('pwk'), pid, wk, data, now(), userId || null]);
  }
};

module.exports = ProjectWeek;
