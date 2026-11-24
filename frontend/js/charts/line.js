/* Line chart. */
import { esc } from '../core/dom.js';
import { C } from '../core/constants.js';
import { fmtDate, fmtShort, isNil, tip } from '../core/format.js';

/* Line chart, one axis, up to four series. series: [{name, color, values}] aligned to labels. */
export function lineChart(series, labels, opts) {
  opts = opts || {};
  const w = opts.w || 640, h = opts.h || 220;
  const m = { t: 16, r: 44, b: 26, l: 34 }, pw = w - m.l - m.r, ph = h - m.t - m.b;
  const all = series.reduce((a, s) => a.concat(s.values.filter(v => !isNil(v))), []);
  if (!all.length || labels.length < 2) return '<p class="muted">Not enough snapshots yet to draw a trend.</p>';
  const lo = Math.max(0, Math.floor((Math.min.apply(null, all.concat(opts.refs ? opts.refs.map(r => r.v) : [])) - 6) / 10) * 10);
  const hi = Math.min(100, Math.ceil((Math.max.apply(null, all.concat(opts.refs ? opts.refs.map(r => r.v) : [])) + 4) / 10) * 10);
  const xs = i => m.l + i * pw / (labels.length - 1);
  const ys = v => m.t + ph - (v - lo) / (hi - lo) * ph;
  let s = `<svg class="chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(opts.label || 'Trend chart')}">`;
  for (let v = lo; v <= hi; v += 10) {
    s += `<line x1="${m.l}" x2="${m.l + pw}" y1="${ys(v)}" y2="${ys(v)}" stroke="${C.rule2}" stroke-width="1"/>`;
    s += `<text x="${m.l - 8}" y="${ys(v) + 3.5}" text-anchor="end">${v}</text>`;
  }
  (opts.refs || []).forEach(r => {
    s += `<line x1="${m.l}" x2="${m.l + pw}" y1="${ys(r.v)}" y2="${ys(r.v)}" stroke="${r.c}" stroke-width="1" stroke-dasharray="4 3" opacity=".7"/>`;
    s += `<text x="${m.l + pw + 6}" y="${ys(r.v) + 3.5}" style="fill:${r.c}">${esc(r.t)}</text>`;
  });
  const step = Math.ceil(labels.length / 6);
  labels.forEach((l, i) => { if (i % step === 0 || i === labels.length - 1) s += `<text x="${xs(i)}" y="${h - 6}" text-anchor="middle">${esc(fmtShort(l))}</text>`; });
  const bw = pw / (labels.length - 1);
  labels.forEach((l, i) => {
    const rows = series.map(sr => `<span style="display:inline-block;width:8px;height:8px;background:${sr.color};margin-right:6px"></span>${esc(sr.name)} <b>${isNil(sr.values[i]) ? '—' : sr.values[i]}</b>`).join('<br>');
    s += `<rect class="hov" x="${Math.max(m.l, xs(i) - bw / 2)}" y="${m.t}" width="${bw}" height="${ph}" fill="${C.rule2}" fill-opacity="0" ${tip(`<b>Week ending ${esc(fmtDate(l))}</b><br>${rows}`)} onmouseenter="this.setAttribute('fill-opacity','.9')" onmouseleave="this.setAttribute('fill-opacity','0')"/>`;
  });
  series.forEach(sr => {
    const pts = sr.values.map((v, i) => isNil(v) ? null : [xs(i), ys(v)]).filter(Boolean);
    if (!pts.length) return;
    s += `<path d="${pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ')}" fill="none" stroke="${sr.color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" pointer-events="none"/>`;
    const last = pts[pts.length - 1], lv = sr.values.filter(v => !isNil(v)).slice(-1)[0];
    s += `<circle cx="${last[0]}" cy="${last[1]}" r="4.5" fill="${sr.color}" stroke="#fff" stroke-width="2" pointer-events="none"/>`;
    s += `<text x="${last[0] + 8}" y="${last[1] + 4}" class="lbl-ink" pointer-events="none">${lv}</text>`;
  });
  return s + '</svg>';
}
