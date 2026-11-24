/* Process performance metrics — the organisation's standard set, measured per project
 * against the process performance baseline (LSL / Goal / USL / Stdev).
 *
 * Definitions follow common CMMi practice and are written once here: the server value,
 * the on-screen "how calculated" text and the Excel template formula all come from this file.
 * QA can correct a definition here and every screen, export and template follows.
 *
 * Inputs are cumulative to date (server/project-details.js, group 'process').
 * 1 person-day = 8 hours.
 */

const PD_HOURS = 8;

const num = v => (v === null || v === undefined || v === '') ? null : Number(v);
const all = (...v) => v.every(x => x !== null && !isNaN(x));
const pd = h => h / PD_HOURS;
const sum = a => a.reduce((s, x) => s + x, 0);
/* All pre-delivery defects: the defects-sheet total when there is one, else the four phase counts. */
const pre = p => num(p.total_defects) !== null ? [num(p.total_defects)] : [p.req_defects, p.design_dev_defects, p.testing_defects, p.uat_defects].map(num);

/* Defect counts derived from the defects sheet (type × phase injected), when the project has rows there:
   requirement = injected in Initiation/Requirement · design & dev = injected in Prototypes/Design & Development ·
   testing = found by Internal Testing Review · UAT = found by External Testing Review ·
   review = found by Internal/External Review · total = every row. */
function withDefects(p, rows) {
  if (!rows || !rows.length) return p;
  const t = f => sum(rows.filter(f).map(r => Number(r.total || 0)));
  return Object.assign({}, p, {
    req_defects: t(r => ['Initiation', 'Requirement'].indexOf(r.phase_injected) >= 0),
    design_dev_defects: t(r => ['Prototypes', 'Design & Development'].indexOf(r.phase_injected) >= 0),
    testing_defects: t(r => r.defect_type === 'Internal Testing Review'),
    uat_defects: t(r => r.defect_type === 'External Testing Review'),
    review_defects: t(r => r.defect_type === 'Internal Review' || r.defect_type === 'External Review'),
    total_defects: t(() => true),
    reopened_defects: sum(rows.map(r => Number(r.reopen_count || 0)))
  });
}

/* Baseline from metricsToFollow.xlsx. Percent metrics are held as percent numbers (47.39 = 47.39%).
   null limits mean the metric is tracked but has no control limits yet. */
const BASELINE = {
  net_margin_pct:        { lsl: 41.28, usl: 53.50, goal: 47.39, sd: 2.04 },
  evb_pct:               { lsl: -17.69, usl: 9.90, goal: -3.89, sd: 4.60 },
  defect_rate:           { lsl: 0, usl: 0.071, goal: 0.04, sd: 0.012 },
  productivity:          { lsl: null, usl: null, goal: null, sd: null },
  req_effort_pct:        { lsl: 16.87, usl: 89.36, goal: 53.12, sd: 12.08 },
  design_effort_pct:     { lsl: 3.01, usl: 9.15, goal: 6.08, sd: 1.02 },
  dev_effort_pct:        { lsl: null, usl: null, goal: null, sd: null },
  req_defect_rate:       { lsl: 0.013, usl: 0.049, goal: 0.031, sd: 0.006 },
  dd_defect_rate:        { lsl: 0.013, usl: 0.049, goal: 0.031, sd: 0.006 },
  testing_defect_rate:   { lsl: 0.013, usl: 0.049, goal: 0.031, sd: 0.006 },
  uat_defect_rate:       { lsl: 0.013, usl: 0.049, goal: 0.031, sd: 0.006 },
  rsi:                   { lsl: null, usl: null, goal: null, sd: null },
  review_effectiveness:  { lsl: 50, usl: 70, goal: 60, sd: 3.33 },
  testing_efficiency:    { lsl: 70, usl: 100, goal: 85, sd: 5 },
  dre:                   { lsl: 70, usl: 100, goal: 85, sd: 5 },
  svb_pct:               { lsl: null, usl: null, goal: null, sd: null },
  design_review_eff:     { lsl: 0.33, usl: 1.19, goal: 0.76, sd: 0.143 },
  code_review_eff:       { lsl: 0.024, usl: 0.675, goal: 0.35, sd: 0.109 },
  review_effort_pct:     { lsl: 3.09, usl: 7.00, goal: 5.04, sd: 0.65 }
};

