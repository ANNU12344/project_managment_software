/* Administrator "view as another user": the admin picks any account and sees exactly what that
   role sees; "stop" returns to the admin account without a password.  API: api/auth.api.js */
import { $, esc } from '../core/dom.js';
import { ROLE_LABEL } from '../core/constants.js';
import { toast } from '../components/toast.js';
import { listSwitchUsers, switchToUser, stopSwitch as stopSwitchApi } from '../api/auth.api.js';
import { State } from '../core/state.js';
import { go } from './shell.js';
import { closeAll } from '../components/overlays.js';

/* ---------- admin: view as another user ---------- */
export async function fillSwitcher() {
  let users;
  try { users = (await listSwitchUsers()).users; } catch (e) { return; }
  State.switchUsers = users;
  const order = ['ceo', 'director', 'dh', 'pm', 'admin'];
  const opts = order.map(r => {
    const us = users.filter(x => x.role === r && x.id !== State.user.id);
    return us.length ? `<optgroup label="${ROLE_LABEL[r]}">${us.map(x => `<option value="${x.id}">${esc(x.name)} — ${esc(x.email)}</option>`).join('')}</optgroup>` : '';
  }).join('');
  ['#vaSwitch', '#tbSwitch'].forEach(sel => {
    const el = $(sel); if (!el) return;
    el.insertAdjacentHTML('beforeend', opts);
    el.addEventListener('change', () => { if (el.value) switchTo(el.value); });
  });
  const stop = $('#vaStop'); if (stop) stop.addEventListener('click', stopSwitch);
}
export async function switchTo(userId) {
  try {
    const r = await switchToUser(userId);
    State.user = r.user; State.real = r.real; State.brief = null; State.analysis = {}; State.ask = [];
    closeAll(); toast(r.real ? `Now viewing as ${r.user.name} · ${ROLE_LABEL[r.user.role]}` : 'Back to your own account');
    go('dashboard');
  } catch (e) { toast('Could not switch to that account', true); }
}
export async function stopSwitch() {
  const r = await stopSwitchApi();
  State.user = r.user; State.real = null; State.brief = null; State.analysis = {}; State.ask = [];
  closeAll(); toast('Back to the administrator account'); go('admin');
}
