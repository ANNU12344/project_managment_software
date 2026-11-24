/* Composite health index — computed, never typed.
 *
 * Version 2: measured against the organisation's own process performance baseline
 * (metricsToFollow.xlsx — LSL / Goal / USL) and the PMO project workbook. Each signal is
 * scored 0–100 by one rule, the component scores are averaged over the signals that have
 * data, and the index is the weighted average of six components. Weights are configurable.
 *
 * Scoring rule for a metric with a baseline:
 *   at or better than Goal            → 100
 *   between Goal and the limit        → 100 down to 75 (near the limit reads as Watch)
 *   outside the limit (LSL or USL)    → 59 down to 0 at twice the Goal–limit distance beyond it
 * so a metric outside its control limits always lands in the Intervene band for that signal.
 * A PM may override the band, but the override is logged with a reason.
 */
const DEFAULT_WEIGHTS = { schedule: 25, effort_cost: 25, quality: 20, risk: 15, compliance: 10, billing_people: 5 };
const LABELS = {
  schedule: 'Schedule', effort_cost: 'Effort & cost', quality: 'Quality', risk: 'Risk & dependencies',
  compliance: 'Process compliance', billing_people: 'Billing & people'
};
const BANDS = { green: 80, amber: 60 };

const clamp = (v, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));
const days = (a, b) => (!a || !b) ? 0 : Math.round((new Date(b) - new Date(a)) / 86400000);
const num = v => (v === null || v === undefined || v === '' || isNaN(Number(v))) ? null : Number(v);
const r0 = v => Math.round(v);

/* ---------- the one scoring rule, three directions ---------- */
function scoreAgainst(v, b, dir) {
  if (v === null || !b || b.goal === null || b.goal === undefined) return null;
  const { lsl, usl, goal } = b;
  const inside = (dist) => 100 - 25 * clamp(dist, 0, 1);
  const outside = (excess) => clamp(59 * (1 - excess / 2), 0, 59);
  if (dir === 'higher') {                                   // more is better (net margin, DRE…)
    if (v >= goal) return 100;
    if (lsl === null || v >= lsl) return inside((goal - v) / Math.max(goal - (lsl === null ? goal - 1 : lsl), 1e-9));
    return outside((lsl - v) / Math.max(goal - lsl, 1e-9));
  }
  if (dir === 'lower') {                                    // less is better (defect rate…)
    if (v <= goal) return 100;
    if (usl === null || v <= usl) return inside((v - goal) / Math.max((usl === null ? goal + 1 : usl) - goal, 1e-9));
    return outside((v - usl) / Math.max(usl - goal, 1e-9));
  }
  /* two-sided: on target is best (effort variance) */
  if (v >= goal) {
    if (usl === null || v <= usl) return inside((v - goal) / Math.max((usl === null ? goal + 1 : usl) - goal, 1e-9));
    return outside((v - usl) / Math.max(usl - goal, 1e-9));
  }
  if (lsl === null || v >= lsl) return inside((goal - v) / Math.max(goal - (lsl === null ? goal - 1 : lsl), 1e-9));
  return outside((lsl - v) / Math.max(goal - lsl, 1e-9));
}

/* Signals without a baseline use fixed, stated scales. */
const SCALES = {
  /* SVb %: on or ahead of plan 100; 10% late 75; 30% late or more 15 → 0 */
  svb: v => v <= 0 ? 100 : v <= 10 ? 100 - 2.5 * v : clamp(75 - (v - 10) * 3),
  /* SPI / CPI (earned value, from the weekly report): 1.00 → 100; 0.95 → 80; 0.85 → 40 */
  evIndex: v => clamp(100 - (1 - v) * 400),
  /* worst open milestone slip in days: 0 → 100; 10 → 75; 20 → 50 */
  slip: d => clamp(100 - d * 2.5),
  /* PCI %: ≥90 → 100; 80 → 75; 70 → 50; 50 or less → 0 */
  pci: v => v >= 90 ? 100 : v >= 80 ? 75 + (v - 80) * 2.5 : v >= 70 ? 50 + (v - 70) * 2.5 : clamp((v - 50) * 2.5),
  /* timesheet compliance %: 95 or more → 100; each point below costs 2 */
  timesheet: v => clamp(100 - Math.max(0, 95 - v) * 2)
};

