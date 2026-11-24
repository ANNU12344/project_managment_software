/* Weekly & monthly trends screen: effort, story points, health and risks over time, for one
   project or the whole portfolio, grouped by week or month.
   API: api/portfolio.api.js, api/project.api.js */
import { $, $$, esc } from '../core/dom.js';
import { C, HC, ROLE_LABEL } from '../core/constants.js';
import { bandOf, fmtDate, fmtShort, isNil, plural, tip } from '../core/format.js';
import { info } from '../core/formulas.js';
import { dots } from '../core/icons.js';
import { getPortfolio, getPortfolioHistory } from '../api/portfolio.api.js';
import { getWeeklyEffort, getWeeks } from '../api/project.api.js';
import { State } from '../core/state.js';
import { setMain, setTools } from './shell.js';
import { wireOpeners } from './ai-brief.js';
import { kpi } from './dashboard.js';
import { evTxt } from './pm-home.js';

/* ================================================================ weekly & monthly */
export const monthOf = wk => String(wk).slice(0, 7);
// const monthName = m => new Date(m + '-01T00:00:00Z').toLocaleDateString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' });
export const monthName = m => m.slice(5, 7) + '-' + m.slice(0, 4);

export const fmtH = v => isNil(v) ? '—' : Number(v).toLocaleString('en-IN', { maximumFractionDigits: 1 });
export const varPct = (a, p) => !p || isNil(a) ? null : Math.round((a - p) / p * 1000) / 10;
/* grouped columns: planned (grey) and actual (colour) per period, with hover detail */
export function colChart(labels, planned, actual) {
  const w = 760, h = 200, m = { t: 14, r: 10, b: 30, l: 44 }, pw = w - m.l - m.r, ph = h - m.t - m.b;
  const max = Math.max(1, ...planned.map(x => x || 0), ...actual.map(x => x || 0));
  const step = pw / Math.max(1, labels.length), bw = Math.min(14, step / 3);
  const y = v => m.t + ph - (v || 0) / max * ph;
  let s = `<svg class="chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="Planned and actual hours by period">`;
  [0, 0.5, 1].forEach(f => { s += `<line x1="${m.l}" x2="${w - m.r}" y1="${y(max * f)}" y2="${y(max * f)}" stroke="${C.rule2}"/><text x="${m.l - 6}" y="${y(max * f) + 4}" text-anchor="end">${fmtH(Math.round(max * f))}</text>`; });
  labels.forEach((l, i) => {
    const cx = m.l + step * i + step / 2, over = (actual[i] || 0) > (planned[i] || 0);
    s += `<g ${tip(`<b>${esc(l)}</b><br>Planned ${fmtH(planned[i])} hrs<br>Actual ${fmtH(actual[i])} hrs${planned[i] ? `<br>Variance ${varPct(actual[i], planned[i])}%` : ''}`)}>
      <rect x="${cx - step / 2}" y="${m.t}" width="${step}" height="${ph}" fill="transparent"/>
      <rect x="${cx - bw - 1}" y="${y(planned[i])}" width="${bw}" height="${m.t + ph - y(planned[i])}" fill="${C.rule}" rx="2"/>
      <rect x="${cx + 1}" y="${y(actual[i])}" width="${bw}" height="${m.t + ph - y(actual[i])}" fill="${over ? C.bad : C.blue}" rx="2"/></g>`;
    if (labels.length <= 14 || i % 2 === 0) s += `<text x="${cx}" y="${h - 10}" text-anchor="middle">${esc(l)}</text>`;
  });
  return `<div class="legend"><span><i style="background:${C.rule}"></i>Planned hours</span><span><i style="background:${C.blue}"></i>Actual hours</span><span><i style="background:${C.bad}"></i>Actual above plan</span></div>${s}</svg>`;
}
export function periodSeg(cur) {
  return `<div class="seg" role="group" aria-label="Period"><button type="button" data-period="week" class="${cur === 'week' ? 'on' : ''}">Weekly</button><button type="button" data-period="month" class="${cur === 'month' ? 'on' : ''}">Monthly</button></div>`;
}
export function scopeSelect(ps, cur, allowAll) {
  return `<select id="scopeSel" aria-label="Project" style="width:auto;min-width:240px">${allowAll ? `<option value="all"${cur === 'all' ? ' selected' : ''}>All projects in view</option>` : ''}${ps.map(p => `<option value="${p.id}"${p.id === cur ? ' selected' : ''}>${esc(p.code)} — ${esc(p.name)}</option>`).join('')}</select>`;
}

