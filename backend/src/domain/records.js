/* The project workbook, sheet by sheet — the structure of projectdetails.xlsx.
 *
 * Each record type (milestones, billing, RAID, IAD, defects, PCI audits, weekly activities)
 * is described once here: the sheet it lives on, its header (including the spellings the
 * PMO's workbook uses), the allowed values and what is required. The upload parser, the
 * Excel template, the on-screen forms and the exports all read these specs.
 *
 * Money is in rupees crore, effort in hours, dates DD-MM-YYYY on sheets.
 */

/* ---------- value lists (from projectdetails.xlsx) ---------- */
const LISTS = {
  stage: ['Initiation', 'Requirement', 'Prototypes', 'Design & Development', 'Testing', 'UAT', 'Go-Live'],
  projectStatus: ['In Progress', 'Hold', 'Completed'],
  projectType: ['Fixed Price', 'T&M', 'AMC', 'Internal'],
  category: ['NICSI', 'GEM', 'Other'],
  yesNo: ['Yes', 'No'],
  milestoneStatus: ['Yet to Start', 'In Progress', 'On Hold', 'Completed'],
  signoff: ['Received', 'Pending', 'On Hold'],
  billingStatus: ['Open', 'Completed', 'On-Hold'],
  level: ['High', 'Medium', 'Low'],
  riskStatus: ['Open', 'Mitigating', 'Closed'],
  iadType: ['Issue', 'Dependency'],
  iadStatus: ['Open', 'In Progress', 'Overdue', 'Closed'],
  followup: ['Email', 'Call', 'Meeting', 'Letter', 'Other'],
  raidType: ['Risk', 'Assumption', 'Issue', 'Dependency'],
  raidStatus: ['Open', 'In Progress', 'Mitigating', 'Overdue', 'Closed'],
  defectType: ['Internal Review', 'External Review', 'Internal Testing Review', 'External Testing Review']
};

/* Old values from before the workbook was adopted, mapped on to the new lists. */
const LEGACY = {
  projectStatus: { 'Active': 'In Progress', 'On hold': 'Hold', 'Closed': 'Completed' },
  projectType: { 'Fixed price': 'Fixed Price', 'Milestone-linked': 'Fixed Price', 'Outcome-based': 'Fixed Price',
    'Time & material': 'T&M', 'AMC / retainer': 'AMC', 'AMC / O&M': 'AMC', 'Build / Development': 'Fixed Price',
    'Implementation': 'Fixed Price', 'Staff augmentation': 'T&M', 'Product deployment': 'Fixed Price', 'Consulting': 'T&M' },
  stage: { 'Initation': 'Initiation', 'Requirment': 'Requirement', 'Prorotypes': 'Prototypes', 'Desing & Development': 'Design & Development',
    'Planning': 'Initiation', 'Requirements': 'Requirement', 'Design': 'Design & Development', 'Development': 'Design & Development',
    'Testing / UAT': 'Testing', 'Go-live': 'Go-Live', 'Hypercare': 'Go-Live', 'Support / AMC': 'Go-Live', 'Closure': 'Go-Live' },
  milestoneStatus: { 'Active': 'In Progress', 'Achieved': 'Completed', 'Cancelled': 'On Hold' },
  iadStatus: { 'Received / closed': 'Closed', 'Committed with date': 'In Progress' }
};

const isOpenIad = d => d && d.status !== 'Closed';
const isOpenRisk = r => r && r.status !== 'Closed';
const isDoneMilestone = m => m && (!!m.actual_date || m.status === 'Completed');

/* ---------- record specs ----------
 * c: { key, h: header on the sheet, alias: other spellings, kind, options, req, hint, eg }
 * key: the fields that identify a row within a project (upsert key). */