/* Weighted average over the signals that have a score. Returns { score, basis, note }. */
function blend(signals, fallbackNote) {
  const have = signals.filter(s => s.score !== null && s.score !== undefined && !isNaN(s.score));
  if (!have.length) return { score: 70, basis: signals.map(s => Object.assign({}, s, { score: null })), note: fallbackNote || 'No data yet — scored 70 (unknown, not good)', noData: true };
  const tw = have.reduce((a, s) => a + s.w, 0);
  const score = have.reduce((a, s) => a + s.score * s.w, 0) / tw;
  return { score, basis: signals.map(s => Object.assign({}, s, { score: s.score === null || s.score === undefined ? null : r0(s.score) })) };
}
const fmt = (v, unit, dp) => v === null || v === undefined ? 'no data' : `${Number(v).toFixed(dp === undefined ? 1 : dp)}${unit || ''}`;
const metricOf = (mx, k) => (mx.find(m => m.key === k) || {}).value;
const baseOf = (mx, k) => { const m = mx.find(x => x.key === k) || {}; return { lsl: m.lsl, usl: m.usl, goal: m.goal }; };
const limTxt = b => b.goal === null || b.goal === undefined ? '' : ` (goal ${b.goal}, limits ${b.lsl}–${b.usl})`;

/* ---------- components ---------- */
function schedule(ctx) {
  const ms = ctx.milestones || [], asOf = ctx.asOf;
  const done = ms.filter(m => m.actual_date);
  const open = ms.filter(m => !m.actual_date && m.status !== 'Completed');
  const onTime = done.filter(m => m.baseline_date && days(m.baseline_date, m.actual_date) <= 0).length;
  const worst = open.reduce((a, m) => Math.max(a, Math.max(0, days(m.baseline_date, m.forecast_date || m.baseline_date))), 0);
  const overdue = open.filter(m => m.baseline_date && days(m.baseline_date, asOf) > 0).length;
  const svb = metricOf(ctx.mx, 'svb_pct');
  const spi = num(ctx.sr.spi);
  return blend([
    { label: 'Schedule variance (SVb)', value: fmt(svb, '%'), score: svb === null ? null : SCALES.svb(svb), w: 30, rule: 'On plan 100 · 10% late 75 · 30% late 15' },
    { label: 'Milestones completed on plan', value: done.length ? `${onTime} of ${done.length}` : 'none completed yet', score: done.length ? onTime / done.length * 100 : null, w: 20, rule: 'Share completed by their plan end date' },
    { label: 'Worst open milestone slip', value: open.length ? `${worst} days` : 'no open milestones', score: open.length ? SCALES.slip(worst) : null, w: 20, rule: '0 days 100 · 10 days 75 · 20 days 50' },
    { label: 'Open milestones past plan end', value: open.length ? String(overdue) : 'no open milestones', score: open.length ? clamp(100 - overdue * 20) : null, w: 10, rule: '−20 for each' },
    { label: 'SPI (weekly report)', value: fmt(spi, '', 2), score: spi === null ? null : SCALES.evIndex(spi), w: 20, rule: '1.00 → 100 · 0.95 → 80 · 0.85 → 40' }
  ]);
}

function effortCost(ctx) {
  const evb = metricOf(ctx.mx, 'evb_pct'), nm = metricOf(ctx.mx, 'net_margin_pct'), cpi = num(ctx.sr.cpi);
  const be = baseOf(ctx.mx, 'evb_pct'), bn = baseOf(ctx.mx, 'net_margin_pct');
  return blend([
    { label: 'Effort variance vs baseline (EVb)', value: fmt(evb, '%') + limTxt(be), score: scoreAgainst(evb, be, 'two'), w: 40, rule: 'Baseline: on goal best, both directions' },
    { label: 'Net margin', value: fmt(nm, '%') + limTxt(bn), score: scoreAgainst(nm, bn, 'higher'), w: 40, rule: 'Baseline: at or above goal is 100' },
    { label: 'CPI (weekly report)', value: fmt(cpi, '', 2), score: cpi === null ? null : SCALES.evIndex(cpi), w: 20, rule: '1.00 → 100 · 0.95 → 80 · 0.85 → 40' }
  ]);
}

