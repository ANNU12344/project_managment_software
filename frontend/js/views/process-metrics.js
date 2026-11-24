/* Process metrics against the organisation baseline (LSL / Goal / USL per metric). The baseline
   is fetched once and kept in State.baseline.  API: api/admin.api.js (getMetricsBaseline) */
import { esc } from '../core/dom.js';
import { C } from '../core/constants.js';
import { chip, isNil, tip } from '../core/format.js';
import { getMetricsBaseline } from '../api/admin.api.js';
import { State } from '../core/state.js';

/* ---------- process metrics vs the baseline ---------- */
export const MX_ST = { within: ['g', 'Within limits'], below: ['r', 'Below LSL'], above: ['r', 'Above USL'], tracked: ['b', 'Tracked'], nodata: ['n', 'No data'] };
export const MX_SHORT = { net_margin_pct: 'NM %', evb_pct: 'EVb %', defect_rate: 'Defect rate', productivity: 'Productivity', req_effort_pct: 'Req/SRS eff %',
  design_effort_pct: 'Design eff %', dev_effort_pct: 'Dev eff %', req_defect_rate: 'Req DR', dd_defect_rate: 'D&D DR', testing_defect_rate: 'Test DR',
  uat_defect_rate: 'UAT DR', rsi: 'RSI', review_effectiveness: 'RE', testing_efficiency: 'TE', dre: 'DRE', svb_pct: 'SVb %',
  design_review_eff: 'Des rev eff', code_review_eff: 'Code rev eff', review_effort_pct: 'Review eff %' };
export const fmtM = (v, unit) => isNil(v) ? '—' : unit === '%' ? Number(v).toFixed(2) + '%' : String(Number(v).toFixed(3)).replace(/\.?0+$/, '') || '0';
export const mxChip = st => chip(MX_ST[st][0], MX_ST[st][1]);
export async function loadBaseline() {
  if (!State.baseline) { const b = await getMetricsBaseline(); State.baseline = {}; b.metrics.forEach(m => State.baseline[m.key] = m); State.baselineList = b.metrics; }
  return State.baseline;
}
/* LSL–USL band with the goal as a tick and the project's value as a dot. */
export function mxRange(m) {
  if (isNil(m.lsl) && isNil(m.usl)) return '<span class="muted" style="font-size:12px">no limits — tracked only</span>';
  if (isNil(m.value)) return '<span class="muted" style="font-size:12px">no data</span>';
  const lo0 = Math.min(m.lsl, m.value), hi0 = Math.max(m.usl, m.value), pad = (hi0 - lo0) * 0.12 || 1;
  const lo = lo0 - pad, hi = hi0 + pad, x = v => ((v - lo) / (hi - lo) * 100).toFixed(2) + '%';
  const col = m.status === 'within' ? C.good : C.bad;
  return `<div class="mxr" ${tip(`<b>${esc(m.label)}</b><br>Value <b>${fmtM(m.value, m.unit)}</b><br>LSL ${fmtM(m.lsl, m.unit)} · Goal ${fmtM(m.goal, m.unit)} · USL ${fmtM(m.usl, m.unit)}${isNil(m.z) ? '' : `<br>${m.z > 0 ? '+' : ''}${m.z} σ from goal`}`)}>
    <span class="mx-band" style="left:${x(m.lsl)};width:calc(${x(m.usl)} - ${x(m.lsl)})"></span>
    ${isNil(m.goal) ? '' : `<span class="mx-goal" style="left:${x(m.goal)}"></span>`}
    <span class="mx-dot" style="left:${x(m.value)};background:${col}"></span></div>`;
}
export function metricsTable(list) {
  return `<div class="tblwrap"><table class="tight" style="min-width:760px"><thead><tr><th>Metric</th><th class="r">Value</th><th class="r">LSL</th><th class="r">Goal</th><th class="r">USL</th><th style="width:26%">Against baseline</th><th>Status</th></tr></thead><tbody>
    ${list.map(m => `<tr><td><span class="wrap" ${tip(`<b>${esc(m.label)}</b><br>${esc(m.formula)}${m.unit !== '%' ? ' · ' + esc(m.unit) : ''}`)}>${esc(m.label)}</span></td>
      <td class="r" style="font-weight:700;color:${m.status === 'within' ? C.good : m.status === 'below' || m.status === 'above' ? C.bad : 'inherit'}">${fmtM(m.value, m.unit)}</td>
      <td class="r muted">${fmtM(m.lsl, m.unit)}</td><td class="r">${fmtM(m.goal, m.unit)}</td><td class="r muted">${fmtM(m.usl, m.unit)}</td>
      <td>${mxRange(m)}</td><td>${mxChip(m.status)}</td></tr>`).join('')}
  </tbody></table></div>`;
}
export function mxSummaryTxt(sm) {
  return `${sm.within} within · <span class="${sm.out ? 'bad' : ''}" style="font-weight:600">${sm.out} out of limits</span> · ${sm.tracked} tracked${sm.nodata ? ' · ' + sm.nodata + ' no data' : ''}`;
}
/* Projects × metrics, coloured by status against the baseline. */
export function capabilityGrid(ps, B) {
  const keys = Object.keys(MX_SHORT);
  const cols = `grid-template-columns:120px repeat(${keys.length},minmax(58px,1fr)) 64px`;
  const rows = ps.slice().sort((a, b) => ((b.process_summary || {}).out || 0) - ((a.process_summary || {}).out || 0));
  let h = `<div class="hscroll"><div class="heat mxgrid" style="min-width:${120 + keys.length * 60 + 64}px">`;
  h += `<div class="hr" style="${cols}"><span></span>${keys.map(k => `<span class="ax" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis" ${tip(`<b>${esc((B[k] || {}).label || k)}</b><br>${esc((B[k] || {}).formula || '')}`)}>${esc(MX_SHORT[k])}</span>`).join('')}<span class="ax">Out</span></div>`;
  rows.forEach(p => {
    const byK = {}; (p.process || []).forEach(m => byK[m.key] = m);
    h += `<div class="hr" style="${cols}"><span class="hl" data-open="${p.id}" tabindex="0">${esc(p.code)}</span>`;
    keys.forEach(k => {
      const m = byK[k] || { status: 'nodata', value: null }, b = B[k] || {};
      const cls = m.status === 'within' ? 'g' : m.status === 'below' || m.status === 'above' ? 'r' : 'n';
      h += `<span class="c ${cls}" ${tip(`<b>${esc(p.code)}</b> · ${esc(b.label || k)}<br>Value <b>${fmtM(m.value, b.unit)}</b>${isNil(b.lsl) ? '<br>No control limits — tracked' : `<br>LSL ${fmtM(b.lsl, b.unit)} · Goal ${fmtM(b.goal, b.unit)} · USL ${fmtM(b.usl, b.unit)}`}<br>${MX_ST[m.status][1]}`)}>${isNil(m.value) ? '' : (b.unit === '%' ? Number(m.value).toFixed(0) : Number(m.value).toFixed(2))}</span>`;
    });
    const out = (p.process_summary || {}).out || 0;
    h += `<span class="${out ? 'bad' : 'good'}" style="text-align:right;font-weight:700">${out}</span></div>`;
  });
  return h + '</div></div>';
}
