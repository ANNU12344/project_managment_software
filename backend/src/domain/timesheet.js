/* Timesheet upload — the standard template, validation, and rolling hours up into the
 * weekly effort register (actual hours and hours by phase, per project per week).
 *
 * One row per person per day per project per activity. Re-uploading a week replaces that
 * person's entries for those days on that project, so a corrected sheet never double-counts.
 */
const XLSX = require('xlsx');
const RC = require('./records');

const PHASES = ['Requirement', 'Design', 'Development', 'Testing', 'UAT', 'Design Review', 'Code Review', 'Other Review', 'Project Management', 'Other'];
/* where each activity's hours land in the weekly register (actual_hrs always gets them) */
const PHASE_FIELD = {
  'Requirement': ['req_hrs'], 'Design': ['design_hrs'], 'Development': ['dev_hrs'], 'Testing': ['testing_hrs'], 'UAT': ['uat_hrs'],
  'Design Review': ['review_hrs', 'design_review_hrs'], 'Code Review': ['review_hrs', 'code_review_hrs'], 'Other Review': ['review_hrs'],
  'Project Management': ['pm_hrs'], 'Other': []
};
const COLS = [
  { key: 'employee_id', h: 'Employee ID', req: true, eg: 'UTL1042' },
  { key: 'employee_name', h: 'Employee Name', eg: 'Ravi Kumar' },
  { key: 'project_code', h: 'Project Code', req: true, eg: 'CIMS-BR-01' },
  { key: 'work_date', h: 'Date', req: true, eg: '14-10-2026' },
  { key: 'phase', h: 'Phase / Activity', req: true, eg: 'Development' },
  { key: 'hours', h: 'Hours', req: true, eg: '7.5' },
  { key: 'task', h: 'Task / Remarks', eg: 'Scheme workflow screens 7–9' }
];

function weekEndingOf(iso) {
  const x = new Date(iso + 'T00:00:00Z'); const day = x.getUTCDay();
  x.setUTCDate(x.getUTCDate() + (day === 0 ? 0 : 7 - day));
  return x.toISOString().slice(0, 10);
}

function template() {
  const wb = XLSX.utils.book_new();
  const readme = [
    ['DCC timesheet upload'], ['Uneecops Technologies Limited'], [],
    ['How to fill'],
    ['1', 'One row per person, per day, per project, per activity. Hours as a number (7.5).'],
    ['2', 'Phase / Activity must be one of the listed values — it decides which phase the hours count towards.'],
    ['3', 'Upload on the Timesheets screen. Rows are checked first; nothing is saved until you commit.'],
    ['4', "Uploading the same person and day again replaces that day's hours for that project, so a corrected sheet never double-counts."],
    [],
    ['Phase / Activity values', PHASES.join(' · ')],
    ['Where hours go', 'Every row adds to Actual Hours for its week. Requirement → Requirement & SRS, Design → Design, Development → Development, Testing → Testing, UAT → UAT support, Design / Code / Other Review → Review, Project Management → Project management.'],
    ['Week', 'Weeks run Monday to Sunday; a date counts towards the week ending on that Sunday.'],
    ['Dates', 'DD-MM-YYYY (14-10-2026). YYYY-MM-DD and 14-Oct-26 are accepted too.']
  ];
  const ws0 = XLSX.utils.aoa_to_sheet(readme); ws0['!cols'] = [{ wch: 26 }, { wch: 120 }];
  XLSX.utils.book_append_sheet(wb, ws0, '00 Read Me');
  const ws = XLSX.utils.aoa_to_sheet([COLS.map(c => c.h), COLS.map(c => c.eg)]);
  ws['!cols'] = COLS.map(c => ({ wch: Math.max(14, c.h.length + 6) }));
  ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: 2000, c: COLS.length - 1 } });
  XLSX.utils.book_append_sheet(wb, ws, 'Timesheet');
  const wsP = XLSX.utils.aoa_to_sheet([['Phase / Activity', 'Counts towards']].concat(PHASES.map(p => [p, ['Actual Hours'].concat((PHASE_FIELD[p] || []).map(k => k.replace(/_hrs$/, '').replace(/_/g, ' '))).join(' + ')])));
  wsP['!cols'] = [{ wch: 22 }, { wch: 60 }];
  XLSX.utils.book_append_sheet(wb, wsP, 'Phases');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

/* Parse and validate. byCode: projects the uploader may write. Returns { ok, rows, errors, summary }.
   The example row (UTL1042 … from the template) is ignored if left in. */
