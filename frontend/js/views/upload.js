/* Workbook upload screen: the PM uploads the PMO project workbook; the server validates every
   sheet and row (nothing saved), shows what it read and what to fix, then "Commit" writes it.
   API: api/upload.api.js */
import { $, esc } from '../core/dom.js';
import { chip, fmtDate, fmtTime, plural } from '../core/format.js';
import { ic } from '../core/icons.js';
import { toast } from '../components/toast.js';
import { listUploads, stageWorkbook, commitWorkbook } from '../api/upload.api.js';
import { State } from '../core/state.js';
import { setMain, setTools } from './shell.js';

/* ================================================================ PM: upload */
export async function viewUpload() {
  const prev = await listUploads();
  setMain(`
    <div class="pagehead"><span class="eyebrow">Project Manager</span><h1>Upload sheet</h1>
      <p class="lede">For weeks when a sheet is faster than a form — several projects, or a catch-up after leave. The file is validated first; nothing is saved until you commit.</p></div>
    <div class="steps">
      <div><span class="n">01</span><h3>Get the template</h3><p>Four data sheets — Weekly Status, Milestones, Risks, Client Dependencies — plus a Field Guide with a worked example for every column.</p>
        <a class="btn sec" href="/assets/templates/DCC-Weekly-Status-Template.xlsx" download>${ic('download')} Download template</a></div>
      <div><span class="n">02</span><h3>Fill and upload</h3><p>Start typing from row 2. Every error names the sheet, the row, the field and the fix.</p></div>
      <div><span class="n">03</span><h3>Commit</h3><p>Only a clean file can be committed. Health is recomputed for every project the sheet touches.</p></div>
    </div>
    <section class="blk">
      <div class="sh"><span class="n">02</span><h2>Upload and check</h2></div>
      <label class="drop" id="drop" for="upf">${ic('upload')}<div><b style="color:var(--ink)">Drop the filled workbook here</b><div class="muted" style="font-size:13px">or click to choose a .xlsx file · up to 8 MB</div><div class="fn" id="fname"></div></div>
        <input id="upf" type="file" accept=".xlsx,.xlsm" class="hide"><span style="margin-left:auto"><button class="btn" type="button" id="upBtn" disabled>Validate</button></span></label>
      <div id="upResult"></div>
    </section>
    <section class="blk">
      <div class="sh"><span class="n">03</span><h2>Recent uploads</h2></div>
      ${prev.uploads.length ? `<div class="tblwrap"><table><thead><tr><th>File</th><th>When</th><th class="r">Rows</th><th class="r">Errors</th><th>State</th></tr></thead><tbody>
        ${prev.uploads.map(u => `<tr><td>${esc(u.filename)}</td><td>${fmtDate(u.uploaded_at)} ${fmtTime(u.uploaded_at)}</td><td class="r">${u.rows_ok}</td>
          <td class="r${u.rows_error ? ' bad' : ''}">${u.rows_error || '—'}</td>
          <td>${u.committed ? chip('g', 'Committed') : chip('a', 'Not committed')}</td></tr>`).join('')}
      </tbody></table></div>` : '<div class="empty">No uploads yet.</div>'}
    </section>`);
  setTools('');
  const f = $('#upf'), b = $('#upBtn'), drop = $('#drop');
  const picked = () => { b.disabled = !f.files.length; $('#fname').textContent = f.files.length ? f.files[0].name : ''; $('#upResult').innerHTML = ''; };
  f.addEventListener('change', picked);
  ['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('over'); }));
  drop.addEventListener('drop', e => { if (e.dataTransfer.files.length) { f.files = e.dataTransfer.files; picked(); } });
  b.addEventListener('click', async e => {
    e.preventDefault(); e.stopPropagation();
    b.disabled = true; b.textContent = 'Validating…';
    try { renderUploadResult(await stageWorkbook(f.files[0])); }
    catch (e2) { $('#upResult').innerHTML = `<div class="banner err">${ic('alert')}<div><strong>Could not read that file.</strong> ${esc((e2.payload && e2.payload.error) || e2.message)}</div></div>`; }
    finally { b.disabled = false; b.textContent = 'Validate'; }
  });
}
export function renderUploadResult(r) {
  const s = r.summary;
  const errRows = r.errors.length ? `
    <div class="tblwrap" style="margin-top:var(--s-4)"><table><thead><tr><th>Sheet</th><th class="r">Row</th><th>Field</th><th>What to fix</th></tr></thead><tbody>
    ${r.errors.map(e => `<tr><td>${esc(e.sheet)}</td><td class="r">${e.row}</td><td>${esc(e.field)}</td><td><span class="wrap">${esc(e.message)}</span></td></tr>`).join('')}
    </tbody></table></div>` : '';
  $('#upResult').innerHTML = `
    <div class="banner ${r.ok ? 'ok' : 'err'}">${ic(r.ok ? 'ok' : 'alert')}<div>
      <strong>${r.ok ? 'Ready to commit.' : `${plural(r.errors.length, 'row')} need fixing before anything is saved.`}</strong>
      Read ${plural(s.rows_ok, 'row')} — ${s.details || 0} project details, ${s.status} weekly status, ${s.milestones} milestones, ${s.risks} risks, ${s.deps} client dependencies${s.projects && s.projects.length ? ` across ${s.projects.join(', ')}` : ''}.</div></div>
    ${errRows}
    ${r.ok ? `<div class="actions-row"><button class="btn" type="button" id="commitBtn" data-id="${r.upload_id}">Commit to the database</button>
      <span class="mono muted">Re-uploading the same week overwrites that week.</span></div>` : ''}`;
  const cb = $('#commitBtn');
  if (cb) cb.addEventListener('click', async () => {
    cb.disabled = true; cb.textContent = 'Committing…';
    try {
      const out = await commitWorkbook(cb.dataset.id);
      $('#upResult').innerHTML = `<div class="banner ok">${ic('ok')}<div><strong>Committed.</strong> ${plural(out.applied.projects, 'project')} updated and their health recomputed.</div></div>`;
      State.brief = null; toast('Upload committed');
    } catch (e) { cb.disabled = false; cb.textContent = 'Commit to the database'; toast('Commit failed', true); }
  });
}
