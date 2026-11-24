/* Sparklines, deltas, simple projection and meters. */
import { esc } from '../core/dom.js';
import { HC, HN } from '../core/constants.js';
import { bandOf, isNil, tip } from '../core/format.js';
import { healthTip } from '../core/formulas.js';

/* ================================================================ charts */
export function spark(data, col, w, h) {
  w = w || 88; h = h || 24;
  if (!data || data.length < 2) return `<svg class="spark" viewBox="0 0 ${w} ${h}"></svg>`;
  let lo = Math.min.apply(null, data), hi = Math.max.apply(null, data);
  if (hi === lo) { hi += 1; lo -= 1; }
  const xs = i => i * (w - 8) / (data.length - 1) + 4;
  const ys = v => h - 4 - (v - lo) / (hi - lo) * (h - 8);
  const d = data.map((v, i) => (i ? 'L' : 'M') + xs(i).toFixed(1) + ' ' + ys(v).toFixed(1)).join(' ');
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" style="width:${w}px;height:${h}px" aria-hidden="true">
    <path d="${d} L${xs(data.length - 1).toFixed(1)} ${h} L4 ${h} Z" fill="${col}" fill-opacity="0.10"/>
    <path d="${d}" fill="none" stroke="${col}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
    <circle cx="${xs(data.length - 1).toFixed(1)}" cy="${ys(data[data.length - 1]).toFixed(1)}" r="3" fill="${col}" stroke="#fff" stroke-width="1.5"/></svg>`;
}
export const deltaOf = a => (!a || a.length < 2) ? 0 : Math.round(a[a.length - 1] - a[0]);
export function deltaTxt(d) {
  if (!d) return `<span class="d muted">±0</span>`;
  return `<span class="d ${d > 0 ? 'good' : 'bad'}">${d > 0 ? '+' : ''}${d}</span>`;
}
/* Straight-line projection of the last six snapshots, four weeks out. A trend, not a forecast model. */
export function project4(trend) {
  const t = (trend || []).slice(-6);
  if (t.length < 3) return null;
  const n = t.length, xm = (n - 1) / 2, ym = t.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0;
  t.forEach((y, x) => { num += (x - xm) * (y - ym); den += (x - xm) * (x - xm); });
  const slope = den ? num / den : 0;
  return Math.max(0, Math.min(100, Math.round(t[n - 1] + slope * 4)));
}
export function projCell(p) {
  const v = project4(p.trend);
  if (v === null || isNil(p.health)) return '<span class="muted">—</span>';
  const d = v - p.health;
  const arrow = d > 1 ? '↗' : d < -1 ? '↘' : '→';
  const crosses = bandOf(v) !== bandOf(p.health);
  return `<span class="proj ${d < -1 ? 'bad' : d > 1 ? 'good' : 'muted'}" ${tip(`<b>${esc(p.code)}</b><br>Trend of the last six snapshots, carried four weeks forward: <b>${v}</b>${crosses ? `<br>Would move from ${HN[bandOf(p.health)]} to ${HN[bandOf(v)]}` : ''}`)}>${arrow} ${v}${crosses ? ' !' : ''}</span>`;
}
export function hmeter(v, p) {
  if (isNil(v)) return '<span class="muted">—</span>';
  const s = bandOf(v);
  return `<span class="hmeter"${p ? ' ' + tip(healthTip(p)) : ''}><span class="t"><i style="width:${Math.max(2, v)}%;background:${HC[s]}"></i></span><b style="color:${HC[s]}">${v}</b></span>`;
}
