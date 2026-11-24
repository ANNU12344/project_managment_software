/* status_reports — the PM's weekly status, one per project per week */
const db = require('../db/connection');
const { now } = require('../utils/dates');

/* the columns a PM (form or sheet) can write */
const STATUS_KEYS = ['pct_complete', 'budget_consumed_pct', 'effort_baseline_pd', 'effort_actual_pd', 'etc_pd',
  'margin_at_completion', 'unbilled_wip', 'ar_over_90', 'defects_open', 'defects_leaked', 'defects_reopened',
  'sla_breaches', 'timesheet_compliance', 'over_allocated', 'attrition_flag', 'pm_rag', 'pm_rag_reason',
  'narrative', 'spi', 'cpi'];

const StatusReport = {
  STATUS_KEYS,
  latest: (pid) => db.get('SELECT * FROM status_reports WHERE project_id=? ORDER BY week_ending DESC', [pid]),
  forWeek: (pid, wk) => db.get('SELECT * FROM status_reports WHERE project_id=? AND week_ending=?', [pid, wk]),
  history: (pid) => db.all('SELECT * FROM status_reports WHERE project_id=? ORDER BY week_ending', [pid]),
  save: async (pid, wk, data, userId, source) => {
    const ex = await StatusReport.forWeek(pid, wk);
    const cols = STATUS_KEYS;
    /* Merge, never replace: a partial save (one field on a form, or a sheet that
       carries only some columns) must not blank everything else for that week. */
    const vals = cols.map(c => {
      if (data[c] !== undefined && data[c] !== '') return data[c];
      if (data[c] === '' && ex) return null;              // explicit clear
      return ex ? ex[c] : null;
    });
    if (ex) {
      await db.run(`UPDATE status_reports SET ${cols.map(c => c + '=?').join(',')},
        submitted_by=?, submitted_at=?, source=? WHERE id=?`,
        vals.concat([userId, now(), source || 'form', ex.id]));
      return ex.id;
    }
    const id = db.uid('sr');
    await db.run(`INSERT INTO status_reports (id,project_id,week_ending,${cols.join(',')},submitted_by,submitted_at,source,created_at)
      VALUES (?,?,?,${cols.map(() => '?').join(',')},?,?,?,?)`,
      [id, pid, wk].concat(vals).concat([userId, now(), source || 'form', now()]));
    return id;
  },
  setHealth: (id, index, state) => db.run('UPDATE status_reports SET health_index=?, health_state=? WHERE id=?', [index, state, id])
};

module.exports = StatusReport;
