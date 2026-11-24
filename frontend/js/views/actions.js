/* Action items screen: list open / closed items, respond to your own, and (DH, Director, CEO,
   admin, auditor) raise new ones.  API: api/action.api.js */
import { $, $$, esc } from '../core/dom.js';
import { ACTION_RAISERS, ROLE_LABEL } from '../core/constants.js';
import { fmtDate, todayISO } from '../core/format.js';
import { ic } from '../core/icons.js';
import { toast } from '../components/toast.js';
import { listActions, createAction, updateAction } from '../api/action.api.js';
import { getPortfolio } from '../api/portfolio.api.js';
import { getProject } from '../api/project.api.js';
import { State } from '../core/state.js';
import { setMain, setTools } from './shell.js';
import { kpi } from './dashboard.js';
import { prioChip } from './health-breakdown.js';

/* ================================================================ action items */
export async function viewActions(opts) {
  opts = opts || {};
  const [r, pf] = await Promise.all([listActions(), getPortfolio()]);
  State.actions = r.actions; State.portfolio = pf.projects;
  const canRaise = ACTION_RAISERS.indexOf(State.user.role) >= 0;
  let users = [];
  if (canRaise && State.portfolio.length) users = (await getProject(State.portfolio[0].id)).users;
  const open = State.actions.filter(a => a.status !== 'Closed');
  const closed = State.actions.filter(a => a.status === 'Closed');
  const mine = open.filter(a => a.owner_user_id === State.user.id);
  const overdue = open.filter(a => a.due_date && a.due_date < todayISO());
  const byStatus = ['Open', 'In progress', 'Blocked'].map(s => [s, open.filter(a => a.status === s).length]);
  setMain(`
    <div class="pagehead"><span class="eyebrow">${ROLE_LABEL[State.user.role]}</span><h1>${State.user.role === 'pm' ? 'My action items' : 'Action items'}</h1>
      <p class="lede">${State.user.role === 'pm'
        ? 'Raised by the Delivery Head, Director, CEO or quality auditor against your projects. Update the status and leave a response — the raiser sees it.'
        : 'An item leaves a review with a named owner and a date, or it is not an action item. Everything here is scoped to the projects you can see.'}</p></div>
    <div class="kpis">
      ${kpi('Open', String(open.length), `${byStatus.map(s => s[1] + ' ' + s[0].toLowerCase()).join(' · ')}`, '')}
      ${kpi('Assigned to me', String(mine.length), mine.length ? 'waiting on you' : 'nothing on you', mine.length ? '' : 'up')}
      ${kpi('Overdue', String(overdue.length), overdue.length ? 'past their due date' : 'none past due', overdue.length ? 'dn' : 'up')}
      ${kpi('Closed', String(closed.length), 'with a response on record', 'up')}
    </div>
    ${canRaise ? `<section class="blk">
      <div class="sh"><span class="n">01</span><h2>Raise an action item</h2><span class="note">Tip · the project diagnosis can raise its recommendations in one click</span></div>
      <form id="actForm" class="form">
        <div class="field wide" style="grid-column:span 2"><label for="a_title">What must happen</label><input id="a_title" required placeholder="Get a dated commitment on district validation"></div>
        <div class="field"><label for="a_proj">Project</label><select id="a_proj"><option value="">Portfolio-wide</option>${State.portfolio.map(p => `<option value="${p.id}"${opts.newFor === p.id ? ' selected' : ''}>${esc(p.code)} — ${esc(p.name)}</option>`).join('')}</select></div>
        <div class="field"><label for="a_owner">Owner</label><select id="a_owner" required><option value="">— choose —</option>${users.map(u => `<option value="${u.id}">${esc(u.name)} (${ROLE_LABEL[u.role] || u.role})</option>`).join('')}</select></div>
        <div class="field"><label for="a_due">Due</label><input id="a_due" type="date" required value="${new Date(Date.now() + 12096e5).toISOString().slice(0, 10)}"></div>
        <div class="field"><label for="a_pri">Priority</label><select id="a_pri"><option>High</option><option selected>Medium</option><option>Low</option></select></div>
        <div class="field wide" style="grid-column:span 2"><label for="a_detail">Detail</label><input id="a_detail" placeholder="Why it matters and what good looks like"></div>
        <div class="field" style="justify-content:end"><button class="btn" type="submit">${ic('plus')} Raise</button></div>
      </form></section>` : ''}
    <section class="blk"><div class="sh"><span class="n">${canRaise ? '02' : '01'}</span><h2>Open items</h2><span class="note">Earliest due date first</span></div>
      ${open.length ? `<div class="tblwrap"><table><thead><tr><th>ID</th><th>Item</th><th>Project</th><th>Owner</th><th>Raised by</th><th class="r">Due</th><th>Priority</th><th>Status</th><th>Response</th></tr></thead><tbody>
        ${open.sort((a, b) => String(a.due_date || '9999').localeCompare(String(b.due_date || '9999'))).map(a => {
          const late = a.due_date && a.due_date < todayISO();
          return `<tr><td class="nw mono" style="font-size:12px"><b>${esc(a.ref || '—')}</b></td><td><span class="wrap">${esc(a.title)}</span>${a.detail ? `<span class="subl">${esc(a.detail)}</span>` : ''}</td>
            <td class="nw">${esc(a.project_code || '—')}</td><td>${esc(a.owner_name || '—')}</td><td>${esc(a.raised_by_name || '—')}</td>
            <td class="r${late ? ' bad' : ''}" style="${late ? 'font-weight:600' : ''}">${fmtDate(a.due_date)}</td>
            <td>${prioChip(a.priority)}</td>
            <td><select data-act="${a.id}" style="min-height:34px;padding:4px 8px;font-size:12px;width:auto">
              ${['Open', 'In progress', 'Blocked', 'Closed'].map(s => `<option${a.status === s ? ' selected' : ''}>${s}</option>`).join('')}</select></td>
            <td><input data-resp="${a.id}" placeholder="Response" value="${esc(a.response || '')}" style="min-height:34px;padding:4px 8px;font-size:12px;min-width:180px"></td></tr>`;
        }).join('')}
      </tbody></table></div>` : '<div class="empty">Nothing open. That is either very good news or nobody is raising anything.</div>'}
    </section>
    ${closed.length ? `<section class="blk"><div class="sh"><span class="n">${canRaise ? '03' : '02'}</span><h2>Recently closed</h2></div>
      <div class="tblwrap"><table><thead><tr><th>ID</th><th>Item</th><th>Project</th><th>Owner</th><th>Response</th><th class="r">Closed</th></tr></thead><tbody>
      ${closed.slice(0, 8).map(a => `<tr><td class="nw mono" style="font-size:12px"><b>${esc(a.ref || '—')}</b></td><td><span class="wrap">${esc(a.title)}</span></td><td>${esc(a.project_code || '—')}</td><td>${esc(a.owner_name || '—')}</td><td><span class="wrap">${esc(a.response || '—')}</span></td><td class="r">${fmtDate(a.closed_at)}</td></tr>`).join('')}
      </tbody></table></div></section>` : ''}`);
  setTools('');
  $$('[data-act]').forEach(sel => sel.addEventListener('change', async () => {
    const id = sel.dataset.act, resp = document.querySelector(`[data-resp="${id}"]`);
    try { await updateAction(id, { status: sel.value, response: resp ? resp.value : '' }); toast('Action updated'); viewActions(); }
    catch (e) { toast('Could not update', true); }
  }));
  $$('[data-resp]').forEach(inp => inp.addEventListener('change', async () => {
    const id = inp.dataset.resp, sel = document.querySelector(`[data-act="${id}"]`);
    try { await updateAction(id, { status: sel ? sel.value : 'Open', response: inp.value }); toast('Response saved'); }
    catch (e) { toast('Could not save that response', true); }
  }));
  const f = $('#actForm');
  if (f) f.addEventListener('submit', async e => {
    e.preventDefault();
    try {
      await createAction({
        project_id: $('#a_proj').value || null, title: $('#a_title').value, detail: $('#a_detail').value,
        owner_user_id: $('#a_owner').value, due_date: $('#a_due').value, priority: $('#a_pri').value });
      toast('Action item raised'); viewActions();
    } catch (err) { const fl = err.payload && err.payload.fields; toast(fl ? Object.values(fl)[0] : 'Could not raise that item', true); }
  });
}
