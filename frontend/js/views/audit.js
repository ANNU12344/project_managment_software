/* Audit & quality screen, two tabs:
     Non-conformances — the auditor raises, the PM records the action and requests closure,
                        the auditor closes or reopens; categories are editable by the auditor.
     Quality reports  — the auditor publishes a template, the PM uploads a filled version,
                        the auditor reviews it (accept / rework) and may attach a reviewed file.
   API: api/audit.api.js */
import { $, $$, esc } from '../core/dom.js';
import { C, ROLE_LABEL } from '../core/constants.js';
import { chip, fmtDate, fmtTime } from '../core/format.js';
import { info } from '../core/formulas.js';
import { dots, ic } from '../core/icons.js';
import { toast } from '../components/toast.js';
import {
  listNcs, getNc, raiseNc, updateNc, addNcComment,
  listNcCategories, addNcCategory, updateNcCategory, removeNcCategory,
  getQualityReports, addQualityTemplate, submitQualityReport, reviewQualityReport, downloadStoredFile
} from '../api/audit.api.js';
import { getPortfolio } from '../api/portfolio.api.js';
import { errorMessage } from '../api/client.js';
import { download } from '../core/download.js';
import { bars } from '../charts/bars.js';
import { State } from '../core/state.js';
import { setMain, setTools } from './shell.js';
import { kpi } from './dashboard.js';
import { closeModal } from '../components/overlays.js';

/* ================================================================ audit */
export const NC_CHIP = { Open: 'r', 'Closure requested': 'b', Closed: 'g', Reopened: 'r' };
export const SEV_CHIP = { Major: 'r', Minor: 'a', Observation: 'n' };
export async function viewAudit() {
  const tab = State.auditTab || 'nc';
  setMain(`
    <div class="pagehead"><span class="eyebrow">${ROLE_LABEL[State.user.role]}</span><h1>Audit &amp; quality</h1>
      <p class="lede">${State.user.role === 'auditor' ? 'Raise non-conformances, verify the actions taken, and review the quality reports project managers send in.' : State.user.role === 'pm' ? 'Non-conformances raised on your projects and the quality reports the auditor needs from you. Record the action you took and request closure; the auditor verifies and closes.' : 'The audit position of every project in view: open non-conformances and quality reports.'}</p></div>
    <div class="toolbar"><div class="seg" role="group"><button type="button" data-atab="nc" class="${tab === 'nc' ? 'on' : ''}">Non-conformances</button><button type="button" data-atab="qr" class="${tab === 'qr' ? 'on' : ''}">Quality reports</button></div></div>
    <div id="auditBody"><p class="muted">${dots()} Loading…</p></div>`);
  setTools('');
  $$('[data-atab]').forEach(b => b.addEventListener('click', () => { State.auditTab = b.dataset.atab; viewAudit(); }));
  if (tab === 'nc') await paintNcs(); else await paintQuality();
}