/* c(key) returns the template cell for an input, so each Excel formula mirrors calc(). */
const METRICS = [
  { key: 'net_margin_pct', label: 'Net margin %', unit: '%', dp: 2,
    formula: '(Project value − Total actual cost) ÷ Project value × 100',
    calc: p => { const v = num(p.contract_value), c = num(p.actual_cost_cr); return all(v, c) && v ? (v - c) / v * 100 : null; },
    excel: c => `(${c('contract_value')}-${c('actual_cost_cr')})/${c('contract_value')}*100` },
  { key: 'evb_pct', label: 'Effort variance baseline (EVb) %', unit: '%', dp: 2,
    formula: '(Actual efforts − Baselined efforts) ÷ Baselined efforts × 100. With weekly entries: actual to date against the baseline pro-rated to date (baseline × planned to date ÷ revised plan)',
    calc: p => { const a = num(p.actual_effort_hours), pl = num(p.baseline_to_date) || num(p.baselined_effort_hours) || num(p.planned_effort_hours); return all(a, pl) && pl ? (a - pl) / pl * 100 : null; },
    excel: c => `(${c('actual_effort_hours')}-IF(N(${c('baselined_effort_hours')})>0,${c('baselined_effort_hours')},${c('planned_effort_hours')}))/IF(N(${c('baselined_effort_hours')})>0,${c('baselined_effort_hours')},${c('planned_effort_hours')})*100` },
  { key: 'defect_rate', label: 'Defect rate', unit: 'per person-day', dp: 3,
    formula: 'All defects (every row on the defects sheet + post-delivery) ÷ Actual effort in person-days',
    calc: p => { const d = pre(p).concat([num(p.post_delivery_defects)]), a = num(p.actual_effort_hours); return all(...d, a) && a ? sum(d) / pd(a) : null; },
    excel: c => `(${c('total_defects')}+${c('post_delivery_defects')})/(${c('actual_effort_hours')}/${PD_HOURS})` },
  { key: 'productivity', label: 'Productivity', unit: 'FP per person-day', dp: 3,
    formula: 'Size delivered (function points) ÷ Actual effort in person-days',
    calc: p => { const s = num(p.size_delivered), a = num(p.actual_effort_hours); return all(s, a) && a ? s / pd(a) : null; },
    excel: c => `${c('size_delivered')}/(${c('actual_effort_hours')}/${PD_HOURS})` },
  { key: 'req_effort_pct', label: 'Requirement analysis & SRS effort %', unit: '%', dp: 2,
    formula: 'Requirement analysis & SRS effort ÷ Actual effort × 100',
    calc: p => { const r = num(p.req_effort_hrs), a = num(p.actual_effort_hours); return all(r, a) && a ? r / a * 100 : null; },
    excel: c => `${c('req_effort_hrs')}/${c('actual_effort_hours')}*100` },
  { key: 'design_effort_pct', label: 'Design integration with application effort %', unit: '%', dp: 2,
    formula: 'Design integration effort ÷ Actual effort × 100',
    calc: p => { const r = num(p.design_effort_hrs), a = num(p.actual_effort_hours); return all(r, a) && a ? r / a * 100 : null; },
    excel: c => `${c('design_effort_hrs')}/${c('actual_effort_hours')}*100` },
  { key: 'dev_effort_pct', label: 'Module development effort %', unit: '%', dp: 2,
    formula: 'Module development effort ÷ Actual effort × 100',
    calc: p => { const r = num(p.dev_effort_hrs), a = num(p.actual_effort_hours); return all(r, a) && a ? r / a * 100 : null; },
    excel: c => `${c('dev_effort_hrs')}/${c('actual_effort_hours')}*100` },
  { key: 'req_defect_rate', label: 'Requirement defect rate', unit: 'per person-day', dp: 3,
    formula: 'Defects injected in Initiation/Requirement ÷ Requirement & SRS effort in person-days',
    calc: p => { const d = num(p.req_defects), h = num(p.req_effort_hrs); return all(d, h) && h ? d / pd(h) : null; },
    excel: c => `${c('req_defects')}/(${c('req_effort_hrs')}/${PD_HOURS})` },
  { key: 'dd_defect_rate', label: 'Design & development defect rate', unit: 'per person-day', dp: 3,
    formula: 'Defects injected in Prototypes/Design & Development ÷ (Design integration + Module development effort) in person-days',
    calc: p => { const d = num(p.design_dev_defects), a = num(p.design_effort_hrs), b = num(p.dev_effort_hrs); return all(d, a, b) && (a + b) ? d / pd(a + b) : null; },
    excel: c => `${c('design_dev_defects')}/((${c('design_effort_hrs')}+${c('dev_effort_hrs')})/${PD_HOURS})` },
  { key: 'testing_defect_rate', label: 'Testing defect rate', unit: 'per person-day', dp: 3,
    formula: 'Defects found by Internal Testing Review ÷ Testing effort in person-days',
    calc: p => { const d = num(p.testing_defects), h = num(p.testing_effort_hrs); return all(d, h) && h ? d / pd(h) : null; },
    excel: c => `${c('testing_defects')}/(${c('testing_effort_hrs')}/${PD_HOURS})` },
  { key: 'uat_defect_rate', label: 'UAT defect rate', unit: 'per person-day', dp: 3,
    formula: 'Defects found by External Testing Review ÷ UAT support effort in person-days',
    calc: p => { const d = num(p.uat_defects), h = num(p.uat_effort_hrs); return all(d, h) && h ? d / pd(h) : null; },
    excel: c => `${c('uat_defects')}/(${c('uat_effort_hrs')}/${PD_HOURS})` },
  { key: 'rsi', label: 'Requirement stability index (RSI)', unit: '%', dp: 2,
    formula: '(1 − Requirement changes ÷ Total requirements) × 100',
    calc: p => { const ch = num(p.requirement_changes), t = num(p.total_requirements); return all(ch, t) && t ? (1 - ch / t) * 100 : null; },
    excel: c => `(1-${c('requirement_changes')}/${c('total_requirements')})*100` },
  { key: 'review_effectiveness', label: 'Review effectiveness (RE)', unit: '%', dp: 2,
    formula: 'Defects found by Internal + External Review ÷ All pre-delivery defects (defects sheet) × 100',
    calc: p => { const r = num(p.review_defects), d = pre(p); return all(r, ...d) && sum(d) ? r / sum(d) * 100 : null; },
    excel: c => `${c('review_defects')}/${c('total_defects')}*100` },
  { key: 'testing_efficiency', label: 'Testing efficiency (TE)', unit: '%', dp: 2,
    formula: 'Internal Testing Review defects ÷ (Internal + External Testing Review defects) × 100',
    calc: p => { const t = num(p.testing_defects), u = num(p.uat_defects); return all(t, u) && (t + u) ? t / (t + u) * 100 : null; },
    excel: c => `${c('testing_defects')}/(${c('testing_defects')}+${c('uat_defects')})*100` },
  { key: 'dre', label: 'Defect removal efficiency (DRE)', unit: '%', dp: 2,
    formula: 'Pre-delivery defects ÷ (Pre-delivery + Post-delivery defects) × 100',
    calc: p => { const d = pre(p), post = num(p.post_delivery_defects); return all(...d, post) && (sum(d) + post) ? sum(d) / (sum(d) + post) * 100 : null; },
    excel: c => `${c('total_defects')}/(${c('total_defects')}+${c('post_delivery_defects')})*100` },
  { key: 'svb_pct', label: 'Schedule variance baseline (SVb) %', unit: '%', dp: 2,
    formula: '(Forecast end date − Baseline end date) ÷ (Baseline end date − Start date) × 100',
    calc: p => {
      if (!p.start_date || !p.end_date || !p.forecast_end_date) return null;
      const d = x => new Date(String(x).slice(0, 10)).getTime();
      const dur = d(p.end_date) - d(p.start_date);
      return dur > 0 ? (d(p.forecast_end_date) - d(p.end_date)) / dur * 100 : null;
    },
    excel: null },   // dates are typed as text in the sheet, so SVb is computed on upload, not in Excel
  { key: 'design_review_eff', label: 'Design review efficiency', unit: 'defects per review hour', dp: 3,
    formula: 'Design review defects ÷ Design review effort (hrs)',
    calc: p => { const d = num(p.design_review_defects), h = num(p.design_review_hrs); return all(d, h) && h ? d / h : null; },
    excel: c => `${c('design_review_defects')}/${c('design_review_hrs')}` },
  { key: 'code_review_eff', label: 'Code review efficiency', unit: 'defects per review hour', dp: 3,
    formula: 'Code review defects ÷ Code review effort (hrs)',
    calc: p => { const d = num(p.code_review_defects), h = num(p.code_review_hrs); return all(d, h) && h ? d / h : null; },
    excel: c => `${c('code_review_defects')}/${c('code_review_hrs')}` },
  { key: 'review_effort_pct', label: 'Review effort %', unit: '%', dp: 2,
    formula: 'Review effort (all reviews) ÷ Actual effort × 100',
    calc: p => { const r = num(p.review_effort_hrs), a = num(p.actual_effort_hours); return all(r, a) && a ? r / a * 100 : null; },
    excel: c => `${c('review_effort_hrs')}/${c('actual_effort_hours')}*100` }
];