export async function viewTrends(opts) {
  opts = opts || {};
  State.portfolio = (await getPortfolio()).projects;
  const ps = State.portfolio, senior = State.user.role !== 'pm';
  if (!ps.length) { setMain('<div class="empty">No projects in view.</div>'); return; }
  const scope = opts.scope || State.trendScope || (senior ? 'all' : ps[0].id);
  State.trendScope = scope;
  const period = State.trendPeriod || 'week';
  setMain(`
    <div class="pagehead"><span class="eyebrow">${ROLE_LABEL[State.user.role]}</span><h1>Weekly &amp; monthly</h1>
      <p class="lede">Effort week by week and month by month — what was planned, what was booked, and the running total to date. ${senior ? 'Pick one project or see every project in view.' : ''}</p></div>
    <div class="toolbar">${scopeSelect(ps, scope, senior)}<span class="spacer"></span>${periodSeg(period)}</div>
    <div id="trendBody"><p class="muted">${dots()} Loading…</p></div>`);
  $('#scopeSel').addEventListener('change', e => viewTrends({ scope: e.target.value }));
  $$('[data-period]').forEach(b => b.addEventListener('click', () => { State.trendPeriod = b.dataset.period; viewTrends({ scope }); }));
  setTools('');
  if (scope === 'all') return paintPortfolioTrends(await getPortfolioHistory(26), period);
  const [wk, hist] = await Promise.all([getWeeklyEffort(scope), getWeeks(scope)]);
  paintProjectTrends(wk, hist, period);
}

