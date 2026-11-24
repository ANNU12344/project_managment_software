/* Builds the PM upload template in the layout of the PMO project workbook (projectdetails.xlsx):
 * one workbook per project, the PMO's sheet names and headers, then the sheets this app adds —
 * Process Metrics (inputs the CMMi metrics need), Calculated Metrics (live Excel formulas against
 * the baseline) and Weekly Status (health index inputs, optional).
 * Run: node scripts/make-template.js [outPath]
 */
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');
const PD = require('../backend/src/domain/project-details');
const RC = require('../backend/src/domain/records');
const MX = require('../backend/src/domain/metrics');
const W = require('../backend/src/domain/weekly');

const F = k => PD.FIELDS.find(f => f.key === k);
const fieldCol = f => [f.h, (f.hint || f.label) + (f.options ? ' — ' + f.options.join(' / ') : ''), f.eg || ''];

/* [sheet name, note, [[header, format, example]...]] */
const INFO = [['Project Code', 'Must match your project in DCC', 'CIMS-BR-01'], fieldCol(F('name')),
  ['Project Manager', 'Your name or email — a check only; reassignment is done by the PMO', 'Sandeep Tinna']]
  .concat(PD.FIELDS.filter(f => f.sheet === PD.SHEET_INFO && f.key !== 'name').map(fieldCol));
const PERF = PD.FIELDS.filter(f => f.sheet === PD.SHEET_PERF).map(fieldCol);
const PROC = PD.FIELDS.filter(f => f.sheet === PD.SHEET_PROC && !f.hidden).map(fieldCol);
const recCols = spec => {
  const cols = spec.cols.filter(c => !c.extra).concat(spec.cols.filter(c => c.extra));      // the PMO's columns first, optional extras last
  const out = cols.map(c => [c.h, (c.hint ? c.hint + '. ' : '') + (c.options ? c.options.join(' / ') : c.kind === 'date' ? 'DD-MM-YYYY' : c.kind === 'num' ? 'Number' : c.kind === 'pct' ? '0–100' : 'Text') + (c.req ? ' · required' : '') + (c.extra ? ' · optional, added by DCC' : ''), c.eg || '']);
  if (spec.projectCol) out.splice(1, 0, [spec.projectCol.h, 'Project code — blank means the project on Project Information', 'CIMS-BR-01']);
  return out;
};
const R = RC.RECORDS;
const SHEETS = [
  [PD.SHEET_INFO, 'One row: the project. Stage, status, type and category from the listed values.', INFO],
  [PD.SHEET_PERF, 'One row: progress to date. Actual Cost is added by DCC — net margin needs it.', PERF],
  [R.milestones.sheet, 'One row per milestone. A forecast end later than the plan end needs Remarks; a completed milestone needs its actual end date.', recCols(R.milestones)],
  [R.billing.sheet, 'One row per invoice: milestone, amount in ₹ crore, date and status.', recCols(R.billing)],
  [R.raid.sheet, 'RAID log — risks, assumptions, issues and dependencies in one register (the PMO Risk and IAD sheets clubbed). Type decides which. Never delete a closed item; mark it Closed with a closed date. Risks need impact and probability.', recCols(R.raid)],
  [R.activities.sheet, "This week's achievements and next week's plan, one row per activity.", recCols(R.activities)],
  [R.defects.sheet, 'Defect counts by type and phase injected (one row per type × phase × milestone). The process metrics read these counts.', recCols(R.defects)],
  [R.pci.sheet, 'Process compliance audits: date, PCI score and open non-conformances.', recCols(R.pci)],
  ['Weekly Effort', 'One row per week (Week Ending = that Sunday). Effort, effort by phase, review findings, optional size/requirements and story points for that week only — DCC adds the weeks up to get the cumulative figures. A timesheet upload fills the hours for you.',
    [['Week Ending', 'DD-MM-YYYY, a Sunday · required', '18-10-2026']].concat(W.FIELDS.map(f => [f.h, (f.hint || f.label) + (f.agg === 'last' ? ' · latest value is used, not added up' : ' · this week only') + (f.optional ? ' · optional' : ''), ''])).concat([['Remarks', 'Optional', '']])],
  [PD.SHEET_PROC, 'Optional — only for projects that do not record Weekly Effort: phase-wise effort and review data as one cumulative row. When Weekly Effort rows exist they are used instead.', PROC]
];
const WEEKLY = ['Weekly Status (health index)',
  'Optional, added by DCC: the weekly figures behind the computed health index. One row per week.',
  [['PROJECT_CODE', 'Text', 'CIMS-BR-01'], ['WEEK_ENDING', 'DD-MM-YYYY, a Sunday', '27-09-2026'], ['PERCENT_COMPLETE', '0-100', '54.2'],
   ['BUDGET_CONSUMED_PERCENT', '0-100', '61.4'], ['SPI', 'Schedule Performance Index', '0.94'], ['CPI', 'Cost Performance Index', '1.02'],
   ['DEFECTS_OPEN', 'Count', '38'], ['DEFECTS_LEAKED_TO_UAT', 'Count', '5'], ['DEFECTS_REOPENED', 'Count', '4'],
   ['SLA_BREACHES', 'AMC only, else 0', '0'], ['TIMESHEET_COMPLIANCE_PERCENT', '0-100', '91'],
   ['OVER_ALLOCATED_PEOPLE', 'Count booked beyond 100%', '1'], ['ATTRITION_ON_PROJECT_YN', '1 = someone resigned', '0'],
   ['PM_RAG', 'Green / Amber / Red', 'Amber'], ['PM_RAG_REASON', 'Required unless Green', 'Client data validation pending'],
   ['NARRATIVE', 'What moved this week', 'M03 forecast moved to 19 Sep']]];

