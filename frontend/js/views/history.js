/* History & compare screen: pick a project, see how it stood each week, open one week, or put
   two weeks side by side.  API: api/project.api.js (getWeeks, getWeek, compareWeeks) */
import { $, $$, esc } from '../core/dom.js';
import { HC, HN, ROLE_LABEL } from '../core/constants.js';
import { bandOf, fmtDate, fmtTime, inr, isNil, pct, plural } from '../core/format.js';
import { info } from '../core/formulas.js';
import { dots, ic } from '../core/icons.js';
import { getPortfolio } from '../api/portfolio.api.js';
import { getWeeks, getWeek, compareWeeks } from '../api/project.api.js';
import { bars } from '../charts/bars.js';
import { State } from '../core/state.js';
import { setMain, setTools } from './shell.js';
import { kpi } from './dashboard.js';
import { fmtH, scopeSelect } from './weekly-monthly.js';

/* ================================================================ history & compare */
export async function viewHistory(opts) {
  opts = opts || {};
  State.portfolio = (await getPortfolio()).projects;
  const ps = State.portfolio;
  if (!ps.length) { setMain('<div class="empty">No projects in view.</div>'); return; }
  const pid = opts.projectId || State.histPid || ps[0].id; State.histPid = pid;
  const hist = await getWeeks(pid);
  const weeks = hist.weeks.map(w => w.week);
  const mode = State.histMode || 'view';
  const a = opts.a || weeks[Math.max(0, weeks.length - 5)], b = opts.b || weeks[weeks.length - 1], one = opts.week || weeks[weeks.length - 1];
  const wkSel = (id, cur) => `<select id="${id}" style="width:auto">${weeks.slice().reverse().map(w => `<option value="${w}"${w === cur ? ' selected' : ''}>w/e ${fmtDate(w)}</option>`).join('')}</select>`;
  setMain(`
    <div class="pagehead"><span class="eyebrow">${ROLE_LABEL[State.user.role]}</span><h1>History &amp; compare</h1>
      <p class="lede">The project exactly as it stood at the end of any week — and what changed between two weeks. A week's picture is saved whenever anything is reported and every Monday.</p></div>
    <div class="toolbar">${scopeSelect(ps, pid, false)}
      <div class="seg" role="group"><button type="button" data-hmode="view" class="${mode === 'view' ? 'on' : ''}">View a week</button><button type="button" data-hmode="compare" class="${mode === 'compare' ? 'on' : ''}">Compare two weeks</button></div>
      <span class="spacer"></span>${mode === 'view' ? wkSel('wkOne', one) : `${wkSel('wkA', a)} <span class="muted">vs</span> ${wkSel('wkB', b)}`}</div>
    <div id="histBody"><p class="muted">${dots()} Loading…</p></div>`);
  setTools('');
  $('#scopeSel').addEventListener('change', e => viewHistory({ projectId: e.target.value }));
  $$('[data-hmode]').forEach(x => x.addEventListener('click', () => { State.histMode = x.dataset.hmode; viewHistory({ projectId: pid }); }));
  if (!weeks.length) { $('#histBody').innerHTML = '<div class="empty">No week has been saved for this project yet. A week is saved as soon as anything is reported.</div>'; return; }
  if (mode === 'view') {
    $('#wkOne').addEventListener('change', e => viewHistory({ projectId: pid, week: e.target.value }));
    paintWeek(await getWeek(pid, one), hist.weeks);
  } else {
    $('#wkA').addEventListener('change', e => viewHistory({ projectId: pid, a: e.target.value, b: $('#wkB').value }));
    $('#wkB').addEventListener('change', e => viewHistory({ projectId: pid, a: $('#wkA').value, b: e.target.value }));
    paintCompare(await compareWeeks(pid, a, b));
  }
}