function quality(ctx) {
  const mx = ctx.mx;
  const sig = [
    ['defect_rate', 'Defect rate', 'lower', 40, ''], ['dre', 'Defect removal efficiency', 'higher', 30, '%'],
    ['testing_efficiency', 'Testing efficiency', 'higher', 15, '%'], ['review_effectiveness', 'Review effectiveness', 'higher', 15, '%']
  ].map(([k, label, dir, w, unit]) => {
    const v = metricOf(mx, k), b = baseOf(mx, k);
    return { label, value: fmt(v, unit, unit ? 1 : 3) + limTxt(b), score: scoreAgainst(v, b, dir), w, rule: `Baseline: ${dir === 'lower' ? 'at or below' : 'at or above'} goal is 100` };
  });
  /* phase defect rates: the average of the four phase scores, and the worst one named */
  const phases = [['req_defect_rate', 'Requirement'], ['dd_defect_rate', 'Design & development'], ['testing_defect_rate', 'Testing'], ['uat_defect_rate', 'UAT']]
    .map(([k, n]) => ({ n, v: metricOf(mx, k), s: scoreAgainst(metricOf(mx, k), baseOf(mx, k), 'lower') })).filter(x => x.s !== null);
  const worstPh = phases.slice().sort((a, b) => a.s - b.s)[0];
  sig.push({ label: 'Defect rate by phase', value: phases.length ? `${phases.filter(x => x.s < 60).length} of ${phases.length} phases outside limits${worstPh && worstPh.s < 75 ? `; worst ${worstPh.n} ${worstPh.v.toFixed(3)}` : ''}` : 'no data',
    score: phases.length ? phases.reduce((a, x) => a + x.s, 0) / phases.length : null, w: 25, rule: 'Baseline per phase (goal 0.031, limits 0.013–0.049 per person-day); average of the phases' });
  if (ctx.project.project_type === 'AMC' && num(ctx.sr.sla_breaches) !== null) {
    const br = num(ctx.sr.sla_breaches);
    sig.push({ label: 'SLA breaches (AMC, weekly report)', value: String(br), score: clamp(100 - br * 18), w: 40, rule: '−18 for each breach' });
  }
  return blend(sig);
}

function risk(ctx) {
  const W = { High: 3, Medium: 2, Low: 1 };
  const risks = ctx.risks || [], deps = ctx.deps || [], asOf = ctx.asOf;
  const openRisks = risks.filter(r => r.status !== 'Closed'), openDeps = deps.filter(d => d.status !== 'Closed');
  let exposure = 0;
  openRisks.forEach(r => { exposure += (W[r.probability] || 1) * (W[r.impact] || 1) * (1 + Math.min(Math.max(0, days(r.raised_date, asOf)), 90) / 90); });
  let load = 0, stale = 0;
  openDeps.forEach(d => {
    load += 1 + Math.min(Math.max(0, days(d.raised_date, asOf)), 60) / 30;
    if (!d.last_followup_date || days(d.last_followup_date, asOf) > 14) stale++;
  });
  /* An empty RAID log is unknown, not risk-free: scoring it 100 would reward not keeping one. */
  const riskSig = risks.length ? clamp(100 - exposure * 1.8) : null;
  return blend([
    { label: 'Open RAID exposure', value: risks.length ? `${openRisks.length} open` : 'no RAID log', score: riskSig === null ? 75 : riskSig, w: 55, rule: 'probability × impact (1–9), doubling with age up to 90 days; −1.8 per point. Empty log scores 75' },
    { label: 'Open issues & dependencies', value: `${openDeps.length} open`, score: clamp(100 - load * 2.5), w: 30, rule: 'each open item −2.5, doubling at 30 days old' },
    { label: 'Issues & dependencies not followed up in 14 days', value: String(stale), score: openDeps.length ? clamp(100 - stale * 15) : null, w: 15, rule: '−15 for each' }
  ]);
}

