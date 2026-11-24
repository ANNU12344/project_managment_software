/* Delivery Command Centre — front-end entry point (loaded by index.html).
 *
 * No build step on purpose: plain ES modules and plain DOM, so the team can read and change it.
 * Start-up:
 *   1. register the global behaviours (tooltips, Escape closes overlays, print clean-up)
 *   2. tell the API client to show the login screen whenever the session ends (401)
 *   3. ask the server who is signed in: show the app, or the login screen
 *
 * Where things live:
 *   api/         one file per backend route file — the only code that talks to the server
 *   core/        shared helpers: DOM, formatting, formulas, icons, state, downloads
 *   components/  toast, drawer / modal overlays
 *   charts/      small SVG charts
 *   views/       one file per screen (router.js picks which one to draw)
 */
import './core/tooltip.js';               // side effect: hover tooltips for [data-tip]
import './components/overlays.js';        // side effect: Escape closes the modal / drawer
import './views/print-report.js';         // side effect: clears the print area after printing
import { State } from './core/state.js';
import { onUnauthorized } from './api/client.js';
import { getMe } from './api/auth.api.js';
import { renderLogin } from './views/login.js';
import { boot } from './router.js';

/* Session ended or never started: forget the user and show the login screen. */
onUnauthorized(() => { State.user = null; State.real = null; renderLogin(); });

(async function init() {
  const me = await getMe();
  if (me && me.user) { State.user = me.user; State.real = me.real || null; await boot(); }
  else renderLogin();
})();