const RECORDS = {
  milestones: {
    sheet: 'Milestone', table: 'milestones', label: 'Milestones', key: ['ref'],
    cols: [
      { key: 'ref', h: 'Milestone ID', kind: 'text', hint: 'Optional — the milestone name is used when blank', eg: 'M03', extra: true },
      { key: 'name', h: 'Milestone Name', kind: 'text', req: true, eg: 'Stakeholder wireframe freeze' },
      { key: 'plan_start', h: 'Plan Start Date', kind: 'date', eg: '01-08-2026' },
      { key: 'baseline_date', h: 'Plan End Date', kind: 'date', req: true, hint: 'From the frozen plan', eg: '01-09-2026' },
      { key: 'forecast_start', h: 'Forcast Start Date', alias: ['Forecast Start Date'], kind: 'date', eg: '05-08-2026' },
      { key: 'forecast_date', h: 'Forcast End Date', alias: ['Forecast End Date'], kind: 'date', hint: 'Your honest current view', eg: '19-09-2026' },
      { key: 'actual_start', h: 'Actual Start Date', kind: 'date', eg: '05-08-2026' },
      { key: 'actual_date', h: 'Actual End Date', kind: 'date', hint: 'Blank until achieved', eg: '' },
      { key: 'estimated_effort_hrs', h: 'Estimated Efforts (hs)', alias: ['Estimated Efforts (hrs)', 'Estimated Efforts'], kind: 'num', eg: '1200' },
      { key: 'actual_effort_hrs', h: 'Actual Efforts (hrs)', alias: ['Actual Efforts'], kind: 'num', eg: '1280' },
      { key: 'pct_complete', h: 'Percentage Completed', kind: 'pct', eg: '70' },
      { key: 'is_billing', h: 'Is this milestone to be invoiced', kind: 'pick', options: LISTS.yesNo, eg: 'Yes' },
      { key: 'status', h: 'Milestone Status', kind: 'pick', options: LISTS.milestoneStatus, req: true, eg: 'In Progress' },
      { key: 'signoff_status', h: 'Milestone Signoff Status', kind: 'pick', options: LISTS.signoff, eg: 'Pending' },
      { key: 'target_date', h: 'Milestone Target Date', kind: 'date', eg: '30-09-2026' },
      { key: 'remarks', h: 'Remarks', kind: 'text', hint: 'Required when the forecast end is later than the plan end', eg: 'Client data validation pending' }
    ],
    check(r) {
      const e = [];
      if (r.baseline_date && r.forecast_date && r.forecast_date > r.baseline_date && !r.remarks) e.push(['remarks', 'Give a reason in Remarks — the forecast end is later than the plan end']);
      if (r.status === 'Completed' && !r.actual_date) e.push(['actual_date', 'A completed milestone needs its actual end date']);
      if (r.actual_date && r.status && r.status !== 'Completed') e.push(['status', 'There is an actual end date, so the status should be Completed']);
      if (r.plan_start && r.baseline_date && r.baseline_date < r.plan_start) e.push(['baseline_date', 'Plan end is before plan start']);
      return e;
    },
    prepare(r) { if (!r.ref) { r.ref = r.name; r._refFromName = true; } r.slip_reason = r.remarks || null; return r; },
    altKey: ['name']
  },
  billing: {
    sheet: 'Billing', table: 'billing', label: 'Billing', key: ['milestone_name', 'billing_date'],
    cols: [
      { key: 'milestone_name', h: 'Milestone Name', kind: 'text', req: true, eg: 'Stakeholder wireframe freeze' },
      { key: 'amount_cr', h: 'Billing Amount', alias: ['Billing Amount (₹ Cr)'], kind: 'num', req: true, hint: 'Rupees crore', eg: '1.8' },
      { key: 'billing_date', h: 'Billing Date', kind: 'date', req: true, eg: '30-09-2026' },
      { key: 'status', h: 'Billing Status', kind: 'pick', options: LISTS.billingStatus, req: true, eg: 'Open' },
      { key: 'remarks', h: 'Remarks', kind: 'text', eg: 'Invoice after sign-off' }
    ]
  },
  risks: {
    sheet: 'Risk', table: 'risks', label: 'RAID', key: ['ref'], projectCol: { h: 'Project ID', alias: ['Project Code'] },
    cols: [
      { key: 'ref', h: 'RAID ID', alias: ['Risk ID'], kind: 'text', req: true, eg: 'R001' },
      { key: 'description', h: 'Description', kind: 'text', req: true, eg: 'Legacy account data mapping errors may extend migration timeline' },
      { key: 'owner_name', h: 'Owner', kind: 'text', req: true, hint: 'A named person, not a team', eg: 'R. Nandi' },
      { key: 'impact', h: 'Impact', kind: 'pick', options: LISTS.level, req: true, eg: 'High' },
      { key: 'probability', h: 'Probability (Risks only)', alias: ['Probability'], kind: 'pick', options: LISTS.level, eg: 'High' },
      { key: 'raised_date', h: 'Raised Date', kind: 'date', eg: '01-06-2026' },
      { key: 'target_date', h: 'Target / Due Date', alias: ['Target Date', 'Due Date'], kind: 'date', eg: '15-09-2026' },
      { key: 'status', h: 'Status', kind: 'pick', options: LISTS.riskStatus, req: true, eg: 'Open' },
      { key: 'mitigation', h: 'Mitigation / Next Steps', alias: ['Mitigation'], kind: 'text', eg: 'Data quality SWAT team engaged; daily defect triage' },
      { key: 'contingency', h: 'Contingency Plan', kind: 'text', eg: 'Phase the migration by district' },
      { key: 'closed_date', h: 'Closed Date', kind: 'date', eg: '' }
    ],
    check(r) { return r.status === 'Closed' && !r.closed_date ? [['closed_date', 'A closed item needs its closed date']] : []; }
  },
  iad: {
    sheet: 'IAD', table: 'dependencies', label: 'Issues & dependencies (IAD)', key: ['ref'],
    cols: [
      { key: 'ref', h: 'DEPENDENCY_ID', alias: ['IAD ID', 'Dependency ID'], kind: 'text', req: true, eg: 'D-07' },
      { key: 'iad_type', h: 'Type', kind: 'pick', options: LISTS.iadType, req: true, eg: 'Dependency' },
      { key: 'description', h: 'DESCRIPTION', kind: 'text', req: true, eg: 'Cluster master data validation for 12 districts' },
      { key: 'owner_at_client', h: 'Owner', kind: 'text', req: true, hint: 'A named person — "the department" is not an owner', eg: 'Shri A. Kumar, Director (Industries)' },
      { key: 'raised_date', h: 'RAISED_DATE', kind: 'date', eg: '29-08-2026' },
      { key: 'milestone_blocked', h: 'Milestone Impacted', kind: 'text', eg: 'Stakeholder wireframe freeze' },
      { key: 'status', h: 'STATUS', kind: 'pick', options: LISTS.iadStatus, req: true, eg: 'Open' },
      { key: 'last_followup_date', h: 'LAST_FOLLOWUP_DATE', kind: 'date', eg: '12-09-2026' },
      { key: 'followup_mode', h: 'FOLLOWUP_MODE', kind: 'pick', options: LISTS.followup, eg: 'Email' },
      { key: 'closed_date', h: 'CLOSED_DATE', kind: 'date', eg: '' },
      { key: 'value_blocked', h: 'Value Held (₹ Cr)', kind: 'num', extra: true, hint: 'Optional — billing held up by this item', eg: '1.8' }
    ],
    check(r) { return r.status === 'Closed' && !r.closed_date ? [['closed_date', 'A closed item needs its closed date']] : []; }
  },
  /* RAID log: risks, assumptions, issues and dependencies in one register (the PMO's Risk and IAD sheets
     clubbed). Risks and assumptions are stored with the risks, issues and dependencies with the IAD items,
     so scoring and the client follow-up screens are unchanged. */
  raid: {
    sheet: 'RAID', alias: ['RAID Log'], table: null, label: 'RAID log — risks, assumptions, issues, dependencies', key: ['ref'],
    projectCol: { h: 'Project ID', alias: ['Project Code'] },
    cols: [
      { key: 'ref', h: 'RAID ID', alias: ['Risk ID', 'DEPENDENCY_ID', 'IAD ID'], kind: 'text', req: true, eg: 'R001' },
      { key: 'raid_type', h: 'Type', kind: 'pick', options: LISTS.raidType, req: true, eg: 'Risk' },
      { key: 'description', h: 'Description', alias: ['DESCRIPTION'], kind: 'text', req: true, eg: 'Legacy account data mapping errors may extend migration timeline' },
      { key: 'owner', h: 'Owner', kind: 'text', req: true, hint: 'A named person — "the department" is not an owner', eg: 'R. Nandi' },
      { key: 'impact', h: 'Impact', kind: 'pick', options: LISTS.level, eg: 'High' },
      { key: 'probability', h: 'Probability (Risks only)', alias: ['Probability'], kind: 'pick', options: LISTS.level, eg: 'High' },
      { key: 'raised_date', h: 'Raised Date', alias: ['RAISED_DATE'], kind: 'date', eg: '01-06-2026' },
      { key: 'target_date', h: 'Target / Due Date', alias: ['Target Date', 'Due Date'], kind: 'date', eg: '15-09-2026' },
      { key: 'status', h: 'Status', alias: ['STATUS'], kind: 'pick', options: LISTS.raidStatus, req: true, eg: 'Open' },
      { key: 'mitigation', h: 'Mitigation / Next Steps', alias: ['Mitigation'], kind: 'text', eg: 'Data quality SWAT team engaged; daily defect triage' },
      { key: 'contingency', h: 'Contingency Plan', kind: 'text', eg: 'Phase the migration by district' },
      { key: 'milestone_impacted', h: 'Milestone Impacted', kind: 'text', eg: 'Stakeholder wireframe freeze' },
      { key: 'last_followup_date', h: 'Last Follow-up Date', alias: ['LAST_FOLLOWUP_DATE'], kind: 'date', eg: '12-09-2026' },
      { key: 'followup_mode', h: 'Follow-up Mode', alias: ['FOLLOWUP_MODE'], kind: 'pick', options: LISTS.followup, eg: 'Email' },
      { key: 'closed_date', h: 'Closed Date', alias: ['CLOSED_DATE'], kind: 'date', eg: '' },
      { key: 'value_blocked', h: 'Value Held (₹ Cr)', kind: 'num', extra: true, hint: 'Optional — billing held up by this item', eg: '1.8' }
    ],
    check(r) {
      const e = [];
      if (r.status === 'Closed' && !r.closed_date) e.push(['closed_date', 'A closed item needs its closed date']);
      if (r.raid_type === 'Risk' && (!r.impact || !r.probability)) e.push([!r.impact ? 'impact' : 'probability', 'A risk needs both impact and probability']);
      return e;
    }
  },
  defects: {
    sheet: 'defects', table: 'defects', label: 'Defects', key: ['defect_type', 'phase_injected', 'milestone_name'],
    cols: [
      { key: 'defect_type', h: 'Defect Type', kind: 'pick', options: LISTS.defectType, req: true, eg: 'Internal Testing Review' },
      { key: 'total', h: 'Total Defects', kind: 'num', req: true, eg: '12' },
      { key: 'phase_injected', h: 'Phase Injected', kind: 'pick', options: LISTS.stage, req: true, eg: 'Design & Development' },
      { key: 'reopen_count', h: 'REOPEN_COUNT', alias: ['Reopen Count'], kind: 'num', eg: '1' },
      { key: 'milestone_name', h: 'Milestone Name', kind: 'text', eg: 'Stakeholder wireframe freeze' }
    ]
  },
  pci: {
    sheet: 'PCI', table: 'pci_audits', label: 'Process compliance (PCI)', key: ['audit_date'],
    cols: [
      { key: 'audit_date', h: 'Audit Date', kind: 'date', req: true, eg: '15-09-2026' },
      { key: 'pci_score', h: 'PCI Score', kind: 'pct', req: true, hint: '0–100, "90%" is accepted', eg: '90' },
      { key: 'open_ncs', h: 'Open NCs', kind: 'num', eg: '3' }
    ]
  },
  activities: {
    sheet: 'Weekly achivements&nextweekplan', alias: ['Weekly achievements', 'Weekly achievements & next week plan'], table: 'weekly_activities',
    label: 'Weekly achievements & next-week plan', key: ['week_ending', 'activity'],
    cols: [
      { key: 'activity', h: 'Activities', alias: ['Activity'], kind: 'text', req: true, eg: 'Module 3 build' },
      { key: 'this_week_status', h: 'This Week Status', kind: 'text', eg: 'Screens 1–6 complete, 7–9 in review' },
      { key: 'next_action', h: 'Next Action', kind: 'text', eg: 'Complete screens 7–9; start UAT scripts' },
      { key: 'week_ending', h: 'Week Ending', kind: 'date', extra: true, hint: 'Optional — this week when blank', eg: '' }
    ]
  }
};

