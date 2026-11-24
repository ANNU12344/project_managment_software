/* Schedule lane, bars and state stack. */
import { esc } from '../core/dom.js';
import { C } from '../core/constants.js';
import { daysBetween, fmtDate, plural, tip, todayISO } from '../core/format.js';

export function lane(baselineDate, forecastDate, from) {
  const base = from || todayISO();
  const bd = daysBetween(base, baselineDate), fd = daysBetween(base, forecastDate);
  if (!forecastDate) return '<span class="muted">—</span>';
  const p = d => (Math.max(0, Math.min(60, d)) / 60 * 100).toFixed(2) + '%';
  const slip = Math.max(0, fd - bd);
  const col = slip > 14 ? C.bad : slip > 0 ? C.warn : C.good;
  let s = `<div class="lane" ${tip(`Baseline <b>${esc(fmtDate(baselineDate))}</b><br>Forecast <b>${esc(fmtDate(forecastDate))}</b>${slip ? `<br>${slip} days behind baseline` : '<br>On baseline'}`)}><div class="base"></div>`;
  [15, 30, 45].forEach(d => s += `<div class="tick" style="left:${p(d)}"></div>`);
  if (slip > 0 && baselineDate) {
    const a = Math.max(0, Math.min(60, bd)), b = Math.max(0, Math.min(60, fd));
    s += `<div class="slipbar" style="left:${p(a)};width:${((b - a) / 60 * 100).toFixed(2)}%"></div><div class="dot bl" style="left:${p(bd)}"></div>`;
  }
  return s + `<div class="dot fc" style="left:${p(fd)};background:${col}"></div></div>`;
}
export function bars(rows, max, unit) {
  const m = max || Math.max.apply(null, rows.map(r => r[1])) || 1;
  return '<div class="bars">' + rows.map(r =>
    `<div class="b" ${r[3] ? tip(r[3]) : ''}><span class="muted">${esc(r[0])}</span>
      <span class="track"><span class="fill" style="display:block;width:${Math.max(1, r[1] / m * 100).toFixed(1)}%;background:${r[2] || C.blue}"></span></span>
      <span class="v">${r[1]}${unit || ''}</span></div>`).join('') + '</div>';
}
export function stateStack(ps) {
  const n = { r: 0, a: 0, g: 0, n: 0 };
  ps.forEach(p => n[p.state || 'n']++);
  const tot = ps.length || 1;
  const segs = [['r', 'Intervene', C.bad], ['a', 'Watch', C.warn], ['g', 'On track', C.good], ['n', 'No report', C.ink3]].filter(s => n[s[0]]);
  return `<div class="legend">${segs.map(s => `<span><i style="background:${s[2]}"></i>${s[1]} <b style="color:var(--ink)">${n[s[0]]}</b></span>`).join('')}</div>
    <div class="stack">${segs.map(s => `<div style="flex:${n[s[0]]};background:${s[2]}" ${tip(`<b>${s[1]}</b><br>${plural(n[s[0]], 'project')} · ${Math.round(n[s[0]] / tot * 100)}%`)}>${n[s[0]] / tot > 0.12 ? n[s[0]] : ''}</div>`).join('')}</div>`;
}