const round = (v, dp) => v === null || !isFinite(v) ? null : Math.round(v * Math.pow(10, dp)) / Math.pow(10, dp);

/* within / below / above the control limits; tracked when the baseline has no limits; nodata without inputs */
function statusOf(v, b) {
  if (v === null) return 'nodata';
  if (!b || (b.lsl === null && b.usl === null)) return 'tracked';
  if (b.lsl !== null && v < b.lsl) return 'below';
  if (b.usl !== null && v > b.usl) return 'above';
  return 'within';
}

/* All metrics for one project, against the given baseline (defaults to BASELINE). */
function evaluate(p, baseline) {
  const B = Object.assign({}, BASELINE, baseline || {});
  return METRICS.map(m => {
    const value = round(m.calc(p), m.dp);
    const b = B[m.key] || {};
    const z = value !== null && b.goal !== null && b.goal !== undefined && b.sd ? round((value - b.goal) / b.sd, 2) : null;
    return { key: m.key, label: m.label, unit: m.unit, formula: m.formula, value,
      lsl: b.lsl, usl: b.usl, goal: b.goal, sd: b.sd, status: statusOf(value, b), z };
  });
}
function summary(list) {
  const c = { within: 0, below: 0, above: 0, tracked: 0, nodata: 0 };
  list.forEach(x => c[x.status]++);
  return Object.assign(c, { out: c.below + c.above, measured: c.within + c.below + c.above });
}