export function paintProjectTrends(wk, hist, period) {
  const rows = wk.rows, c = wk.cumulative, last = rows[rows.length - 1];
  const hByWeek = {}; (hist.weeks || []).forEach(w => hByWeek[w.week] = w);
  const healthNow = hist.weeks.length ? hist.weeks[hist.weeks.length - 1] : null, health4 = hist.weeks.length > 4 ? hist.weeks[hist.weeks.length - 5] : null;
  const agile = rows.some(r => !isNil(r.sp_completed));
  let body = `<div class="kpis">
    ${kpi('This week ' + info('pva'), last ? fmtH(last.actual_hrs) : '—', last ? `actual of ${fmtH(last.planned_hrs)} planned hrs · w/e ${fmtShort(last.week_ending)}${last.source === 'timesheet' ? ' · from timesheets' : ''}` : 'no entry yet', last && last.actual_hrs > last.planned_hrs ? 'dn' : '', null, 'hrs')}
    ${kpi('To date ' + info('cum'), fmtH(c.actual_hrs), `actual of ${fmtH(c.planned_hrs)} planned hrs over ${plural(c.weeks, 'week')}`, '', null, 'hrs')}
    ${kpi('Effort variance to date ' + info('ev'), isNil(varPct(c.actual_hrs, c.planned_hrs)) ? '—' : (varPct(c.actual_hrs, c.planned_hrs) > 0 ? '+' : '') + varPct(c.actual_hrs, c.planned_hrs), '(actual − planned) ÷ planned', varPct(c.actual_hrs, c.planned_hrs) > 10 ? 'dn' : 'up', null, '%')}
    ${agile ? kpi('Velocity · backlog ' + info('velocity'), isNil(c.velocity) ? '—' : String(c.velocity), `story points / week · ${fmtH(c.sp_backlog)} SP backlog${c.weeks_of_backlog ? ` ≈ ${c.weeks_of_backlog} weeks` : ''}`, '', null, 'SP')
      : kpi('Health now ' + info('health'), healthNow ? String(healthNow.health) : '—', health4 ? `${healthNow.health - health4.health >= 0 ? '+' : ''}${healthNow.health - health4.health} vs 4 weeks ago` : '', healthNow && health4 && healthNow.health < health4.health ? 'dn' : 'up')}
  </div>`;
  if (period === 'week') {
    const tail = rows.slice(-16);
    body += `<section class="blk"><div class="sh"><h2>Planned vs actual, last ${tail.length} weeks</h2><span class="note">Hover a week for the figures</span></div>${colChart(tail.map(r => fmtShort(r.week_ending)), tail.map(r => r.planned_hrs), tail.map(r => r.actual_hrs))}</section>
    <section class="blk"><div class="sh"><h2>Week by week</h2><span class="note">Latest first · "to date" adds up every week so far</span></div>
      <div class="tblwrap"><table class="tight" style="min-width:1180px"><thead><tr><th>Week ending</th><th class="r">Planned</th><th class="r">Actual</th><th class="r">Variance</th>
        <th class="r">Planned to date</th><th class="r">Actual to date</th><th class="r">Variance to date${info('ev')}</th><th>Top phases (hrs)</th>${agile ? '<th class="r">SP done</th><th class="r">Backlog</th>' : ''}<th class="r">Health</th><th>PM band</th><th>Source</th></tr></thead><tbody>
      ${rows.slice().reverse().map(r => { const t = r.to_date, hw = hByWeek[r.week_ending] || {}, v = varPct(r.actual_hrs, r.planned_hrs), vt = varPct(t.actual_hrs, t.planned_hrs);
        const ph = [['Req', r.req_hrs], ['Design', r.design_hrs], ['Dev', r.dev_hrs], ['Test', r.testing_hrs], ['UAT', r.uat_hrs], ['Review', r.review_hrs], ['PM', r.pm_hrs]].filter(x => x[1]).sort((a, b) => b[1] - a[1]).slice(0, 3);
        return `<tr><td class="nw">${fmtDate(r.week_ending)}</td><td class="r">${fmtH(r.planned_hrs)}</td><td class="r">${fmtH(r.actual_hrs)}</td><td class="r">${evTxt(v)}</td>
          <td class="r muted">${fmtH(t.planned_hrs)}</td><td class="r muted">${fmtH(t.actual_hrs)}</td><td class="r">${evTxt(vt)}</td>
          <td style="font-size:12px">${ph.map(x => `${x[0]} ${fmtH(x[1])}`).join(' · ') || '—'}</td>
          ${agile ? `<td class="r">${fmtH(r.sp_completed)}</td><td class="r">${fmtH(r.sp_backlog)}</td>` : ''}
          <td class="r">${isNil(hw.health) ? '—' : `<b style="color:${HC[bandOf(hw.health)]}">${hw.health}</b>`}</td><td>${hw.pm_rag ? esc(hw.pm_rag) : '—'}</td><td class="muted" style="font-size:12px">${esc(r.source || '—')}</td></tr>`; }).join('')}
      </tbody></table></div></section>`;
  } else {
    const months = {};
    rows.forEach(r => { const m = monthOf(r.week_ending); const o = months[m] || (months[m] = { m, planned: 0, actual: 0, sp: 0, weeks: 0, lastRow: null }); o.planned += Number(r.planned_hrs || 0); o.actual += Number(r.actual_hrs || 0); o.sp += Number(r.sp_completed || 0); o.weeks++; o.lastRow = r; });
    const ml = Object.values(months).sort((a, b) => a.m.localeCompare(b.m));
    body += `<section class="blk"><div class="sh"><h2>Planned vs actual by month</h2></div>${colChart(ml.map(x => monthName(x.m)), ml.map(x => Math.round(x.planned)), ml.map(x => Math.round(x.actual)))}</section>
    <section class="blk"><div class="sh"><h2>Month by month</h2><span class="note">Hours added up over the weeks ending in that month · health and band as at the month's last week</span></div>
      <div class="tblwrap"><table class="tight" style="min-width:980px"><thead><tr><th>Month</th><th class="r">Weeks</th><th class="r">Planned</th><th class="r">Actual</th><th class="r">Variance${info('ev')}</th><th class="r">Actual to date</th><th class="r">Variance to date</th>${agile ? '<th class="r">SP done</th><th class="r">Backlog at month end</th>' : ''}<th class="r">Health at month end</th><th>PM band</th></tr></thead><tbody>
      ${ml.slice().reverse().map(x => { const t = x.lastRow.to_date, hw = hByWeek[x.lastRow.week_ending] || {};
        return `<tr><td>${monthName(x.m)}</td><td class="r">${x.weeks}</td><td class="r">${fmtH(Math.round(x.planned))}</td><td class="r">${fmtH(Math.round(x.actual))}</td><td class="r">${evTxt(varPct(x.actual, x.planned))}</td>
          <td class="r muted">${fmtH(t.actual_hrs)}</td><td class="r">${evTxt(varPct(t.actual_hrs, t.planned_hrs))}</td>${agile ? `<td class="r">${fmtH(x.sp)}</td><td class="r">${fmtH(x.lastRow.sp_backlog)}</td>` : ''}
          <td class="r">${isNil(hw.health) ? '—' : `<b style="color:${HC[bandOf(hw.health)]}">${hw.health}</b>`}</td><td>${esc(hw.pm_rag || '—')}</td></tr>`; }).join('')}
      </tbody></table></div></section>`;
  }
  $('#trendBody').innerHTML = body;
}