/* Cell address of an input for the Calculated Metrics formulas (row 2 of single-row sheets;
   defect counts are sums over the defects sheet). */
function cellOf(key) {
  const q = n => `'${n}'`;
  const df = (crit) => crit.map(([col, v]) => `SUMIF(${q(R.defects.sheet)}!${col}:${col},"${v}",${q(R.defects.sheet)}!B:B)`).join('+');
  const derived = {
    total_defects: `SUM(${q(R.defects.sheet)}!B:B)`,
    req_defects: df([['C', 'Initiation'], ['C', 'Requirement']]),
    design_dev_defects: df([['C', 'Prototypes'], ['C', 'Design & Development']]),
    testing_defects: df([['A', 'Internal Testing Review']]),
    uat_defects: df([['A', 'External Testing Review']]),
    review_defects: df([['A', 'Internal Review'], ['A', 'External Review']])
  };
  if (derived[key]) return `(${derived[key]})`;
  /* weekly figures win when the Weekly Effort sheet has rows: the sum of the weeks, else the one-row value */
  const WK = { actual_effort_hours: 'actual_hrs', req_effort_hrs: 'req_hrs', design_effort_hrs: 'design_hrs', dev_effort_hrs: 'dev_hrs', testing_effort_hrs: 'testing_hrs',
    uat_effort_hrs: 'uat_hrs', review_effort_hrs: 'review_hrs', design_review_hrs: 'design_review_hrs', code_review_hrs: 'code_review_hrs',
    design_review_defects: 'design_review_defects', code_review_defects: 'code_review_defects', post_delivery_defects: 'post_delivery_defects',
    size_delivered: 'size_fp', total_requirements: 'requirements_added', requirement_changes: 'requirement_changes' };
  if (WK[key] && !cellOf._inner) {
    const wcols = SHEETS.find(x => x[0] === 'Weekly Effort')[2];
    const j = wcols.findIndex(c => c[0] === W.FIELDS.find(f => f.key === WK[key]).h);
    const col = XLSX.utils.encode_col(j), rng = `'Weekly Effort'!${col}2:${col}201`;
    cellOf._inner = true; const one = cellOf(key); cellOf._inner = false;
    return `IF(SUM(${rng})>0,SUM(${rng}),${one})`;
  }
  for (const [name, , cols] of SHEETS) {
    const f = PD.FIELDS.find(x => x.key === key);
    if (f && name === f.sheet) {
      const j = cols.findIndex(c => c[0] === f.h);
      if (j >= 0) return `${q(name)}!${XLSX.utils.encode_col(j)}2`;
    }
  }
  throw new Error('template: no cell for ' + key);
}

