/* Project workbook upload: parse and validate a PMO workbook (nothing written), then commit the staged rows. */
const XLSX = require('xlsx');
const M = require('../models');
const access = require('./access.service');
const { weekEnding } = require('../utils/dates');
const PD = require('../domain/project-details');
const RC = require('../domain/records');
const W = require('../domain/weekly');

/* Sheets of the PMO project workbook (projectdetails.xlsx), the extras this app adds, and the
   names an earlier template used, so a file made from it still uploads. */
const SHEETS = {
  info: [PD.SHEET_INFO, 'Project Details'],
  perf: [PD.SHEET_PERF],
  proc: [PD.SHEET_PROC],
  status: ['Weekly Status', 'Weekly Status (health index)'],
  weekly: ['Weekly Effort', 'Weekly Effort & Process'],
  raid: ['RAID', 'RAID Log'],
  milestones: [RC.RECORDS.milestones.sheet, 'Milestones'],
  billing: [RC.RECORDS.billing.sheet],
  risks: [RC.RECORDS.risks.sheet, 'Risks'],
  iad: [RC.RECORDS.iad.sheet, 'Client Dependencies', 'Issues and Dependencies'],
  defects: [RC.RECORDS.defects.sheet, 'Defect'],
  pci: [RC.RECORDS.pci.sheet],
  activities: [RC.RECORDS.activities.sheet].concat(RC.RECORDS.activities.alias || [])
};
/* Headers an earlier machine-named template used, per record type. */
const OLD_HEADERS = {
  milestones: { ref: ['MILESTONE_ID'], baseline_date: ['BASELINE_DATE'], forecast_date: ['FORECAST_DATE'], actual_date: ['ACTUAL_DATE'], status: ['STATUS'], remarks: ['SLIPPAGE_REASON'], is_billing: ['IS_BILLING_MILESTONE_YN'] },
  risks: { ref: ['RISK_ID'], description: ['RISK_DESCRIPTION'], owner_name: ['OWNER_NAME'], mitigation: ['MITIGATION_ACTION'], target_date: ['MITIGATION_TARGET_DATE'] },
  iad: { owner_at_client: ['OWNER_AT_CLIENT'], milestone_blocked: ['MILESTONE_BLOCKED'], value_blocked: ['VALUE_BLOCKED_CR'] }
};

const NUM = v => (v === '' || v === null || v === undefined) ? null : (isNaN(Number(v)) ? NaN : Number(v));
const STR = v => (v === null || v === undefined) ? '' : String(v).trim();
const DATE = v => RC.parseDateCell(v);

function findSheet(wb, names) {
  const want = names.map(RC.norm);
  const hit = wb.SheetNames.find(n => want.indexOf(RC.norm(n)) >= 0);
  return hit ? { name: hit, ws: wb.Sheets[hit] } : null;
}
/* Locate the header row (the PMO workbook has title rows above it) and map columns to keys.
   cols: [{ key, headers: [normalised spellings] }]. Returns { name, header, rows: [{line, raw}] }. */
function readSheet(found, cols, extraKeys) {
  const grid = XLSX.utils.sheet_to_json(found.ws, { header: 1, defval: '', raw: false, blankrows: true });
  let best = -1, bestScore = 1;
  for (let i = 0; i < Math.min(grid.length, 15); i++) {
    const score = grid[i].filter(c => cols.some(x => x.headers.indexOf(RC.norm(c)) >= 0)).length;
    if (score > bestScore) { best = i; bestScore = score; }
  }
  if (best < 0) return { name: found.name, header: null, rows: [] };
  const idx = {};
  grid[best].forEach((c, j) => { const col = cols.find(x => x.headers.indexOf(RC.norm(c)) >= 0); if (col && idx[col.key] === undefined) idx[col.key] = j; });
  const first = XLSX.utils.decode_range(found.ws['!ref']).s.r;   // sheet_to_json starts at the used range
  const rows = [];
  for (let i = best + 1; i < grid.length; i++) {
    const raw = {};
    Object.keys(idx).forEach(k => { raw[k] = grid[i][idx[k]]; });
    const filled = Object.keys(raw).filter(k => STR(raw[k]) !== '');
    if (!filled.length) continue;
    /* A lone sentence in one cell is a note on the sheet ("Option to add defect count…"), not a row. */
    if (filled.length === 1 && STR(raw[filled[0]]).split(/\s+/).length >= 4 && grid[i].filter(c => STR(c) !== '').length === 1) continue;
    rows.push({ line: first + i + 1, raw });
  }
  return { name: found.name, header: first + best + 1, idx, rows };
}

