/* PDF status report: builds a print layout in #print and opens the browser's print dialog
   ("Save as PDF"). For one project or the whole portfolio.
   Side effect on import: #print is cleared after printing (imported in main.js).
   API: api/portfolio.api.js, api/project.api.js */
import { $, esc } from '../core/dom.js';
import { HN, ROLE_LABEL } from '../core/constants.js';
import { chip, daysBetween, fmtDate, isNil, n2, pct, todayISO } from '../core/format.js';
import { toast } from '../components/toast.js';
import { getPortfolio } from '../api/portfolio.api.js';
import { getProject } from '../api/project.api.js';
import { deltaOf, deltaTxt } from '../charts/spark.js';
import { heatmap } from '../charts/heatmap.js';
import { trendChartProject } from '../charts/portfolio.js';
import { State } from '../core/state.js';
import { kpi, portfolioKpis } from './dashboard.js';
import { healthBreakdown } from './health-breakdown.js';

/* ================================================================ PDF status report (print) */
export async function printReport(projectId) {
  toast('Preparing the report…');
  const host = $('#print');
  const who = `${esc(State.user.name)} · ${ROLE_LABEL[State.user.role]}`;
  const head = t => `<div class="rpt-head"><span class="mark"><img src="/assets/logo.png" alt="Uneecops" style="height:44px;vertical-align:middle;margin-right:10px">Delivery Command Centre</span><span class="eyebrow">${esc(t)} · ${esc(fmtDate(todayISO()))}</span></div>`;
  const foot = `<div class="rpt-foot"><span>Delivery Command Centre · Uneecops Technologies Limited</span><span>Prepared for ${who}</span></div>`;
  try {
    if (!State.portfolio.length) State.portfolio = (await getPortfolio()).projects;
    if (projectId) {
      const r = await getProject(projectId), p = r.project, h = r.health;
      const row = State.portfolio.find(x => x.id === projectId) || {};
      const an = State.analysis[projectId] ? State.analysis[projectId].out : null;
      const openDeps = r.dependencies.filter(x => x.status !== 'Closed');
      host.innerHTML = `${head('Project status report')}
        <div class="band"><span class="eyebrow">${esc(p.code)} · ${esc(p.bu)} · ${esc(p.client)}</span><h2 class="hl">${esc(p.name)}</h2>
          ${an ? `<p><strong style="color:var(--ink)">${esc(an.headline)}.</strong> ${esc(an.diagnosis)}</p>` : ''}</div>
        <div class="kpis">${kpi('Health', h ? String(h.index) : '—', h ? HN[h.state] : 'No report', h && h.state === 'r' ? 'dn' : '', null, '/100')}
          ${kpi('SPI / CPI', `${n2(row.spi)}`, `CPI ${n2(row.cpi)}`, '')}
          ${kpi('Complete', isNil(row.pct_complete) ? '—' : String(row.pct_complete), `budget consumed ${pct(row.budget_consumed_pct)}`, '', null, '%')}
          ${kpi('Open with client', String(openDeps.length), openDeps.length ? `oldest ${row.oldest_dep_days} days` : 'nothing pending', openDeps.length ? 'dn' : 'up')}</div>
        ${h ? `<section class="blk"><div class="sh"><h2>What makes up the score · ${h.index}/100</h2></div>${healthBreakdown(h, true)}</section>` : ''}
        <section class="blk"><div class="sh"><h2>Health across weekly snapshots</h2></div>${trendChartProject(r.snapshots)}</section>
        ${an && an.actions.length ? `<section class="blk"><div class="sh"><h2>Recommended actions</h2><span class="note">${an.source === 'ai' ? 'DCC Intelligence' : 'Rule-based'}</span></div><table><thead><tr><th>Action</th><th>Owner</th><th class="r">Within</th><th>Priority</th></tr></thead><tbody>${an.actions.map(x => `<tr><td>${esc(x.title)}<span class="subl">${esc(x.detail)}</span></td><td>${esc(ROLE_LABEL[x.owner_role] || x.owner_role)}</td><td class="r">${x.due_in_days} d</td><td>${esc(x.priority)}</td></tr>`).join('')}</tbody></table></section>` : ''}
        <section class="blk"><div class="sh"><h2>Milestones</h2></div><table><thead><tr><th>Ref</th><th>Milestone</th><th class="r">Baseline</th><th class="r">Forecast</th><th class="r">Actual</th><th class="r">Slip</th></tr></thead><tbody>
          ${r.milestones.map(m => { const s = m.actual_date ? 0 : Math.max(0, daysBetween(m.baseline_date, m.forecast_date)); return `<tr><td>${esc(m.ref)}</td><td>${esc(m.name)}</td><td class="r">${fmtDate(m.baseline_date)}</td><td class="r">${fmtDate(m.forecast_date)}</td><td class="r">${fmtDate(m.actual_date)}</td><td class="r${s ? ' bad' : ''}">${s ? s + ' d' : '—'}</td></tr>`; }).join('')}</tbody></table></section>
        <section class="blk"><div class="sh"><h2>Open with the client</h2></div>${openDeps.length ? `<table><thead><tr><th>Item</th><th>Owner at client</th><th class="r">Age</th><th>Holds</th><th>Status</th></tr></thead><tbody>
          ${openDeps.map(x => `<tr><td>${esc(x.description)}</td><td>${esc(x.owner_at_client || '—')}</td><td class="r">${Math.max(0, daysBetween(x.raised_date, todayISO()))} d</td><td>${esc(x.milestone_blocked || '—')}</td><td>${esc(x.status)}</td></tr>`).join('')}</tbody></table>` : '<p>Nothing pending.</p>'}</section>
        <section class="blk"><div class="sh"><h2>Open risks</h2></div>${r.risks.filter(x => x.status !== 'Closed').length ? `<table><thead><tr><th>Ref</th><th>Risk</th><th>P / I</th><th>Owner</th><th>Mitigation</th></tr></thead><tbody>
          ${r.risks.filter(x => x.status !== 'Closed').map(x => `<tr><td>${esc(x.ref)}</td><td>${esc(x.description)}</td><td>${esc(x.probability)} / ${esc(x.impact)}</td><td>${esc(x.owner_name || '—')}</td><td>${esc(x.mitigation || '—')}</td></tr>`).join('')}</tbody></table>` : '<p>No open risks.</p>'}</section>
        ${r.history.length && r.history[r.history.length - 1].narrative ? `<section class="blk"><div class="sh"><h2>Project manager's narrative</h2><span class="note">week ending ${fmtDate(r.history[r.history.length - 1].week_ending)}</span></div><p>${esc(r.history[r.history.length - 1].narrative)}</p></section>` : ''}
        ${foot}`;
    } else {
      const ps = State.portfolio, showValue = State.user.role !== 'pm', b = State.brief;
      host.innerHTML = `${head('Portfolio status report')}
        ${b ? `<div class="band"><span class="eyebrow">Monday brief · ${b.source === 'ai' ? 'DCC Intelligence' : 'Rule-based'}</span><h2 class="hl">${esc(b.headline)}</h2><p>${esc(b.summary)}</p>
          ${b.attention.length ? `<div class="cols">${b.attention.map((a, i) => `<div><span class="n">0${i + 1}</span><span class="code">${esc(a.code)}</span><h3>${esc(a.title)}</h3><p>${esc(a.why)}</p><p style="color:var(--ink)">→ ${esc(a.action)}</p></div>`).join('')}</div>` : ''}</div>` : ''}
        ${portfolioKpis(ps, showValue)}
        <section class="blk"><div class="sh"><h2>Projects</h2></div><table><thead><tr><th>Code</th><th>Project</th><th class="r">Health</th><th class="r">Trend</th><th class="r">SPI / CPI</th>${showValue ? '<th class="r">Margin</th>' : ''}<th class="r">Slip</th><th class="r">Client</th><th>State</th></tr></thead><tbody>
          ${ps.slice().sort((a, c) => (a.health || 0) - (c.health || 0)).map(p => `<tr><td>${esc(p.code)}</td><td>${esc(p.name)}<span class="subl">${esc(p.client)}</span></td><td class="r">${isNil(p.health) ? '—' : p.health}</td><td class="r">${deltaTxt(deltaOf(p.trend))}</td><td class="r">${n2(p.spi)} / ${n2(p.cpi)}</td>${showValue ? `<td class="r">${pct(p.margin_at_completion)}</td>` : ''}<td class="r">${p.slip_days ? p.slip_days + ' d' : '—'}</td><td class="r">${p.open_deps || '—'}</td><td>${chip(p.state)}</td></tr>`).join('')}</tbody></table></section>
        <section class="blk"><div class="sh"><h2>Week by week</h2></div>${heatmap(ps)}</section>
        ${foot}`;
    }
    setTimeout(() => window.print(), 120);
  } catch (e) { toast('Could not prepare the report', true); }
}
window.addEventListener('afterprint', () => { const p = $('#print'); if (p) p.innerHTML = ''; });