function build(outPath) {
  const wb = XLSX.utils.book_new();
  const readme = [
    ['Delivery Command Centre — project workbook'],
    ['Uneecops Technologies Limited · one workbook per project · layout of the PMO project details workbook'],
    [],
    ['How to use'],
    ['1', 'Fill Project Information (one row) and the other sheets you have data for. Row 1 is the header — do not rename or reorder columns.'],
    ['2', 'Child sheets belong to the project on Project Information. To put several projects in one workbook, add a "Project Code" column to each sheet.'],
    ['3', 'Upload on the Upload screen. The file is validated first; nothing is saved until you press Commit.'],
    ['4', 'Re-uploading updates rows that match: milestones on name (or ID), RAID items on their ID, weekly effort on its week, billing on milestone + date, defects on type + phase + milestone, PCI on audit date.'],
    ['·', 'Size Delivered (FP), Total Requirements and story points are optional. Agile projects can record story points planned, completed and the backlog each week instead of function points.'],
    ['5', 'Calculated Metrics shows the CMMi process metrics live as you type, against the organisation baseline.'],
    [],
    ['Rules the validator enforces'],
    ['·', 'Project Code must be a project assigned to you; Project Manager, if filled, must be the PM it is assigned to.'],
    ['·', 'Values in listed fields must come from the list (the spellings in the PMO workbook, such as "Desing & Development", are accepted too).'],
    ['·', 'A milestone forecast later than its plan end needs Remarks; a completed milestone needs its actual end date.'],
    ['·', 'IAD and RAID owners must be named people; a closed item needs its closed date.'],
    [],
    ['Dates', 'DD-MM-YYYY (27-09-2026). 01-Jun-26 and YYYY-MM-DD are accepted too.'],
    ['Money', 'Rupees crore, as a plain number (1.8, not ₹1.8 Cr).'],
    ['Effort', 'Hours, as a plain number (9240).'],
    [],
    ['Sheets in this workbook']
  ];
  SHEETS.concat([WEEKLY]).forEach(([name, note]) => readme.push([name, note]));
  readme.push(['Calculated Metrics', 'Formulas only — the 19 process metrics with their LSL / Goal / USL and a within / out-of-limits flag.']);
  const ws0 = XLSX.utils.aoa_to_sheet(readme);
  ws0['!cols'] = [{ wch: 30 }, { wch: 120 }];
  XLSX.utils.book_append_sheet(wb, ws0, '00 Read Me');

  const guide = [['SHEET', 'FIELD', 'EXPECTED FORMAT', 'WORKED EXAMPLE']];
  SHEETS.concat([WEEKLY]).forEach(([name, , cols]) => cols.forEach(c => guide.push([name, c[0], c[1], c[2]])));
  const wsG = XLSX.utils.aoa_to_sheet(guide);
  wsG['!cols'] = [{ wch: 30 }, { wch: 36 }, { wch: 80 }, { wch: 50 }];
  XLSX.utils.book_append_sheet(wb, wsG, '01 Field Guide');

  SHEETS.concat([WEEKLY]).forEach(([name, , cols]) => {
    const ws = XLSX.utils.aoa_to_sheet([cols.map(c => c[0])]);
    ws['!cols'] = cols.map(c => ({ wch: Math.max(14, Math.min(42, c[0].length + 4)) }));
    ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: 200, c: cols.length - 1 } });
    XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31));
  });

  /* Calculated Metrics: one row per metric, formula against the cells above, limits, flag. */
  const calc = [['Metric', 'Value', 'Unit', 'LSL', 'Goal', 'USL', 'Within limits?', 'How calculated']];
  MX.METRICS.forEach(m => { const b = MX.BASELINE[m.key] || {}; calc.push([m.label, '', m.unit, b.lsl, b.goal, b.usl, '', m.formula]); });
  const wsC = XLSX.utils.aoa_to_sheet(calc);
  MX.METRICS.forEach((m, i) => {
    const r = i + 2;
    wsC['B' + r] = m.excel ? { t: 's', v: '', f: `IFERROR(ROUND(${m.excel(cellOf)},${m.dp}),"")` } : { t: 's', v: 'computed on upload' };
    wsC['G' + r] = { t: 's', v: '', f: `IF(OR(B${r}="",B${r}="computed on upload"),"",IF(D${r}="","tracked",IF(AND(B${r}>=D${r},B${r}<=F${r}),"within","OUT")))` };
  });
  wsC['!cols'] = [{ wch: 44 }, { wch: 12 }, { wch: 22 }, { wch: 9 }, { wch: 9 }, { wch: 9 }, { wch: 14 }, { wch: 90 }];
  XLSX.utils.book_append_sheet(wb, wsC, 'Calculated Metrics');

  const out = outPath || path.join(__dirname, '..', 'frontend', 'assets', 'templates', 'DCC-Weekly-Status-Template.xlsx');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  XLSX.writeFile(wb, out);
  return out;
}

if (require.main === module) console.log('written:', build(process.argv[2]));
module.exports = { build, SHEETS };
