/* Demo data: 13 users, 8 engagements, weekly history, audit register and quality reports.
 * Safe to run again: existing users and projects are kept and brought in step with this file.
 *   npm run seed
 */
const config = require('../../config');
const logger = require('../../utils/logger').child({ component: 'seed' });
const db = require('../connection');
const { runMigrations } = require('../migrate');
const M = require('../../models');
const auth = require('../../services/auth.service');
const state = require('../../services/project-state.service');
const { now, weekEnding } = require('../../utils/dates');

const PW = config.seed.password;

/* Role-based sign-in addresses, so a demo audience can tell who is who from the email alone. */
const USERS = [
  ['ceo@uneecops.in',           'Sushant Dubey',   'ceo',      null],
  ['admin@uneecops.in',         'Ketan Jain',      'admin',    null],
  ['deliveryhead@uneecops.in',  'Manoj Nagpal',    'dh',       'Govt Digital'],
  ['deliveryhead2@uneecops.in', 'M. Grover',      'dh',       'Run / AMC'],
  ['director@uneecops.in',      'Ketan Jain',      'director', 'Govt Digital'],
  ['director2@uneecops.in',     'Piyush Jain',       'director', 'AI & Data'],
  ['pm1@uneecops.in',           'Sandeep Tinna',       'pm',       'Govt Digital'],
  ['pm2@uneecops.in',           'A. Nair',        'pm',       'AI & Data'],
  ['pm3@uneecops.in',           'D. Barman',      'pm',       'Govt Digital'],
  ['pm4@uneecops.in',           'M. Ali',     'pm',       'Run / AMC'],
  ['pm5@uneecops.in',           'K. Iyer',        'pm',       'AI & Data'],
  ['pm6@uneecops.in',           'P. Rao',         'pm',       'Enterprise Apps'],
  ['auditor@uneecops.in',       'Quality Audit',  'auditor',  null]
];



const PROJECTS = [
  ['CIMS-BR-01','Bihar RAMP CIMS Platform','Industries Department, Government of Bihar','Govt Digital','Fixed Price','Fixed Price','pm1@uneecops.in','deliveryhead@uneecops.in',12.6,28],
  ['MSME-MN-01','Manipur MSME One Application','Commerce & Industries, Manipur','Govt Digital','Fixed Price','Fixed Price','pm3@uneecops.in','deliveryhead@uneecops.in',8.4,27],
  ['AIS-GJ-01','AI Sangrah Knowledge Platform','DICT, Government of Gujarat','AI & Data','Fixed Price','Fixed Price','pm2@uneecops.in','deliveryhead@uneecops.in',18.9,31],
  ['DMS-MOF-01','Budget Archive Digitisation','Ministry of Finance','AI & Data','Fixed Price','Fixed Price','pm5@uneecops.in','deliveryhead@uneecops.in',9.7,34],
  ['BHV-HR-01','Bhavishya Vibhag Portal','Department of Future, Haryana','Govt Digital','Fixed Price','Fixed Price','pm1@uneecops.in','deliveryhead@uneecops.in',6.8,30],
  ['EDIS-UP-01','e-District Operate & Maintain','Government of Uttar Pradesh','Run / AMC','AMC','AMC','pm4@uneecops.in','deliveryhead2@uneecops.in',5.5,22],
  ['HRMS-PSU-01','HRMS Modernisation','Central PSU','Enterprise Apps','T&M','T&M','pm6@uneecops.in','deliveryhead2@uneecops.in',7.2,24],
  ['LMS-OD-01','Skill Mission LMS','Skill Development Department, Odisha','Govt Digital','Fixed Price','Fixed Price','pm3@uneecops.in','deliveryhead@uneecops.in',3.6,26]
];

