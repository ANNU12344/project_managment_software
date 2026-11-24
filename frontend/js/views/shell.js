/* App shell: side navigation (items depend on the role), top bar, sign-out, and go(view) to
   switch screens. Every screen draws into the main area with setMain() and the top-bar buttons
   with setTools().  API: api/auth.api.js (logout) */
import { $, $$, esc, root } from '../core/dom.js';
import { ROLE_LABEL } from '../core/constants.js';
import { ic } from '../core/icons.js';
import { logout } from '../api/auth.api.js';
import { State } from '../core/state.js';
import { renderLogin } from './login.js';
import { fillSwitcher } from './switch-user.js';
import { openAsk } from './ask.js';
import { route } from '../router.js';

/* ================================================================ shell */
export function navItems() {
  const r = State.user.role;
  if (r === 'auditor') return [['audit', 'Audit & quality', 'shield'], ['actions', 'Action items', 'check'], ['dashboard', 'Portfolio', 'grid'], ['history', 'History & compare', 'history'], ['faq', 'How it works', 'help']];
  const items = [['dashboard', r === 'pm' ? 'My projects' : 'Portfolio', 'grid']];
  if (r === 'pm') { items.push(['status', 'Weekly status', 'edit']); }
  items.push(['trends', 'Weekly & monthly', 'chart']);
  items.push(['history', 'History & compare', 'history']);
  if (r !== 'pm') { items.push(['commercial', 'Commercial position', 'rupee']); items.push(['clients', 'RAID & dependencies', 'clock']); }
  if (r === 'pm' || r === 'admin') { items.push(['timesheets', 'Timesheets', 'sheet']); items.push(['upload', 'Upload workbook', 'upload']); }
  items.push(['audit', 'Audit & quality', 'shield']);
  items.push(['actions', r === 'pm' ? 'My action items' : 'Action items', 'check']);
  if (r === 'admin') items.push(['admin', 'Administration', 'sliders']);
  items.push(['faq', 'How it works', 'help']);
  return items;
}
export const VIEW_TITLE = { dashboard: 'Portfolio', status: 'Weekly status', upload: 'Upload workbook', clients: 'RAID & dependencies', actions: 'Action items', admin: 'Administration',
  trends: 'Weekly & monthly', history: 'History & compare', commercial: 'Commercial position', timesheets: 'Timesheets', audit: 'Audit & quality', faq: 'How it works' };

export function renderShell(inner) {
  const items = navItems(), u = State.user;
  root().innerHTML = `
  <div class="shell">
    <aside>
      <div class="brand"><img src="/assets/logo.png" alt="Uneecops"><div><span class="mark">Delivery <span>Command Centre</span></span><span class="sub">Uneecops Technologies</span></div></div>
      <nav aria-label="Main">
        <div class="navgrp">Workspace</div>
        ${items.map(([k, l, i]) => `<a class="nav ${State.view === k ? 'on' : ''}" href="#${k}" data-v="${k}">${ic(i)}<span>${l}</span></a>`).join('')}
        <div class="navgrp">Intelligence</div>
        <a class="nav" href="#ask" id="navAsk">${ic('spark')}<span>Ask DCC</span></a>
      </nav>
      <div class="who"><div><b>${esc(u.name)}</b><span class="role">${ROLE_LABEL[u.role]}${u.bu ? ' · ' + esc(u.bu) : ''}</span></div>
        <button type="button" id="out">Sign out</button></div>
    </aside>
    <div class="mainwrap">
      ${State.real ? `<div class="viewas" role="status">
        <span class="eyebrow">Viewing as</span><b>${esc(u.name)}</b><span class="r">${ROLE_LABEL[u.role]}${u.bu ? ' · ' + esc(u.bu) : ''} · ${esc(u.email)}</span>
        <span class="sp"></span>
        <select id="vaSwitch" aria-label="Switch to another account"><option value="">Switch to…</option></select>
        <button class="btn sm" type="button" id="vaStop">${ic('x')} Return to ${esc(State.real.name)}</button></div>` : ''}
      <div class="topbar">
        <span class="crumb">${ROLE_LABEL[u.role]} <span aria-hidden="true">/</span> <b>${esc(VIEW_TITLE[State.view] || '')}</b></span>
        <span class="sp"></span>
        ${u.role === 'admin' && !State.real ? `<select id="tbSwitch" aria-label="View as another user" style="width:auto;min-height:36px;font-size:12.5px"><option value="">${'View as…'}</option></select>` : ''}
        <span id="tbTools" style="display:flex;gap:var(--s-2);flex-wrap:wrap"></span>
        <button class="btn ai sm" type="button" id="tbAsk">${ic('spark')} Ask DCC</button>
      </div>
      <main id="main">${inner || ''}</main>
    </div>
  </div>`;
  $$('a.nav[data-v]').forEach(a => a.addEventListener('click', e => { e.preventDefault(); go(a.dataset.v); }));
  document.getElementById('main') && document.getElementById('main').addEventListener('click', e => { const a = e.target.closest('a[data-v]'); if (a && !a.classList.contains('nav')) { e.preventDefault(); go(a.dataset.v); } });
  $('#navAsk').addEventListener('click', e => { e.preventDefault(); openAsk(); });
  $('#tbAsk').addEventListener('click', openAsk);
  $('#out').addEventListener('click', async () => { try { await logout(); } catch (e) { /* signed out anyway */ } State.user = null; State.real = null; State.brief = null; renderLogin(); });
  if (State.real || u.role === 'admin') fillSwitcher();
}
export function setTools(html) { const t = $('#tbTools'); if (t) t.innerHTML = html || ''; }
export const setMain = html => { $('#main').innerHTML = html; };
export function go(view, opts) { State.view = view; try { history.replaceState(null, '', '#' + view); } catch (e) {} route(opts); }
