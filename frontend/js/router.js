/* Router: draws the screen named in State.view.
 *
 *   boot()   after sign-in: picks the screen from the URL hash (#audit …) if the role may see it
 *   route()  draws State.view inside the app shell; any error shows a banner instead of a blank page
 *
 * To add a screen: write views/<name>.js exporting view<Name>(), add a line below, and add the
 * nav item for the roles that may see it in views/shell.js (navItems).
 */
import { esc } from './core/dom.js';
import { errorMessage } from './api/client.js';
import { dots, ic } from './core/icons.js';
import { State } from './core/state.js';
import { navItems, renderShell, setMain } from './views/shell.js';
import { viewDashboard } from './views/dashboard.js';
import { viewStatus } from './views/weekly-status.js';
import { viewUpload } from './views/upload.js';
import { viewClients } from './views/clients.js';
import { viewActions } from './views/actions.js';
import { viewAdmin } from './views/admin.js';
import { viewTrends } from './views/weekly-monthly.js';
import { viewHistory } from './views/history.js';
import { viewCommercial } from './views/commercial.js';
import { viewTimesheets } from './views/timesheets.js';
import { viewAudit } from './views/audit.js';
import { viewFaq } from './views/faq.js';

/* ================================================================ router */
export async function route(opts) {
  renderShell(`<p class="muted" style="display:flex;gap:10px;align-items:center">${dots()} Loading…</p>`);
  try {
    if (State.view === 'dashboard') await viewDashboard();
    else if (State.view === 'status') await viewStatus(opts);
    else if (State.view === 'upload') await viewUpload();
    else if (State.view === 'clients') await viewClients();
    else if (State.view === 'actions') await viewActions(opts);
    else if (State.view === 'admin' && State.user.role === 'admin') await viewAdmin();
    else if (State.view === 'trends') await viewTrends(opts);
    else if (State.view === 'history') await viewHistory(opts);
    else if (State.view === 'commercial') await viewCommercial();
    else if (State.view === 'timesheets') await viewTimesheets();
    else if (State.view === 'audit') await viewAudit();
    else if (State.view === 'faq') await viewFaq();
    else { State.view = navItems()[0][0]; await route(opts); return; }
  } catch (e) {
    if (e.status !== 401)                // 401: the login screen is already showing
      setMain(`<div class="banner err">${ic('alert')}<div><strong>Something went wrong loading this screen.</strong> ${esc(errorMessage(e, e.message))}</div></div>`);
  }
}

// boot  function
export async function boot() {
  const allowed = navItems().map(i => i[0]);
  const h = (location.hash || '').slice(1);
  if (allowed.indexOf(h) >= 0) State.view = h;
  else if (allowed.indexOf(State.view) < 0) State.view = 'dashboard';
  await route();
}