/* One realistic current week per project so every screen has something to show. */
const STATUS = {
  'CIMS-BR-01': { pct_complete:54.2, budget_consumed_pct:61.4, effort_baseline_pd:1840, effort_actual_pd:1128, etc_pd:820, spi:0.94, cpi:1.02, margin_at_completion:26.1, unbilled_wip:1.8, ar_over_90:0, defects_open:38, defects_leaked:5, defects_reopened:4, sla_breaches:0, timesheet_compliance:91, over_allocated:1, attrition_flag:0, pm_rag:'Amber', pm_rag_reason:'Wireframe freeze blocked on cluster master data validation', narrative:'M03 forecast moved to 19 Sep; cost performance holding at CPI 1.02.' },
  'MSME-MN-01': { pct_complete:48, budget_consumed_pct:53, effort_baseline_pd:1260, effort_actual_pd:668, etc_pd:640, spi:0.89, cpi:0.97, margin_at_completion:22.8, unbilled_wip:1.6, ar_over_90:0.6, defects_open:21, defects_leaked:3, defects_reopened:2, sla_breaches:0, timesheet_compliance:94, over_allocated:0, attrition_flag:0, pm_rag:'Amber', pm_rag_reason:'UAT nomination not received from the department', narrative:'Module-3 UAT cannot start until the department nominates a test team.' },
  'AIS-GJ-01':  { pct_complete:40, budget_consumed_pct:58, effort_baseline_pd:3100, effort_actual_pd:1798, etc_pd:1720, spi:0.82, cpi:0.88, margin_at_completion:19.4, unbilled_wip:2.4, ar_over_90:1.1, defects_open:44, defects_leaked:9, defects_reopened:7, sla_breaches:0, timesheet_compliance:84, over_allocated:3, attrition_flag:1, pm_rag:'Red', pm_rag_reason:'Data-set clearance pending from six line departments since 06 Aug', narrative:'Phase-2 UAT frozen. Re-plan needed rather than a push.' },
  'DMS-MOF-01': { pct_complete:62, budget_consumed_pct:59, effort_baseline_pd:1520, effort_actual_pd:897, etc_pd:560, spi:1.03, cpi:1.06, margin_at_completion:36.2, unbilled_wip:0.9, ar_over_90:0, defects_open:9, defects_leaked:1, defects_reopened:0, sla_breaches:0, timesheet_compliance:98, over_allocated:0, attrition_flag:0, pm_rag:'Green', pm_rag_reason:'', narrative:'On-prem OCR pipeline on track for the single-shot deployment window.' },
  'BHV-HR-01':  { pct_complete:66, budget_consumed_pct:62, effort_baseline_pd:980, effort_actual_pd:608, etc_pd:320, spi:1.05, cpi:1.04, margin_at_completion:31.5, unbilled_wip:0.7, ar_over_90:0, defects_open:6, defects_leaked:0, defects_reopened:0, sla_breaches:0, timesheet_compliance:100, over_allocated:0, attrition_flag:0, pm_rag:'Green', pm_rag_reason:'', narrative:'Launch build tracking to the ministerial event date.' },
  'EDIS-UP-01': { pct_complete:70, budget_consumed_pct:76, effort_baseline_pd:720, effort_actual_pd:547, etc_pd:210, spi:1.00, cpi:0.91, margin_at_completion:14.6, unbilled_wip:2.2, ar_over_90:1.4, defects_open:12, defects_leaked:2, defects_reopened:1, sla_breaches:2, timesheet_compliance:88, over_allocated:2, attrition_flag:0, pm_rag:'Red', pm_rag_reason:'Sev-1 SLA breached twice in August; penalty accruing', narrative:'Run cost above plan. RCA acceptance pending with the client PMU.' },
  'HRMS-PSU-01':{ pct_complete:52, budget_consumed_pct:55, effort_baseline_pd:1400, effort_actual_pd:770, etc_pd:700, spi:0.97, cpi:0.99, margin_at_completion:23.1, unbilled_wip:1.1, ar_over_90:0, defects_open:17, defects_leaked:2, defects_reopened:1, sla_breaches:0, timesheet_compliance:96, over_allocated:1, attrition_flag:0, pm_rag:'Amber', pm_rag_reason:'Legacy payroll rules undocumented', narrative:'Parallel run cycle 2 scheduled; rule documentation is the open dependency.' },
  'LMS-OD-01':  { pct_complete:44, budget_consumed_pct:50, effort_baseline_pd:640, effort_actual_pd:320, etc_pd:360, spi:0.91, cpi:0.95, margin_at_completion:21.7, unbilled_wip:0.8, ar_over_90:0.3, defects_open:14, defects_leaked:3, defects_reopened:2, sla_breaches:0, timesheet_compliance:89, over_allocated:0, attrition_flag:0, pm_rag:'Amber', pm_rag_reason:'Client-supplied content incomplete for two batches', narrative:'Migration batch 4 at risk on content availability.' }
};

/* Project details: stage, presales hrs, budget Cr, budgeted hrs, expenses budget Cr,
   planned hrs to date, actual hrs to date, actual cost to date Cr. */
const DETAILS = {
  'CIMS-BR-01': ['Design & Development', 420, 9.1, 14720, 0.60,  8200,  8900, 6.60],
  'MSME-MN-01': ['Testing', 260, 6.1, 10080, 0.40,  5100,  5400, 4.40],
  'AIS-GJ-01':  ['Testing', 610, 13.0, 24800, 1.10, 11600, 14400, 8.90],
  'DMS-MOF-01': ['Go-Live',       300, 6.2, 12160, 0.50,  7400,  7200, 5.10],
  'BHV-HR-01':  ['Design & Development', 180, 4.8,  7840, 0.30,  5000,  4900, 3.60],
  'EDIS-UP-01': ['Go-Live', 120, 4.7,  5760, 0.30,  4300,  4500, 4.20],
  'HRMS-PSU-01':['Testing', 240, 5.5, 11200, 0.40,  5800,  6000, 3.80],
  'LMS-OD-01':  ['Design & Development', 140, 2.7,  5120, 0.20,  2300,  2500, 1.90]
};

/* Process-metric inputs, derived from each project's actual hours so most metrics land inside
   the baseline. The multipliers push a few projects out of limits on purpose, so the screens
   show both cases: defect-heavy (dx), review-light (rv), UAT-leaky (ux), slipping (slip days). */
