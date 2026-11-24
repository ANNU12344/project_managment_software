/* Margin, ageing, risk matrix and project trend charts. */
import { esc } from '../core/dom.js';
import { C } from '../core/constants.js';
import { isNil, plural, tip } from '../core/format.js';
import { lineChart } from './line.js';

/* Margin at bid against margin at completion, per project. One axis, two marks. */
export function marginChart(ps) {
  const rows = ps.filter(p => !isNil(p.margin_at_completion)).sort((a, b) => (a.margin_at_completion - a.margin_at_bid) - (b.margin_at_completion - b.margin_at_bid));
  if (!rows.length) return '<p class="muted">No margin data in view.</p>';
  const w = 640, rh = 30, m = { t: 8, r: 50, b: 26, l: 110 }, h = m.t + rows.length * rh + m.b, pw = w - m.l - m.r;
  const hi = Math.ceil(Math.max.apply(null, rows.map(r => Math.max(r.margin_at_bid, r.margin_at_completion))) / 10) * 10 + 5;
  const lo = Math.max(0, Math.floor(Math.min.apply(null, rows.map(r => Math.min(r.margin_at_bid, r.margin_at_completion))) / 10) * 10 - 5);
  const xs = v => m.l + (v - lo) / (hi - lo) * pw;
  let s = `<svg class="chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="Margin at bid versus margin at completion">`;
  for (let v = lo; v <= hi; v += 5) s += `<line x1="${xs(v)}" x2="${xs(v)}" y1="${m.t}" y2="${h - m.b}" stroke="${C.rule2}"/><text x="${xs(v)}" y="${h - 8}" text-anchor="middle">${v}%</text>`;
  rows.forEach((p, i) => {
    const y = m.t + i * rh + rh / 2, er = p.margin_at_completion - p.margin_at_bid;
    const col = er <= -5 ? C.bad : er < 0 ? C.warn : C.good;
    s += `<g ${tip(`<b>${esc(p.code)}</b> · ${esc(p.name)}<br>At bid <b>${p.margin_at_bid}%</b> · at completion <b>${p.margin_at_completion}%</b><br>${er >= 0 ? '+' : ''}${er.toFixed(1)} points`)} data-open="${p.id}" style="cursor:pointer">
      <rect x="0" y="${y - rh / 2}" width="${w}" height="${rh}" fill="transparent"/>
      <text x="${m.l - 12}" y="${y + 4}" text-anchor="end" class="lbl-ink" style="font-family:var(--mono);font-weight:500">${esc(p.code)}</text>
      <line x1="${xs(p.margin_at_bid)}" x2="${xs(p.margin_at_completion)}" y1="${y}" y2="${y}" stroke="${col}" stroke-width="2"/>
      <circle cx="${xs(p.margin_at_bid)}" cy="${y}" r="5" fill="#fff" stroke="${C.ink3}" stroke-width="1.6"/>
      <circle cx="${xs(p.margin_at_completion)}" cy="${y}" r="5.5" fill="${col}" stroke="#fff" stroke-width="2"/>
      <text x="${Math.max(xs(p.margin_at_bid), xs(p.margin_at_completion)) + 10}" y="${y + 4}">${er >= 0 ? '+' : ''}${er.toFixed(1)}</text></g>`;
  });
  return `<div class="legend"><span><i style="background:#fff;border:1.6px solid ${C.ink3};border-radius:50%"></i>Margin at bid</span><span><i style="background:${C.bad};border-radius:50%"></i>Margin at completion (colour = erosion)</span></div>` + s + '</svg>';
}
export function ageingChart(items) {
  const bins = [['0–7 d', 0, 7], ['8–14 d', 8, 14], ['15–30 d', 15, 30], ['31–60 d', 31, 60], ['60+ d', 61, 1e9]];
  const counts = bins.map(b => items.filter(x => x.age >= b[1] && x.age <= b[2]).length);
  const max = Math.max.apply(null, counts.concat([1]));
  const w = 560, h = 190, m = { t: 20, r: 10, b: 28, l: 10 }, pw = w - m.l - m.r, ph = h - m.t - m.b, bw = Math.min(56, pw / bins.length - 18);
  let s = `<svg class="chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="Open client items by age">`;
  s += `<line x1="${m.l}" x2="${w - m.r}" y1="${m.t + ph}" y2="${m.t + ph}" stroke="${C.rule}"/>`;
  bins.forEach((b, i) => {
    const cx = m.l + (i + 0.5) * pw / bins.length, bh = counts[i] / max * ph;
    const col = i >= 3 ? C.bad : i === 2 ? C.warn : C.blue;
    s += `<rect x="${cx - bw / 2}" y="${m.t + ph - bh}" width="${bw}" height="${Math.max(bh, counts[i] ? 2 : 0)}" fill="${col}" rx="1" ${tip(`<b>${b[0]}</b><br>${plural(counts[i], 'item')} open`)}/>`;
    s += `<text x="${cx}" y="${m.t + ph - bh - 6}" text-anchor="middle" class="lbl-ink">${counts[i]}</text>`;
    s += `<text x="${cx}" y="${h - 8}" text-anchor="middle">${b[0]}</text>`;
  });
  return s + '</svg>';
}
export function riskMatrix(risks) {
  const L = ['High', 'Medium', 'Low'], W = { High: 3, Medium: 2, Low: 1 };
  const open = risks.filter(r => r.status !== 'Closed');
  let s = `<div class="matrix"><span></span>${['Low', 'Medium', 'High'].map(i => `<span class="ax c">${i}</span>`).join('')}`;
  L.forEach(p => {
    s += `<span class="ax">${p}</span>`;
    ['Low', 'Medium', 'High'].forEach(i => {
      const here = open.filter(r => r.probability === p && r.impact === i);
      const sc = W[p] * W[i];
      const bg = sc >= 6 ? 'var(--bad-t)' : sc >= 3 ? 'var(--warn-t)' : 'var(--good-t)';
      const fg = sc >= 6 ? 'var(--bad)' : sc >= 3 ? 'var(--warn)' : 'var(--good)';
      s += `<span class="m" style="background:${bg};color:${fg}" ${here.length ? tip(here.map(r => `<b>${esc(r.ref)}</b> ${esc(r.description)}`).join('<br>')) : ''}>${here.length || ''}</span>`;
    });
  });
  return s + `</div><div class="source" style="margin-top:6px">Rows: probability · columns: impact</div>`;
}
export function trendChartProject(snaps) {
  const s = snaps.filter(x => !isNil(x.health_index));
  return lineChart([{ name: 'Health', color: C.blue, values: s.map(x => x.health_index) }], s.map(x => x.week_ending),
    { w: 640, h: 190, refs: [{ v: 80, c: C.good, t: '80' }, { v: 60, c: C.bad, t: '60' }], label: 'Health across weekly snapshots' });
}
