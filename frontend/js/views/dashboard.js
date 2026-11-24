/* Portfolio dashboard (the home screen for every role except PM): KPI row, Monday brief, project
   table with filters, and the Excel / PDF download buttons other screens reuse
   (downloadTools + wireDownloads).  API: api/portfolio.api.js, api/export.api.js */
import { $, $$, esc } from '../core/dom.js';
import { C, HC, ROLE_LABEL } from '../core/constants.js';
import { bandOf, chip, daysBetween, fmtDate, inr, isNil, n2, pct, plural, todayISO } from '../core/format.js';
import { info } from '../core/formulas.js';
import { dots, ic } from '../core/icons.js';
import { getPortfolio } from '../api/portfolio.api.js';
import { downloadPortfolioPack, downloadProjectPack } from '../api/export.api.js';
import { download } from '../core/download.js';
import { deltaOf, deltaTxt, hmeter, projCell, project4, spark } from '../charts/spark.js';
import { lineChart } from '../charts/line.js';
import { heatmap } from '../charts/heatmap.js';
import { bars, lane, stateStack } from '../charts/bars.js';
import { State } from '../core/state.js';
import { setMain, setTools } from './shell.js';
import { briefShell, loadBrief, wireOpeners } from './ai-brief.js';
import { evTxt, nmTxt, viewPmHome } from './pm-home.js';
import { capabilityGrid, loadBaseline } from './process-metrics.js';
import { avg, pmoDashboard } from './pmo-dashboard.js';
import { printReport } from './print-report.js';

/* ================================================================ dashboard */
export function kpi(label, value, sub, cls, trend, unit) {
  return `<div class="kpi"><span class="lbl">${label}</span>
    <div class="row"><span class="stat">${value}${unit ? `<span class="unit">${unit}</span>` : ''}</span>${trend && trend.length > 1 ? spark(trend, cls === 'dn' ? C.bad : cls === 'up' ? C.good : C.blue, 110, 30) : ''}</div>
    <div class="sub ${cls || ''}">${sub || ''}</div></div>`;
}
export function portfolioSeries(ps) {
  const weeks = Array.from(new Set(ps.reduce((a, p) => a.concat(p.trend_weeks || []), []))).sort().slice(-12);
  const avg = [], worst = [];
  weeks.forEach(wk => {
    const vals = ps.map(p => { const i = (p.trend_weeks || []).indexOf(wk); return i >= 0 ? p.trend[i] : null; }).filter(v => !isNil(v));
    avg.push(vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null);
    worst.push(vals.length ? Math.min.apply(null, vals) : null);
  });
  return { weeks, avg, worst };
}
export function portfolioKpis(ps, showValue) {
  const rep = ps.filter(p => !isNil(p.health));
  const avg = rep.length ? Math.round(rep.reduce((s, p) => s + p.health, 0) / rep.length) : null;
  const reds = ps.filter(p => p.state === 'r').length, ambers = ps.filter(p => p.state === 'a').length;
  const slipping = ps.filter(p => p.slip_days > 0).length;
  const blocked = ps.reduce((s, p) => s + (p.dep_value_blocked || 0), 0);
  const stale = ps.filter(p => p.stale_days === null || p.stale_days > 10).length;
  const cv = ps.reduce((s, p) => s + (p.contract_value || 0), 0);
  const ser = portfolioSeries(ps), d = deltaOf(ser.avg.filter(v => !isNil(v)));
  const falling = ps.filter(p => { const v = project4(p.trend); return v !== null && !isNil(p.health) && bandOf(v) !== bandOf(p.health) && v < p.health; }).length;
  return `<div class="kpis k5">
    ${kpi('Portfolio health', avg === null ? '—' : String(avg), ser.avg.length > 1 ? `${d >= 0 ? '+' : ''}${d} over ${ser.avg.length} weeks` : 'No trend yet', d < 0 ? 'dn' : d > 0 ? 'up' : '', ser.avg.filter(v => !isNil(v)), '/100')}
    ${kpi('Needing attention', String(reds + ambers), `${reds} intervene · ${ambers} watch`, reds ? 'dn' : '')}
    ${kpi('Milestones slipping', String(slipping), slipping ? `of ${ps.length} behind baseline` : 'all on baseline', slipping ? 'dn' : 'up')}
    ${showValue ? kpi('Billing held by clients', blocked.toFixed(1), `₹ Cr · ${ps.reduce((s, p) => s + (p.open_deps || 0), 0)} open items`, blocked ? 'dn' : '', null, 'Cr')
      : kpi('Open with clients', String(ps.reduce((s, p) => s + (p.open_deps || 0), 0)), stale ? `${stale} report stale` : 'all reports current', '')}
    ${showValue ? kpi('Contract value in view', cv.toFixed(1), `₹ Cr · ${falling ? falling + ' trending into a worse band' : 'no band changes projected'}`, falling ? 'dn' : '', null, 'Cr')
      : kpi('Projected band change', String(falling), falling ? 'trending into a worse band in 4 weeks' : 'no band changes projected', falling ? 'dn' : 'up')}
  </div>`;
}

