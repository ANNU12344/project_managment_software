/* Project details — the engagement master data a project manager maintains, laid out as the
 * PMO workbook (projectdetails.xlsx) lays it out:
 *   Project Information · Project Performance · Process Metrics (inputs the CMMi metrics need)
 *
 * One list drives the database columns, the upload sheets, the Excel template, the on-screen
 * form and the exports. h is the header on the sheet (with the workbook's own spellings);
 * alias holds other spellings and the older machine names, so earlier templates still upload.
 * Money is in rupees crore, effort in hours.
 */
const { LISTS } = require('./records');

const STAGES = LISTS.stage, STATUSES = LISTS.projectStatus, TYPES = LISTS.projectType;
const SHEET_INFO = 'Project Information', SHEET_PERF = 'Project Performance', SHEET_PROC = 'Process Metrics';

/* key = projects column · kind = num | pct | date | pick | text · hidden = kept in the database but
   derived from the defects sheet, so never typed */
const FIELDS = [
  { key: 'name', sheet: SHEET_INFO, h: 'Project Name', alias: ['PROJECT_NAME'], label: 'Project name', kind: 'text', eg: 'Bihar RAMP CIMS Platform' },
  { key: 'start_date', sheet: SHEET_INFO, h: 'Project Start Date', alias: ['PROJECT_START_DATE'], label: 'Project start date', kind: 'date', eg: '01-04-2026' },
  { key: 'end_date', sheet: SHEET_INFO, h: 'Project End Date', alias: ['PROJECT_END_DATE'], label: 'Project end date', kind: 'date', hint: 'On or after the start date', eg: '31-03-2027' },
  { key: 'stage', sheet: SHEET_INFO, h: 'Project Stage', alias: ['PROJECT_STAGE'], label: 'Project stage', kind: 'pick', options: STAGES, eg: 'Design & Development' },
  { key: 'status', sheet: SHEET_INFO, h: 'Project Status', alias: ['PROJECT_STATUS'], label: 'Project status', kind: 'pick', options: STATUSES, eg: 'In Progress' },
  { key: 'project_type', sheet: SHEET_INFO, h: 'Project Type', alias: ['PROJECT_TYPE'], label: 'Project type', kind: 'pick', options: TYPES, eg: 'Fixed Price' },
  { key: 'presales_hours', sheet: SHEET_INFO, h: 'Presales efforts (hrs)', alias: ['PRESALES_EFFORT_HRS'], label: 'Presales efforts (hrs)', kind: 'num', hint: 'Hours spent before the order', eg: '320' },
  { key: 'contract_value', sheet: SHEET_INFO, h: 'Project Value', alias: ['PROJECT_VALUE_CR', 'Project Value (₹ Cr)'], label: 'Project value (₹ Cr)', kind: 'num', hint: 'Rupees crore, order value', eg: '12.6' },
  { key: 'budget_cr', sheet: SHEET_INFO, h: 'Project Budget', alias: ['PROJECT_BUDGET_CR', 'Project Budget (₹ Cr)'], label: 'Project budget (₹ Cr)', kind: 'num', hint: 'Rupees crore, approved cost budget', eg: '9.1' },
  { key: 'budgeted_hours', sheet: SHEET_INFO, h: 'Budgeted Hours', alias: ['BUDGETED_HOURS'], label: 'Budgeted hours', kind: 'num', hint: 'Hours in the approved budget', eg: '14720' },
  { key: 'baselined_effort_hours', sheet: SHEET_INFO, h: 'Baslined Efforts (hrs)', alias: ['Baselined Efforts (hrs)', 'Baseline Efforts (hrs)'], label: 'Baselined efforts (hrs)', kind: 'num', hint: 'Effort in the frozen baseline plan', eg: '14000' },
  { key: 'planned_effort_hours', sheet: SHEET_INFO, h: 'Revised Planned Efforts (hrs)', alias: ['PLANNED_EFFORT_HRS', 'Planned Efforts (hrs)'], label: 'Revised planned efforts (hrs)', kind: 'num', hint: 'Current plan after approved changes', eg: '14600' },
  { key: 'delivery_methodology', sheet: SHEET_INFO, h: 'Delivery Methodology', label: 'Delivery methodology', kind: 'text', eg: 'Agile (Scrum)' },
  { key: 'technology', sheet: SHEET_INFO, h: 'Technology / Platform', alias: ['Technology', 'Platform'], label: 'Technology / platform', kind: 'text', eg: 'Java, React, PostgreSQL' },
  { key: 'project_category', sheet: SHEET_INFO, h: 'Project Category', label: 'Project category', kind: 'pick', options: LISTS.category, eg: 'NICSI' },

  { key: 'actual_effort_hours', sheet: SHEET_PERF, h: 'Acctual efforts (hrs)', alias: ['ACTUAL_EFFORT_HRS', 'Actual efforts (hrs)'], label: 'Actual efforts (hrs)', kind: 'num', hint: 'Hours booked to date, from timesheets', eg: '9240' },
  { key: 'pct_completed', sheet: SHEET_PERF, h: 'Percentage Completed', label: 'Percentage completed', kind: 'pct', eg: '54' },
  { key: 'expenses_budget_cr', sheet: SHEET_PERF, h: 'Expenses Budget', alias: ['EXPENSES_BUDGET_CR', 'Expenses Budget (₹ Cr)'], label: 'Expenses budget (₹ Cr)', kind: 'num', hint: 'Rupees crore, non-manpower expenses', eg: '0.6' },
  { key: 'timesheet_pct', sheet: SHEET_PERF, h: 'Timesheet compliance %', label: 'Timesheet compliance %', kind: 'pct', eg: '92' },
  { key: 'actual_cost_cr', sheet: SHEET_PERF, h: 'Actual Cost (₹ Cr)', alias: ['ACTUAL_COST_CR', 'Actual cost to date (₹ Cr)'], extra: true, label: 'Actual cost to date (₹ Cr)', kind: 'num', hint: 'Rupees crore, total manpower + expenses to date — needed for net margin', eg: '6.9' },

  /* Process-metric inputs: cumulative to date, from timesheets. Defect counts come from the defects sheet. */
  { key: 'forecast_end_date', sheet: SHEET_PROC, group: 'process', h: 'Forecast End Date', alias: ['FORECAST_END_DATE'], label: 'Forecast / actual end date', kind: 'date', hint: 'Current view of completion', eg: '30-04-2027' },
  { key: 'req_effort_hrs', sheet: SHEET_PROC, group: 'process', h: 'Requirement Analysis & SRS Effort (hrs)', alias: ['REQ_SRS_EFFORT_HRS'], label: 'Requirement analysis & SRS effort (hrs)', kind: 'num', eg: '4900' },
  { key: 'design_effort_hrs', sheet: SHEET_PROC, group: 'process', h: 'Design Integration Effort (hrs)', alias: ['DESIGN_INTEG_EFFORT_HRS'], label: 'Design integration effort (hrs)', kind: 'num', eg: '560' },
  { key: 'dev_effort_hrs', sheet: SHEET_PROC, group: 'process', h: 'Module Development Effort (hrs)', alias: ['MODULE_DEV_EFFORT_HRS'], label: 'Module development effort (hrs)', kind: 'num', eg: '1800' },
  { key: 'testing_effort_hrs', sheet: SHEET_PROC, group: 'process', h: 'Testing Effort (hrs)', alias: ['TESTING_EFFORT_HRS'], label: 'Testing effort (hrs)', kind: 'num', eg: '1850' },
  { key: 'uat_effort_hrs', sheet: SHEET_PROC, group: 'process', h: 'UAT Support Effort (hrs)', alias: ['UAT_EFFORT_HRS'], label: 'UAT support effort (hrs)', kind: 'num', eg: '260' },
  { key: 'review_effort_hrs', sheet: SHEET_PROC, group: 'process', h: 'Review Effort, all reviews (hrs)', alias: ['REVIEW_EFFORT_HRS'], label: 'Review effort, all reviews (hrs)', kind: 'num', eg: '460' },
  { key: 'design_review_hrs', sheet: SHEET_PROC, group: 'process', h: 'Design Review Effort (hrs)', alias: ['DESIGN_REVIEW_HRS'], label: 'Design review effort (hrs)', kind: 'num', eg: '60' },
  { key: 'code_review_hrs', sheet: SHEET_PROC, group: 'process', h: 'Code Review Effort (hrs)', alias: ['CODE_REVIEW_HRS'], label: 'Code review effort (hrs)', kind: 'num', eg: '180' },
  { key: 'design_review_defects', sheet: SHEET_PROC, group: 'process', h: 'Design Review Defects', alias: ['DESIGN_REVIEW_DEFECTS'], label: 'Design review defects', kind: 'num', eg: '45' },
  { key: 'code_review_defects', sheet: SHEET_PROC, group: 'process', h: 'Code Review Defects', alias: ['CODE_REVIEW_DEFECTS'], label: 'Code review defects', kind: 'num', eg: '62' },
  { key: 'post_delivery_defects', sheet: SHEET_PROC, group: 'process', h: 'Post-delivery Defects', alias: ['POST_DELIVERY_DEFECTS'], label: 'Post-delivery defects', kind: 'num', hint: 'Found after go-live', eg: '0' },
  { key: 'size_delivered', sheet: SHEET_PROC, group: 'process', h: 'Size Delivered (FP)', alias: ['SIZE_DELIVERED_FP'], label: 'Size delivered (function points)', kind: 'num', eg: '640' },
  { key: 'total_requirements', sheet: SHEET_PROC, group: 'process', h: 'Total Requirements', alias: ['TOTAL_REQUIREMENTS'], label: 'Total requirements', kind: 'num', hint: 'In the signed-off SRS', eg: '210' },
  { key: 'requirement_changes', sheet: SHEET_PROC, group: 'process', h: 'Requirement Changes', alias: ['REQUIREMENT_CHANGES'], label: 'Requirement changes', kind: 'num', hint: 'Added + modified + deleted since sign-off', eg: '18' },
  { key: 'req_defects', group: 'process', hidden: true, label: 'Requirement defects', kind: 'num' },
  { key: 'design_dev_defects', group: 'process', hidden: true, label: 'Design & development defects', kind: 'num' },
  { key: 'testing_defects', group: 'process', hidden: true, label: 'Testing defects', kind: 'num' },
  { key: 'uat_defects', group: 'process', hidden: true, label: 'UAT defects', kind: 'num' },
  { key: 'review_defects', group: 'process', hidden: true, label: 'Defects found in reviews', kind: 'num' }
];
const TEXT_COLUMNS = ['stage', 'project_category', 'delivery_methodology', 'technology'];
const DATE_COLUMNS = ['forecast_end_date', 'details_updated_at'];
const NEW_COLUMNS = ['details_updated_at', 'details_updated_by'].concat(FIELDS.map(f => f.key)
  .filter(k => ['name', 'start_date', 'end_date', 'status', 'project_type', 'contract_value'].indexOf(k) < 0));

