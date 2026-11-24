/* One project: the drawer / status pack / AI context, dates, the weekly effort register and week history. */
const M = require('../models');
const access = require('./access.service');
const state = require('./project-state.service');
const PD = require('../domain/project-details');
const RC = require('../domain/records');
const W = require('../domain/weekly');
const { isSunday } = require('../utils/dates');
const { notFound, forbidden, validation } = require('../utils/errors');

const PM_HIDDEN_HISTORY = ['margin_at_completion', 'unbilled_wip', 'ar_over_90'];

/* Everything the drawer, the status pack and the AI diagnosis need. Throws 404 / 403 when the
   project does not exist or is outside the user's scope. */
async function projectDetail(user, id) {
  const p = await M.Project.byId(id);
  if (!p) throw notFound();
  const visible = await access.visibleTo(user);
  if (!visible.some(v => v.id === p.id)) throw forbidden();
  const [ms, rk, dp, hist, snaps, acts, users, bl, dfx, pci, wa] = await Promise.all([
    M.Milestone.forProject(p.id), M.Risk.forProject(p.id), M.Dependency.forProject(p.id),
    M.StatusReport.history(p.id), M.Snapshot.forProject(p.id), M.ActionItem.all(), M.User.all(),
    M.Billing.forProject(p.id), M.Defect.forProject(p.id), M.PciAudit.forProject(p.id), M.Activity.forProject(p.id)
  ]);
  const h = await state.recompute(p.id);
  const st = await state.projectState(p.id);
  const ncs = await M.Nc.forProjectNewestFirst(p.id);
  const isPm = user.role === 'pm';
  const redactedHistory = isPm
    ? hist.map(s => { const x = Object.assign({}, s); PM_HIDDEN_HISTORY.forEach(k => delete x[k]); return x; })
    : hist;
  return {
    project: Object.assign(access.redactProject(user, st.eff), PD.metrics(st.eff)), isPm,
    metrics: st.mx,
    raid: RC.raidRows(rk, dp),
    weekly: st.weeklyAll, cumulative: W.cumulative(st.weeklyAll), weekly_fields: W.FIELDS, weekly_groups: W.GROUPS,
    ncs,
    milestones: ms, risks: rk, dependencies: dp,
    billing: bl, defects: dfx, pci: pci.slice().reverse(),
    activities: wa.slice().reverse(),
    history: redactedHistory,
    snapshots: isPm ? snaps.map(x => { const y = Object.assign({}, x); delete y.margin_at_completion; return y; }) : snaps,
    health: h || st.health,
    actions: acts.filter(a => a.project_id === p.id),
    can_edit: access.canEditStatus(user, p),
    pmName: (users.find(u => u.id === p.pm_user_id) || {}).name || '—',
    users: users.filter(u => u.active).map(u => ({ id: u.id, name: u.name, role: u.role, bu: u.bu }))
  };
}

/* the API response for GET /projects/:id (internal fields removed) */
async function projectForApi(user, id) {
  const d = await projectDetail(user, id);
  delete d.pmName; delete d.isPm;
  return d;
}

async function updateDates(user, id, body) {
  const p = await M.Project.byId(id);
  if (!p) throw notFound();
  if (!access.canEditDates(user, p)) throw forbidden('Only the Delivery Head of this project or the PMO administrator can change its dates');
  const c = PD.clean({ start_date: body.start_date, end_date: body.end_date }, { current: p });
  if (c.errors.length) throw validation(c.errors.map(e => e.message).join('; '));
  const d = {};
  ['start_date', 'end_date'].forEach(k => { if (c.data[k] !== undefined) d[k] = c.data[k]; });
  await M.Project.updateDetails(p.id, d, user.id);
  await state.refresh(p.id, user.id);
  await M.AuditLog.log(user.id, 'project.dates', 'project', p.id, { from: [p.start_date, p.end_date], to: [d.start_date, d.end_date] });
}

/* ---------- weekly effort register ---------- */
async function weeklyRegister(user, id) {
  const s = await access.scopedProject(user, id);
  const rows = await M.WeeklyEffort.forProject(s.p.id);
  /* running totals so each week shows "to date" beside "this week" */
  const withCum = rows.map((r, i) => Object.assign({}, r, { to_date: W.cumulative(rows.slice(0, i + 1)) }));
  return { project: { id: s.p.id, code: s.p.code, name: s.p.name }, rows: withCum, cumulative: W.cumulative(rows), fields: W.FIELDS, groups: W.GROUPS, can_edit: s.canEdit };
}