const PROCESS_SHAPE = {
  'CIMS-BR-01': { dx: 1.0, rv: 0.75, ux: 1.0, slip: 19 },
  'MSME-MN-01': { dx: 1.2, rv: 1.0,  ux: 1.0, slip: 16 },
  'AIS-GJ-01':  { dx: 2.6, rv: 0.45, ux: 1.6, slip: 48 },
  'DMS-MOF-01': { dx: 0.8, rv: 1.1,  ux: 0.8, slip: 0 },
  'BHV-HR-01':  { dx: 0.7, rv: 1.0,  ux: 1.0, slip: 0 },
  'EDIS-UP-01': { dx: 1.3, rv: 1.0,  ux: 3.2, slip: 0 },
  'HRMS-PSU-01':{ dx: 1.0, rv: 1.0,  ux: 1.0, slip: 7 },
  'LMS-OD-01':  { dx: 1.1, rv: 0.9,  ux: 1.2, slip: 10 }
};
function processInputs(code, actualHrs, endDate, stage) {
  const k = PROCESS_SHAPE[code] || { dx: 1, rv: 1, ux: 1, slip: 0 };
  const A = actualHrs, rate = 0.031 * k.dx, R0 = x => Math.max(0, Math.round(x));
  const inUat = ['Testing', 'UAT', 'Go-Live'].indexOf(stage) >= 0;
  const req = A * 0.50, des = A * 0.06, dev = A * 0.19, tst = A * 0.20;
  const reqD = R0(rate * req / 8), ddD = R0(rate * (des + dev) / 8), tD = R0(rate * tst / 8);
  const uD = inUat ? Math.max(1, R0(tD * 0.15 * k.ux)) : 0;
  const uat = inUat ? R0(uD * 8 / (0.031 * (k.ux > 1.5 ? k.ux : 1))) : 0;
  const pre = reqD + ddD + tD + uD;
  const drh = R0(A * 0.007), crh = R0(A * 0.02);
  const fe = new Date(endDate); fe.setUTCDate(fe.getUTCDate() + k.slip);
  return {
    forecast_end_date: fe.toISOString().slice(0, 10),
    req_effort_hrs: R0(req), design_effort_hrs: R0(des), dev_effort_hrs: R0(dev), testing_effort_hrs: R0(tst), uat_effort_hrs: uat,
    review_effort_hrs: R0(A * 0.05 * k.rv), design_review_hrs: drh, code_review_hrs: crh,
    req_defects: reqD, design_dev_defects: ddD, testing_defects: tD, uat_defects: uD,
    post_delivery_defects: R0(pre * 0.03 * k.ux), review_defects: R0(pre * 0.6 * k.rv),
    design_review_defects: R0(drh * 0.76 * k.rv), code_review_defects: R0(crh * 0.35 * k.rv),
    size_delivered: R0(A / 8 * 0.6), total_requirements: R0(150 + A / 100), requirement_changes: R0((150 + A / 100) * 0.08 * k.dx)
  };
}

/* IAD items that are issues rather than dependencies */
const ISSUES = ['D-04@EDIS-UP-01', 'D-05@MSME-MN-01'];

/* Defect log by type and phase injected, shaped so most projects sit inside the baseline and the
   defect-heavy ones (PROCESS_SHAPE dx) do not. */
function defectRows(code, actualHrs, stage) {
  const k = PROCESS_SHAPE[code] || { dx: 1, rv: 1, ux: 1 };
  const A = actualHrs, rate = 0.031 * k.dx, R0 = x => Math.max(0, Math.round(x));
  const inUat = ['Testing', 'UAT', 'Go-Live'].indexOf(stage) >= 0;
  const reqD = R0(rate * A * 0.50 / 8), tD = R0(rate * A * 0.20 / 8);
  const uD = inUat ? Math.max(1, R0(tD * 0.15 * k.ux)) : 0;
  const ddAll = R0(rate * A * 0.25 / 8);                       // everything injected in design & build, however found
  const ddReview = Math.max(0, ddAll - tD - uD);
  const rows = [
    { defect_type: 'Internal Review', phase_injected: 'Requirement', total: R0(reqD * 0.6 * k.rv) },
    { defect_type: 'External Review', phase_injected: 'Requirement', total: R0(reqD * 0.25 * k.rv) },
    { defect_type: 'Internal Testing Review', phase_injected: 'Requirement', total: R0(reqD * 0.15) },
    { defect_type: 'Internal Review', phase_injected: 'Design & Development', total: R0(ddReview * k.rv) },
    { defect_type: 'Internal Testing Review', phase_injected: 'Design & Development', total: tD, reopen_count: R0(tD * 0.1) },
    { defect_type: 'External Testing Review', phase_injected: 'Design & Development', total: uD, reopen_count: uD > 2 ? 1 : 0 }
  ];
  return rows.filter(r => r.total > 0);
}
/* PCI audits: [days ago, score %, open NCs] */
const PCI = {
  'CIMS-BR-01': [[-75, 86, 4], [-14, 91, 2]], 'MSME-MN-01': [[-60, 88, 3]], 'AIS-GJ-01': [[-80, 78, 7], [-20, 74, 9]],
  'DMS-MOF-01': [[-45, 95, 1]], 'BHV-HR-01': [[-30, 93, 1]], 'EDIS-UP-01': [[-50, 81, 5], [-10, 84, 4]],
  'HRMS-PSU-01': [[-40, 90, 2]], 'LMS-OD-01': [[-35, 87, 3]]
};
/* This week's achievements and next week's plan: [activity, this week, next action] */
const ACTIVITIES = {
  'CIMS-BR-01': [['Scheme workflow build', 'Screens 1–6 built and reviewed', 'Build screens 7–9; start integration tests'],
                 ['Cluster master data', 'Validated 8 of 12 districts', 'Escalate the remaining 4 districts to the Director']],
  'MSME-MN-01': [['Module 3 UAT', 'Test scripts ready; waiting for nominations', 'Follow up with the Director for the UAT team']],
  'AIS-GJ-01':  [['Phase-2 UAT', 'Frozen — data-set clearance pending', 'Re-plan with the department; propose phased sign-off'],
                 ['Model evaluation', 'Re-sampled corpus with two departments', 'Re-run evaluation and share results']],
  'DMS-MOF-01': [['Go-live rehearsal', 'Dress rehearsal on the isolated rack passed', 'Confirm the deployment window']],
  'BHV-HR-01':  [['Launch build', 'Content pages and registration complete', 'Performance test before the event']],
  'EDIS-UP-01': [['Sev-1 RCA', 'RCA submitted to the PMU', 'Get RCA accepted; close penalty discussion'],
                 ['Cross-training', 'Second engineer shadowing on-call', 'Hand over two runbooks']],
  'HRMS-PSU-01':[['Payroll parallel run 2', 'Run 2 reconciled to 99.2%', 'Fix 14 rule gaps; plan run 3']],
  'LMS-OD-01':  [['Migration batch 4', '60% of content migrated', 'Chase batch 5–6 content from the PMU']]
};