const CODE_HEADERS = ['Project Code', 'PROJECT_CODE', 'Project ID'].map(RC.norm);
const MGR_HEADERS = ['Project Manager', 'PROJECT_MANAGER'].map(RC.norm);
const fieldCols = sheet => PD.FIELDS.filter(f => !f.hidden && (f.sheet === sheet || (sheet === PD.SHEET_INFO && false)))
  .map(f => ({ key: f.key, headers: [f.h].concat(f.alias || []).map(RC.norm) }));

/* Validate an uploaded workbook against the projects this user may write.
 * Returns { ok, summary, staged, errors } — nothing is written here. */
async function parseAndValidate(buffer, user) {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const visible = await access.visibleTo(user);
  const writable = visible.filter(p => access.canEditStatus(user, p));
  const byCode = {}; writable.forEach(p => byCode[p.code.toUpperCase()] = p);
  const users = await M.User.all();

  const errors = [];
  const staged = { details: [], status: [], weekly: [], records: {} };
  Object.keys(RC.RECORDS).forEach(k => staged.records[k] = []);
  const err = (sheet, row, field, msg) => errors.push({ sheet, row, field, message: msg });

  const present = Object.keys(SHEETS).filter(k => findSheet(wb, SHEETS[k]));
  if (!present.length) {
    return { ok: false, summary: { rows_ok: 0, rows_error: 0 },
      errors: [{ sheet: '-', row: 0, field: '-', message: 'No recognised sheets. Use the template from the Upload screen, or the PMO project workbook.' }], staged };
  }

  function project(code, sheet, line) {
    const c = STR(code).toUpperCase();
    if (!c) { err(sheet, line, 'Project Code', 'Project code is blank'); return null; }
    const p = byCode[c];
    if (!p) { err(sheet, line, 'Project Code', `"${c}" is not a project you can update`); return null; }
    return p;
  }

  /* --- Project Information (one row per project; old "Project Details" sheet also lands here) --- */
  const details = {};                                  // code -> { p, d, line, sheet }
  const infoFound = findSheet(wb, SHEETS.info);
  if (infoFound) {
    const oldCombined = RC.norm(infoFound.name) === RC.norm('Project Details');
    const cols = (oldCombined ? PD.FIELDS.filter(f => !f.hidden) : PD.FIELDS.filter(f => f.sheet === PD.SHEET_INFO))
      .map(f => ({ key: f.key, headers: [f.h].concat(f.alias || []).map(RC.norm) }))
      .concat([{ key: '_code', headers: CODE_HEADERS }, { key: '_mgr', headers: MGR_HEADERS }]);
    const sh = readSheet(infoFound, cols);
    sh.rows.forEach(({ line, raw }) => {
      if (['stage', 'status', 'project_type', 'project_category'].some(k => STR(raw[k]).indexOf(',') > 0)) return;   // hint row
      const p = project(raw._code, sh.name, line); if (!p) return;
      if (details[p.code]) { err(sh.name, line, 'Project Code', `${p.code} appears twice — keep one row per project`); return; }
      const mgr = STR(raw._mgr);
      if (mgr) {
        const pm = users.find(u => u.id === p.pm_user_id);
        const ok = pm && [pm.name, pm.email].some(x => String(x || '').toLowerCase() === mgr.toLowerCase());
        if (!ok) err(sh.name, line, 'Project Manager', `${p.code} is assigned to ${pm ? pm.name : 'no one'}. Leave this as is, or ask the PMO administrator to reassign the project`);
      }
      delete raw._code; delete raw._mgr;
      PD.stripPmLocked(user, raw);                       // a PM's workbook cannot change the project start / end date
      const c = PD.clean(raw, { current: p });
      c.errors.forEach(e => err(sh.name, line, e.label, e.message));
      details[p.code] = { p, d: c.data };
    });
  }
  const onlyCode = Object.keys(details).length === 1 ? Object.keys(details)[0] : null;

  /* Child sheets: rows carry a project code column, or belong to the one project on Project Information. */
  function rowProject(raw, sheetName, line) {
    const code = STR(raw._code);
    if (code) return project(code, sheetName, line);
    if (onlyCode) return byCode[onlyCode];
    err(sheetName, line, 'Project Code', 'Add a Project Code column, or fill Project Information for exactly one project in this workbook');
    return null;
  }

  /* --- Project Performance and Process Metrics: single-row sheets merged into the project's details --- */
  [[SHEETS.perf, PD.SHEET_PERF], [SHEETS.proc, PD.SHEET_PROC]].forEach(([names, sheet]) => {
    const found = findSheet(wb, names); if (!found) return;
    const sh = readSheet(found, fieldCols(sheet).concat([{ key: '_code', headers: CODE_HEADERS }]));
    sh.rows.forEach(({ line, raw }) => {
      const p = rowProject(raw, sh.name, line); if (!p) return;
      delete raw._code;
      PD.stripPmLocked(user, raw);
      const c = PD.clean(raw, { current: p });
      c.errors.forEach(e => err(sh.name, line, e.label, e.message));
      const cur = details[p.code] || (details[p.code] = { p, d: {} });
      Object.assign(cur.d, c.data);
    });
  });
  Object.values(details).forEach(({ p, d }) => { if (Object.keys(d).length) staged.details.push({ project_id: p.id, code: p.code, d }); });

  /* --- Workbook record sheets --- */
  for (const kind of Object.keys(RC.RECORDS)) {
    const spec = RC.RECORDS[kind];
    const found = findSheet(wb, SHEETS[kind]); if (!found) continue;
    const old = OLD_HEADERS[kind] || {};
    const cols = spec.cols.map(c => ({ key: c.key, headers: RC.headersOf(c).concat((old[c.key] || []).map(RC.norm)) }))
      .concat([{ key: '_code', headers: CODE_HEADERS.concat(spec.projectCol ? [spec.projectCol.h].concat(spec.projectCol.alias || []).map(RC.norm) : []) }]);
    const sh = readSheet(found, cols);
    const seen = {};
    sh.rows.forEach(({ line, raw }) => {
      if (RC.isHintRow(spec, raw)) return;
      const p = rowProject(raw, sh.name, line); if (!p) return;
      delete raw._code;
      const c = RC.cleanRecord(spec, raw);
      c.errors.forEach(e => err(sh.name, line, e.field, e.message));
      if (c.errors.length) return;
      if (kind === 'activities' && !c.data.week_ending) c.data.week_ending = weekEnding();
      const k = p.code + '|' + spec.key.map(x => c.data[x] === undefined ? '' : c.data[x]).join('|');
      if (seen[k]) { err(sh.name, line, spec.cols.find(x => x.key === spec.key[0]).h, `Same ${spec.key.join(' + ')} as row ${seen[k]} — keep one row`); return; }
      seen[k] = line;
      staged.records[kind].push({ project_id: p.id, code: p.code, r: c.data });
    });
  }

  /* --- Weekly Effort: one row per week; cumulative figures are the sum of the weeks --- */
  const wkFound = findSheet(wb, SHEETS.weekly);
  if (wkFound) {
    const cols = W.FIELDS.map(f => ({ key: f.key, headers: [f.h, f.label].map(RC.norm) }))
      .concat([{ key: '_code', headers: CODE_HEADERS }, { key: '_week', headers: ['Week Ending', 'WEEK_ENDING', 'Week'].map(RC.norm) }, { key: 'remarks', headers: ['Remarks'].map(RC.norm) }]);
    const sh = readSheet(wkFound, cols);
    const seenW = {};
    sh.rows.forEach(({ line, raw }) => {
      const p = rowProject(raw, sh.name, line); if (!p) return;
      const wk = RC.parseDateCell(raw._week);
      if (!wk) { err(sh.name, line, 'Week Ending', raw._week ? 'Not a readable date (use DD-MM-YYYY)' : 'Required — the Sunday the week ends on'); return; }
      if (new Date(wk + 'T00:00:00Z').getUTCDay() !== 0) { err(sh.name, line, 'Week Ending', `${wk} is not a Sunday — give the week's ending Sunday`); return; }
      if (seenW[p.code + wk]) { err(sh.name, line, 'Week Ending', `Week ${wk} appears twice — keep one row per week`); return; }
      seenW[p.code + wk] = line;
      delete raw._code; delete raw._week;
      Object.keys(raw).forEach(k => { if (String(raw[k]).trim() === '') delete raw[k]; });
      const c = W.clean(raw);
      c.errors.forEach(e => err(sh.name, line, e.label, e.message));
      if (!c.errors.length && Object.keys(c.data).length) staged.weekly.push({ project_id: p.id, code: p.code, week_ending: wk, d: c.data });
    });
  }

  /* --- Weekly Status (health index inputs; optional) --- */
  const statusFound = findSheet(wb, SHEETS.status);
  const st = statusFound ? XLSX.utils.sheet_to_json(statusFound.ws, { defval: '', raw: false }) : [];
  const SHEETS_status = statusFound ? statusFound.name : 'Weekly Status';
  st.forEach((r, i) => {
    const line = i + 2;
    const p = project(r.PROJECT_CODE, SHEETS_status, line); if (!p) return;
    const wk = DATE(r.WEEK_ENDING);
    if (wk === undefined) { err(SHEETS_status, line, 'WEEK_ENDING', 'Not a readable date (use DD-MM-YYYY)'); return; }
    if (!wk) { err(SHEETS_status, line, 'WEEK_ENDING', 'Required'); return; }
    const row = { project_id: p.id, code: p.code, week_ending: wk, data: {} };
    const numField = (key, col, lo, hi) => {
      const v = NUM(r[col]);
      if (v !== null && isNaN(v)) { err(SHEETS_status, line, col, 'Must be a number'); return; }
      if (v !== null && (v < lo || v > hi)) { err(SHEETS_status, line, col, `Must be between ${lo} and ${hi}`); return; }
      row.data[key] = v;
    };
    numField('pct_complete', 'PERCENT_COMPLETE', 0, 100);
    numField('budget_consumed_pct', 'BUDGET_CONSUMED_PERCENT', 0, 500);
    numField('effort_baseline_pd', 'BASELINE_EFFORT_PD', 0, 1e6);
    numField('effort_actual_pd', 'ACTUAL_EFFORT_PD', 0, 1e6);
    numField('etc_pd', 'ESTIMATE_TO_COMPLETE_PD', 0, 1e6);
    numField('margin_at_completion', 'MARGIN_AT_COMPLETION_PERCENT', -100, 100);
    numField('unbilled_wip', 'UNBILLED_WIP_CR', 0, 1e5);
    numField('ar_over_90', 'RECEIVABLE_OVER_90D_CR', 0, 1e5);
    numField('defects_open', 'DEFECTS_OPEN', 0, 1e5);
    numField('defects_leaked', 'DEFECTS_LEAKED_TO_UAT', 0, 1e5);
    numField('defects_reopened', 'DEFECTS_REOPENED', 0, 1e5);
    numField('sla_breaches', 'SLA_BREACHES', 0, 1e4);
    numField('timesheet_compliance', 'TIMESHEET_COMPLIANCE_PERCENT', 0, 100);
    numField('over_allocated', 'OVER_ALLOCATED_PEOPLE', 0, 1e4);
    numField('attrition_flag', 'ATTRITION_ON_PROJECT_YN', 0, 1);
    numField('spi', 'SPI', 0, 3);
    numField('cpi', 'CPI', 0, 3);
    const rag = STR(r.PM_RAG);
    if (rag && ['Green','Amber','Red'].indexOf(rag) < 0) err(SHEETS_status, line, 'PM_RAG', 'Use Green, Amber or Red');
    row.data.pm_rag = rag || null;
    row.data.pm_rag_reason = STR(r.PM_RAG_REASON) || null;
    row.data.narrative = STR(r.NARRATIVE) || null;
    if (rag && rag !== 'Green' && !row.data.pm_rag_reason)
      err(SHEETS_status, line, 'PM_RAG_REASON', 'A reason is required whenever the band is not Green');
    staged.status.push(row);
  });


  const counts = { details: staged.details.length, status: staged.status.length, weekly: staged.weekly.length };
  Object.keys(staged.records).forEach(k => counts[k] = staged.records[k].length);
  const rows_ok = Object.values(counts).reduce((a, b) => a + b, 0);
  const codes = new Set(staged.details.map(s => s.code).concat(staged.status.map(s => s.code), staged.weekly.map(s => s.code)));
  Object.values(staged.records).forEach(list => list.forEach(x => codes.add(x.code)));
  return {
    ok: errors.length === 0 && rows_ok > 0,
    summary: Object.assign({ rows_ok, rows_error: errors.length, projects: Array.from(codes), sheets: present.length }, counts,
      { milestones: counts.milestones, risks: counts.risks, deps: counts.iad }),
    errors, staged
  };
}

