/* Weekly effort & process entries.
 *
 * Project managers record each week's effort (planned and actual hours, split by phase), review
 * effort and findings, optional size and requirement counts, and agile story points. A timesheet
 * upload fills the hours for them. Everything cumulative ("to date") is the sum of the weeks —
 * except the backlog, which is the latest week's figure.
 *
 * When a project has weekly rows, they replace the single cumulative figures on the project, so
 * every metric, the health index and the dashboards use the weekly data.
 */

/* agg: sum = add the weeks · last = latest week's value. group drives the on-screen grouping. */
const FIELDS = [
  { key: 'planned_hrs', h: 'Planned Hours', label: 'Planned hours', group: 'effort', agg: 'sum', hint: 'Hours planned for this week' },
  { key: 'actual_hrs', h: 'Actual Hours', label: 'Actual hours', group: 'effort', agg: 'sum', hint: 'Hours booked this week (from timesheets when uploaded)' },
  { key: 'req_hrs', h: 'Requirement & SRS Hours', label: 'Requirement & SRS', group: 'phase', agg: 'sum' },
  { key: 'design_hrs', h: 'Design Hours', label: 'Design', group: 'phase', agg: 'sum' },
  { key: 'dev_hrs', h: 'Development Hours', label: 'Development', group: 'phase', agg: 'sum' },
  { key: 'testing_hrs', h: 'Testing Hours', label: 'Testing', group: 'phase', agg: 'sum' },
  { key: 'uat_hrs', h: 'UAT Support Hours', label: 'UAT support', group: 'phase', agg: 'sum' },
  { key: 'pm_hrs', h: 'Project Management Hours', label: 'Project management', group: 'phase', agg: 'sum' },
  { key: 'review_hrs', h: 'Review Hours (all reviews)', label: 'Review, all', group: 'review', agg: 'sum' },
  { key: 'design_review_hrs', h: 'Design Review Hours', label: 'Design review hours', group: 'review', agg: 'sum' },
  { key: 'code_review_hrs', h: 'Code Review Hours', label: 'Code review hours', group: 'review', agg: 'sum' },
  { key: 'design_review_defects', h: 'Design Review Defects', label: 'Design review defects', group: 'review', agg: 'sum' },
  { key: 'code_review_defects', h: 'Code Review Defects', label: 'Code review defects', group: 'review', agg: 'sum' },
  { key: 'post_delivery_defects', h: 'Post-delivery Defects', label: 'Post-delivery defects', group: 'review', agg: 'sum' },
  { key: 'size_fp', h: 'Size Delivered (FP) — optional', label: 'Size delivered, FP (optional)', group: 'size', agg: 'sum', optional: true },
  { key: 'requirements_added', h: 'Requirements Added — optional', label: 'Requirements added (optional)', group: 'size', agg: 'sum', optional: true },
  { key: 'requirement_changes', h: 'Requirement Changes — optional', label: 'Requirement changes (optional)', group: 'size', agg: 'sum', optional: true },
  { key: 'sp_planned', h: 'Story Points Planned', label: 'Story points planned', group: 'agile', agg: 'sum', optional: true },
  { key: 'sp_completed', h: 'Story Points Completed', label: 'Story points completed', group: 'agile', agg: 'sum', optional: true },
  { key: 'sp_backlog', h: 'Backlog (story points)', label: 'Backlog, story points', group: 'agile', agg: 'last', optional: true, hint: 'Story points left in the backlog at week end' }
];
const GROUPS = {
  effort: 'Effort', phase: 'Effort by phase (hours)', review: 'Reviews and defects found',
  size: 'Size and requirements (optional)', agile: 'Agile — story points (optional)'
};
const KEYS = FIELDS.map(f => f.key);
const HOURS_FROM_TIMESHEET = ['actual_hrs', 'req_hrs', 'design_hrs', 'dev_hrs', 'testing_hrs', 'uat_hrs', 'pm_hrs', 'review_hrs', 'design_review_hrs', 'code_review_hrs'];