export function paintWeek(d) {
  const k = d.kpis, e = d.effort || {}, w = e.week || {}, t = e.to_date || {}, wr = d.weekly_report || {};
  const out = (d.metrics || []).filter(m => m.status === 'above' || m.status === 'below');
  $('#histBody').innerHTML = `
    <div class="banner">${ic('info')}<div><strong>${esc(d.project.code)} as at week ending ${fmtDate(d.week)}.</strong> ${d.stored ? `Saved ${fmtDate(d.saved_at)} ${fmtTime(d.saved_at)}.` : 'No picture was saved that week, so this is rebuilt from the weekly entries up to that week.'}</div></div>
    <div class="kpis k5">
      ${kpi('Health ' + info('health'), String(k.health), HN[k.state] || '', k.state === 'r' ? 'dn' : k.state === 'g' ? 'up' : '')}
      ${kpi('Effort variance ' + info('ev'), isNil(k.effort_variance_pct) ? '—' : (k.effort_variance_pct > 0 ? '+' : '') + k.effort_variance_pct, 'to date', k.effort_variance_pct > 10 ? 'dn' : '', null, '%')}
      ${kpi('Net margin ' + info('nm'), isNil(k.net_margin_pct) ? '—' : String(k.net_margin_pct), 'to date', k.net_margin_pct < 0 ? 'dn' : '', null, '%')}
      ${kpi('Hours that week', fmtH(w.actual_hrs), `of ${fmtH(w.planned_hrs)} planned · ${fmtH(t.actual_hrs)} to date`, '', null, 'hrs')}
      ${kpi('Open items', String((k.open_risks || 0) + (k.open_iad || 0)), `${k.open_risks} risks · ${k.open_iad} issues/deps · ${k.open_ncs} NCs`, (k.open_ncs || 0) ? 'dn' : '')}
    </div>
    <div class="grid2">
      <div><h3>Weekly report that week</h3><div class="cap">${wr.week_ending ? 'w/e ' + fmtDate(wr.week_ending) : 'No weekly report'}</div>
        <dl class="dl" style="grid-template-columns:1fr">
          <div class="r"><dt>PM band</dt><dd>${esc(wr.pm_rag || '—')}${wr.pm_rag_reason ? ' · ' + esc(wr.pm_rag_reason) : ''}</dd></div>
          <div class="r"><dt>% complete</dt><dd>${pct(d.project.pct_completed)}</dd></div>
          <div class="r"><dt>Milestones done</dt><dd>${k.milestones_done} of ${k.milestones_total}</dd></div>
          <div class="r"><dt>Next milestone</dt><dd>${esc(k.next_milestone || '—')} ${k.next_milestone_date ? '· ' + fmtDate(k.next_milestone_date) : ''}</dd></div>
          <div class="r"><dt>Billed / to bill</dt><dd>${inr(k.billed_cr)} / ${inr(k.to_bill_cr)}</dd></div>
          <div class="r"><dt>PCI</dt><dd>${isNil(k.pci) ? '—' : k.pci + '%'}</dd></div>
        </dl>
        ${wr.narrative ? `<p style="margin-top:var(--s-3);font-size:14px"><b>What moved:</b> ${esc(wr.narrative)}</p>` : ''}</div>
      <div><h3>Health components that week</h3><div class="cap">Out of 100 each</div>
        ${bars(Object.keys(k.parts || {}).map(x => [x.replace(/_/g, ' ').replace(/^\w/, ch => ch.toUpperCase()), k.parts[x], HC[bandOf(k.parts[x])]]), 100)}
        ${out.length ? `<div class="takeaway"><strong>${plural(out.length, 'process metric')} outside the baseline:</strong> ${out.map(m => esc(m.key.replace(/_/g, ' '))).join(', ')}</div>` : ''}</div>
    </div>
    <section class="blk"><div class="sh"><h2>Milestones that week</h2></div>
      <div class="tblwrap"><table class="tight"><thead><tr><th>Milestone</th><th class="r">Plan end</th><th class="r">Forecast end</th><th class="r">Actual end</th><th>Status</th></tr></thead><tbody>
      ${(d.milestones || []).map(m => `<tr><td>${esc(m.name)}</td><td class="r">${fmtDate(m.baseline_date)}</td><td class="r">${fmtDate(m.forecast_date)}</td><td class="r">${fmtDate(m.actual_date)}</td><td>${esc(m.status || '—')}</td></tr>`).join('')}
      </tbody></table></div></section>
    <section class="blk"><div class="sh"><h2>Open RAID items that week</h2></div>
      ${(d.raid_open || []).length ? `<div class="tblwrap"><table class="tight"><thead><tr><th>ID</th><th>Type</th><th>Description</th><th>Owner</th><th>Status</th></tr></thead><tbody>
      ${d.raid_open.map(r => `<tr><td>${esc(r.ref)}</td><td>${esc(r.raid_type)}</td><td><span class="wrap">${esc(r.description)}</span></td><td>${esc(r.owner || '—')}</td><td>${esc(r.status)}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">Nothing open.</div>'}</section>`;
}

export function paintCompare(r) {
  const A = r.a, B = r.b, ka = A.kpis, kb = B.kpis;
  const num = v => isNil(v) ? null : Number(v);
  const delta = (x, y, good) => { if (num(x) === null || num(y) === null) return ''; const dd = Math.round((num(y) - num(x)) * 10) / 10; if (!dd) return '<span class="muted">no change</span>';
    const better = good === 'up' ? dd > 0 : good === 'down' ? dd < 0 : null; return `<b class="${better === null ? '' : better ? 'good' : 'bad'}">${dd > 0 ? '+' : ''}${dd}</b>`; };
  const row = (label, x, y, good, fmt, fx) => { const f = fmt || (v => isNil(v) ? '—' : v); const changed = String(x) !== String(y);
    return `<tr class="${changed ? 'chg' : ''}"><td>${label}${fx ? info(fx) : ''}</td><td class="r">${f(x)}</td><td class="r">${f(y)}</td><td class="r">${typeof good === 'string' ? delta(x, y, good) : changed ? '<b>changed</b>' : '<span class="muted">no change</span>'}</td></tr>`; };
  const ea = A.effort || {}, eb = B.effort || {};
  const msA = {}; (A.milestones || []).forEach(m => msA[m.name] = m);
  const msChanges = (B.milestones || []).map(m => { const o = msA[m.name]; if (!o) return { m, what: 'added' };
    const ch = []; if (o.forecast_date !== m.forecast_date) ch.push(`forecast ${fmtDate(o.forecast_date)} → ${fmtDate(m.forecast_date)}`); if (o.status !== m.status) ch.push(`status ${o.status || '—'} → ${m.status || '—'}`); if (o.actual_date !== m.actual_date) ch.push(`actual end ${fmtDate(o.actual_date)} → ${fmtDate(m.actual_date)}`);
    return ch.length ? { m, what: ch.join(' · ') } : null; }).filter(Boolean);
  const ra = new Set((A.raid_open || []).map(x => x.ref)), rb = new Set((B.raid_open || []).map(x => x.ref));
  const opened = (B.raid_open || []).filter(x => !ra.has(x.ref)), closed = (A.raid_open || []).filter(x => !rb.has(x.ref));
  $('#histBody').innerHTML = `
    <section class="blk"><div class="sh"><h2>w/e ${fmtDate(A.week)} → w/e ${fmtDate(B.week)}</h2><span class="note">Changed rows are highlighted · green = better, red = worse</span></div>
      <div class="tblwrap"><table class="tight cmp"><thead><tr><th>Measure</th><th class="r">${fmtDate(A.week)}</th><th class="r">${fmtDate(B.week)}</th><th class="r">Change</th></tr></thead><tbody>
        ${row('Health', ka.health, kb.health, 'up', null, 'health')}
        ${row('Band', HN[ka.state], HN[kb.state])}
        ${row('Effort variance to date %', ka.effort_variance_pct, kb.effort_variance_pct, 'down', null, 'ev')}
        ${row('Net margin to date %', ka.net_margin_pct, kb.net_margin_pct, 'up', null, 'nm')}
        ${row('Hours that week', ea.week && ea.week.actual_hrs, eb.week && eb.week.actual_hrs, 'none', fmtH)}
        ${row('Actual hours to date', ea.to_date && ea.to_date.actual_hrs, eb.to_date && eb.to_date.actual_hrs, 'none', fmtH, 'cum')}
        ${row('Planned hours to date', ea.to_date && ea.to_date.planned_hrs, eb.to_date && eb.to_date.planned_hrs, 'none', fmtH)}
        ${row('% complete', A.project.pct_completed, B.project.pct_completed, 'up')}
        ${row('Milestones done', ka.milestones_done, kb.milestones_done, 'up')}
        ${row('Next milestone', ka.next_milestone, kb.next_milestone)}
        ${row('Open risks', ka.open_risks, kb.open_risks, 'down', null, 'risks')}
        ${row('Open issues & dependencies', ka.open_iad, kb.open_iad, 'down', null, 'iad')}
        ${row('Open NCs', ka.open_ncs, kb.open_ncs, 'down', null, 'ncs')}
        ${row('PCI %', ka.pci, kb.pci, 'up', null, 'pci')}
        ${row('Billed (₹ Cr)', ka.billed_cr, kb.billed_cr, 'up', v => isNil(v) ? '—' : Number(v).toFixed(2))}
        ${row('Story points done that week', ea.week && ea.week.sp_completed, eb.week && eb.week.sp_completed, 'up')}
        ${row('Backlog (SP)', ea.to_date && ea.to_date.sp_backlog, eb.to_date && eb.to_date.sp_backlog, 'down', null, 'backlog')}
        ${row('PM band', (A.weekly_report || {}).pm_rag, (B.weekly_report || {}).pm_rag)}
        ${Object.keys(kb.parts || {}).map(x => row('· ' + x.replace(/_/g, ' '), (ka.parts || {})[x], kb.parts[x], 'up')).join('')}
      </tbody></table></div></section>
    <div class="grid2">
      <div><h3>Milestones that moved</h3><div class="cap">Forecast, status or actual end changed between the two weeks</div>
        ${msChanges.length ? msChanges.map(x => `<div class="item"><div><b>${esc(x.m.name)}</b><div class="s">${esc(x.what)}</div></div></div>`).join('') : '<p class="muted">No milestone changed.</p>'}</div>
      <div><h3>RAID: opened and closed</h3><div class="cap">Items open in one week but not the other</div>
        ${opened.map(x => `<div class="item"><div><b>${esc(x.ref)} · ${esc(x.description)}</b><div class="s">${esc(x.raid_type)} · opened since</div></div><div class="ag bad">new</div></div>`).join('')}
        ${closed.map(x => `<div class="item"><div><b>${esc(x.ref)} · ${esc(x.description)}</b><div class="s">${esc(x.raid_type)} · closed since</div></div><div class="ag good">closed</div></div>`).join('')}
        ${!opened.length && !closed.length ? '<p class="muted">No RAID item opened or closed.</p>' : ''}</div>
    </div>
    ${(A.weekly_report || {}).narrative || (B.weekly_report || {}).narrative ? `<section class="blk"><div class="sh"><h2>What the PM wrote</h2></div><div class="grid2" style="border:0">
      <div><h3>w/e ${fmtDate(A.week)}</h3><p>${esc((A.weekly_report || {}).narrative || '—')}</p></div><div><h3>w/e ${fmtDate(B.week)}</h3><p>${esc((B.weekly_report || {}).narrative || '—')}</p></div></div></section>` : ''}`;
}