function compliance(ctx) {
  const audits = (ctx.pci || []).slice().sort((a, b) => String(b.audit_date).localeCompare(String(a.audit_date)));
  const last = audits[0];
  const register = ctx.ncs || [];
  const open = register.filter(n => n.status !== 'Closed');
  const useRegister = register.length > 0;
  let pciSig = { label: 'Latest PCI audit', value: 'no audit recorded', score: null, w: 60, rule: '≥90% 100 · 80% 75 · 70% 50; capped at 80 if the audit is over 120 days old' };
  if (last) {
    const pci = num(last.pci_score), age = days(last.audit_date, ctx.asOf);
    let s = pci === null ? null : SCALES.pci(pci);
    if (!useRegister && s !== null) s = clamp(s - Math.min((num(last.open_ncs) || 0) * 3, 30));   // no NC register yet: use the audit's NC count
    if (s !== null && age > 120) s = Math.min(s, 80);
    pciSig = Object.assign(pciSig, { value: `${pci === null ? '—' : pci + '%'} on ${last.audit_date}${age > 120 ? ' (older than 120 days)' : ''}${useRegister ? '' : `, ${num(last.open_ncs) || 0} open NCs`}`, score: s,
      rule: useRegister ? pciSig.rule : pciSig.rule + '; −3 per open NC on the audit' });
  }
  /* the auditor's NC register: Major −15, Minor −6, Observation −2, and −5 more for each one past its due date */
  const W = { Major: 15, Minor: 6, Observation: 2 };
  const overdue = open.filter(n => n.due_date && days(n.due_date, ctx.asOf) > 0).length;
  const ncSig = { label: 'Open non-conformances (audit register)',
    value: useRegister ? `${open.length} open — ${open.filter(n => n.severity === 'Major').length} major, ${open.filter(n => n.severity === 'Minor').length} minor, ${open.filter(n => n.severity === 'Observation').length} observation; ${overdue} past due` : 'no NCs raised',
    score: useRegister ? clamp(100 - open.reduce((a, n) => a + (W[n.severity] || 6), 0) - overdue * 5) : null, w: 40,
    rule: 'Major −15 · Minor −6 · Observation −2 · −5 more for each past its due date' };
  return blend([pciSig, ncSig], 'No PCI audit or NC recorded — scored 70 (unknown, not good)');
}

function billingPeople(ctx) {
  const value = num(ctx.project.contract_value);
  const overdue = (ctx.billing || []).filter(b => b.status !== 'Completed' && b.billing_date && days(b.billing_date, ctx.asOf) > 0);
  const overdueCr = overdue.reduce((a, b) => a + (num(b.amount_cr) || 0), 0);
  const ts = num(ctx.project.timesheet_pct) !== null ? num(ctx.project.timesheet_pct) : num(ctx.sr.timesheet_compliance);
  const over = num(ctx.sr.over_allocated), attr = num(ctx.sr.attrition_flag);
  return blend([
    { label: 'Billing past its date, not invoiced', value: (ctx.billing || []).length ? `₹${overdueCr.toFixed(2)} Cr` : 'no billing plan', score: (ctx.billing || []).length && value ? clamp(100 - overdueCr / value * 100 * 5) : null, w: 50, rule: '−5 per 1% of project value overdue' },
    { label: 'Timesheet compliance', value: fmt(ts, '%', 0), score: ts === null ? null : SCALES.timesheet(ts), w: 30, rule: '95% or more 100; −2 per point below' },
    { label: 'Over-allocation & resignations (weekly report)', value: over === null && attr === null ? 'no data' : `${over || 0} over-allocated, ${attr ? 'resignation' : 'no resignation'}`, score: over === null && attr === null ? null : clamp(100 - (over || 0) * 7 - (attr || 0) * 15), w: 20, rule: '−7 per person over 100%, −15 for a resignation' }
  ]);
}

function bandOf(score) { return score >= BANDS.green ? 'g' : score >= BANDS.amber ? 'a' : 'r'; }
const STATE_NAME = { g: 'On track', a: 'Watch', r: 'Intervene' };

/* Stored weights from before version 2 used other components; use the defaults until an
   administrator saves weights for these six. */
function weightsFrom(stored) {
  const keys = Object.keys(DEFAULT_WEIGHTS);
  const ok = stored && keys.every(k => typeof stored[k] === 'number') && Object.keys(stored).every(k => keys.indexOf(k) >= 0);
  return Object.assign({}, ok ? stored : DEFAULT_WEIGHTS);
}

/* ctx: { project (with process inputs), sr (latest weekly report or {}), milestones, risks, deps,
          defects, pci, billing, mx (evaluated process metrics), asOf } */
function computeV2(ctx, stored) {
  const w = weightsFrom(stored);
  const total = Object.values(w).reduce((a, b) => a + b, 0) || 100;
  ctx.sr = ctx.sr || {};
  const detail = { schedule: schedule(ctx), effort_cost: effortCost(ctx), quality: quality(ctx), risk: risk(ctx), compliance: compliance(ctx), billing_people: billingPeople(ctx) };
  const parts = {};
  Object.keys(detail).forEach(k => { parts[k] = r0(detail[k].score); });
  const index = r0(Object.keys(parts).reduce((sum, k) => sum + detail[k].score * (w[k] || 0), 0) / total);
  return { index, state: bandOf(index), stateName: STATE_NAME[bandOf(index)], parts, weights: w, labels: LABELS, detail, version: 2 };
}

module.exports = { computeV2, scoreAgainst, weightsFrom, bandOf, STATE_NAME, DEFAULT_WEIGHTS, LABELS, BANDS, SCALES, days };