/* Validate an admin edit of the baseline: numbers or blank, LSL ≤ Goal ≤ USL, sd ≥ 0. */
function cleanBaseline(input) {
  const out = {}, errors = [];
  for (const m of METRICS) {
    const r = (input || {})[m.key]; if (!r) continue;
    const g = k => (r[k] === '' || r[k] === null || r[k] === undefined) ? null : Number(r[k]);
    const b = { lsl: g('lsl'), usl: g('usl'), goal: g('goal'), sd: g('sd') };
    if (Object.values(b).some(x => x !== null && isNaN(x))) { errors.push(`${m.label}: limits must be numbers`); continue; }
    if (b.lsl !== null && b.usl !== null && b.lsl > b.usl) errors.push(`${m.label}: LSL is above USL`);
    if (b.goal !== null && ((b.lsl !== null && b.goal < b.lsl) || (b.usl !== null && b.goal > b.usl))) errors.push(`${m.label}: goal is outside LSL–USL`);
    if (b.sd !== null && b.sd < 0) errors.push(`${m.label}: standard deviation cannot be negative`);
    out[m.key] = b;
  }
  return { baseline: out, errors };
}

/* Column name a metric gets in the template, e.g. NET_MARGIN_PCT. */
const colName = m => m.key.toUpperCase();

module.exports = { withDefects, colName, METRICS, BASELINE, PD_HOURS, evaluate, summary, statusOf, cleanBaseline };
