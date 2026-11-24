/* Weekly snapshot — the job that makes trend, ageing and forecast accuracy possible.
 * Runs against whatever data exists. A week not snapshotted is history that cannot
 * be recovered later, so it never waits for complete data.
 */
const M = require('../models');
const state = require('./project-state.service');
const { days } = require('../domain/health');
const { weekEnding } = require('../utils/dates');

async function takeSnapshot(weekEndingDate) {
  const wk = weekEndingDate || weekEnding();
  const projects = await M.Project.all();
  const written = [];
  for (const p of projects) {
    if (p.status === 'Completed') continue;
    const sr = (await M.StatusReport.forWeek(p.id, wk)) || (await M.StatusReport.latest(p.id));
    if (!sr) continue;
    const h = await state.recompute(p.id, sr.week_ending);
    const [ms, rk, dp] = await Promise.all([M.Milestone.forProject(p.id), M.Risk.forProject(p.id), M.Dependency.forProject(p.id)]);
    const openMs = ms.filter(m => !m.actual_date);
    const slip = openMs.reduce((mx, m) => Math.max(mx, Math.max(0, days(m.baseline_date, m.forecast_date))), 0);
    await M.Snapshot.write({
      project_id: p.id, week_ending: wk,
      health_index: h ? h.index : null, health_state: h ? h.state : null,
      spi: sr.spi, cpi: sr.cpi, pct_complete: sr.pct_complete,
      margin_at_completion: sr.margin_at_completion,
      slip_days: slip,
      open_risks: rk.filter(r => r.status !== 'Closed').length,
      open_deps: dp.filter(d => d.status !== 'Closed').length
    });
    await state.saveWeek(p.id, null, wk);    // the full weekly picture for history and comparison
    written.push(p.code);
  }
  await M.AuditLog.log(null, 'snapshot.run', 'snapshot', wk, { projects: written.length });
  return { week_ending: wk, projects: written.length, codes: written };
}

module.exports = { takeSnapshot };
