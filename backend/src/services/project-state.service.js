/* One project's full state as of a week — the single place every figure is assembled from.
 *
 * Health recompute, the weekly history snapshot, the dashboards and the AI all call this, so a
 * number reads the same everywhere: weekly efforts roll up to date, defect counts come from the
 * defects sheet, process metrics are measured against the baseline, and the health index is
 * computed from all of it.
 */
const M = require('../models');
const W = require('../domain/weekly');
const MX = require('../domain/metrics');
const H = require('../domain/health');
const RC = require('../domain/records');
const PD = require('../domain/project-details');
const { today, weekEnding } = require('../utils/dates');

const upTo = (rows, week, key) => week ? rows.filter(r => !r[key] || String(r[key]).slice(0, 10) <= week) : rows;

async function projectState(pid, week) {
  const project = await M.Project.byId(pid);
  if (!project) return null;
  const t = today();
  const [srWeek, history, ms, rk, dp, bl, dfx, pci, weekly, ncs, base, weights] = await Promise.all([
    week ? M.StatusReport.forWeek(pid, week) : null, M.StatusReport.history(pid),
    M.Milestone.forProject(pid), M.Risk.forProject(pid), M.Dependency.forProject(pid),
    M.Billing.forProject(pid), M.Defect.forProject(pid), M.PciAudit.forProject(pid),
    M.WeeklyEffort.forProject(pid),
    M.Nc.forProject(pid),
    M.AppConfig.get('metric_baseline', MX.BASELINE), M.AppConfig.get('health_weights', H.DEFAULT_WEIGHTS)
  ]);
  /* the weekly report for that week, else the latest one on or before it */
  const sr = srWeek || (week ? history.filter(s => s.week_ending <= week).pop() : history[history.length - 1]) || null;
  /* no week asked for = today's picture: weekly rows, NCs and audits up to now, even when the
     last weekly report is older (cutting at that report hid everything entered since) */
  const wk = week || weekEnding();
  const asOf = wk < t ? wk : t;
  const weeklyTo = upTo(weekly, wk, 'week_ending');
  const eff = W.effective(project, weeklyTo);
  const pe = MX.withDefects(eff, dfx);
  const mx = MX.evaluate(pe, Object.assign({}, MX.BASELINE, base));
  const pciTo = upTo(pci, wk, 'audit_date');
  const ncsTo = ncs.filter(n => String(n.raised_date).slice(0, 10) <= wk);
  const health = H.computeV2({ project: pe, sr: sr || {}, milestones: ms, risks: rk, deps: dp, defects: dfx, pci: pciTo, billing: bl, ncs: ncsTo, mx, asOf }, weights);
  return { project, eff: pe, sr, week: wk, asOf, milestones: ms, risks: rk, deps: dp, billing: bl, defects: dfx, pci: pciTo,
    weekly: weeklyTo, weeklyAll: weekly, cumulative: W.cumulative(weeklyTo), ncs: ncsTo, mx, health };
}

/* Everything worth seeing again about a project at the end of a week: kept in project_weeks. */
function snapshotOf(st) {
  const p = st.eff, H2 = st.health, sr = st.sr || {};
  const thisWeek = st.weekly.find(w => w.week_ending === st.week) || null;
  const openMs = st.milestones.filter(m => !RC.isDoneMilestone(m)).sort((a, b) => String(a.forecast_date || a.baseline_date).localeCompare(String(b.forecast_date || b.baseline_date)));
  const pick = (o, keys) => keys.reduce((a, k) => (a[k] = o[k] === undefined ? null : o[k], a), {});
  const openNcs = st.ncs.filter(n => n.status !== 'Closed');
  return {
    week: st.week, version: 1,
    project: pick(p, ['code', 'name', 'stage', 'status', 'project_type', 'pct_completed', 'contract_value', 'budget_cr', 'expenses_budget_cr', 'actual_cost_cr',
      'budgeted_hours', 'baselined_effort_hours', 'planned_effort_hours', 'planned_to_date', 'baseline_to_date', 'actual_effort_hours', 'timesheet_pct']),
    kpis: {
      health: H2.index, state: H2.state, parts: H2.parts,
      effort_variance_pct: PD.effortVariance(p), net_margin_pct: PD.netMargin(p),
      open_risks: st.risks.filter(r => r.status !== 'Closed').length, open_iad: st.deps.filter(d => d.status !== 'Closed').length,
      open_ncs: openNcs.length, major_ncs: openNcs.filter(n => n.severity === 'Major').length,
      pci: st.pci.length ? st.pci.slice().sort((a, b) => String(b.audit_date).localeCompare(String(a.audit_date)))[0].pci_score : null,
      billed_cr: st.billing.filter(b => b.status === 'Completed').reduce((a, b) => a + Number(b.amount_cr || 0), 0),
      to_bill_cr: st.billing.filter(b => b.status !== 'Completed').reduce((a, b) => a + Number(b.amount_cr || 0), 0),
      milestones_done: st.milestones.filter(RC.isDoneMilestone).length, milestones_total: st.milestones.length,
      next_milestone: openMs[0] ? openMs[0].name : null, next_milestone_date: openMs[0] ? (openMs[0].forecast_date || openMs[0].baseline_date) : null
    },
    effort: { week: thisWeek ? pick(thisWeek, W.KEYS.concat(['remarks', 'source'])) : null, to_date: st.cumulative },
    metrics: st.mx.map(m => ({ key: m.key, value: m.value, status: m.status })),
    weekly_report: pick(sr, ['week_ending', 'pct_complete', 'spi', 'cpi', 'defects_open', 'pm_rag', 'pm_rag_reason', 'narrative']),
    milestones: st.milestones.map(m => pick(m, ['name', 'baseline_date', 'forecast_date', 'actual_date', 'status', 'pct_complete', 'signoff_status'])),
    raid_open: RC.raidRows(st.risks, st.deps).filter(r => r.status !== 'Closed').map(r => pick(r, ['ref', 'raid_type', 'description', 'owner', 'status']))
  };
}

/* Store the project's state for a week (default: the current week). Called after every save. */
async function saveWeek(pid, userId, week) {
  const st = await projectState(pid, week || weekEnding());
  if (!st) return null;
  await M.ProjectWeek.save(pid, st.week, JSON.stringify(snapshotOf(st)), userId);
  return st.week;
}

/* Recompute and store the health index on the project's weekly report for a week (default: latest). */
async function recompute(pid, weekEndingDate) {
  const wk = weekEndingDate || weekEnding();
  const sr = (await M.StatusReport.forWeek(pid, wk)) || (await M.StatusReport.latest(pid));
  if (!sr) return null;
  /* a given week is scored as of that week; otherwise the latest report carries today's picture */
  const st = await projectState(pid, weekEndingDate ? sr.week_ending : null);
  if (!st) return null;
  const r = st.health;
  await M.StatusReport.setHealth(sr.id, r.index, r.state);
  return Object.assign(r, { status_report_id: sr.id, week_ending: sr.week_ending });
}

/* After any change to a project: recompute health, then store this week's picture. */
async function refresh(pid, userId, week) {
  const h = await recompute(pid);
  await saveWeek(pid, userId, week);
  return h;
}

module.exports = { projectState, snapshotOf, saveWeek, recompute, refresh };