/* Project Information extras: delivery methodology, technology / platform, category */
const INFO = {
  'CIMS-BR-01': ['Agile (Scrum)', 'Java, React, PostgreSQL', 'NICSI'], 'MSME-MN-01': ['Agile (Scrum)', '.NET, Angular, SQL Server', 'GEM'],
  'AIS-GJ-01': ['Hybrid', 'Python, LLM, Azure OpenAI', 'Other'], 'DMS-MOF-01': ['Waterfall', 'OCR, Java, Oracle', 'NICSI'],
  'BHV-HR-01': ['Agile (Kanban)', 'Next.js, Node.js', 'GEM'], 'EDIS-UP-01': ['ITIL support', 'PHP, MySQL', 'NICSI'],
  'HRMS-PSU-01': ['Waterfall', 'SAP SuccessFactors', 'Other'], 'LMS-OD-01': ['Agile (Scrum)', 'Moodle, PHP', 'GEM']
};

/* date offset days from today — or from a given ISO date when one is passed (d(0, '2026-10-04', 7) = a week later) */
const d = (offset, from, plus) => { const x = from ? new Date(String(from).slice(0, 10) + 'T00:00:00Z') : new Date(); x.setUTCDate(x.getUTCDate() + offset + (plus || 0)); return x.toISOString().slice(0, 10); };

const MILESTONES = {
  'CIMS-BR-01': [['M01','Requirements sign-off',-80,-80,-78,1.2,1],['M02','Architecture baseline',-40,-40,-40,0.9,1],['M03','Stakeholder wireframe freeze',-18,-9,null,1.8,1],['M04','Scheme workflow build',25,32,null,2.1,1]],
  'MSME-MN-01': [['M01','Requirements sign-off',-70,-70,-66,0.8,1],['M02','Module 1-2 UAT',-30,-24,-24,1.2,1],['M03','Scheme module 3 UAT',-14,2,null,1.6,1],['M04','Module 4 build start',30,38,null,1.1,1]],
  'AIS-GJ-01':  [['M01','Discovery and corpus plan',-95,-95,-90,2.2,1],['M02','Phase-1 ingestion',-45,-38,-36,3.1,1],['M03','Phase-2 UAT sign-off',-25,23,null,2.4,1]],
  'DMS-MOF-01': [['M01','Pilot digitisation',-60,-60,-62,1.4,1],['M02','On-prem OCR go-live',7,7,null,0.9,1]],
  'BHV-HR-01':  [['M01','Concept sign-off',-55,-55,-57,0.6,1],['M02','Bhavishya Manch launch',9,9,null,0.7,1]],
  'EDIS-UP-01': [['M01','Q2 SLA close',-30,-30,-30,0.3,1],['M02','Q3 SLA close',2,2,null,0.3,1]],
  'HRMS-PSU-01':[['M01','Fit-gap sign-off',-50,-50,-48,1.0,1],['M02','Payroll parallel run 2',-2,5,null,1.1,1]],
  'LMS-OD-01':  [['M01','Platform setup',-45,-45,-44,0.5,1],['M02','Migration batch 4',-6,4,null,0.8,1]]
};
const RISKS = {
  'CIMS-BR-01': [['R-14','Cluster master data still in flux across 12 districts','Client','High','High','Sandeep Tinna','Freeze scope to 8 validated districts for M3',-42,'Mitigating'],
                 ['R-09','Two vendor modules have no SLA on defect turnaround','Technical','Medium','High','Sandeep Tinna','Amend vendor PO before sprint 15',-24,'Open']],
  'MSME-MN-01': [['R-06','Departmental UAT capacity unproven','Client','High','Medium','D. Barman','Offer a joint test team for two weeks',-30,'Open']],
  'AIS-GJ-01':  [['R-02','Data clearance across six departments has no single owner','Client','High','High','A. Nair','Escalate to Principal Secretary level',-60,'Open'],
                 ['R-05','Model evaluation corpus not representative','Technical','High','Medium','A. Nair','Re-sample with department input',-35,'Open']],
  'DMS-MOF-01': [['R-01','Air-gapped deployment window is single-shot','Technical','Medium','High','K. Iyer','Full dress rehearsal on an isolated rack',-20,'Mitigating']],
  'BHV-HR-01':  [['R-01','Launch date tied to a ministerial event','Schedule','Medium','Medium','Sandeep Tinna','Freeze scope four weeks before the date',-25,'Mitigating']],
  'EDIS-UP-01': [['R-03','Sev-1 response depends on one infrastructure engineer','Resource','High','High','M. Ali','Cross-train a second engineer',-28,'Open']],
  'HRMS-PSU-01':[['R-04','Legacy payroll rules undocumented','Technical','High','Medium','P. Rao','Reverse-engineer from 12 months of payslips',-33,'Mitigating']],
  'LMS-OD-01':  [['R-02','Client content delivery slipping','Client','High','Medium','D. Barman','Descope batches 5-6 from this phase',-26,'Open']]
};
const DEPS = {
  'CIMS-BR-01': [['D-07','Cluster master data validation for 12 districts','Shri A. Kumar, Director (Industries)',-30,-10,'M03',1.8,'Open'],
                 ['D-09','Nodal officer nomination, 4 remaining districts','Industries Department, Bihar',-6,null,'M04',0,'Open']],
  'MSME-MN-01': [['D-03','UAT team nomination and test-window confirmation','Director, Commerce & Industries',-19,null,'M03',1.6,'Overdue'],
                 ['D-05','SSL certificate and NIC hosting approval','NIC State Unit',-9,-2,'M03',0,'Open']],
  'AIS-GJ-01':  [['D-01','Data-set sharing clearance, six line departments','Principal Secretary, DICT Gujarat',-50,null,'M03',2.4,'Overdue']],
  'DMS-MOF-01': [['D-02','Deployment window confirmation','Joint Secretary (Budget)',-8,3,'M02',0.9,'Committed with date']],
  'BHV-HR-01':  [],
  'EDIS-UP-01': [['D-04','Sev-1 RCA acceptance for August breaches','e-District PMU, Government of UP',-5,null,'M02',0,'Open']],
  'HRMS-PSU-01':[['D-06','Legacy payroll rule documentation','Finance Controller, Central PSU',-15,null,'M02',0,'Open']],
  'LMS-OD-01':  [['D-08','Course content for batches 5 and 6','State Skill Mission PMU, Odisha',-21,null,'M02',0.8,'Overdue']]
};