async function saveWeeklyEffort(user, id, week, body) {
  const s = await access.scopedProject(user, id);
  if (!s.canEdit) throw forbidden();
  const wk = String(week).slice(0, 10);
  if (!isSunday(wk)) throw validation('The week must be given by its Sunday (week ending)');
  const c = W.clean(body || {});
  if (c.errors.length) throw validation(c.errors.map(e => `${e.label}: ${e.message}`).join(' · '));
  await M.WeeklyEffort.upsert(s.p.id, wk, c.data, user.id, 'form');
  await state.refresh(s.p.id, user.id, wk);
  await M.AuditLog.log(user.id, 'weekly.save', 'project', s.p.id, { week: wk });
}

/* ---------- history: the project as it stood each week ---------- */
const summaryOf = (d) => ({
  week: d.week, health: d.kpis.health, state: d.kpis.state, effort_variance_pct: d.kpis.effort_variance_pct, net_margin_pct: d.kpis.net_margin_pct,
  actual_hrs: d.effort.week ? d.effort.week.actual_hrs : null, planned_hrs: d.effort.week ? d.effort.week.planned_hrs : null,
  actual_to_date: d.effort.to_date ? d.effort.to_date.actual_hrs : null, planned_to_date: d.effort.to_date ? d.effort.to_date.planned_hrs : null,
  sp_completed: d.effort.week ? d.effort.week.sp_completed : null, sp_backlog: d.effort.week ? d.effort.week.sp_backlog : null,
  open_risks: d.kpis.open_risks, open_iad: d.kpis.open_iad, open_ncs: d.kpis.open_ncs, pci: d.kpis.pci,
  milestones_done: d.kpis.milestones_done, milestones_total: d.kpis.milestones_total, pct_completed: d.project.pct_completed,
  pm_rag: d.weekly_report ? d.weekly_report.pm_rag : null, narrative: d.weekly_report ? d.weekly_report.narrative : null
});

async function weeks(user, id) {
  const s = await access.scopedProject(user, id);
  const rows = await M.ProjectWeek.forProject(s.p.id);
  return { project: { id: s.p.id, code: s.p.code, name: s.p.name }, weeks: rows.map(r => Object.assign(summaryOf(JSON.parse(r.data)), { saved_at: r.saved_at })) };
}

async function weekData(pid, wk) {
  const row = await M.ProjectWeek.get(pid, wk);
  if (row) return Object.assign(JSON.parse(row.data), { saved_at: row.saved_at, stored: true });
  const st = await state.projectState(pid, wk);           // never saved: reconstruct from today's records
  return st ? Object.assign(state.snapshotOf(st), { stored: false }) : null;
}

async function week(user, id, wk) {
  const s = await access.scopedProject(user, id);
  return weekData(s.p.id, String(wk).slice(0, 10));
}

async function compare(user, id, a, b) {
  const s = await access.scopedProject(user, id);
  const A = await weekData(s.p.id, String(a || '').slice(0, 10)), B = await weekData(s.p.id, String(b || '').slice(0, 10));
  if (!A || !B) throw validation('Choose two weeks');
  return { a: A, b: B };
}

/* portfolio history for seniors: every visible project, last N weeks */
async function portfolioHistory(user, weeksParam) {
  const n = Math.max(4, Math.min(52, Number(weeksParam) || 12));
  const visible = await access.visibleTo(user);
  const ids = new Set(visible.map(p => p.id));
  const rows = (await M.ProjectWeek.all()).filter(r => ids.has(r.project_id));
  const wks = Array.from(new Set(rows.map(r => r.week_ending))).sort().slice(-n);
  const projects = visible.map(p => ({ id: p.id, code: p.code, name: p.name, bu: p.bu,
    weeks: wks.map(wk => { const r = rows.find(x => x.project_id === p.id && x.week_ending === wk); return r ? summaryOf(JSON.parse(r.data)) : { week: wk }; }) }));
  return { weeks: wks, projects };
}

module.exports = { projectDetail, projectForApi, updateDates, weeklyRegister, saveWeeklyEffort, weeks, week, compare, portfolioHistory };
