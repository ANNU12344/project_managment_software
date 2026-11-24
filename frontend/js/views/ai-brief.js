/* AI status and the "Monday brief" band on the dashboard. The brief is cached in State per user,
   and on the server for 20 minutes; "refresh" asks for a new one.  API: api/ai.api.js */
import { $, esc } from '../core/dom.js';
import { fmtDate, fmtTime, plural, todayISO } from '../core/format.js';
import { dots, ic } from '../core/icons.js';
import { getAiStatus, getBrief } from '../api/ai.api.js';
import { State } from '../core/state.js';
import { openProject } from './project-drawer.js';

/* ================================================================ AI: status + brief */
export async function aiStatus() {
  if (State.ai) return State.ai;
  try { State.ai = await getAiStatus(); } catch (e) { State.ai = { configured: false }; }
  return State.ai;
}
export const srcLabel = o => o.source === 'ai'
  ? `<span class="srcbadge"><i></i>DCC Intelligence · ${esc(o.model || 'Azure OpenAI')}</span>`
  : `<span class="srcbadge rules"><i></i>Rule-based insight · AI unavailable</span>`;
export const srcLine = o => o.source === 'ai'
  ? `<span class="srcline"><i></i>Written by ${esc(o.model || 'Azure OpenAI')} from the certified figures</span>`
  : `<span class="srcline rules"><i></i>Rule-based · the AI service was not reachable</span>`;

export function briefShell() {
  return `<div class="band" id="brief" aria-live="polite">
    <span class="eyebrow">${ic('spark')} Monday brief · ${esc(fmtDate(todayISO()))}</span>
    <div class="thinking">${dots()} Reading ${plural(State.portfolio.length, 'project')}, their client items and risks…</div></div>`;
}
export async function loadBrief(refresh) {
  const host = $('#brief'); if (!host) return;
  const key = State.user.id;
  if (!refresh && State.brief && State.briefFor === key) return paintBrief(State.brief);
  if (refresh) host.innerHTML = `<span class="eyebrow">${ic('spark')} Monday brief</span><div class="thinking">${dots()} Re-reading the portfolio…</div>`;
  try {
    const b = await getBrief(refresh);
    State.brief = b; State.briefFor = key;
    paintBrief(b);
  } catch (e) {
    if ($('#brief')) $('#brief').innerHTML = `<span class="eyebrow">Monday brief</span><p style="margin-top:var(--s-3)">The brief could not be prepared just now.</p>`;
  }
}
export function paintBrief(b) {
  const host = $('#brief'); if (!host) return;
  const byCode = {}; State.portfolio.forEach(p => byCode[p.code] = p);
  host.innerHTML = `
    <div style="display:flex;gap:var(--s-4);align-items:center;flex-wrap:wrap">
      <span class="eyebrow">${ic('spark')} Monday brief · ${esc(fmtDate(todayISO()))}</span><span style="margin-left:auto">${srcLabel(b)}</span></div>
    <h2 class="hl">${esc(b.headline)}</h2>
    <p>${esc(b.summary)}</p>
    ${b.attention && b.attention.length ? `<div class="cols">${b.attention.map((a, i) => `<div>
      <span class="n">0${i + 1}</span><span class="code">${esc(a.code)}</span>
      <h3>${esc(a.title)}</h3><p>${esc(a.why)}</p>
      <div class="act">${ic('arrow')}<span>${esc(a.action)}</span></div>
      ${byCode[a.code] ? `<button class="lnk" type="button" data-open="${byCode[a.code].id}">Open ${esc(a.code)} →</button>` : ''}</div>`).join('')}</div>` : ''}
    ${b.watch && b.watch.length ? `<div class="watch"><span class="eyebrow" style="color:var(--ink-3)">Also watch</span>${b.watch.map(w => `<span><b>${esc(w.code)}</b>${esc(w.note)}</span>`).join('')}</div>` : ''}
    <div class="foot">
      ${b.client_ask ? `<span><b>Chase with clients:</b> ${esc(b.client_ask)}</span>` : ''}
      ${b.positives && b.positives.length ? `<span><b>Going well:</b> ${esc(b.positives.join(' '))}</span>` : ''}
      <span class="sp"></span>
      <span class="mono">${b.generated_at ? 'Prepared ' + esc(fmtTime(b.generated_at)) : ''}${b.cached ? ' · cached' : ''}</span>
      <button class="btn sm ghost" type="button" id="briefRefresh">${ic('refresh')} Rewrite</button>
    </div>`;
  $('#briefRefresh').addEventListener('click', () => loadBrief(true));
  wireOpeners(host);
}
export function wireOpeners(scope) {
  (scope || document).querySelectorAll('[data-open]').forEach(el => {
    if (el._wo) return; el._wo = true;
    const go2 = () => openProject(el.dataset.open);
    el.addEventListener('click', go2);
    el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go2(); } });
  });
}