export async function paintNcs() {
  const d = await listNcs();
  if (!State.portfolio.length) State.portfolio = (await getPortfolio()).projects;
  /* the category list (with removed ones) is only needed by those who manage it */
  const cats = d.can_raise ? (await listNcCategories(true)).categories : [];
  const activeCats = cats.filter(c => c.active);
  const open = d.ncs.filter(n => n.status !== 'Closed');
  const filt = State.ncFilter || 'open';
  const list = d.ncs.filter(n => filt === 'all' ? true : filt === 'open' ? n.status !== 'Closed' : n.status === filt);
  const byProj = {}; open.forEach(n => { byProj[n.project_code] = (byProj[n.project_code] || 0) + 1; });
  $('#auditBody').innerHTML = `
    <div class="kpis">
      ${kpi('Open NCs ' + info('ncs'), String(open.length), `${open.filter(n => n.severity === 'Major').length} major · ${open.filter(n => n.severity === 'Minor').length} minor · ${open.filter(n => n.severity === 'Observation').length} observation`, open.length ? 'dn' : 'up')}
      ${kpi('Past due date', String(open.filter(n => n.overdue).length), 'open and past their due date', open.some(n => n.overdue) ? 'dn' : 'up')}
      ${kpi('Waiting for the auditor', String(d.ncs.filter(n => n.status === 'Closure requested').length), 'closure requested by the PM', '')}
      ${kpi('Closed', String(d.ncs.filter(n => n.status === 'Closed').length), 'verified by the auditor', 'up')}
    </div>
    ${d.can_raise ? `<section class="blk"><div class="sh"><span class="n">${ic('plus')}</span><h2>Raise a non-conformance</h2></div>
      <form id="ncForm" class="form f4">
        <div class="field"><label for="nc_p">Project *</label><select id="nc_p" required><option value="">— choose —</option>${State.portfolio.map(p => `<option value="${p.id}">${esc(p.code)} — ${esc(p.name)}</option>`).join('')}</select></div>
        <div class="field" style="grid-column:span 2"><label for="nc_t">What was found *</label><input id="nc_t" required placeholder="Code review records missing for 3 modules"></div>
        <div class="field"><label for="nc_s">Severity *</label><select id="nc_s">${d.severities.map(x => `<option${x === 'Minor' ? ' selected' : ''}>${x}</option>`).join('')}</select></div>
        <div class="field"><label for="nc_c">Category</label><select id="nc_c"><option value="">— choose —</option>${(d.category_options || []).map(c => `<option value="${esc(c.id)}">${esc(c.label)}</option>`).join('')}</select></div>
        <div class="field"><label for="nc_due">Due date</label><input id="nc_due" type="date" value="${new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 10)}"></div>
        <div class="field" style="grid-column:span 2"><label for="nc_d">Detail / evidence</label><input id="nc_d" placeholder="Where and when it was found"></div>
        <div class="field wide"><button class="btn" type="submit">${ic('plus')} Raise and assign to the project manager</button></div>
      </form></section>` : ''}
    <section class="blk"><div class="sh"><h2>Non-conformances</h2><span class="tools"><select id="ncFilt" style="width:auto;min-height:36px">${[['open', 'All open'], ['all', 'All']].concat(d.statuses.map(x => [x, x])).map(([v, l]) => `<option value="${v}"${filt === v ? ' selected' : ''}>${l}</option>`).join('')}</select></span></div>
      ${list.length ? `<div class="tblwrap"><table class="tight" style="min-width:1100px"><thead><tr><th>NC</th><th>Project</th><th>What was found</th><th>Severity</th><th>Status</th><th class="r">Raised</th><th class="r">Due</th><th>Assigned to</th><th class="r">Thread</th></tr></thead><tbody>
      ${list.map(n => `<tr class="clickable" data-nc="${n.id}" tabindex="0"><td class="nw"><b>${esc(n.ref)}</b></td><td>${esc(n.project_code)}</td><td><span class="wrap">${esc(n.title)}</span>${n.action_taken ? `<span class="subl">Action: ${esc(n.action_taken)}</span>` : ''}</td>
        <td>${chip(SEV_CHIP[n.severity], esc(n.severity))}</td><td>${chip(NC_CHIP[n.status] || 'n', esc(n.status))}</td><td class="r">${fmtDate(n.raised_date)}</td>
        <td class="r${n.overdue ? ' bad' : ''}">${fmtDate(n.due_date)}${n.overdue ? '<span class="subl bad">past due</span>' : ''}</td><td>${esc(n.assigned_to_name || '—')}</td><td class="r">${n.comments}</td></tr>`).join('')}
      </tbody></table></div>` : '<div class="empty">No non-conformances here.</div>'}</section>
    ${Object.keys(byProj).length && State.user.role !== 'pm' ? `<section class="blk"><div class="sh"><h2>Open NCs by project</h2></div>${bars(Object.keys(byProj).sort((a, b) => byProj[b] - byProj[a]).map(k => [k, byProj[k], C.bad]))}</section>` : ''}
    ${d.can_raise ? (() => {
      const removedCount = cats.length - activeCats.length;
      return `<section class="blk"><div class="sh"><h2>Categories</h2><span class="note">${activeCats.length} categories${removedCount ? ` (+${removedCount} removed)` : ''} · the list offered when raising an NC · removing one does not change NCs already raised under it</span></div>
      <form id="paForm" class="form" style="grid-template-columns:160px minmax(0,1fr) auto;align-items:end;margin-bottom:var(--s-4)">
        <div class="field"><label for="paCode">Code</label><input id="paCode" placeholder="e.g. PR" maxlength="12"></div>
        <div class="field"><label for="paNew">Category name *</label><input id="paNew" placeholder="e.g. Peer Reviews" maxlength="85" required></div>
        <div class="field"><button class="btn sm" type="submit">${ic('plus')} Add category</button></div></form>
      <div class="tblwrap scroll-list" id="paScroll"><table class="tight"><thead><tr><th class="r" style="width:48px">#</th><th style="width:110px">Code</th><th>Category</th><th class="r" style="width:110px">NCs raised</th><th class="r" style="width:120px"></th></tr></thead>
      <tbody id="paBody"></tbody></table><div class="scroll-more" id="paMore"></div></div></section>`;
    })() : ''}`;
  /* Categories: rows are added PAGE at a time as the list is scrolled (like a feed),
     inside a fixed-height box so the page itself does not grow. */
  if ($('#paBody')) {
    const PAGE = 10;
    /* active categories first, removed ones after them (server order) */
    const row = (c, i) => `<tr${c.active ? '' : ' class="muted"'}><td class="r muted">${i + 1}</td><td class="nw mono"><b>${esc(c.code || '—')}</b></td>
        <td>${esc(c.name)}${c.active ? '' : ` ${chip('n', 'Removed')}`}</td><td class="r">${c.nc_count || '<span class="muted">0</span>'}</td>
        <td class="r">${c.active
          ? `<button class="btn sec sm" type="button" data-cat-del="${esc(c.id)}" aria-label="Remove ${esc(c.label)}">${ic('x')} Remove</button>`
          : `<button class="btn sec sm" type="button" data-cat-restore="${esc(c.id)}" aria-label="Restore ${esc(c.label)}">${ic('refresh')} Restore</button>`}</td></tr>`;
    const body = $('#paBody'), box = $('#paScroll'), more = $('#paMore');
    let shown = 0;
    const showMore = () => {
      if (shown >= cats.length) return;
      body.insertAdjacentHTML('beforeend', cats.slice(shown, shown + PAGE).map((c, k) => row(c, shown + k)).join(''));
      shown = Math.min(shown + PAGE, cats.length);
      more.textContent = shown < cats.length ? `Showing ${shown} of ${cats.length} · scroll for more` : `All ${cats.length} categories shown`;
    };
    showMore();
    /* load the next page when the user is within 60px of the bottom of the box */
    box.addEventListener('scroll', () => { if (box.scrollTop + box.clientHeight >= box.scrollHeight - 60) showMore(); });
    /* one click handler for every Remove / Restore button, including rows added later */
    body.addEventListener('click', async e => {
      const del = e.target.closest('[data-cat-del]'), res = e.target.closest('[data-cat-restore]');
      const c = cats.find(x => x.id === (del ? del.dataset.catDel : res ? res.dataset.catRestore : null));
      if (!c) return;
      if (del && !confirm(`Remove “${c.label}” from the categories?` + (c.nc_count ? `\n\n${c.nc_count} NC(s) already raised under it will keep it.` : ''))) return;
      try {
        if (del) { await removeNcCategory(c.id); toast(`Removed “${c.label}”`); }
        else { await updateNcCategory(c.id, { active: true }); toast(`Restored “${c.label}”`); }
        paintNcs();
      } catch (x) { toast(errorMessage(x, 'Could not save the category'), true); }
    });
  }
  const pf = $('#paForm');
  if (pf) pf.addEventListener('submit', async e => {
    e.preventDefault();
    const name = $('#paNew').value.trim(); if (!name) return;
    try {
      const r = await addNcCategory({ code: $('#paCode').value.trim(), name });
      toast(`Added “${r.category.label}”`); paintNcs();
    } catch (x) { toast(errorMessage(x, 'Could not add the category'), true); }
  });
  $('#ncFilt').addEventListener('change', e => { State.ncFilter = e.target.value; paintNcs(); });
  $$('[data-nc]').forEach(r => r.addEventListener('click', () => openNc(r.dataset.nc)));
  const f = $('#ncForm');
  if (f) f.addEventListener('submit', async e => {
    e.preventDefault();
    try { await raiseNc({ project_id: $('#nc_p').value, title: $('#nc_t').value, severity: $('#nc_s').value, category_id: $('#nc_c').value || null, due_date: $('#nc_due').value, description: $('#nc_d').value });
      toast('Non-conformance raised and assigned'); paintNcs(); }
    catch (x) { toast((x.payload && x.payload.message) || 'Could not raise it', true); }
  });
}