export const SORT = { key: 'health', dir: 1 };
export function portfolioTable(ps, opts) {
  opts = opts || {};
  const cols = [
    ['code', 'Code', ''], ['name', 'Project', ''],
    ...(opts.showValue ? [['contract_value', 'Value', 'r']] : []),
    ['health', 'Health', 'r'], ['trend', 'Trend', 'r'], ['proj', '+4 wk', 'r'],
    ['spi', 'SPI / CPI', 'r'],
    ['effort_variance_pct', 'Effort var.', 'r'], ['net_margin_pct', 'Net margin', 'r'],
    ...(opts.showValue ? [['margin_at_completion', 'Margin', 'r']] : []),
    ['slip_days', 'Slip', 'r'], ['open_deps', 'Client', 'r'], ['state', 'State', '']
  ];
  const rows = ps.slice().sort((a, b) => {
    const k = SORT.key, d = SORT.dir;
    let va, vb;
    if (k === 'trend') { va = deltaOf(a.trend); vb = deltaOf(b.trend); }
    else if (k === 'proj') { va = project4(a.trend); vb = project4(b.trend); }
    else if (k === 'state') { const o = { r: 0, a: 1, g: 2 }; va = o[a.state] === undefined ? 3 : o[a.state]; vb = o[b.state] === undefined ? 3 : o[b.state]; }
    else { va = a[k]; vb = b[k]; }
    if (isNil(va)) va = k === 'name' || k === 'code' ? '' : -1;
    if (isNil(vb)) vb = k === 'name' || k === 'code' ? '' : -1;
    return typeof va === 'string' ? d * va.localeCompare(vb) : d * (va - vb);
  });
  const FXK = { health: 'health', effort_variance_pct: 'ev', net_margin_pct: 'nm', spi: 'spi', slip_days: 'slip', open_deps: 'iad', margin_at_completion: 'forecast_margin' };
  const head = cols.map(c => `<th class="sortable ${c[2]}" data-k="${c[0]}" tabindex="0" aria-sort="${SORT.key === c[0] ? (SORT.dir > 0 ? 'ascending' : 'descending') : 'none'}">${c[1]}${FXK[c[0]] ? info(FXK[c[0]]) : ''}<span class="ar">${SORT.key === c[0] ? (SORT.dir > 0 ? '▲' : '▼') : '▲'}</span></th>`).join('');
  const body = rows.length ? rows.map(p => {
    const t = p.trend || [], d = deltaOf(t);
    const mc = (!isNil(p.margin_at_completion) && p.margin_at_completion < p.margin_at_bid) ? ' class="r bad" style="font-weight:600"' : ' class="r"';
    return `<tr class="clickable" tabindex="0" data-open="${p.id}">
      <td class="nw">${esc(p.code)}</td><td><span class="wrap">${esc(p.name)}</span><span class="subl">${esc(p.client)} · ${esc(p.pm)}${p.stage ? ' · ' + esc(p.stage) : ''}</span></td>
      ${opts.showValue ? `<td class="r">${inr(p.contract_value)}</td>` : ''}
      <td class="r">${hmeter(p.health, p)}</td>
      <td class="r"><span class="trendcell">${t.length > 1 ? spark(t, d < 0 ? C.bad : d > 0 ? C.good : C.ink3) : ''}${t.length > 1 ? deltaTxt(d) : '<span class="muted">—</span>'}</span></td>
      <td class="r">${projCell(p)}</td>
      <td class="r">${n2(p.spi)} <span class="muted">/ ${n2(p.cpi)}</span></td>
      <td class="r">${evTxt(p.effort_variance_pct)}</td><td class="r">${nmTxt(p.net_margin_pct)}</td>
      ${opts.showValue ? `<td${mc}>${pct(p.margin_at_completion)} <span class="muted">/ ${p.margin_at_bid}%</span></td>` : ''}
      <td class="r${p.slip_days ? ' bad' : ''}">${p.slip_days ? p.slip_days + ' d' : '—'}</td>
      <td class="r${p.open_deps ? ' bad' : ''}" style="${p.open_deps ? 'font-weight:600' : ''}">${p.open_deps || '—'}</td>
      <td>${chip(p.state)}</td></tr>`;
  }).join('') : `<tr><td colspan="${cols.length}" style="color:var(--ink-3);padding:var(--s-6)">No project matches these filters.</td></tr>`;
  return `<div class="tblwrap" id="pfWrap"><table id="pfTable" class="tight"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
}

export const FILTER = { q: '', bu: '', state: '' };
export function applyFilter(ps) {
  const q = FILTER.q.toLowerCase();
  return ps.filter(p => {
    if (FILTER.bu && p.bu !== FILTER.bu) return false;
    if (FILTER.state && p.state !== FILTER.state) return false;
    if (q && (p.code + ' ' + p.name + ' ' + p.client + ' ' + p.pm + ' ' + p.bu).toLowerCase().indexOf(q) < 0) return false;
    return true;
  });
}
export function downloadTools(projectId) {
  return projectId
    ? `<button class="btn sec sm" type="button" data-dl-xlsx="${projectId}">${ic('download')} Status pack .xlsx</button><button class="btn sec sm" type="button" data-dl-pdf="${projectId}">${ic('file')} PDF report</button>`
    : `<button class="btn sec sm" type="button" data-dl-xlsx="">${ic('download')} Status pack .xlsx</button><button class="btn sec sm" type="button" data-dl-pdf="">${ic('file')} PDF report</button>`;
}
export function wireDownloads(scope) {
  (scope || document).querySelectorAll('[data-dl-xlsx]').forEach(b => { if (b._w) return; b._w = true;
    b.addEventListener('click', () => b.dataset.dlXlsx ? download(() => downloadProjectPack(b.dataset.dlXlsx), 'status.xlsx') : download(downloadPortfolioPack, 'portfolio.xlsx')); });
  (scope || document).querySelectorAll('[data-dl-pdf]').forEach(b => { if (b._w) return; b._w = true;
    b.addEventListener('click', () => printReport(b.dataset.dlPdf || null)); });
}

export async function viewDashboard() {
  const r = await getPortfolio();
  State.portfolio = r.projects;
  if (State.user.role === 'pm') return viewPmHome();
  const role = State.user.role, showValue = true;
  const bus = Array.from(new Set(State.portfolio.map(p => p.bu))).sort();
  const titles = {
    dh: ['Your portfolio', 'Every project you own, ranked by a computed health index — with the trend, the four-week projection and what is sitting with the client.'],
    director: [`${State.user.bu || 'Business unit'} portfolio`, 'Your business unit, with the commercial position alongside delivery health.'],
    ceo: ['The firm, this week', 'Every project at Uneecops. The brief first, then the numbers behind it, then the exceptions.'],
    admin: ['All projects', 'Administrator view — every project, regardless of assignment.'],
    auditor: ['All projects — audit view', 'Delivery health alongside the audit position. Open non-conformances lower the Process compliance part of the score.']
  };
  const [title, lede] = titles[role] || titles.ceo;
  const ser = portfolioSeries(State.portfolio);
  const byBu = bus.map(b => {
    const rows = State.portfolio.filter(p => p.bu === b && !isNil(p.health));
    const v = rows.length ? Math.round(rows.reduce((s, p) => s + p.health, 0) / rows.length) : 0;
    return [b, v, HC[bandOf(v)], `<b>${esc(b)}</b><br>Average health ${v} across ${plural(rows.length, 'project')}`];
  }).sort((a, b) => a[1] - b[1]);
  const fell = State.portfolio.filter(p => deltaOf(p.trend) <= -8).sort((a, b) => deltaOf(a.trend) - deltaOf(b.trend));
  const filtered = applyFilter(State.portfolio);

  setMain(`
    <div class="pagehead"><div class="row"><div class="grow"><span class="eyebrow">${ROLE_LABEL[role]}${State.user.bu ? ' · ' + esc(State.user.bu) : ''}</span><h1>${esc(title)}</h1>
      <p class="lede">${lede}</p></div></div>
      <div class="meta"><div>Projects <b>${State.portfolio.length}</b></div>
        <div>Reported this cycle <b>${State.portfolio.filter(p => p.stale_days !== null && p.stale_days <= 10).length} of ${State.portfolio.length}</b></div>
        <div>As of <b>${fmtDate(todayISO())}</b></div></div></div>
    ${briefShell()}
    ${pmoDashboard(State.portfolio, 'mgmt')}
    <div class="sh" style="margin:var(--s-6) 0 var(--s-3)"><h2>Health and commercial position</h2></div>
    ${portfolioKpis(State.portfolio, showValue)}
    <div class="grid2">
      <div><span class="eyebrow">01 · Trend</span><h3>Portfolio health, last ${ser.weeks.length} weeks</h3><div class="cap">Average of every project in view, against the weakest one. Hover for the week.</div>
        <div class="legend"><span><i class="ln" style="background:${C.blue}"></i>Portfolio average</span><span><i class="ln" style="background:${C.cat3}"></i>Weakest project</span></div>
        ${lineChart([{ name: 'Portfolio average', color: C.blue, values: ser.avg }, { name: 'Weakest project', color: C.cat3, values: ser.worst }], ser.weeks,
          { refs: [{ v: 80, c: C.good, t: 'On track' }, { v: 60, c: C.bad, t: 'Intervene' }], label: 'Portfolio health trend' })}
        <div class="source">Source · weekly snapshots, health index 0–100</div></div>
      <div><span class="eyebrow">02 · Position</span><h3>Where the portfolio stands</h3><div class="cap">Projects by computed band, then average health by business unit.</div>
        ${stateStack(State.portfolio)}
        <div style="margin-top:var(--s-5)">${bars(byBu, 100)}</div>
        ${fell.length ? `<div class="takeaway"><strong>${fell.map(p => esc(p.code)).join(', ')}</strong> ${fell.length === 1 ? 'has' : 'have'} lost eight or more points since the first snapshot — the trend is the part a single week's number hides.</div>` : ''}</div>
    </div>
    <section class="blk">
      <div class="sh"><span class="n">03</span><h2>Week by week</h2><span class="note">Each cell is one snapshot · outlined cell is the latest · last column projects the trend four weeks on</span></div>
      ${heatmap(State.portfolio)}
      <div class="source">Source · weekly snapshots · projection is a straight-line trend, not a forecast model</div>
    </section>
    <section class="blk" id="capSec">
      <div class="sh"><span class="n">★</span><h2>Process capability against the baseline</h2><span class="note">Green within LSL–USL · red outside · grey no limits or no data · hover a cell for the limits</span></div>
      <div id="capGrid"><p class="muted">${dots()} Loading the baseline…</p></div>
      <div class="source">Source · project process inputs, measured against the organisation's process performance baseline (Administration → Process baseline)</div>
    </section>
    <section class="blk">
      <div class="sh"><span class="n">04</span><h2>Projects</h2><span class="note">Click a row to open the project</span></div>
      <div class="toolbar">
        <input type="search" id="fq" placeholder="Search code, client, PM…" value="${esc(FILTER.q)}" aria-label="Search">
        <select id="fbu" aria-label="Business unit"><option value="">All business units</option>${bus.map(b => `<option${FILTER.bu === b ? ' selected' : ''}>${esc(b)}</option>`).join('')}</select>
        <select id="fst" aria-label="State"><option value="">All states</option>
          <option value="r"${FILTER.state === 'r' ? ' selected' : ''}>Intervene</option>
          <option value="a"${FILTER.state === 'a' ? ' selected' : ''}>Watch</option>
          <option value="g"${FILTER.state === 'g' ? ' selected' : ''}>On track</option></select>
        <button class="btn sec sm" id="freset" type="button">Reset</button>
        <span class="spacer"></span>
        <span class="mono muted" id="fcount">${filtered.length} of ${State.portfolio.length}</span>
      </div>
      ${portfolioTable(filtered, { showValue })}
    </section>
    ${runwaySection(State.portfolio)}
    ${showValue ? `<section class="blk"><div class="sh"><span class="n">06</span><h2>Commercial position</h2><span class="note">Value, budget, cost so far and net margin — with a plain-words reading for every project</span></div>
      <p>Net margin to date across the projects in view is <b>${(() => { const v = State.portfolio.reduce((x, p) => x + Number(p.contract_value || 0), 0), c = State.portfolio.reduce((x, p) => x + Number(p.actual_cost_cr || 0), 0); return v ? Math.round((v - c) / v * 1000) / 10 + '%' : '—'; })()}</b>${info('nm')}. <a href="#commercial" data-v="commercial" class="lnk">Open the commercial position →</a></p></section>` : ''}
  `);
  setTools(downloadTools());
  wireDownloads();
  wireDashboard(showValue);
  wireOpeners($('#main'));
  loadBaseline().then(B => { const g = $('#capGrid'); if (g) { g.innerHTML = capabilityGrid(State.portfolio, B); wireOpeners(g); } }).catch(() => {});
  loadBrief(false);
}

export function runwaySection(ps) {
  const withMs = ps.filter(p => p.next_milestone_date).sort((a, b) => String(a.next_milestone_date).localeCompare(String(b.next_milestone_date)));
  if (!withMs.length) return '';
  const inside21 = withMs.filter(p => daysBetween(todayISO(), p.next_milestone_date) <= 21).length;
  const behind = withMs.filter(p => p.slip_days > 0).length;
  return `<section class="blk">
    <div class="sh"><span class="n">05</span><h2>Milestone runway, next 60 days</h2><span class="note">Hollow marker is the baseline date, filled marker is the current forecast</span></div>
    <div class="tblwrap"><table style="min-width:720px"><thead><tr><th>Project</th><th>Next milestone</th><th class="r">Forecast</th><th class="r">Slip</th><th style="width:40%">Runway · today → +60 days</th></tr></thead><tbody>
    ${withMs.map(p => `<tr class="clickable" tabindex="0" data-open="${p.id}">
      <td>${esc(p.code)}</td><td><span class="wrap">${esc(p.next_milestone)}</span></td>
      <td class="r">${fmtDate(p.next_milestone_date)}</td>
      <td class="r${p.slip_days ? ' bad' : ''}" style="${p.slip_days ? 'font-weight:600' : ''}">${p.slip_days ? p.slip_days + ' d' : '—'}</td>
      <td>${lane(p.next_milestone_baseline, p.next_milestone_date)}</td></tr>`).join('')}
    </tbody></table></div>
    <div class="takeaway"><strong>${plural(inside21, 'milestone')} land${inside21 === 1 ? 's' : ''} inside three weeks, and ${behind} of the ${withMs.length} shown ${behind === 1 ? 'is' : 'are'} already behind baseline.</strong>
      Read the cluster rather than the individual rows — several landing in the same week is a cash problem before it is a delivery one.</div>
  </section>`;
}

export function wireDashboard(showValue) {
  const q = $('#fq');
  if (!q) return;
  q.addEventListener('input', () => { FILTER.q = q.value; repaint(); });
  $('#fbu').addEventListener('change', e => { FILTER.bu = e.target.value; repaint(); });
  $('#fst').addEventListener('change', e => { FILTER.state = e.target.value; repaint(); });
  $('#freset').addEventListener('click', () => { FILTER.q = FILTER.bu = FILTER.state = ''; q.value = ''; $('#fbu').value = ''; $('#fst').value = ''; repaint(); });
  function repaint() {
    const filtered = applyFilter(State.portfolio);
    $('#pfWrap').outerHTML = portfolioTable(filtered, { showValue });
    $('#fcount').textContent = `${filtered.length} of ${State.portfolio.length}`;
    wireTable(repaint);
  }
  wireTable(repaint);
}
export function wireTable(repaint) {
  wireOpeners($('#main'));
  $$('th.sortable').forEach(th => {
    if (th._w) return; th._w = true;
    const go2 = () => { const k = th.dataset.k; if (SORT.key === k) SORT.dir = -SORT.dir; else { SORT.key = k; SORT.dir = 1; } repaint(); };
    th.addEventListener('click', go2);
    th.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go2(); } });
  });
}