function parse(buffer, byCode) {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const name = wb.SheetNames.find(n => RC.norm(n) === 'timesheet') || wb.SheetNames.find(n => !/read ?me|phases/i.test(n));
  const errors = [], rows = [];
  if (!name) return { ok: false, rows, errors: [{ row: 0, field: '-', message: 'No Timesheet sheet found. Use the template from the Timesheets screen.' }], summary: {} };
  const grid = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: '', raw: false });
  let hr = grid.findIndex(r => r.filter(c => COLS.some(x => RC.norm(x.h) === RC.norm(c))).length >= 4);
  if (hr < 0) return { ok: false, rows, errors: [{ row: 0, field: '-', message: 'Could not find the header row (Employee ID, Project Code, Date, Phase / Activity, Hours).' }], summary: {} };
  const idx = {}; grid[hr].forEach((c, j) => { const col = COLS.find(x => RC.norm(x.h) === RC.norm(c)); if (col) idx[col.key] = j; });
  const seen = {};
  for (let i = hr + 1; i < grid.length; i++) {
    const line = i + 1, raw = {};
    Object.keys(idx).forEach(k => { raw[k] = String(grid[i][idx[k]] === undefined ? '' : grid[i][idx[k]]).trim(); });
    if (Object.values(raw).every(v => v === '')) continue;
    if (raw.employee_id === 'UTL1042' && raw.task === COLS[6].eg) continue;      // template example row
    const err = (field, message) => errors.push({ row: line, field, message });
    COLS.filter(c => c.req && !raw[c.key]).forEach(c => err(c.h, 'Required'));
    if (COLS.some(c => c.req && !raw[c.key])) continue;
    const p = byCode[raw.project_code.toUpperCase()];
    if (!p) { err('Project Code', `"${raw.project_code}" is not a project you can upload timesheets for`); continue; }
    const date = RC.parseDateCell(raw.work_date);
    if (!date) { err('Date', 'Not a readable date (use DD-MM-YYYY)'); continue; }
    const phase = PHASES.find(x => RC.norm(x) === RC.norm(raw.phase));
    if (!phase) { err('Phase / Activity', `Use one of: ${PHASES.join(', ')}`); continue; }
    const hours = Number(String(raw.hours).replace(',', '.'));
    if (isNaN(hours) || hours <= 0 || hours > 24) { err('Hours', 'Between 0 and 24 hours for one day'); continue; }
    const k = [raw.employee_id, p.id, date, phase].join('|');
    if (seen[k]) { err('Phase / Activity', `Same person, project, date and activity as row ${seen[k]} — combine them into one row`); continue; }
    seen[k] = line;
    rows.push({ project_id: p.id, code: p.code, employee_id: raw.employee_id, employee_name: raw.employee_name || null,
      work_date: date, week_ending: weekEndingOf(date), phase, hours, task: raw.task || null });
  }
  /* a person cannot book more than 24 hours in one day across projects in this file */
  const perDay = {};
  rows.forEach(r => { const k = r.employee_id + '|' + r.work_date; perDay[k] = (perDay[k] || 0) + r.hours; });
  Object.keys(perDay).filter(k => perDay[k] > 24).forEach(k => errors.push({ row: 0, field: 'Hours', message: `${k.split('|')[0]} has ${perDay[k]} hours on ${k.split('|')[1]} — more than 24 in one day` }));
  const weeks = {};
  rows.forEach(r => { const k = r.code + ' w/e ' + r.week_ending; weeks[k] = (weeks[k] || 0) + r.hours; });
  return {
    ok: errors.length === 0 && rows.length > 0, rows, errors,
    summary: { rows: rows.length, people: new Set(rows.map(r => r.employee_id)).size, hours: Math.round(rows.reduce((a, r) => a + r.hours, 0) * 10) / 10,
      projects: Array.from(new Set(rows.map(r => r.code))), weeks: Object.keys(weeks).sort().map(k => ({ week: k, hours: Math.round(weeks[k] * 10) / 10 })) }
  };
}

/* Roll a project's timesheet entries for one week up into weekly-register hours. */
function rollUp(entries) {
  const out = { actual_hrs: 0 };
  ['req_hrs', 'design_hrs', 'dev_hrs', 'testing_hrs', 'uat_hrs', 'pm_hrs', 'review_hrs', 'design_review_hrs', 'code_review_hrs'].forEach(k => out[k] = 0);
  entries.forEach(e => { out.actual_hrs += Number(e.hours); (PHASE_FIELD[e.phase] || []).forEach(k => out[k] += Number(e.hours)); });
  Object.keys(out).forEach(k => out[k] = Math.round(out[k] * 10) / 10);
  return out;
}

module.exports = { PHASES, PHASE_FIELD, COLS, template, parse, rollUp, weekEndingOf };