export async function openNc(id) {
  const r = await getNc(id), n = r.nc;
  const auditor = State.user.role === 'auditor' || State.user.role === 'admin';
  const isPm = State.user.role === 'pm';
  const m = $('#modal');
  m.innerHTML = `<div id="mscrim" style="position:absolute;inset:0;background:rgba(16,22,29,.4)"></div><div class="mbox" role="dialog" aria-modal="true" aria-labelledby="nc-title" style="position:relative">
    <div class="mhead"><div><span class="eyebrow">${esc(n.ref)} · ${esc(n.project_code)}</span><h3 id="nc-title">${esc(n.title)}</h3></div><button type="button" id="mClose" aria-label="Close">${ic('x')}</button></div>
    <div class="mbody">
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">${chip(SEV_CHIP[n.severity], esc(n.severity))}${chip(NC_CHIP[n.status] || 'n', esc(n.status))}${n.category ? chip('n', esc(n.category)) : ''}</div>
      <dl class="dl" style="grid-template-columns:1fr 1fr">
        <div class="r"><dt>Raised</dt><dd>${fmtDate(n.raised_date)} by ${esc(n.raised_by_name || '—')}</dd></div><div class="r"><dt>Due</dt><dd class="${n.overdue ? 'bad' : ''}">${fmtDate(n.due_date)}</dd></div>
        <div class="r"><dt>Assigned to</dt><dd>${esc(n.assigned_to_name || '—')}</dd></div><div class="r"><dt>Closed</dt><dd>${fmtDate(n.closed_date)}</dd></div>
      </dl>
      ${n.description ? `<p style="margin-top:12px">${esc(n.description)}</p>` : ''}
      <div class="sub" style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:var(--ink-3);margin:16px 0 6px">Action taken</div>
      <p>${esc(n.action_taken || 'Not recorded yet.')}</p>
      <div class="sub" style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:var(--ink-3);margin:16px 0 6px">Thread</div>
      ${r.comments.length ? r.comments.map(c => `<div class="item"><div><b>${esc(c.user_name || '—')}</b> <span class="muted" style="font-size:12px">${esc(ROLE_LABEL[c.user_role] || '')} · ${fmtDate(c.created_at)} ${fmtTime(c.created_at)}</span><div style="margin-top:3px">${esc(c.body)}</div></div></div>`).join('') : '<p class="muted">No comments yet.</p>'}
      <form id="ncAct" class="form" style="grid-template-columns:1fr;margin-top:14px">
        ${isPm || auditor ? `<div class="field"><label for="nc_act">Action taken${isPm ? ' (required to request closure)' : ''}</label><textarea id="nc_act" style="min-height:70px">${esc(n.action_taken || '')}</textarea></div>` : ''}
        <div class="field"><label for="nc_cm">Comment</label><input id="nc_cm" placeholder="Add to the thread"></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          ${isPm && n.status !== 'Closed' ? `<button class="btn" type="button" data-ncs="Closure requested">Request closure</button>` : ''}
          ${auditor ? `${n.status !== 'Closed' ? '<button class="btn" type="button" data-ncs="Closed">Verify and close</button>' : ''}${n.status === 'Closed' || n.status === 'Closure requested' ? '<button class="btn sec" type="button" data-ncs="Reopened">Reopen</button>' : ''}` : ''}
          <button class="btn sec" type="button" id="ncCommentBtn">Add comment</button>
        </div>
      </form>
    </div></div>`;
  m.className = 'on';
  $('#mClose').addEventListener('click', closeModal); $('#mscrim').addEventListener('click', closeModal);
  const send = async (status) => {
    try {
      const body = { comment: $('#nc_cm').value };
      if ($('#nc_act')) body.action_taken = $('#nc_act').value;
      if (status) body.status = status;
      await updateNc(n.id, body);
      toast(status ? `Status: ${status}` : 'Saved'); closeModal(); paintNcs();
    } catch (x) { toast((x.payload && x.payload.message) || 'Could not save', true); }
  };
  $$('[data-ncs]').forEach(b => b.addEventListener('click', () => send(b.dataset.ncs)));
  $('#ncCommentBtn').addEventListener('click', async () => {
    const t = $('#nc_cm').value.trim(); if (!t && !($('#nc_act') && $('#nc_act').value !== (n.action_taken || ''))) { toast('Write a comment first', true); return; }
    if ($('#nc_act') && $('#nc_act').value !== (n.action_taken || '')) return send(null);
    try { await addNcComment(n.id, t); toast('Comment added'); openNc(n.id); }
    catch (x) { toast('Could not add the comment', true); }
  });
}

