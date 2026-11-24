/* Portfolio: one row per visible project with every figure the dashboards need,
 * plus the open client items, risks and actions across that portfolio.
 */
const M = require('../models');
const access = require('./access.service');
const state = require('./project-state.service');
const PD = require('../domain/project-details');
const MX = require('../domain/metrics');
const RC = require('../domain/records');
const { days } = require('../domain/health');
const { today, weekEnding } = require('../utils/dates');

const sum = (list, key) => list.reduce((a, x) => a + Number(x[key] || 0), 0);

function portfolioRow(user, st, snaps, nameOf, thisWeek) {
  const p = st.eff, sr = st.sr, ms = st.milestones, rk = st.risks, dp = st.deps, h = st.health;
  const openMs = ms.filter(m => !RC.isDoneMilestone(m))
    .sort((a, b) => String(a.forecast_date || '9999').localeCompare(String(b.forecast_date || '9999')));
  const next = openMs[0] || null;
  const slip = next ? Math.max(0, days(next.baseline_date, next.forecast_date)) : 0;
  const openDeps = dp.filter(d => d.status !== 'Closed');
  /* why the score is what it is: the two weakest components and their weakest signal */
  const why = Object.keys(h.parts).sort((a, b) => h.parts[a] - h.parts[b]).slice(0, 2).map(k => {
    const low = (h.detail[k].basis || []).filter(x => x.score !== null).sort((a, b) => a.score - b.score)[0];
    return { component: h.labels[k], score: h.parts[k], signal: low ? `${low.label}: ${low.value}` : null };
  });
  const wk = st.weekly.find(w => w.week_ending === thisWeek) || null;
  const row = {
    id: p.id, code: p.code, name: p.name, client: p.client, bu: p.bu,
    project_type: p.project_type, commercial_basis: p.commercial_basis, status: p.status,
    pm: nameOf(p.pm_user_id), dh: nameOf(p.dh_user_id),
    contract_value: p.contract_value, margin_at_bid: p.margin_at_bid,
    health: h.index, state: h.state, health_parts: h.parts, health_weights: h.weights, health_labels: h.labels, health_why: why,
    spi: sr ? sr.spi : null, cpi: sr ? sr.cpi : null,
    margin_at_completion: sr ? sr.margin_at_completion : null,
    pct_complete: sr ? sr.pct_complete : null,
    budget_consumed_pct: sr ? sr.budget_consumed_pct : null,
    unbilled_wip: sr ? sr.unbilled_wip : null, ar_over_90: sr ? sr.ar_over_90 : null,
    week_ending: sr ? sr.week_ending : null, reported_at: sr ? sr.submitted_at : null,
    stale_days: sr ? days(sr.week_ending, today()) : null,
    next_milestone: next ? next.name : null,
    next_milestone_date: next ? next.forecast_date : null,
    next_milestone_baseline: next ? next.baseline_date : null,
    slip_days: slip,
    open_risks: rk.filter(r => r.status !== 'Closed').length,
    open_deps: openDeps.length,
    dep_value_blocked: openDeps.reduce((s2, d) => s2 + Number(d.value_blocked || 0), 0),
    oldest_dep_days: openDeps.reduce((mx, d) => Math.max(mx, days(d.raised_date, today())), 0),
    trend: snaps.filter(x => x.health_index !== null).map(x => x.health_index),
    trend_weeks: snaps.filter(x => x.health_index !== null).map(x => x.week_ending),
    pm_rag: sr ? sr.pm_rag : null, pm_rag_reason: sr ? sr.pm_rag_reason : null,
    start_date: p.start_date, end_date: p.end_date, stage: p.stage || null,
    presales_hours: p.presales_hours, budget_cr: p.budget_cr, budgeted_hours: p.budgeted_hours,
    expenses_budget_cr: p.expenses_budget_cr, planned_effort_hours: p.planned_effort_hours, planned_to_date: p.planned_to_date || null,
    actual_effort_hours: p.actual_effort_hours, actual_cost_cr: p.actual_cost_cr,
    details_updated_at: p.details_updated_at || null,
    baselined_effort_hours: p.baselined_effort_hours, delivery_methodology: p.delivery_methodology, technology: p.technology,
    project_category: p.project_category, timesheet_pct: p.timesheet_pct,
    pct_completed: p.pct_completed !== null && p.pct_completed !== undefined ? p.pct_completed : (sr ? sr.pct_complete : null),
    week_effort: wk ? { planned_hrs: wk.planned_hrs, actual_hrs: wk.actual_hrs, sp_completed: wk.sp_completed, source: wk.source } : null,
    cumulative: st.weekly.length ? st.cumulative : null,
    open_ncs: st.ncs.filter(n => n.status !== 'Closed').length,
    major_ncs: st.ncs.filter(n => n.status !== 'Closed' && n.severity === 'Major').length
  };
  Object.assign(row, PD.metrics(p));
  const msc = { completed: 0, in_progress: 0, on_hold: 0, yet_to_start: 0 };
  ms.forEach(m => { const k = RC.isDoneMilestone(m) ? 'completed' : m.status === 'On Hold' ? 'on_hold' : m.status === 'In Progress' ? 'in_progress' : 'yet_to_start'; msc[k]++; });
  row.milestone_counts = msc;
  row.current_milestone = next ? next.name : null;
  row.current_milestone_status = next ? next.status : null;
  row.current_milestone_signoff = next ? next.signoff_status : null;
  row.open_defects = sr ? sr.defects_open : null;
  row.total_defects = st.defects.length ? sum(st.defects, 'total') : null;
  row.open_issues = openDeps.filter(d => d.iad_type === 'Issue').length;
  row.open_dependencies = openDeps.filter(d => d.iad_type !== 'Issue').length;
  row.billed_cr = sum(st.billing.filter(b => b.status === 'Completed'), 'amount_cr');
  row.billing_open_cr = sum(st.billing.filter(b => b.status !== 'Completed'), 'amount_cr');
  const pci = st.pci.slice().sort((a2, b) => String(b.audit_date).localeCompare(String(a2.audit_date)));
  row.pci_score = pci.length ? pci[0].pci_score : null;
  row.pci_open_ncs = pci.length ? pci[0].open_ncs : null;
  row.pci_audit_date = pci.length ? pci[0].audit_date : null;
  row.defect_rate = (st.mx.find(m => m.key === 'defect_rate') || {}).value;
  row.process = st.mx.map(m => ({ key: m.key, value: m.value, status: m.status }));
  row.process_summary = MX.summary(st.mx);
  PD.FIELDS.filter(f => f.group === 'process').forEach(f => { row[f.key] = p[f.key]; });
  return access.redactProject(user, row);
}

