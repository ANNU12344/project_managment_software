/* Timesheets screen: download the template, upload a filled sheet (checked first, then committed),
   and see hours per project and week. Committing rolls the hours up into the weekly effort register.
   API: api/upload.api.js */
import { $, esc } from '../core/dom.js';
import { ROLE_LABEL } from '../core/constants.js';
import { chip, fmtDate, fmtTime, plural } from '../core/format.js';
import { ic } from '../core/icons.js';
import { toast } from '../components/toast.js';
import { getTimesheets, stageTimesheet, commitTimesheet, downloadTimesheetTemplate } from '../api/upload.api.js';
import { download } from '../core/download.js';
import { State } from '../core/state.js';
import { setMain, setTools } from './shell.js';
import { fmtH } from './weekly-monthly.js';

/* ================================================================ timesheets */
export async function viewTimesheets() {
  const d = await getTimesheets();
  setMain(`
    <div class="pagehead"><span class="eyebrow">${ROLE_LABEL[State.user.role]}</span><h1>Timesheets</h1>
      <p class="lede">Upload the team's timesheets and DCC fills each week's actual hours and the hours by phase. Re-uploading the same person and day replaces it — nothing is counted twice.</p></div>
    <div class="steps">
      <div><span class="n">01</span><h3>Get the template</h3><p>One row per person, per day, per project, per activity. The activity decides which phase the hours count towards.</p>
        <button class="btn sec" type="button" id="tsTpl">${ic('download')} Download timesheet template</button></div>
      <div><span class="n">02</span><h3>Upload and check</h3><p>Every row is checked — project, date, activity and hours. Errors name the row and the fix.</p></div>
      <div><span class="n">03</span><h3>Commit</h3><p>Hours roll up into Weekly effort for each week and project; planned hours you entered stay as they are.</p></div>
    </div>
    <section class="blk"><div class="sh"><span class="n">02</span><h2>Upload a timesheet</h2></div>
      <label class="drop" id="tsDrop" for="tsFile">${ic('upload')}<div><b style="color:var(--ink)">Drop the timesheet here</b><div class="muted" style="font-size:13px">or click to choose a .xlsx file</div><div class="fn" id="tsName"></div></div>
        <input id="tsFile" type="file" accept=".xlsx" class="hide"><span style="margin-left:auto"><button class="btn" type="button" id="tsBtn" disabled>Check</button></span></label>
      <div id="tsResult"></div></section>
    <section class="blk"><div class="sh"><span class="n">03</span><h2>Hours recorded from timesheets</h2><span class="note">By project and week</span></div>
      ${d.weeks.length ? `<div class="tblwrap"><table class="tight"><thead><tr><th>Project</th><th class="r">Week ending</th><th class="r">Hours</th><th class="r">People</th><th>By activity</th></tr></thead><tbody>
      ${d.weeks.map(w => `<tr><td>${esc(w.code)}</td><td class="r">${fmtDate(w.week_ending)}</td><td class="r">${fmtH(w.hours)}</td><td class="r">${w.people}</td><td style="font-size:12.5px">${Object.keys(w.phases).map(k => `${esc(k)} ${fmtH(w.phases[k])}`).join(' · ')}</td></tr>`).join('')}
      </tbody></table></div>` : '<div class="empty">No timesheet uploaded yet.</div>'}</section>
    <section class="blk"><div class="sh"><h2>Your recent timesheet uploads</h2></div>
      ${d.uploads.length ? `<div class="tblwrap"><table class="tight"><thead><tr><th>File</th><th>When</th><th class="r">Rows</th><th class="r">Errors</th><th>State</th></tr></thead><tbody>
      ${d.uploads.map(u => `<tr><td>${esc(u.filename.replace(/^timesheet: /, ''))}</td><td>${fmtDate(u.uploaded_at)} ${fmtTime(u.uploaded_at)}</td><td class="r">${u.rows_ok}</td><td class="r${u.rows_error ? ' bad' : ''}">${u.rows_error || '—'}</td><td>${u.committed ? chip('g', 'Committed') : chip('a', 'Not committed')}</td></tr>`).join('')}
      </tbody></table></div>` : '<div class="empty">None yet.</div>'}</section>`);
  setTools('');
  $('#tsTpl').addEventListener('click', () => download(downloadTimesheetTemplate, 'DCC-Timesheet-Template.xlsx'));
  const f = $('#tsFile'), b = $('#tsBtn'), drop = $('#tsDrop');
  const picked = () => { b.disabled = !f.files.length; $('#tsName').textContent = f.files.length ? f.files[0].name : ''; $('#tsResult').innerHTML = ''; };
  f.addEventListener('change', picked);
  ['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('over'); }));
  drop.addEventListener('drop', e => { if (e.dataTransfer.files.length) { f.files = e.dataTransfer.files; picked(); } });
  b.addEventListener('click', async e => {
    e.preventDefault(); e.stopPropagation(); b.disabled = true; b.textContent = 'Checking…';
    try {
      const r = await stageTimesheet(f.files[0]);
      $('#tsResult').innerHTML = `<div class="banner ${r.ok ? 'ok' : 'err'}">${ic(r.ok ? 'ok' : 'alert')}<div><strong>${r.ok ? 'Ready to commit.' : plural(r.errors.length, 'problem') + ' to fix first.'}</strong>
          ${r.summary.rows || 0} rows · ${r.summary.people || 0} people · ${fmtH(r.summary.hours)} hours${(r.summary.weeks || []).length ? ' — ' + r.summary.weeks.map(w => `${esc(w.week)}: ${fmtH(w.hours)} h`).join(', ') : ''}</div></div>
        ${r.errors.length ? `<div class="tblwrap"><table class="tight"><thead><tr><th class="r">Row</th><th>Field</th><th>What to fix</th></tr></thead><tbody>${r.errors.map(x => `<tr><td class="r">${x.row || '—'}</td><td>${esc(x.field)}</td><td>${esc(x.message)}</td></tr>`).join('')}</tbody></table></div>` : ''}
        ${r.ok ? `<div class="actions-row"><button class="btn" type="button" id="tsCommit">Commit ${fmtH(r.summary.hours)} hours</button><span class="mono muted">Replaces the same person-days already recorded.</span></div>` : ''}`;
      const cb = $('#tsCommit');
      if (cb) cb.addEventListener('click', async () => { cb.disabled = true; try { const o = await commitTimesheet(r.upload_id); toast(`Committed — ${plural(o.weeks, 'week')} updated`); State.brief = null; viewTimesheets(); } catch (x) { cb.disabled = false; toast('Commit failed', true); } });
    } catch (x) { $('#tsResult').innerHTML = `<div class="banner err">${ic('alert')}<div>${esc((x.payload && (x.payload.message || x.payload.error)) || x.message)}</div></div>`; }
    finally { b.disabled = false; b.textContent = 'Check'; }
  });
}