export const QR_CHIP = { Submitted: 'b', 'Under review': 'a', Accepted: 'g', 'Rework requested': 'r' };
export async function paintQuality() {
  const d = await getQualityReports();
  const auditor = d.can_template;
  const fileBtn = (fid, name, label) => `<button class="btn sec sm" type="button" data-file="${fid}" data-fname="${esc(name)}">${ic('download')} ${label}</button>`;
  $('#auditBody').innerHTML = `
    ${auditor ? `<section class="blk"><div class="sh"><span class="n">${ic('upload')}</span><h2>Publish a quality report template</h2><span class="note">Project managers download it, fill it and upload their version</span></div>
      <form id="qtForm" class="form f4"><div class="field" style="grid-column:span 2"><label for="qt_t">Title *</label><input id="qt_t" required placeholder="Monthly project quality report"></div>
        <div class="field"><label for="qt_due">Due date</label><input id="qt_due" type="date"></div><div class="field"><label for="qt_f">Template file *</label><input id="qt_f" type="file" required></div>
        <div class="field" style="grid-column:span 3"><label for="qt_d">Instructions</label><input id="qt_d" placeholder="Fill one per project each month"></div>
        <div class="field" style="justify-content:end"><button class="btn" type="submit">Publish template</button></div></form></section>` : ''}
    ${d.templates.length ? d.templates.map(t => { const subs = d.submissions.filter(s => s.template_id === t.id), revs = d.reviews.filter(v => v.template_id === t.id);
      return `<section class="blk"><div class="sh"><h2>${esc(t.title)}</h2><span class="note">${esc(t.description || '')}${t.due_date ? ' · due ' + fmtDate(t.due_date) : ''}</span>
        <span class="tools">${fileBtn(t.file_id, t.title, 'Download template')}</span></div>
        ${d.projects.length ? `<form class="form f4 qsub" data-t="${t.id}" style="margin-bottom:16px;background:var(--tint);padding:14px;border-radius:12px">
          <div class="field"><label>Project</label><select name="project_id">${d.projects.map(p => `<option value="${p.id}">${esc(p.code)}</option>`).join('')}</select></div>
          <div class="field"><label>Your filled report</label><input type="file" name="file" required></div><div class="field"><label>Note</label><input name="note" placeholder="e.g. October 2026"></div>
          <div class="field" style="justify-content:end"><button class="btn" type="submit">${ic('upload')} Upload my report</button></div></form>` : ''}
        ${subs.length ? `<div class="tblwrap"><table class="tight" style="min-width:1050px"><thead><tr><th>Project</th><th class="r">Version</th><th>Note</th><th>Uploaded</th><th>Status</th><th>Auditor's comment</th><th>Files</th>${auditor ? '<th>Review</th>' : ''}</tr></thead><tbody>
        ${subs.map(s => { const rv = revs.filter(v => v.parent_id === s.id);
          return `<tr><td class="nw"><b>${esc(s.project_code || '—')}</b></td><td class="r">v${s.version}</td><td>${esc(s.description || '—')}</td><td>${fmtDate(s.uploaded_at)}<span class="subl">${esc(s.uploaded_by_name || '')}</span></td>
          <td>${chip(QR_CHIP[s.status] || 'n', esc(s.status))}</td><td><span class="wrap">${esc(s.review_comment || '—')}</span>${s.reviewed_by_name ? `<span class="subl">${esc(s.reviewed_by_name)} · ${fmtDate(s.reviewed_at)}</span>` : ''}</td>
          <td><div style="display:flex;gap:6px;flex-wrap:wrap">${fileBtn(s.file_id, s.project_code + '-v' + s.version, 'PM version')}${rv.map(v => fileBtn(v.file_id, s.project_code + '-auditor', 'Auditor version')).join('')}</div></td>
          ${auditor ? `<td><form class="qrev" data-s="${s.id}" style="display:grid;gap:6px;min-width:220px"><select name="status">${d.statuses.map(x => `<option${x === s.status ? ' selected' : ''}>${x}</option>`).join('')}</select><input name="comment" placeholder="Comment for the PM"><input type="file" name="file" title="Optional: your reviewed version"><button class="btn sm" type="submit">Save review</button></form></td>` : ''}</tr>`; }).join('')}
        </tbody></table></div>` : '<div class="empty">No reports submitted for this template yet.</div>'}</section>`; }).join('') : '<div class="empty">No quality report template published yet.</div>'}`;
  $$('[data-file]').forEach(b => b.addEventListener('click', () => download(() => downloadStoredFile(b.dataset.file), b.dataset.fname + '.xlsx')));
  const qt = $('#qtForm');
  if (qt) qt.addEventListener('submit', async e => { e.preventDefault();
    try { await addQualityTemplate({ title: $('#qt_t').value, description: $('#qt_d').value, due_date: $('#qt_due').value }, $('#qt_f').files[0]); toast('Template published'); paintQuality(); }
    catch (x) { toast((x.payload && x.payload.message) || 'Could not publish', true); } });
  $$('.qsub').forEach(f => f.addEventListener('submit', async e => { e.preventDefault();
    try { await submitQualityReport(f.dataset.t, { project_id: f.project_id.value, note: f.note.value }, f.file.files[0]); toast('Report uploaded for review'); paintQuality(); }
    catch (x) { toast((x.payload && x.payload.message) || 'Could not upload', true); } }));
  $$('.qrev').forEach(f => f.addEventListener('submit', async e => { e.preventDefault();
    try { await reviewQualityReport(f.dataset.s, { status: f.status.value, comment: f.comment.value }, f.file.files[0]); toast('Review saved'); paintQuality(); }
    catch (x) { toast((x.payload && x.payload.message) || 'Could not save the review', true); } }));
}