async function portfolio(user) {
  const projects = await access.visibleTo(user);
  const users = await M.User.all();
  const nameOf = id => (users.find(u => u.id === id) || {}).name || '—';
  const thisWeek = weekEnding();
  const states = await Promise.all(projects.map(p => state.projectState(p.id)));
  const snapsAll = await Promise.all(projects.map(p => M.Snapshot.forProject(p.id)));
  const out = [];
  projects.forEach((p0, i) => {
    if (!states[i]) return;
    out.push(portfolioRow(user, states[i], snapsAll[i], nameOf, thisWeek));
  });
  return out;
}

/* Open client items, risks and actions across everything the user can see —
   the portfolio-level context for the clients screen, the pack and the AI brief. */
async function portfolioExtras(user, ps) {
  const ids = ps.map(p => p.id), byId = {};
  ps.forEach(p => byId[p.id] = p);
  const [deps, risks, acts, users] = await Promise.all([
    M.Dependency.forProjects(ids), M.Risk.forProjects(ids), M.ActionItem.all(), M.User.all()]);
  const t = today();
  return {
    deps: deps.filter(d => d.status !== 'Closed')
      .map(d => ({ p: byId[d.project_id], d, age: Math.max(0, days(d.raised_date, t)) }))
      .sort((a, b) => b.age - a.age),
    risks: risks.filter(r => r.status !== 'Closed')
      .map(r => ({ p: byId[r.project_id], r, age: Math.max(0, days(r.raised_date, t)) }))
      .sort((a, b) => b.age - a.age),
    actions: acts.filter(a => !a.project_id || byId[a.project_id] || a.owner_user_id === user.id).map(a => Object.assign({}, a, {
      project_code: a.project_id && byId[a.project_id] ? byId[a.project_id].code : null,
      owner_name: (users.find(u => u.id === a.owner_user_id) || {}).name || null
    }))
  };
}

/* Every open client item in scope, in one call. */
async function clientItems(user) {
  const ps = await portfolio(user);
  const ex = await portfolioExtras(user, ps);
  return ex.deps.map(({ p, d, age }) => ({
    project_id: p.id, code: p.code, name: p.name, client: p.client, dh: p.dh, age,
    ref: d.ref, description: d.description, owner_at_client: d.owner_at_client, raised_date: d.raised_date,
    committed_date: d.committed_date, milestone_blocked: d.milestone_blocked, status: d.status,
    iad_type: d.iad_type || 'Dependency', last_followup_date: d.last_followup_date, followup_mode: d.followup_mode,
    ...(user.role === 'pm' ? {} : { value_blocked: d.value_blocked })
  }));
}

module.exports = { portfolio, portfolioExtras, clientItems };