export function paintPortfolioTrends(d, period) {
  const weeks = d.weeks.slice(-12);
  const cell = (w) => isNil(w.health) ? '<td class="r muted">—</td>' : `<td class="r" ${tip(`Week ending ${esc(fmtDate(w.week))}<br>Health <b>${w.health}</b><br>Hours ${fmtH(w.actual_hrs)} of ${fmtH(w.planned_hrs)} planned<br>Effort variance to date ${isNil(w.effort_variance_pct) ? '—' : w.effort_variance_pct + '%'}${w.pm_rag ? '<br>PM band ' + esc(w.pm_rag) : ''}`)}><b style="color:${HC[bandOf(w.health)]}">${w.health}</b><span class="subl">${fmtH(w.actual_hrs)} h</span></td>`;
  let body;
  if (period === 'week') {
    body = `<section class="blk"><div class="sh"><h2>Every project, week by week</h2><span class="note">Health (top) and hours booked (below) as saved at the end of each week · hover a cell for detail</span></div>
      <div class="tblwrap"><table class="tight" style="min-width:${220 + weeks.length * 74}px"><thead><tr><th>Project</th>${weeks.map(w => `<th class="r">${fmtShort(w)}</th>`).join('')}</tr></thead><tbody>
      ${d.projects.map(p => `<tr class="clickable" data-open="${p.id}"><td><b>${esc(p.code)}</b><span class="subl">${esc(p.name)}</span></td>${p.weeks.slice(-12).map(cell).join('')}</tr>`).join('')}
      </tbody></table></div></section>`;
  } else {
    const months = Array.from(new Set(d.weeks.map(monthOf))).sort().slice(-6);
    body = `<section class="blk"><div class="sh"><h2>Every project, month by month</h2><span class="note">Hours added up over the month's weeks · health as at the month's last week</span></div>
      <div class="tblwrap"><table class="tight" style="min-width:${220 + months.length * 120}px"><thead><tr><th>Project</th>${months.map(m => `<th class="r">${monthName(m)}</th>`).join('')}</tr></thead><tbody>
      ${d.projects.map(p => `<tr class="clickable" data-open="${p.id}"><td><b>${esc(p.code)}</b><span class="subl">${esc(p.name)}</span></td>${months.map(m => {
        const ws = p.weeks.filter(w => monthOf(w.week) === m && !isNil(w.health)); if (!ws.length) return '<td class="r muted">—</td>';
        const end = ws[ws.length - 1], pl = ws.reduce((a, w) => a + Number(w.planned_hrs || 0), 0), ac = ws.reduce((a, w) => a + Number(w.actual_hrs || 0), 0);
        return `<td class="r" ${tip(`${esc(p.code)} · ${esc(monthName(m))}<br>Hours ${fmtH(Math.round(ac))} of ${fmtH(Math.round(pl))} planned (${varPct(ac, pl)}%)<br>Health at month end <b>${end.health}</b>`)}><b style="color:${HC[bandOf(end.health)]}">${end.health}</b><span class="subl">${fmtH(Math.round(ac))} h · ${evTxt(varPct(ac, pl))}</span></td>`;
      }).join('')}</tr>`).join('')}
      </tbody></table></div></section>`;
  }
  $('#trendBody').innerHTML = body;
  wireOpeners($('#trendBody'));
}
