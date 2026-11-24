/* The PM's weekly status form: status figures, project details, workbook records and this week's
 * effort, validated together and saved together. Also deleting a single record.
 */
const M = require('../models');
const access = require('./access.service');
const state = require('./project-state.service');
const PD = require('../domain/project-details');
const RC = require('../domain/records');
const W = require('../domain/weekly');
const { weekEnding } = require('../utils/dates');
const { notFound, forbidden, validation } = require('../utils/errors');

const PM_HIDDEN = ['margin_at_completion', 'unbilled_wip', 'ar_over_90'];

async function getStatus(projectId, week) {
  const p = await M.Project.byId(projectId);
  if (!p) throw notFound();
  const wk = week || weekEnding();
  return { week_ending: wk, report: await M.StatusReport.forWeek(p.id, wk) };
}

/* Only write what actually changed, so "last updated" means something. */
const same = (a, b) => (a === null || a === undefined || a === '') ? (b === null || b === undefined || b === '')
  : (typeof a === 'number' ? Number(b) === a : String(a) === String(b === null || b === undefined ? '' : b).slice(0, String(a).length));

async function saveStatus(user, projectId, body) {
  const p = await M.Project.byId(projectId);
  if (!p) throw notFound();
  if (!access.canEditStatus(user, p)) throw forbidden();
  const d = body;
  const wk = d.week_ending || weekEnding();
  if (d.pm_rag && d.pm_rag !== 'Green' && !String(d.pm_rag_reason || '').trim())
    throw validation(undefined, { fields: { pm_rag_reason: 'A reason is required whenever the band is not Green' } });

  /* Project managers do not see margin or receivables, so their form does not carry them.
     A new week inherits those figures from the last report instead of blanking them. */
  if (user.role === 'pm' && !(await M.StatusReport.forWeek(p.id, wk))) {
    const last = (await M.StatusReport.history(p.id)).filter(s => s.week_ending < wk).pop();
    if (last) PM_HIDDEN.forEach(k => { if (d[k] === undefined) d[k] = last[k]; });
  }
  if (user.role === 'pm') PM_HIDDEN.forEach(k => { if (d[k] === '') delete d[k]; });

  let detailsChanged = 0;
  if (d.details && typeof d.details === 'object') {
    PD.stripPmLocked(user, d.details);               // a PM cannot change the project start / end date
    const c = PD.clean(d.details, { current: p });
    if (c.errors.length) throw validation(undefined, { fields: Object.fromEntries(c.errors.map(e => ['pd_' + e.key, e.message])) });
    const changed = {};
    Object.keys(c.data).forEach(k => { if (!same(c.data[k], p[k])) changed[k] = c.data[k]; });
    detailsChanged = await M.Project.updateDetails(p.id, changed, user.id);
  }

  /* Workbook records from the form: { kind: [rows] }, validated with the same specs as the upload. */
  const recs = Object.assign({}, d.records || {});
  if (d.milestones) recs.milestones = (recs.milestones || []).concat(d.milestones);
  if (d.risks) recs.risks = (recs.risks || []).concat(d.risks);
  if (d.dependencies) recs.iad = (recs.iad || []).concat(d.dependencies);
  const cleaned = {}, recErrors = [];
  for (const kind of Object.keys(recs)) {
    const spec = RC.RECORDS[kind]; if (!spec || !Array.isArray(recs[kind])) continue;
    cleaned[kind] = [];
    recs[kind].forEach((row, i) => {
      const c = RC.cleanRecord(spec, row);
      c.errors.forEach(e => recErrors.push(`${spec.label}, row ${i + 1}: ${e.field} — ${e.message}`));
      if (kind === 'activities' && !c.data.week_ending) c.data.week_ending = wk;
      cleaned[kind].push(c.data);
    });
  }
  /* this week's effort & process entry */
  let weeklyRow = null;
  if (d.weekly && typeof d.weekly === 'object') {
    const c = W.clean(d.weekly);
    c.errors.forEach(e => recErrors.push(`Weekly effort: ${e.label} — ${e.message}`));
    weeklyRow = c.data;
  }
  if (recErrors.length) throw validation(recErrors.slice(0, 6).join(' · '), { errors: recErrors });

  if (weeklyRow && Object.keys(weeklyRow).some(k => weeklyRow[k] !== null)) await M.WeeklyEffort.upsert(p.id, wk, weeklyRow, user.id, 'form');
  for (const kind of Object.keys(cleaned)) for (const r of cleaned[kind]) await M.RECORD_MODELS[kind].upsert(p.id, r);
  const recordCount = Object.values(cleaned).reduce((a, l) => a + l.length, 0);

  /* Weekly figures are saved only when some were given — a details or records save must not
     create an empty weekly report. */
  const hasStatus = M.StatusReport.STATUS_KEYS.some(k => d[k] !== undefined && d[k] !== '');
  if (!hasStatus) {
    const h0 = await state.recompute(p.id);
    await state.saveWeek(p.id, user.id, wk);
    await M.AuditLog.log(user.id, 'project.details', 'project', p.id, { fields: detailsChanged, records: recordCount });
    return { ok: true, details: detailsChanged, records: recordCount, health: h0 };
  }
  const id = await M.StatusReport.save(p.id, wk, d, user.id, 'form');
  const h = await state.recompute(p.id, wk);
  await state.saveWeek(p.id, user.id, wk);
  await M.AuditLog.log(user.id, 'status.save', 'project', p.id, { week: wk, health: h && h.index, details: detailsChanged || undefined });
  return { ok: true, id, health: h };
}

/* DELETE /records/:kind/:id — any workbook record kind */
async function deleteRecord(user, kind, id) {
  const model = M.RECORD_MODELS[kind];
  if (!model) throw notFound();
  const m = await model.get(id);
  if (!m) throw notFound();
  const p = await M.Project.byId(m.project_id);
  if (!access.canEditStatus(user, p)) throw forbidden();
  await model.remove(m.id);
  await state.refresh(p.id, user.id);
  await M.AuditLog.log(user.id, 'record.delete', kind, m.id, { project: p.code });
}

/* DELETE /milestones/:id, /risks/:id, /dependencies/:id — older endpoints, kept for the front end */
async function deleteSimple(user, model, id) {
  const m = await model.get(id);
  if (!m) throw notFound();
  const p = await M.Project.byId(m.project_id);
  if (!access.canEditStatus(user, p)) throw forbidden();
  await model.remove(m.id);
  await state.recompute(p.id);
}

module.exports = { getStatus, saveStatus, deleteRecord, deleteSimple };
