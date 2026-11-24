/* Weekly health heatmap. */
import { esc } from '../core/dom.js';
import { HN } from '../core/constants.js';
import { bandOf, fmtDate, fmtShort, isNil, tip } from '../core/format.js';
import { projCell } from './spark.js';

/* Weekly health heatmap: one row per project, one cell per snapshot week. */
export function heatmap(ps, onlyLast) {
  const weeks = Array.from(new Set(ps.reduce((a, p) => a.concat(p.trend_weeks || []), []))).sort().slice(-(onlyLast || 12));
  if (!weeks.length) return '<p class="muted">No snapshots yet.</p>';
  const rows = ps.slice().sort((a, b) => (isNil(a.health) ? 999 : a.health) - (isNil(b.health) ? 999 : b.health));
  const cols = `grid-template-columns:120px repeat(${weeks.length},minmax(30px,1fr)) 78px`;
  let s = `<div class="hscroll"><div class="heat" role="table" aria-label="Weekly health by project">`;
  rows.forEach(p => {
    const map = {}; (p.trend_weeks || []).forEach((wk, i) => map[wk] = p.trend[i]);
    s += `<div class="hr" style="${cols}" role="row"><span class="hl" data-open="${p.id}" role="rowheader" tabindex="0">${esc(p.code)}</span>`;
    weeks.forEach((wk, i) => {
      const v = map[wk];
      s += `<span class="c ${bandOf(v)}${i === weeks.length - 1 ? ' last' : ''}" role="cell" ${tip(`<b>${esc(p.code)}</b> · week ending ${esc(fmtDate(wk))}<br>Health <b>${isNil(v) ? 'no report' : v}</b>${isNil(v) ? '' : ' · ' + HN[bandOf(v)]}`)}>${isNil(v) ? '' : v}</span>`;
    });
    s += `<span style="text-align:right">${projCell(p)}</span></div>`;
  });
  s += `<div class="hr" style="${cols}"><span></span>${weeks.map((wk, i) => `<span class="ax">${i === 0 || i === weeks.length - 1 || i % 3 === 0 ? esc(fmtShort(wk)) : ''}</span>`).join('')}<span class="ax" style="text-align:right">+4 wk</span></div>`;
  return s + '</div></div>';
}
