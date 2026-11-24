/* Sign-in screen. Shown at start-up when nobody is signed in, and whenever the session ends
   (api/client.js calls renderLogin on any 401 — wired in main.js). */
import { $, esc, root } from '../core/dom.js';
import { ic } from '../core/icons.js';
import { login } from '../api/auth.api.js';
import { errorMessage } from '../api/client.js';
import { State } from '../core/state.js';
import { closeAll } from '../components/overlays.js';
import { boot } from '../router.js';

/* ================================================================ login */
export function renderLogin(msg) {
  closeAll();
  root().innerHTML = `
  <div class="login">
    <div class="brandside">
      <img class="logo-login" src="/assets/logo.png" alt="Uneecops — quest for excellence">
      <div>
        <span class="eyebrow">One certified view · every project</span>
        <h1>Delivery <em>Command Centre</em></h1>
        <p>One certified view of every project. Project managers report once a week; everyone above them reads the same numbers, scoped to their role, with an intelligence layer that reads the portfolio before you do.</p>
      </div>
      <div class="pillars">
        <div><span class="n">01</span><b>Computed health</b><span>A 0–100 index per project from schedule, cost, quality, risk, cash and people. Never typed.</span></div>
        <div><span class="n">02</span><b>Monday brief</b><span>The three things that need you this week, written from the certified numbers.</span></div>
        <div><span class="n">03</span><b>Ask the portfolio</b><span>Plain-language questions, answered only from what your role can see.</span></div>
      </div>
    </div>
    <div class="formside">
      <span class="eyebrow">Sign in</span>
      <h2 style="margin:var(--s-2) 0 var(--s-2);font-size:30px">Welcome back</h2>
      <p class="muted" style="margin:0 0 var(--s-5);font-size:13.5px">Use your Uneecops address.</p>
      ${msg ? `<div class="banner err">${ic('alert')}<div>${esc(msg)}</div></div>` : ''}
      <form id="loginForm" class="form" style="grid-template-columns:1fr">
        <div class="field"><label for="em">Email</label><input id="em" type="email" autocomplete="username" required placeholder="name@uneecops.in"></div>
        <div class="field"><label for="pw">Password</label><input id="pw" type="password" autocomplete="current-password" required></div>
        <div><button class="btn" type="submit" id="loginBtn">Sign in ${ic('arrow')}</button></div>
      </form>
      <div class="roles">Accounts are named by role — <code>ceo@</code>, <code>director@</code>, <code>deliveryhead@</code>, <code>pm1@</code> … <code>pm6@</code> and <code>admin@uneecops.in</code>. The administrator can switch into any of them.</div>
    </div>
  </div>`;
  $('#loginForm').addEventListener('submit', async e => {
    e.preventDefault();
    const b = $('#loginBtn'); b.disabled = true; b.textContent = 'Signing in…';
    try {
      const r = await login($('#em').value, $('#pw').value);
      State.user = r.user; State.real = null; State.view = 'dashboard'; State.brief = null; await boot();
    } catch (err) {
      /* wrong password -> 401 bad_credentials; too many failures -> 429; server down -> network_error */
      renderLogin(err.code === 'bad_credentials'
        ? 'That email and password did not match. Check with the PMO if you have not been given an account yet.'
        : errorMessage(err, 'Could not sign in just now. Please try again.'));
    }
  });
}
