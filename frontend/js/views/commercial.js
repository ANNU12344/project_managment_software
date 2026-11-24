/* Commercial position screen (not shown to PMs): value, budget, cost, margin and billing across
   the portfolio.  API: api/portfolio.api.js */
import { $, esc } from '../core/dom.js';
import { ROLE_LABEL } from '../core/constants.js';
import { inr, isNil, plural, tip } from '../core/format.js';
import { info } from '../core/formulas.js';
import { ic } from '../core/icons.js';
import { getPortfolio } from '../api/portfolio.api.js';
import { State } from '../core/state.js';
import { setMain, setTools } from './shell.js';
import { wireOpeners } from './ai-brief.js';
import { downloadTools, kpi, wireDownloads } from './dashboard.js';
import { nmTxt } from './pm-home.js';

/* ================================================================ commercial */
export async function viewCommercial() {
  State.portfolio = (await getPortfolio()).projects;
  const ps = State.portfolio.slice().sort((a, b) => (isNil(a.net_margin_pct) ? 999 : a.net_margin_pct) - (isNil(b.net_margin_pct) ? 999 : b.net_margin_pct));
  const sum = k => ps.reduce((a, p) => a + Number(p[k] || 0), 0);
  const val = sum('contract_value'), cost = sum('actual_cost_cr'), budget = sum('budget_cr');
  const nm = val ? Math.round((val - cost) / val * 1000) / 10 : null;
  const loss = ps.filter(p => !isNil(p.net_margin_pct) && p.net_margin_pct < 0);
  const overBudget = ps.filter(p => p.budget_cr && p.actual_cost_cr > p.budget_cr);
  const mx = Math.max(1, ...ps.map(p => Math.max(Number(p.contract_value || 0), Number(p.budget_cr || 0), Number(p.actual_cost_cr || 0))));
  const bar = p => { const v = Number(p.contract_value || 0), c = Number(p.actual_cost_cr || 0), b = Number(p.budget_cr || 0);
    return `<div class="cbar" ${tip(`<b>${esc(p.code)}</b><br>Project value ₹${v} Cr<br>Budget ₹${b} Cr<br>Spent so far ₹${c} Cr`)}>
      <span class="v" style="width:${(v / mx * 100).toFixed(1)}%"></span><span class="c${c > v ? ' loss' : c > b && b ? ' over' : ''}" style="width:${(Math.min(c, mx) / mx * 100).toFixed(1)}%"></span>
      ${b ? `<span class="b" style="left:${(b / mx * 100).toFixed(1)}%"></span>` : ''}</div>`; };
  setMain(`
    <div class="pagehead"><span class="eyebrow">${ROLE_LABEL[State.user.role]}</span><h1>Commercial position</h1>
      <p class="lede">For every project: what the order is worth, what was budgeted, what has been spent so far, and how much margin is left. All money in ₹ crore.</p></div>
    <div class="banner">${ic('info')}<div><strong>How to read net margin.</strong> Net margin (to date) = (Project value − Actual cost so far) ÷ Project value × 100. A project worth ₹10 Cr that has spent ₹6 Cr shows 40% — ₹4 Cr of value is still uncovered by cost. It falls as the project spends, and ends at the final margin. If cost goes above the project value it turns negative and is shown as a <b>loss</b>.</div></div>
    <div class="kpis">
      ${kpi('Value of projects in view', val.toFixed(1), `${plural(ps.length, 'project')}`, '', null, 'Cr')}
      ${kpi('Spent so far', cost.toFixed(1), `${budget ? Math.round(cost / budget * 100) + '% of ₹' + budget.toFixed(1) + ' Cr budget' : 'no budgets recorded'}`, budget && cost > budget ? 'dn' : '', null, 'Cr')}
      ${kpi('Net margin to date ' + info('nm'), isNil(nm) ? '—' : String(nm), `₹${(val - cost).toFixed(1)} Cr of value not yet spent`, nm < 0 ? 'dn' : 'up', null, '%')}
      ${kpi('Needs attention', String(loss.length + overBudget.length), `${plural(loss.length, 'project')} in loss · ${overBudget.length} over budget`, loss.length + overBudget.length ? 'dn' : 'up')}
    </div>
    <section class="blk"><div class="sh"><h2>Value, budget and cost by project</h2><span class="note">Grey = project value · blue = spent so far (orange over budget, red above value = loss) · black tick = budget</span></div>
      ${ps.map(p => `<div class="crow clickable" data-open="${p.id}"><span class="code">${esc(p.code)}</span>${bar(p)}<span class="cnm">${nmTxt(p.net_margin_pct)}</span></div>`).join('')}</section>
    <section class="blk"><div class="sh"><h2>The numbers</h2><span class="note">Lowest margin first · click a row to open the project</span></div>
      <div class="tblwrap"><table class="tight" style="min-width:1240px"><thead><tr><th style="min-width:220px">Project</th><th class="r">Project value</th><th class="r">Budget</th><th class="r">Spent so far</th>
        <th class="r">Budget used${info('budget_used')}</th><th class="r">Net margin to date${info('nm')}</th><th class="r">Margin at bid${info('margin_bid')}</th><th class="r">Forecast margin${info('forecast_margin')}</th><th class="r">Billed / to bill${info('billed')}</th><th>In plain words</th></tr></thead><tbody>
      ${ps.map(p => { const v = Number(p.contract_value || 0), c = p.actual_cost_cr, b = p.budget_cr, used = b && !isNil(c) ? Math.round(c / b * 100) : null;
        const words = isNil(c) ? 'No actual cost recorded yet.' : c > v ? `<b class="bad">Loss of ₹${(c - v).toFixed(2)} Cr</b> — cost so far is above the project value.`
          : `Spent ₹${Number(c).toFixed(1)} Cr of a ₹${v} Cr project; ₹${(v - c).toFixed(1)} Cr of value left${used !== null ? `, ${used}% of budget used${used > 100 ? ' — <b class="bad">over budget</b>' : ''}` : ''}.`;
        return `<tr class="clickable" data-open="${p.id}"><td><b>${esc(p.code)}</b><span class="subl">${esc(p.name)}</span></td><td class="r">${inr(v)}</td><td class="r">${inr(b)}</td><td class="r">${inr(c)}</td>
          <td class="r${used > 100 ? ' bad' : ''}">${isNil(used) ? '—' : used + '%'}</td><td class="r">${isNil(p.net_margin_pct) ? '—' : p.net_margin_pct < 0 ? `<b class="bad">${p.net_margin_pct}% (loss)</b>` : nmTxt(p.net_margin_pct)}</td>
          <td class="r">${isNil(p.margin_at_bid) ? '—' : p.margin_at_bid + '%'}</td><td class="r">${isNil(p.margin_at_completion) ? '—' : p.margin_at_completion + '%'}</td>
          <td class="r">${inr(p.billed_cr)} / ${inr(p.billing_open_cr)}</td><td style="min-width:260px;font-size:13px">${words}</td></tr>`; }).join('')}
      </tbody></table></div></section>`);
  setTools(downloadTools());
  wireDownloads(); wireOpeners($('#main'));
}
