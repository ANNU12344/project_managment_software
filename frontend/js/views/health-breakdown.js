/* Health index breakdown per component. */
import { esc } from '../core/dom.js';
import { C, HC } from '../core/constants.js';
import { bandOf, chip } from '../core/format.js';

/* Health index: each component as a bar, opening to the signals behind it (value → score, and the rule). */
export function healthBreakdown(h, open) {
  const L = h.labels || {};
  return `<div class="hb">${Object.keys(h.parts).map(k => {
    const d = (h.detail || {})[k] || {}, sc = h.parts[k];
    return `<details class="hbc"${open ? ' open' : ''}><summary>
        <span class="hbl">${esc(L[k] || k)} <span class="muted">· ${h.weights[k]}%</span></span>
        <span class="track"><span class="fill" style="width:${Math.max(1, sc)}%;background:${HC[bandOf(sc)]}"></span></span>
        <span class="v" style="color:${HC[bandOf(sc)]}">${sc}</span></summary>
      ${d.note ? `<p class="muted" style="font-size:12.5px;margin:6px 0">${esc(d.note)}</p>` : ''}
      <table class="tight hbt"><tbody>${(d.basis || []).map(b => `<tr><td>${esc(b.label)}<span class="subl">${esc(b.rule || '')}</span></td>
        <td>${esc(b.value)}</td><td class="r" style="font-weight:700;color:${b.score === null ? C.ink3 : HC[bandOf(b.score)]}">${b.score === null ? 'no data' : b.score}</td>
        <td class="r muted">weight ${b.w}</td></tr>`).join('')}</tbody></table></details>`;
  }).join('')}
  <p class="source" style="margin-top:var(--s-3)">Index = Σ(component × weight) ÷ Σ weights = ${Object.keys(h.parts).map(k => `${h.parts[k]}×${h.weights[k]}`).join(' + ')} ÷ ${Object.values(h.weights).reduce((a, b) => a + b, 0)} = ${h.index} · ≥80 On track · 60–79 Watch · &lt;60 Intervene</p></div>`;
}
export const prioChip = p => chip(p === 'High' ? 'r' : p === 'Low' ? 'n' : 'a', esc(p || 'Medium'));