/* Weekly effort rows from the project start to this week. Their totals equal the project's planned
   and actual hours to date, so the cumulative figures match the rest of the demo. */
async function seedWeekly(p, det) {
  const db = require('../connection');
  if ((await db.get('SELECT COUNT(*) AS n FROM weekly_efforts WHERE project_id = ?', [p.id])).n) return;
  const weeks = [];
  for (let wk = weekEnding(p.start_date); wk <= weekEnding(); wk = weekEnding(d(0, wk, 7))) weeks.push(wk);
  const n = weeks.length, k = PROCESS_SHAPE[p.code] || { dx: 1, rv: 1, ux: 1 };
  const proc = processInputs(p.code, det[6], p.end_date, det[0]);
  const agile = /agile/i.test((INFO[p.code] || [''])[0]);
  /* a gentle ramp-up: early weeks lighter, weight w = 0.6 → 1.0 */
  const wts = weeks.map((_, i) => 0.6 + 0.4 * Math.min(1, i / 6));
  const tot = wts.reduce((a, b) => a + b, 0);
  const split = (total, jitter) => { let used = 0; return weeks.map((_, i) => {
    if (i === n - 1) return Math.max(0, Math.round((total - used) * 10) / 10);
    const v = Math.max(0, Math.round(total * wts[i] / tot * (1 + (jitter ? Math.sin(i * 1.7 + p.code.length) * jitter : 0)) * 10) / 10); used += v; return v; }); };
  const planned = split(det[5], 0), actual = split(det[6], 0.08);
  const phase = { req_hrs: split(proc.req_effort_hrs, 0.1), design_hrs: split(proc.design_effort_hrs, 0.1), dev_hrs: split(proc.dev_effort_hrs, 0.1),
    testing_hrs: split(proc.testing_effort_hrs, 0.1), uat_hrs: split(proc.uat_effort_hrs, 0.1), review_hrs: split(proc.review_effort_hrs, 0.1),
    design_review_hrs: split(proc.design_review_hrs, 0.1), code_review_hrs: split(proc.code_review_hrs, 0.1) };
  const ints = total => split(total, 0.2).map(Math.round);
  const drd = ints(proc.design_review_defects), crd = ints(proc.code_review_defects), post = ints(proc.post_delivery_defects);
  const size = ints(proc.size_delivered), reqs = weeks.map((_, i) => i < 6 ? Math.round(proc.total_requirements / 6) : 0), chg = ints(proc.requirement_changes);
  const seedN = p.code.charCodeAt(0) + p.code.charCodeAt(1);
  let backlog = agile ? 30 * n + 40 + (seedN % 5) * 25 : null;
  for (let i = 0; i < n; i++) {
    const row = { planned_hrs: planned[i], actual_hrs: actual[i], size_fp: size[i], requirements_added: reqs[i], requirement_changes: chg[i],
      design_review_defects: drd[i], code_review_defects: crd[i], post_delivery_defects: post[i] };
    Object.keys(phase).forEach(f => row[f] = phase[f][i]);
    row.pm_hrs = Math.max(0, Math.round((actual[i] - Object.keys(phase).filter(f => f !== 'design_review_hrs' && f !== 'code_review_hrs').reduce((a, f) => a + phase[f][i], 0)) * 10) / 10);
    if (agile) {
      row.sp_planned = 30 + (seedN % 3) * 4; row.sp_completed = Math.max(16, Math.round(26 + (seedN % 3) * 3 + Math.sin(i * 1.3 + seedN) * 5 - (k.dx > 1.5 ? 6 : 0)));
      backlog = Math.max(0, backlog - row.sp_completed + (i % 4 === 0 ? 12 : 0)); row.sp_backlog = backlog;
    }
    await M.WeeklyEffort.upsert(p.id, weeks[i], row, p.pm_user_id, 'seed');
  }
}

