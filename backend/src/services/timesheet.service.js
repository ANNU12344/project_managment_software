/* Timesheets: template, stage an upload, commit it (rolls up into weekly efforts), overview. */
const M = require('../models');
const access = require('./access.service');
const state = require('./project-state.service');
const TS = require('../domain/timesheet');
const { badRequest, notFound, validation } = require('../utils/errors');

const PREFIX = 'timesheet: ';

const template = () => TS.template();

async function stage(user, file) {
  if (!file) throw badRequest('no_file');
  const writable = (await access.visibleTo(user)).filter(p => access.canEditStatus(user, p));
  const byCode = {}; writable.forEach(p => byCode[p.code.toUpperCase()] = p);
  const r = TS.parse(file.buffer, byCode);
  const id = await M.Upload.create({
    userId: user.id, filename: PREFIX + file.originalname, rowsOk: r.rows.length, rowsError: r.errors.length,
    report: { kind: 'timesheet', rows: r.rows, errors: r.errors, summary: r.summary }
  });
  return { upload_id: id, ok: r.ok, summary: r.summary, errors: r.errors.slice(0, 200) };
}

async function commit(user, uploadId) {
  const row = await M.Upload.getOwn(uploadId, user.id);
  if (!row) throw notFound();
  if (row.committed) throw badRequest('already_committed');
  const payload = JSON.parse(row.report);
  if (payload.kind !== 'timesheet') throw validation('Not a timesheet upload');
  if (payload.errors.length) throw badRequest('has_errors', undefined, { count: payload.errors.length });

  /* replace each person's entries for the days in this file, then re-roll the affected weeks */
  const keys = new Set(payload.rows.map(r => [r.project_id, r.employee_id, r.work_date].join('|')));
  for (const k of keys) { const [pid, emp, day] = k.split('|'); await M.TimesheetEntry.removeDay(pid, emp, day); }
  for (const r of payload.rows) await M.TimesheetEntry.insert(row.id, r);

  const weeks = new Set(payload.rows.map(r => r.project_id + '|' + r.week_ending));
  for (const k of weeks) {
    const [pid, wk] = k.split('|');
    await M.WeeklyEffort.upsert(pid, wk, TS.rollUp(await M.TimesheetEntry.forWeek(pid, wk)), user.id, 'timesheet');
  }
  const pids = new Set(payload.rows.map(r => r.project_id));
  for (const pid of pids) {
    await state.recompute(pid);
    for (const k of weeks) if (k.startsWith(pid + '|')) await state.saveWeek(pid, user.id, k.split('|')[1]);
  }
  await M.Upload.markCommitted(row.id);
  await M.AuditLog.log(user.id, 'timesheet.commit', 'upload', row.id, { rows: payload.rows.length, weeks: weeks.size });
  return { ok: true, rows: payload.rows.length, weeks: weeks.size, projects: pids.size };
}

async function overview(user) {
  const visible = await access.visibleTo(user);
  const code = {}; visible.forEach(p => code[p.id] = p.code);
  const uploads = (await M.Upload.listOwn(user.id)).filter(u => u.filename.indexOf(PREFIX) === 0).slice(0, 15);
  const entries = visible.length ? (await M.TimesheetEntry.summaryRows()).filter(e => code[e.project_id]) : [];
  const agg = {};
  entries.forEach(e => {
    const k = e.project_id + '|' + e.week_ending;
    const a = agg[k] || (agg[k] = { project_id: e.project_id, code: code[e.project_id], week_ending: e.week_ending, hours: 0, people: new Set(), phases: {} });
    a.hours += Number(e.hours); a.people.add(e.employee_id); a.phases[e.phase] = (a.phases[e.phase] || 0) + Number(e.hours);
  });
  const weeks = Object.values(agg).map(a => Object.assign(a, { people: a.people.size, hours: Math.round(a.hours * 10) / 10 }))
    .sort((a, b) => String(b.week_ending).localeCompare(String(a.week_ending)) || String(a.code).localeCompare(String(b.code))).slice(0, 200);
  return { uploads, weeks, phases: TS.PHASES };
}

module.exports = { template, stage, commit, overview };
