/* Administration screen (admin only): users, engagements, health-index weights, process
   performance baseline, weekly snapshot and the audit log.  API: api/admin.api.js */
import { $, $$, esc } from '../core/dom.js';
import { C, ROLE_LABEL } from '../core/constants.js';
import { chip, fmtDate, fmtShort, fmtTime, inr, isNil, plural, tip } from '../core/format.js';
import { ic } from '../core/icons.js';
import { toast } from '../components/toast.js';
import {
  listUsers, createUser, listAdminProjects, createProject, updateProject,
  getMetricsBaseline, updateMetricsBaseline, getWeights, updateWeights, runSnapshot, getAuditLog
} from '../api/admin.api.js';
import { State } from '../core/state.js';
import { setMain, setTools } from './shell.js';
import { switchTo } from './switch-user.js';
import { aiStatus } from './ai-brief.js';
import { kpi } from './dashboard.js';

/* ================================================================ admin */
export async function viewAdmin() {
  const [u, p, w, au, bl] = await Promise.all([listUsers(), listAdminProjects(), getWeights(), getAuditLog(), getMetricsBaseline()]);
  const users = u.users, projects = p.projects;
  const lastSnap = au.log.find(a => a.action === 'snapshot.run');
  const ai = await aiStatus();
  const groups = [['ceo', 'CEO'], ['director', 'Directors'], ['dh', 'Delivery Heads'], ['pm', 'Project Managers'], ['admin', 'Administrators']];
  setMain(`
    <div class="pagehead"><span class="eyebrow">Administrator</span><h1>Administration</h1>
      <p class="lede">Switch into any account to see exactly what that role sees. Manage users, projects, the health index weights and the weekly snapshot. Every change is written to the audit log.</p></div>
    <div class="kpis">
      ${kpi('Users', String(users.filter(x => x.active).length), `${users.filter(x => x.role === 'pm').length} project managers`, '')}
      ${kpi('Projects', String(projects.length), `${projects.filter(x => x.status === 'In Progress').length} in progress`, '')}
      ${kpi('Last snapshot', lastSnap ? fmtShort(lastSnap.at) : '—', lastSnap ? 'weekly freeze on record' : 'none recorded yet', lastSnap ? 'up' : 'dn')}
      ${kpi('Intelligence', ai.reachable ? 'On' : ai.configured ? 'Blocked' : 'Off', ai.reachable ? `${esc(ai.model)} · Azure OpenAI` : ai.configured ? `${esc(ai.model)} · ${esc(ai.error || 'not reachable')} · rule-based fallback` : 'rule-based fallback only', ai.reachable ? 'up' : 'dn')}
    </div>
    <section class="blk"><div class="sh"><span class="n">01</span><h2>View as another user</h2><span class="note">Pick anyone — you can return to this account from the bar at the top</span></div>
      <div class="people">${groups.map(([r, l]) => `<div><h4>${l}</h4>${users.filter(x => x.role === r && x.active).map(x => `<button type="button" data-as="${x.id}" ${x.id === State.user.id ? 'disabled' : ''}><b>${esc(x.name)}${x.id === State.user.id ? ' (you)' : ''}</b><span>${esc(x.email)}${x.bu ? ' · ' + esc(x.bu) : ''}</span></button>`).join('') || '<span class="muted" style="font-size:12.5px">None</span>'}</div>`).join('')}</div>
    </section>
    <section class="blk"><div class="sh"><span class="n">02</span><h2>Health index weights</h2><span class="note">Must total 100 · saving recomputes every project</span></div>
      <form id="wForm" class="form">
        ${Object.keys(w.defaults).map(k => `<div class="field"><label for="w_${k}">${esc((w.labels || {})[k] || k)}</label>
          <input id="w_${k}" type="number" min="0" max="100" value="${w.weights[k]}" data-w><span class="hint">default ${w.defaults[k]}</span></div>`).join('')}
        <div class="field wide"><div class="wtotal"><span>TOTAL</span><span class="t"><i id="wBar"></i></span><b id="wTot"></b></div></div>
        <div class="field"><button class="btn" type="submit">Save and recompute</button></div>
      </form></section>
    <section class="blk"><div class="sh"><span class="n">★</span><h2>Process performance baseline</h2><span class="note">LSL / Goal / USL / Stdev per metric · blank = tracked without limits · 1 person-day = ${bl.person_day_hours} hrs</span></div>
      <form id="blForm"><div class="tblwrap"><table class="tight" style="min-width:900px"><thead><tr><th>Metric</th><th>Unit</th><th class="r">LSL</th><th class="r">Goal</th><th class="r">USL</th><th class="r">Stdev</th></tr></thead><tbody>
        ${bl.metrics.map(m => `<tr><td><span class="wrap" ${tip(esc(m.formula))}>${esc(m.label)}</span></td><td class="muted" style="font-size:12px">${esc(m.unit)}</td>
          ${['lsl', 'goal', 'usl', 'sd'].map(k => `<td class="r"><input data-bl="${m.key}" data-k="${k}" type="number" step="any" value="${isNil(m[k]) ? '' : m[k]}" style="width:110px;min-height:36px;text-align:right" aria-label="${esc(m.label)} ${k}"></td>`).join('')}</tr>`).join('')}
      </tbody></table></div>
      <div class="actions-row"><button class="btn" type="submit">Save baseline</button><button class="btn sec" type="button" id="blReset">Reset to metricsToFollow defaults</button><span class="mono muted">Changes apply to every project immediately and are written to the audit log.</span></div></form>
    </section>
    <section class="blk"><div class="sh"><span class="n">03</span><h2>Weekly snapshot</h2><span class="note">A week not snapshotted is history that cannot be recovered</span></div>
      <div class="actions-row" style="border-top:0;margin-top:0;padding-top:0">
        <button class="btn sec" type="button" id="snapBtn">${ic('refresh')} Run snapshot now</button>
        <span class="mono muted" id="snapMsg">${lastSnap ? 'Last run ' + fmtDate(lastSnap.at) + ' ' + fmtTime(lastSnap.at) + '. ' : ''}Runs automatically every Monday.</span>
      </div></section>
    <section class="blk"><div class="sh"><span class="n">04</span><h2>Projects</h2><span class="tools"><button class="btn sec sm" type="button" id="newProj">${ic('plus')} Add project</button></span></div>
      <div id="projForm"></div>
      <div class="tblwrap"><table><thead><tr><th>Code</th><th>Name</th><th>BU</th><th>Type</th><th>PM</th><th>Delivery Head</th><th class="r">Value</th><th>Status</th><th></th></tr></thead><tbody>
        ${projects.map(x => `<tr><td>${esc(x.code)}</td><td><span class="wrap">${esc(x.name)}</span></td><td>${esc(x.bu)}</td><td>${esc(x.project_type)}</td>
          <td>${x.pm_user_id ? esc((users.find(y => y.id === x.pm_user_id) || {}).name || '—') : '<span class="bad">Unassigned</span>'}</td>
          <td>${x.dh_user_id ? esc((users.find(y => y.id === x.dh_user_id) || {}).name || '—') : '<span class="bad">Unassigned</span>'}</td>
          <td class="r">${inr(x.contract_value)}</td><td>${chip(x.status === 'In Progress' ? 'b' : x.status === 'Hold' ? 'a' : 'n', esc(x.status))}</td>
          <td><button class="btn sec sm" type="button" data-edit-proj="${x.id}">${ic('edit')} Edit</button></td></tr>`).join('')}
      </tbody></table></div></section>
    <section class="blk"><div class="sh"><span class="n">05</span><h2>Users</h2><span class="tools"><button class="btn sec sm" type="button" id="newUser">${ic('plus')} Add user</button></span></div>
      <div id="userForm"></div>
      <div class="tblwrap"><table><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>BU</th><th>Active</th><th></th></tr></thead><tbody>
        ${users.map(x => `<tr><td>${esc(x.name)}</td><td class="mono" style="font-size:12px">${esc(x.email)}</td><td>${ROLE_LABEL[x.role] || x.role}</td><td>${esc(x.bu || '—')}</td><td>${x.active ? chip('g', 'Active') : chip('n', 'Disabled')}</td>
          <td>${x.id !== State.user.id && x.active ? `<button class="btn sec sm" type="button" data-as="${x.id}">${ic('users')} View as</button>` : ''}</td></tr>`).join('')}
      </tbody></table></div></section>
    <section class="blk"><div class="sh"><span class="n">06</span><h2>Audit log</h2><span class="note">Most recent ${Math.min(40, au.log.length)} entries</span></div>
      <div class="tblwrap"><table class="tight"><thead><tr><th>When</th><th>Who</th><th>Action</th><th>Detail</th></tr></thead><tbody>
        ${au.log.slice(0, 40).map(a => `<tr><td class="nw mono" style="font-size:11.5px">${fmtDate(a.at)} ${fmtTime(a.at)}</td><td>${esc(a.user_name || '—')}</td><td><span class="chip b">${esc(a.action)}</span></td><td><span class="wrap mono" style="font-size:11px;max-width:60ch">${esc(a.detail || '')}</span></td></tr>`).join('')}
      </tbody></table></div></section>`);
  setTools('');
  $$('[data-as]').forEach(b => b.addEventListener('click', () => switchTo(b.dataset.as)));
  const tot = () => {
    const t = $$('[data-w]').reduce((s, i) => s + Number(i.value || 0), 0);
    $('#wTot').textContent = t + ' / 100'; $('#wTot').style.color = t === 100 ? C.good : C.bad;
    $('#wBar').style.width = Math.min(100, t) + '%'; $('#wBar').style.background = t === 100 ? C.good : C.bad;
  };
  $$('[data-w]').forEach(i => i.addEventListener('input', tot)); tot();
  $('#wForm').addEventListener('submit', async e => {
    e.preventDefault();
    const weights = {}; Object.keys(w.defaults).forEach(k => weights[k] = Number($('#w_' + k).value || 0));
    try { await updateWeights(weights); State.brief = null; toast('Weights saved, every project recomputed'); viewAdmin(); }
    catch (err) { toast((err.payload && err.payload.message) || 'Weights must total 100', true); }
  });
  const saveBaseline = async b => {
    try { await updateMetricsBaseline(b); State.baseline = null; toast('Baseline saved'); viewAdmin(); }
    catch (err) { toast((err.payload && err.payload.message) || 'Could not save the baseline', true); }
  };
  $('#blForm').addEventListener('submit', e => {
    e.preventDefault();
    const b = {}; $$('[data-bl]').forEach(i => { (b[i.dataset.bl] = b[i.dataset.bl] || {})[i.dataset.k] = i.value === '' ? null : Number(i.value); });
    saveBaseline(b);
  });
  $('#blReset').addEventListener('click', () => { if (confirm('Reset every metric to the limits from metricsToFollow.xlsx?')) saveBaseline(bl.defaults); });
  $('#snapBtn').addEventListener('click', async () => {
    const b = $('#snapBtn'); b.disabled = true; b.textContent = 'Running…';
    try { const r = await runSnapshot();
      $('#snapMsg').textContent = `Snapshot written for week ending ${fmtDate(r.week_ending)} — ${plural(r.projects, 'project')}.`; toast('Snapshot taken'); }
    catch (e) { toast('Snapshot failed', true); }
    finally { b.disabled = false; b.innerHTML = ic('refresh') + ' Run snapshot now'; }
  });
  /* One form for adding an project and for editing one — editing is how a wrong
     PM or Delivery Head assignment is corrected. */
  const bus = Array.from(new Set(projects.map(x => x.bu).concat(users.map(x => x.bu)).filter(Boolean))).sort();
  const opt = (list, cur) => list.map(v => `<option${v === cur ? ' selected' : ''}>${esc(v)}</option>`).join('');
  const userOpts = (role, cur) => users.filter(u => u.role === role && (u.active || u.id === cur))
    .map(u => `<option value="${u.id}"${u.id === cur ? ' selected' : ''}>${esc(u.name)}${u.bu ? ' · ' + esc(u.bu) : ''} — ${esc(u.email)}</option>`).join('');
  function projectForm(x) {
    const edit = !!x; x = x || { status: 'In Progress', project_type: 'Fixed Price', contract_value: 0, margin_at_bid: 28 };
    $('#projForm').innerHTML = `<form class="form" id="pForm" style="margin-bottom:var(--s-5);padding:var(--s-5);background:var(--tint);border-radius:var(--radius)">
      <div class="field wide"><span class="eyebrow">${edit ? 'Editing ' + esc(x.code) : 'New project'}</span></div>
      <div class="field"><label for="p_code">Code</label><input id="p_code" required placeholder="CIMS-BR-02" value="${esc(x.code || '')}"${edit ? ' readonly' : ''}></div>
      <div class="field" style="grid-column:span 2"><label for="p_name">Name</label><input id="p_name" required value="${esc(x.name || '')}"></div>
      <div class="field" style="grid-column:span 2"><label for="p_client">Client</label><input id="p_client" required value="${esc(x.client || '')}"></div>
      <div class="field"><label for="p_bu">Business unit</label><input id="p_bu" required list="buList" placeholder="Govt Digital" value="${esc(x.bu || '')}"><datalist id="buList">${bus.map(v => `<option value="${esc(v)}">`).join('')}</datalist></div>
      <div class="field"><label for="p_type">Project type</label><select id="p_type">${opt(['Fixed Price', 'T&M', 'AMC', 'Internal'], x.project_type)}</select></div>

      <div class="field"><label for="p_status">Status</label><select id="p_status">${opt(['In Progress', 'Hold', 'Completed'], x.status)}</select></div>
      <div class="field"><label for="p_pm">Project manager</label><select id="p_pm"><option value="">— unassigned —</option>${userOpts('pm', x.pm_user_id)}</select><span class="hint">Only this PM sees and reports the project</span></div>
      <div class="field"><label for="p_dh">Delivery Head</label><select id="p_dh"><option value="">— unassigned —</option>${userOpts('dh', x.dh_user_id)}</select><span class="hint">Owns the project and the client relationship</span></div>
      <div class="field"><label for="p_val">Contract value ₹ Cr</label><input id="p_val" type="number" step="any" value="${isNil(x.contract_value) ? 0 : x.contract_value}"></div>
      <div class="field"><label for="p_bid">Margin at bid %</label><input id="p_bid" type="number" step="any" value="${isNil(x.margin_at_bid) ? 0 : x.margin_at_bid}"></div>
      <div class="field"><label for="p_start">Start date</label><input id="p_start" type="date" value="${esc((x.start_date || '').slice(0, 10))}"></div>
      <div class="field"><label for="p_end">End date</label><input id="p_end" type="date" value="${esc((x.end_date || '').slice(0, 10))}"></div>
      <div class="field wide" style="flex-direction:row;gap:var(--s-2)"><button class="btn" type="submit">${edit ? 'Save changes' : 'Create'}</button><button class="btn sec" type="button" id="pCancel">Cancel</button></div></form>`;
    $('#pCancel').addEventListener('click', () => { $('#projForm').innerHTML = ''; });
    $('#projForm').scrollIntoView({ behavior: 'smooth', block: 'start' });
    $('#p_name').focus();
    $('#pForm').addEventListener('submit', async e => {
      e.preventDefault();
      const body = {
        name: $('#p_name').value.trim(), client: $('#p_client').value.trim(), bu: $('#p_bu').value.trim(),
        project_type: $('#p_type').value, commercial_basis: $('#p_type').value, status: $('#p_status').value,
        pm_user_id: $('#p_pm').value || null, dh_user_id: $('#p_dh').value || null,
        contract_value: Number($('#p_val').value || 0), margin_at_bid: Number($('#p_bid').value || 0),
        start_date: $('#p_start').value || null, end_date: $('#p_end').value || null };
      try {
        if (edit) await updateProject(x.id, body);
        else await createProject(Object.assign({ code: $('#p_code').value.trim() }, body));
        State.brief = null; toast(edit ? `${x.code} updated` : 'Project created'); viewAdmin();
      } catch (err) {
        const pl = err.payload || {};
        toast(pl.error === 'duplicate_code' ? 'That code already exists' : pl.message || 'Could not save', true);
      }
    });
  }
  $('#newProj').addEventListener('click', () => projectForm(null));
  $$('[data-edit-proj]').forEach(b => b.addEventListener('click', () => projectForm(projects.find(p => p.id === b.dataset.editProj))));
  $('#newUser').addEventListener('click', () => {
    $('#userForm').innerHTML = `<form class="form" id="uForm" style="margin-bottom:var(--s-5);padding:var(--s-5);background:var(--tint)">
      <div class="field"><label>Name</label><input id="u_name" required></div>
      <div class="field"><label>Email</label><input id="u_email" type="email" required placeholder="pm7@uneecops.in"></div>
      <div class="field"><label>Role</label><select id="u_role">${Object.keys(ROLE_LABEL).map(r => `<option value="${r}">${ROLE_LABEL[r]}</option>`).join('')}</select></div>
      <div class="field"><label>Business unit</label><input id="u_bu" placeholder="Govt Digital"></div>
      <div class="field"><label>Initial password</label><input id="u_pw" value="Welcome@123"></div>
      <div class="field" style="justify-content:end"><button class="btn" type="submit">Create</button></div></form>`;
    $('#uForm').addEventListener('submit', async e => {
      e.preventDefault();
      try { await createUser({
        name: $('#u_name').value, email: $('#u_email').value, role: $('#u_role').value, bu: $('#u_bu').value, password: $('#u_pw').value });
        toast('User created'); viewAdmin();
      } catch (err) { toast(err.payload && err.payload.error === 'duplicate_email' ? 'That email already exists' : 'Could not create', true); }
    });
  });
}