/* A few non-conformances per project from the last audit, some answered, one closed. */
/* category = a label from the nc_categories table (seeded by migration 004) */
const NCS = {
  'AIS-GJ-01': [['Requirement traceability matrix not updated for phase 2', 'RDM - Requirements Development and Management', 'Major', -20, -3, 'Open'],
                ['Code review records missing for 3 modules', 'PR - Peer Reviews', 'Major', -20, 4, 'Open'],
                ['Test plan not baselined before UAT', 'VV - Verification and Validation', 'Minor', -20, 10, 'Open']],
  'EDIS-UP-01': [['Sev-1 incident RCA submitted late', 'CAR - Causal Analysis and Resolution', 'Minor', -15, -2, 'Closure requested'],
                 ['Configuration register out of date', 'CM - Configuration Management', 'Observation', -15, 12, 'Open']],
  'CIMS-BR-01': [['Design review checklist not signed by reviewer', 'PR - Peer Reviews', 'Minor', -30, -10, 'Closed']],
  'MSME-MN-01': [['Weekly status not shared with client PMU for two weeks', 'MC - Monitor and Control', 'Observation', -12, 7, 'Open']],
  'LMS-OD-01':  [['Content migration log incomplete', 'CM - Configuration Management', 'Minor', -10, 14, 'Open']]
};
async function seedAudit(p, auditorId) {
  const db = require('../connection');
  if ((await db.get('SELECT COUNT(*) AS n FROM ncs WHERE project_id = ?', [p.id])).n) return;
  let i = 0;
  for (const [title, cat, sev, raised, due, status] of (NCS[p.code] || [])) {
    i++;
    const id = db.uid('nc');
    const action = status === 'Open' ? null : 'Checklist re-run with the reviewer; records attached in the project repository.';
    const category = await M.NcCategory.activeByLabel(cat);
    await db.run('INSERT INTO ncs (id,project_id,ref,title,description,category,category_id,severity,raised_by,raised_date,due_date,status,assigned_to,action_taken,closed_date,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
      [id, p.id, `NC-${p.code}-${String(i).padStart(2, '0')}`, title, `Found in the process audit of ${d(raised)}.`, cat, category ? category.id : null, sev, auditorId, d(raised), d(due), status,
       p.pm_user_id, action, status === 'Closed' ? d(-4) : null, now()]);
    if (status !== 'Open') await db.run('INSERT INTO nc_comments (id,nc_id,user_id,kind,body,created_at) VALUES (?,?,?,?,?,?)',
      [db.uid('ncc'), id, p.pm_user_id, 'comment', action, new Date(Date.now() - 3 * 864e5).toISOString()]);
    if (status === 'Closed') await db.run('INSERT INTO nc_comments (id,nc_id,user_id,kind,body,created_at) VALUES (?,?,?,?,?,?)',
      [db.uid('ncc'), id, auditorId, 'status', 'Status: Closure requested → Closed. Evidence verified.', new Date(Date.now() - 2 * 864e5).toISOString()]);
  }
}