const num = v => (v === null || v === undefined || v === '' || isNaN(Number(v))) ? null : Number(v);
const r1 = v => Math.round(v * 10) / 10;

/* Validate a weekly row from the form or a sheet (keyed by field key). */
function clean(raw) {
  const data = {}, errors = [];
  for (const f of FIELDS) {
    if (!(f.key in raw)) continue;
    const s = String(raw[f.key] === null || raw[f.key] === undefined ? '' : raw[f.key]).trim();
    if (s === '') { data[f.key] = null; continue; }
    const x = Number(s.replace(/,/g, ''));
    if (isNaN(x)) errors.push({ key: f.key, label: f.label, message: 'Must be a number' });
    else if (x < 0) errors.push({ key: f.key, label: f.label, message: 'Cannot be negative' });
    else if (f.group !== 'agile' && f.group !== 'size' && f.group !== 'review' && x > 10000) errors.push({ key: f.key, label: f.label, message: 'More than 10,000 hours in one week — check the figure' });
    else data[f.key] = x;
  }
  if ('remarks' in raw) data.remarks = String(raw.remarks || '').slice(0, 1000) || null;
  return { data, errors };
}

/* Cumulative totals over the weeks given (sorted by week). */
function cumulative(rows) {
  const sorted = (rows || []).slice().sort((a, b) => String(a.week_ending).localeCompare(String(b.week_ending)));
  const out = { weeks: sorted.length, first_week: sorted.length ? sorted[0].week_ending : null, last_week: sorted.length ? sorted[sorted.length - 1].week_ending : null };
  for (const f of FIELDS) {
    const vals = sorted.map(r => num(r[f.key])).filter(v => v !== null);
    out[f.key] = !vals.length ? null : f.agg === 'last' ? vals[vals.length - 1] : r1(vals.reduce((a, b) => a + b, 0));
  }
  /* agile summary */
  const sp = sorted.filter(r => num(r.sp_completed) !== null);
  const last4 = sp.slice(-4);
  out.velocity = last4.length ? r1(last4.reduce((a, r) => a + num(r.sp_completed), 0) / last4.length) : null;
  out.sp_completion_pct = out.sp_planned ? r1(out.sp_completed / out.sp_planned * 100) : null;
  out.weeks_of_backlog = out.velocity && out.sp_backlog !== null ? r1(out.sp_backlog / out.velocity) : null;
  return out;
}

/* The project with its cumulative figures taken from the weekly rows (when there are any).
 * Effort variance then compares actual to date with planned to date; EVb compares actual to date
 * with the baseline pro-rated to date (baseline × planned to date ÷ revised plan). */
function effective(project, rows) {
  if (!rows || !rows.length) return project;
  const c = cumulative(rows);
  const p = Object.assign({}, project);
  const set = (key, v) => { if (v !== null && v !== undefined) p[key] = v; };
  set('actual_effort_hours', c.actual_hrs);
  p.planned_to_date = c.planned_hrs;
  set('req_effort_hrs', c.req_hrs);
  set('design_effort_hrs', c.design_hrs);
  set('dev_effort_hrs', c.dev_hrs);
  set('testing_effort_hrs', c.testing_hrs);
  set('uat_effort_hrs', c.uat_hrs);
  set('review_effort_hrs', c.review_hrs);
  set('design_review_hrs', c.design_review_hrs);
  set('code_review_hrs', c.code_review_hrs);
  set('design_review_defects', c.design_review_defects);
  set('code_review_defects', c.code_review_defects);
  set('post_delivery_defects', c.post_delivery_defects);
  set('size_delivered', c.size_fp);
  set('total_requirements', c.requirements_added);
  set('requirement_changes', c.requirement_changes);
  const base = num(project.baselined_effort_hours), plan = num(project.planned_effort_hours);
  if (c.planned_hrs) p.baseline_to_date = base && plan ? r1(base * c.planned_hrs / plan) : c.planned_hrs;
  p.weekly = c;
  return p;
}

module.exports = { FIELDS, GROUPS, KEYS, HOURS_FROM_TIMESHEET, clean, cumulative, effective };
