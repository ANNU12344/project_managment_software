/* PMO dashboards (management / PM). */
import { esc } from '../core/dom.js';
import { chip, fmtDate, isNil, tip } from '../core/format.js';
import { info } from '../core/formulas.js';
import { ic } from '../core/icons.js';
import { hmeter } from '../charts/spark.js';
import { kpi } from './dashboard.js';
import { evTxt, nmTxt } from './pm-home.js';

/* ---------- PMO dashboards (Management Dashboard / Dashboard PM of projectdetails.xlsx) ---------- */
export const avg = a => { const v = a.filter(x => !isNil(x)).map(Number); return v.length ? Math.round(v.reduce((x, y) => x + y, 0) / v.length * 10) / 10 : null; };
export function pva(p) {
  const pl = Number(p.planned_to_date || p.planned_effort_hours || 0), ac = Number(p.actual_effort_hours || 0);
  if (!pl && !ac) return '<span class="muted">—</span>';
  const mx = Math.max(pl, ac) || 1, over = ac > pl;
  return `<div class="pva" ${tip(`<b>${esc(p.code)}</b><br>${p.planned_to_date ? 'Planned to date (weekly entries)' : 'Revised planned'} <b>${pl.toLocaleString('en-IN')} hrs</b><br>Actual <b>${ac.toLocaleString('en-IN')} hrs</b>${isNil(p.baselined_effort_hours) ? '' : `<br>Baselined ${Number(p.baselined_effort_hours).toLocaleString('en-IN')} hrs`}`)}>
    <span class="b pl" style="width:${(pl / mx * 100).toFixed(1)}%"></span><span class="b ac${over ? ' over' : ''}" style="width:${(ac / mx * 100).toFixed(1)}%"></span>
    <span class="t">${ac.toLocaleString('en-IN')} / ${pl.toLocaleString('en-IN')}</span></div>`;
}
export const msStatusChip = st => st ? chip(st === 'Completed' ? 'g' : st === 'On Hold' ? 'r' : st === 'In Progress' ? 'b' : 'n', esc(st)) : '<span class="muted">—</span>';
export function pmoDashboard(ps, mode) {
  const mgmt = mode === 'mgmt';
  const openRisks = ps.reduce((a, p) => a + (p.open_risks || 0), 0), openIad = ps.reduce((a, p) => a + (p.open_deps || 0), 0);
  const ev = avg(ps.map(p => p.effort_variance_pct)), nm = avg(ps.map(p => p.net_margin_pct));
  const rows = ps.slice().sort((a, b) => String(a.code).localeCompare(String(b.code)));
  return `<section class="blk pmo">
    <div class="sh"><span class="n">${ic('grid')}</span><h2>${mgmt ? 'Management dashboard' : 'Dashboard PM'}</h2><span class="note">As in the PMO project workbook · click a row to open the project</span></div>
    <div class="kpis k5" style="margin-bottom:var(--s-5)">
      ${kpi('Total projects', String(ps.length), `${ps.filter(p => p.status === 'In Progress').length} in progress · ${ps.filter(p => p.status === 'Hold').length} on hold`, '')}
      ${kpi('Average effort variance ' + info('ev'), ev === null ? '—' : (ev > 0 ? '+' : '') + ev.toFixed(1), '(actual − revised plan) ÷ revised plan', ev !== null && ev > 9.9 ? 'dn' : ev !== null && ev <= 0 ? 'up' : '', null, '%')}
      ${kpi('Average net margin ' + info('nm'), nm === null ? '—' : nm.toFixed(1), '(value − actual cost) ÷ value', nm !== null && nm < 41.28 ? 'dn' : 'up', null, '%')}
      ${kpi('Open risks ' + info('risks'), String(openRisks), `${ps.filter(p => p.open_risks).length} projects with open risks`, openRisks ? 'dn' : 'up')}
      ${kpi('Open issues & dependencies ' + info('iad'), String(openIad), `${ps.reduce((a, p) => a + (p.open_issues || 0), 0)} issues · ${ps.reduce((a, p) => a + (p.open_dependencies || 0), 0)} dependencies`, openIad ? 'dn' : 'up')}
    </div>
    <div class="sh" style="margin-bottom:var(--s-3)"><h3>Project wise</h3></div>
    <div class="tblwrap"><table class="tight" style="min-width:${mgmt ? 1420 : 1180}px"><thead><tr>
      <th>Project</th><th class="r">Health${info('health')}</th><th class="r">Effort variance${info('ev')}</th><th style="width:170px">Planned vs actual (hrs)${info('pva')}</th><th class="r">Net margin${info('nm')}</th><th class="r">Open defects${info('open_defects')}</th>
      <th class="r">Risks open${info('risks')}</th><th class="r">Issues &amp; deps open${info('iad')}</th><th>Upcoming milestone${info('upcoming')}</th><th class="r">Defect rate${info('defect_rate')}</th>
      ${mgmt ? `<th>Milestones${info('milestones')}</th><th>Current milestone status</th>` : ''}</tr></thead><tbody>
      ${rows.map(p => { const mc = p.milestone_counts || {};
        return `<tr class="clickable" tabindex="0" data-open="${p.id}">
        <td style="min-width:230px"><b class="nw" style="white-space:nowrap">${esc(p.code)}</b><span class="subl">${esc(p.name)}${p.stage ? ' · ' + esc(p.stage) : ''}</span></td>
        <td class="r">${hmeter(p.health, p)}</td><td class="r">${evTxt(p.effort_variance_pct)}</td><td>${pva(p)}</td><td class="r">${nmTxt(p.net_margin_pct)}</td>
        <td class="r">${isNil(p.open_defects) ? '—' : p.open_defects}</td>
        <td class="r${p.open_risks ? ' bad' : ''}">${p.open_risks || '—'}</td><td class="r${p.open_deps ? ' bad' : ''}">${p.open_deps || '—'}</td>
        <td>${p.next_milestone ? `<span class="wrap">${esc(p.next_milestone)}</span><span class="subl${p.slip_days ? ' bad' : ''}">${fmtDate(p.next_milestone_date)}${p.slip_days ? ' · ' + p.slip_days + ' d late' : ''}</span>` : '<span class="muted">—</span>'}</td>
        <td class="r">${isNil(p.defect_rate) ? '—' : Number(p.defect_rate).toFixed(3)}</td>
        ${mgmt ? `<td class="nw" style="font-size:12.5px"><span class="good">● ${mc.completed || 0}</span> Completed<br><span style="color:var(--blue)">● ${mc.in_progress || 0}</span> In progress${mc.on_hold ? ` · <span class="bad">${mc.on_hold} on hold</span>` : ''}<br><span class="muted">● ${mc.yet_to_start || 0}</span> Yet to start</td>
        <td>${msStatusChip(p.current_milestone_status)}${p.current_milestone_signoff ? `<span class="subl">Sign-off ${esc(p.current_milestone_signoff)}</span>` : ''}</td>` : ''}</tr>`; }).join('')}
    </tbody></table></div></section>`;
}