async function commit(staged, user) {
  const touched = new Set();
  for (const x of (staged.details || [])) { await M.Project.updateDetails(x.project_id, x.d, user.id); touched.add(x.project_id); }
  for (const s of (staged.status || [])) { await M.StatusReport.save(s.project_id, s.week_ending, s.data, user.id, 'upload'); touched.add(s.project_id); }
  for (const x of (staged.weekly || [])) { await M.WeeklyEffort.upsert(x.project_id, x.week_ending, x.d, user.id, 'upload'); touched.add(x.project_id); }
  const recs = staged.records || {
    /* uploads validated before the workbook layout still commit */
    milestones: (staged.milestones || []).map(x => ({ project_id: x.project_id, r: x.m })),
    risks: (staged.risks || []).map(x => ({ project_id: x.project_id, r: x.r })),
    iad: (staged.deps || []).map(x => ({ project_id: x.project_id, r: x.d }))
  };
  for (const kind of Object.keys(recs)) {
    for (const x of recs[kind]) { await M.RECORD_MODELS[kind].upsert(x.project_id, x.r); touched.add(x.project_id); }
  }
  for (const pid of touched) await require('./project-state.service').recompute(pid);
  return { projects: touched.size, project_ids: Array.from(touched) };
}

module.exports = { parseAndValidate, commit, SHEETS };
