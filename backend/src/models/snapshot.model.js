/* snapshots — the weekly KPI freeze */
const db = require('../db/connection');
const { now } = require('../utils/dates');

const Snapshot = {
  forProject: (pid) => db.all('SELECT * FROM snapshots WHERE project_id=? ORDER BY week_ending', [pid]),
  all: () => db.all('SELECT * FROM snapshots ORDER BY week_ending'),
  exists: (pid, wk) => db.get('SELECT id FROM snapshots WHERE project_id=? AND week_ending=?', [pid, wk]),
  write: async (s) => {
    const ex = await Snapshot.exists(s.project_id, s.week_ending);
    if (ex) {
      await db.run(`UPDATE snapshots SET health_index=?,health_state=?,spi=?,cpi=?,pct_complete=?,margin_at_completion=?,slip_days=?,open_risks=?,open_deps=?,taken_at=? WHERE id=?`,
        [s.health_index, s.health_state, s.spi, s.cpi, s.pct_complete, s.margin_at_completion,
         s.slip_days, s.open_risks, s.open_deps, now(), ex.id]);
      return ex.id;
    }
    const id = db.uid('snp');
    await db.run(`INSERT INTO snapshots (id,project_id,week_ending,health_index,health_state,spi,cpi,pct_complete,margin_at_completion,slip_days,open_risks,open_deps,taken_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [id, s.project_id, s.week_ending, s.health_index, s.health_state, s.spi, s.cpi, s.pct_complete,
       s.margin_at_completion, s.slip_days, s.open_risks, s.open_deps, now()]);
    return id;
  }
};

module.exports = Snapshot;