/* One quality report template from the auditor, a submitted report and a reviewed one. */
async function seedQuality(auditorId) {
  const db = require('../connection');
  if ((await db.get("SELECT COUNT(*) AS n FROM quality_reports WHERE kind = 'template'")).n) return;
  const XLSX = require('xlsx');
  const book = (rows) => { const wb = XLSX.utils.book_new(); const ws = XLSX.utils.aoa_to_sheet(rows); ws['!cols'] = [{ wch: 46 }, { wch: 16 }, { wch: 50 }]; XLSX.utils.book_append_sheet(wb, ws, 'Quality Report'); return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }); };
  const tpl = [['Monthly project quality report'], ['Project code', ''], ['Reporting month', ''], [],
    ['Check', 'Status (Yes / No / NA)', 'Evidence / remarks'],
    ['Requirement traceability matrix updated', '', ''], ['Design reviews done and recorded', '', ''], ['Code reviews done for every module', '', ''],
    ['Test cases executed and results recorded', '', ''], ['Defects logged with phase injected', '', ''], ['Configuration register up to date', '', ''],
    ['Previous NCs closed with evidence', '', ''], [], ['Remarks', '', '']];
  const save = async (name, buf, by) => { const id = db.uid('fil'); await db.run('INSERT INTO files (id,name,mime,size,data,uploaded_by,uploaded_at) VALUES (?,?,?,?,?,?,?)',
    [id, name, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buf.length, buf, by, now()]); return id; };
  const tid = db.uid('qrt');
  await db.run('INSERT INTO quality_reports (id,kind,title,description,file_id,status,due_date,uploaded_by,uploaded_at) VALUES (?,?,?,?,?,?,?,?,?)',
    [tid, 'template', 'Monthly project quality report', 'Fill one per project each month and upload it here.', await save('Monthly-Quality-Report-Template.xlsx', book(tpl), auditorId), 'Active', d(10), auditorId, now()]);
  const filled = (code, ok) => book(tpl.map((r, i) => i === 1 ? ['Project code', code] : i === 2 ? ['Reporting month', 'October 2026'] : i >= 5 && i <= 11 ? [r[0], ok ? 'Yes' : (i % 2 ? 'Yes' : 'No'), ok ? 'Recorded in the repository' : (i % 2 ? 'Recorded' : 'Pending')] : r));
  for (const [code, ok, status, comment] of [['CIMS-BR-01', true, 'Accepted', 'All checks evidenced. Thank you.'], ['AIS-GJ-01', false, 'Rework requested', 'Code review and traceability evidence missing — see NC-AIS-GJ-01-01 and -02.'], ['MSME-MN-01', true, 'Submitted', null]]) {
    const pr = await M.Project.byCode(code); if (!pr) continue;
    const sid = db.uid('qrs');
    await db.run('INSERT INTO quality_reports (id,kind,title,description,project_id,template_id,version,file_id,status,review_comment,uploaded_by,uploaded_at,reviewed_by,reviewed_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
      [sid, 'submission', 'Monthly project quality report', 'October 2026', pr.id, tid, 1, await save(`${code}-Quality-Report-Oct-2026.xlsx`, filled(code, ok), pr.pm_user_id),
       status, comment, pr.pm_user_id, new Date(Date.now() - 4 * 864e5).toISOString(), status === 'Submitted' ? null : auditorId, status === 'Submitted' ? null : new Date(Date.now() - 2 * 864e5).toISOString()]);
    if (status === 'Rework requested') await db.run('INSERT INTO quality_reports (id,kind,title,description,project_id,template_id,parent_id,version,file_id,status,uploaded_by,uploaded_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
      [db.uid('qrv'), 'review', 'Monthly project quality report — auditor version', comment, pr.id, tid, sid, 1, await save(`${code}-Quality-Report-Oct-2026-auditor.xlsx`, filled(code, false), auditorId), status, auditorId, now()]);
  }
}