const r1 = v => Math.round(v * 10) / 10;
const n = v => (v === null || v === undefined || v === '') ? null : Number(v);

/* Effort Variance % = (Actual efforts − Planned efforts) ÷ Planned efforts × 100 — planned to date when
   weekly efforts are recorded, else the revised planned efforts */
function effortVariance(p) {
  /* with weekly entries: actual to date against planned to date */
  const a = n(p.actual_effort_hours), pl = n(p.planned_to_date) || n(p.planned_effort_hours);
  return a === null || !pl ? null : r1((a - pl) / pl * 100);
}
/* Net Margin % = (Project value − Total actual cost) ÷ Project value × 100 */
function netMargin(p) {
  const v = n(p.contract_value), c = n(p.actual_cost_cr);
  return c === null || !v ? null : r1((v - c) / v * 100);
}
const metrics = p => ({ effort_variance_pct: effortVariance(p), net_margin_pct: netMargin(p) });

/* Validate raw input keyed by FIELD.key (the upload parser maps sheet headers to keys first).
 * A blank value leaves the stored value alone. Returns { data, errors:[{key,label,message}] }. */
function clean(raw, opts) {
  opts = opts || {};
  const { cleanValue, LEGACY } = require('./records');
  const data = {}, errors = [];
  for (const f of FIELDS) {
    if (f.hidden || !(f.key in raw)) continue;
    const legacy = f.key === 'status' ? LEGACY.projectStatus : f.key === 'project_type' ? LEGACY.projectType : f.key === 'stage' ? LEGACY.stage : null;
    const [v, err] = cleanValue(f, raw[f.key], legacy);
    if (err) errors.push({ key: f.key, label: f.h || f.label, message: err });
    else if (v !== undefined) data[f.key] = v;
    else if (raw[f.key] === '' && opts.allowClear) data[f.key] = f.key === 'name' ? undefined : null;
  }
  if (data.name === undefined) delete data.name;
  const cur = opts.current || {};
  const sd = data.start_date !== undefined ? data.start_date : cur.start_date;
  const ed = data.end_date !== undefined ? data.end_date : cur.end_date;
  if (sd && ed && String(ed).slice(0, 10) < String(sd).slice(0, 10))
    errors.push({ key: 'end_date', label: 'Project End Date', message: 'End date is before the start date' });
  if (data.actual_cost_cr !== undefined && data.contract_value === undefined && !cur.contract_value)
    errors.push({ key: 'contract_value', label: 'Project Value', message: 'Give the project value too — net margin needs both' });
  return { data, errors };
}

/* Project start and end dates are set by the Delivery Head or the PMO administrator, never by the
   project manager. A PM's form or workbook may still carry them; they are dropped, not rejected,
   so an upload with the existing dates in it goes through. */
const PM_LOCKED = ['start_date', 'end_date'];
function stripPmLocked(user, data) {
  if (user && user.role === 'pm' && data) PM_LOCKED.forEach(k => { delete data[k]; });
  return data;
}

module.exports = { FIELDS, STAGES, STATUSES, TYPES, NEW_COLUMNS, TEXT_COLUMNS, DATE_COLUMNS, SHEET_INFO, SHEET_PERF, SHEET_PROC, PM_LOCKED, effortVariance, netMargin, metrics, clean, stripPmLocked };