/* ---------- parsing ---------- */
const norm = s => String(s === null || s === undefined ? '' : s).toLowerCase().replace(/[^a-z0-9]+/g, '');
const headersOf = c => [c.h].concat(c.alias || []).map(norm);

function parseDateCell(v) {
  if (v === '' || v === null || v === undefined) return null;
  if (v instanceof Date) return isNaN(v) ? undefined : v.toISOString().slice(0, 10);
  const s = String(v).trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s); if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = /^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})$/.exec(s);                 // DD-MM-YYYY
  if (m) return `${m[3]}-${String(m[2]).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}`;
  m = /^(\d{1,2})[-\s]([A-Za-z]{3,9})[-\s,]*(\d{2,4})$/.exec(s);         // 01-Jun-26, 1 June 2026
  if (m) {
    const mon = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'].indexOf(m[2].slice(0, 3).toLowerCase());
    if (mon >= 0) { const y = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]); return `${y}-${String(mon + 1).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}`; }
  }
  return undefined;
}

/* Clean one value for a column spec. Returns [value, error|null]; value undefined = blank. */
function cleanValue(c, raw, legacy) {
  if (raw === undefined || raw === null || String(raw).trim() === '') return [undefined, null];
  const s = String(raw).trim();
  if (c.kind === 'text') return [s.slice(0, 1000), null];
  if (c.kind === 'date') { const d = parseDateCell(raw); return d === undefined ? [undefined, 'Not a readable date (use DD-MM-YYYY)'] : [d, null]; }
  if (c.kind === 'pick') {
    const lk = legacy && Object.keys(legacy).find(k => norm(k) === norm(s));
    const hit = c.options.find(o => norm(o) === norm(s)) || (lk && legacy[lk]);
    return hit ? [c.key === 'is_billing' ? (hit === 'Yes' ? 1 : 0) : hit, null] : [undefined, `Use one of: ${c.options.join(', ')}`];
  }
  const x = Number(s.replace(/[,%₹\s]/g, '').replace(/cr$/i, ''));
  if (isNaN(x)) return [undefined, 'Must be a number'];
  if (x < 0) return [undefined, 'Cannot be negative'];
  if (c.kind === 'pct' && x > 100) return [undefined, 'Must be between 0 and 100'];
  /* Excel stores 90% as 0.9; a fraction typed without a % sign is read the same way. */
  if (c.kind === 'pct' && x > 0 && x < 1 && s.indexOf('%') < 0) return [Math.round(x * 10000) / 100, null];
  return [x, null];
}