async function seed() {
  db.open();
  await runMigrations();

  const hash = await auth.hash(PW);
  const byEmail = {};
  for (const [email, name, role, bu] of USERS) {
    let u = await M.User.byEmail(email);
    if (!u) { const id = await M.User.create({ email, name, role, bu, password_hash: hash }); u = { id }; }
    else if (u.name !== name || u.role !== role || (u.bu || null) !== bu)
      await M.User.update(u.id, { name, role, bu, active: 1 });   // keep the seeded roster in step with this file
    byEmail[email] = u.id;
  }

  for (const [code, name, client, bu, ptype, basis, pmEmail, dhEmail, value, bid] of PROJECTS) {
    let p = await M.Project.byCode(code);
    if (!p) {
      const id = await M.Project.create({
        code, name, client, bu, project_type: ptype, commercial_basis: basis, status: 'In Progress',
        pm_user_id: byEmail[pmEmail], dh_user_id: byEmail[dhEmail],
        contract_value: value, margin_at_bid: bid, start_date: d(-180), end_date: d(200)
      });
      p = { id };
    }
    const det = DETAILS[code];
    if (det) await M.Project.updateDetails(p.id, { stage: det[0], presales_hours: det[1], budget_cr: det[2],
      budgeted_hours: det[3], expenses_budget_cr: det[4], planned_effort_hours: det[5], actual_effort_hours: det[6],
      actual_cost_cr: det[7], baselined_effort_hours: Math.round(det[5] * 0.99), delivery_methodology: INFO[code][0],
      technology: INFO[code][1], project_category: INFO[code][2], pct_completed: STATUS[code].pct_complete,
      timesheet_pct: STATUS[code].timesheet_compliance }, byEmail[pmEmail]);
    if (det) await M.Project.updateDetails(p.id, processInputs(code, det[6], (await M.Project.byId(p.id)).end_date, det[0]), byEmail[pmEmail]);
    for (const [ref, mname, bd, fd, ad, val, bill] of (MILESTONES[code] || []))
      await M.Milestone.upsert(p.id, { ref, name: mname, plan_start: d(bd - 30), baseline_date: d(bd),
        forecast_start: d(Math.min(bd, fd) - 30), forecast_date: d(fd), actual_start: bd > 20 ? null : d(bd - 28),
        actual_date: ad === null ? null : d(ad), value_cr: val, is_billing: bill,
        status: ad !== null ? 'Completed' : bd > 20 ? 'Yet to Start' : 'In Progress',
        signoff_status: ad !== null ? 'Received' : 'Pending', target_date: d(fd),
        pct_complete: ad !== null ? 100 : bd > 20 ? 0 : Math.max(10, Math.min(90, Math.round(100 - (fd > 0 ? fd : 0) * 2))),
        estimated_effort_hrs: Math.round(val * 900), actual_effort_hrs: ad !== null ? Math.round(val * 940) : bd > 20 ? 0 : Math.round(val * 600),
        remarks: (ad === null && fd > bd) ? 'Client-side dependency pending' : null });
    /* billing: invoiced on completion of a billing milestone */
    for (const [ref, mname, bd, fd, ad, val, bill] of (MILESTONES[code] || []))
      if (bill && val) await M.Billing.upsert(p.id, { milestone_name: mname, amount_cr: val, billing_date: d(ad !== null ? ad + 12 : fd + 10),
        status: ad !== null ? 'Completed' : 'Open', remarks: ad !== null ? 'Paid' : 'To invoice on sign-off' });
    for (const [ref, desc, cat, prob, imp, owner, mit, raised, status] of (RISKS[code] || []))
      await M.Risk.upsert(p.id, { ref, description: desc, category: cat, probability: prob, impact: imp,
        owner_name: owner, mitigation: mit, target_date: d(20), status, raised_date: d(raised),
        contingency: imp === 'High' ? 'Escalate to Delivery Head and re-plan the affected milestone' : null });
    for (const [ref, desc, owner, raised, committed, blocks, val, status] of (DEPS[code] || []))
      await M.Dependency.upsert(p.id, { ref, description: desc, owner_at_client: owner, raised_date: d(raised),
        committed_date: committed === null ? null : d(committed), milestone_blocked: blocks,
        value_blocked: val, status: status === 'Committed with date' ? 'In Progress' : status,
        iad_type: ISSUES.indexOf(ref + '@' + code) >= 0 ? 'Issue' : 'Dependency',
        last_followup_date: d(Math.max(raised, -4 - (ref.charCodeAt(2) % 5))), followup_mode: ['Email', 'Meeting', 'Call', 'Letter'][ref.charCodeAt(2) % 4] });

    /* defects by type × phase injected, PCI audits and this week's activities */
    if (det) for (const row of defectRows(code, det[6], det[0])) await M.Defect.upsert(p.id, row);
    for (const [ago, score, ncs] of (PCI[code] || [])) await M.PciAudit.upsert(p.id, { audit_date: d(ago), pci_score: score, open_ncs: ncs });
    for (const [act, st, nx] of (ACTIVITIES[code] || [])) await M.Activity.upsert(p.id, { week_ending: weekEnding(), activity: act, this_week_status: st, next_action: nx });

    /* Twelve weekly reports so trend and snapshots exist from day one. */
    const base = STATUS[code];
    for (let w = 11; w >= 0; w--) {
      const wk = weekEnding(d(-7 * w));
      const drift = w / 11;
      const s = Object.assign({}, base, {
        pct_complete: Math.max(0, +(base.pct_complete - drift * base.pct_complete * 0.55).toFixed(1)),
        budget_consumed_pct: Math.max(0, +(base.budget_consumed_pct - drift * base.budget_consumed_pct * 0.52).toFixed(1)),
        effort_actual_pd: Math.round(base.effort_actual_pd * (1 - drift * 0.55)),
        spi: +(base.spi + drift * (1 - base.spi) * 0.8).toFixed(2),
        cpi: +(base.cpi + drift * (1 - base.cpi) * 0.8).toFixed(2),
        margin_at_completion: +(base.margin_at_completion + drift * 4).toFixed(1),
        defects_open: Math.max(0, Math.round(base.defects_open * (1 - drift * 0.4)))
      });
      const id = await M.StatusReport.save(p.id, wk, s, byEmail[pmEmail], 'seed');
      const h = await state.recompute(p.id, wk);
      if (h) await M.Snapshot.write({
        project_id: p.id, week_ending: wk, health_index: h.index, health_state: h.state,
        spi: s.spi, cpi: s.cpi, pct_complete: s.pct_complete, margin_at_completion: s.margin_at_completion,
        slip_days: 0, open_risks: (RISKS[code] || []).length, open_deps: (DEPS[code] || []).length
      });
    }
    await state.recompute(p.id);
  }

  await M.AppConfig.set('health_weights', require('../../domain/health').DEFAULT_WEIGHTS);

  /* weekly effort from project start, audit register, quality reports, and 12 weeks of history */
  const auditorId = byEmail['auditor@uneecops.in'];
  for (const p of await M.Project.all()) {
    const det = DETAILS[p.code]; if (!det) continue;
    await seedWeekly(p, det);
    await seedAudit(p, auditorId);
  }
  await seedQuality(auditorId);
  for (const p of await M.Project.all()) {
    for (let w = 11; w >= 0; w--) await state.saveWeek(p.id, null, weekEnding(d(-7 * w)));
    await state.recompute(p.id);
  }

  const u = await M.User.all(), pr = await M.Project.all();
  logger.info('seed complete', { users: u.length, projects: pr.length, weeks: 12 });
  logger.info('sign in as ceo@, admin@, deliveryhead@, director@ or pm1@ … pm6@uneecops.in with the SEED_PASSWORD from .env');
}

if (require.main === module) {
  seed().then(() => { db.close(); process.exit(0); })
    .catch(err => { logger.error('seed failed', { err }); db.close(); process.exit(1); });
}
module.exports = { seed, seedWeekly, seedAudit, seedQuality, USERS, PW, processInputs, DETAILS, defectRows, PCI, ACTIVITIES, INFO, ISSUES, STATUS };