/* A row whose cells list the allowed values ("High, Low, Medium") is a hint row from the
   PMO workbook, not data. */
function isHintRow(spec, row) {
  return spec.cols.some(c => c.options && typeof row[c.key] === 'string' && row[c.key].indexOf(',') > 0 &&
    c.options.filter(o => norm(row[c.key]).indexOf(norm(o)) >= 0).length >= 2);
}

/* Validate one parsed sheet row against a spec. Returns { data, errors:[{field,message}] }. */
function cleanRecord(spec, raw) {
  const data = {}, errors = [];
  const legacyFor = c => c.key === 'status' && spec.table === 'milestones' ? LEGACY.milestoneStatus
    : c.key === 'status' && (spec.table === 'dependencies' || spec.table === null) ? LEGACY.iadStatus
    : c.key === 'phase_injected' ? LEGACY.stage : null;
  for (const c of spec.cols) {
    const [v, err] = cleanValue(c, raw[c.key], legacyFor(c));
    if (err) errors.push({ field: c.h, message: err });
    else if (v !== undefined) data[c.key] = v;
    else if (c.req && !(c.key === 'ref' && spec.table === 'milestones')) errors.push({ field: c.h, message: 'Required' });
  }
  if (spec.check && !errors.length) spec.check(data).forEach(([k, m]) => errors.push({ field: (spec.cols.find(c => c.key === k) || {}).h || k, message: m }));
  if (spec.prepare) spec.prepare(data);
  return { data, errors };
}

/* What the client needs to render forms: specs without functions. */
function publicSpecs() {
  const out = {};
  Object.keys(RECORDS).forEach(k => {
    const s = RECORDS[k];
    out[k] = { sheet: s.sheet, label: s.label, key: s.key, table: s.table, cols: s.cols.map(c => Object.assign({}, c)) };
  });
  return { records: out, lists: LISTS };
}

const RISK_TYPES = ['Risk', 'Assumption'];
/* Stored risks and IAD items as one RAID list (each row remembers where it is stored). */
function raidRows(risks, deps) {
  return (risks || []).map(r => ({ id: r.id, _src: 'risks', ref: r.ref, raid_type: RISK_TYPES.indexOf(r.category) >= 0 ? r.category : 'Risk',
    description: r.description, owner: r.owner_name, impact: r.impact || null, probability: r.probability || null, raised_date: r.raised_date,
    target_date: r.target_date, status: r.status, mitigation: r.mitigation, contingency: r.contingency, closed_date: r.closed_date }))
    .concat((deps || []).map(d => ({ id: d.id, _src: 'iad', ref: d.ref, raid_type: d.iad_type === 'Issue' ? 'Issue' : 'Dependency',
      description: d.description, owner: d.owner_at_client, raised_date: d.raised_date, target_date: d.committed_date, status: d.status,
      milestone_impacted: d.milestone_blocked, last_followup_date: d.last_followup_date, followup_mode: d.followup_mode,
      closed_date: d.closed_date, value_blocked: d.value_blocked })))
    .sort((a, b) => String(a.ref).localeCompare(String(b.ref)));
}
/* A RAID row as the stored record it belongs to: { kind: 'risks' | 'iad', data } */
function raidSplit(r) {
  const has = k => r[k] !== undefined;
  if (RISK_TYPES.indexOf(r.raid_type) >= 0) {
    const d = { ref: r.ref, category: r.raid_type, description: r.description, owner_name: r.owner };
    ['impact', 'probability', 'raised_date', 'target_date', 'mitigation', 'contingency', 'closed_date'].forEach(k => { if (has(k)) d[k] = r[k]; });
    if (has('status')) d.status = r.status === 'In Progress' || r.status === 'Overdue' ? 'Open' : r.status;
    if (!d.impact && r.raid_type === 'Assumption') d.impact = 'Low';
    if (!d.probability && r.raid_type === 'Assumption') d.probability = 'Low';
    return { kind: 'risks', data: d };
  }
  const d = { ref: r.ref, iad_type: r.raid_type, description: r.description, owner_at_client: r.owner };
  if (has('raised_date')) d.raised_date = r.raised_date;
  if (has('target_date')) d.committed_date = r.target_date;
  if (has('milestone_impacted')) d.milestone_blocked = r.milestone_impacted;
  ['status', 'last_followup_date', 'followup_mode', 'closed_date', 'value_blocked'].forEach(k => { if (has(k)) d[k] = r[k]; });
  if (d.status === 'Mitigating') d.status = 'In Progress';
  return { kind: 'iad', data: d };
}

module.exports = { raidRows, raidSplit, RISK_TYPES, LISTS, LEGACY, RECORDS, norm, headersOf, parseDateCell, cleanValue, cleanRecord, isHintRow, publicSpecs,
  isOpenIad, isOpenRisk, isDoneMilestone };
