/* Project drawer (opens over any screen when a project is clicked): health breakdown, metrics,
   milestones, RAID, history, dates (DH / admin can edit), AI diagnosis, and one-click raising of
   the recommended action items.  API: api/project.api.js, api/ai.api.js, api/action.api.js */
import { $, $$, esc } from '../core/dom.js';
import { ACTION_RAISERS, ROLE_LABEL } from '../core/constants.js';
import { chip, daysBetween, fmtDate, fmtShort, inr, isNil, n2, pct, plural, todayISO } from '../core/format.js';
import { info } from '../core/formulas.js';
import { dots, ic } from '../core/icons.js';
import { toast } from '../components/toast.js';
import { getProject, updateProjectDates } from '../api/project.api.js';
import { analyseProject } from '../api/ai.api.js';
import { createAction } from '../api/action.api.js';
import { project4 } from '../charts/spark.js';
import { riskMatrix, trendChartProject } from '../charts/portfolio.js';
import { State } from '../core/state.js';
import { go } from './shell.js';
import { srcLine } from './ai-brief.js';
import { downloadTools, wireDownloads } from './dashboard.js';
import { evTxt, hrs, nmTxt } from './pm-home.js';
import { metricsTable, mxSummaryTxt } from './process-metrics.js';
import { msStatusChip } from './pmo-dashboard.js';
import { healthBreakdown, prioChip } from './health-breakdown.js';
import { closeAsk, closeDrawer } from '../components/overlays.js';
import { openLetter } from './escalation-letter.js';
import { colChart, fmtH, varPct } from './weekly-monthly.js';
import { NC_CHIP } from './audit.js';

export async function openProject(id) {
  closeAsk();
  const d = $('#drawer');
  d.innerHTML = `<div class="dhead"><span class="eyebrow">Loading</span><h2>${dots()}</h2></div>`;
  d.className = 'drawer on'; $('#scrim').className = 'on';
  let r;
  try { r = await getProject(id); }
  catch (e) { d.innerHTML = `<div class="dbody"><div class="banner err">${ic('alert')}<div>Could not open this project.</div></div></div>`; return; }
  State.project = r;
  const p = r.project, h = r.health;
  const row = State.portfolio.find(x => x.id === p.id) || {};
  const openDeps = r.dependencies.filter(x => x.status !== 'Closed');
  const openRisks = r.risks.filter(x => x.status !== 'Closed');
  const openMs = r.milestones.filter(m => !m.actual_date && m.status !== 'Completed').sort((a, b) => String(a.forecast_date || '9999').localeCompare(String(b.forecast_date || '9999')));
  const doneMs = r.milestones.filter(m => m.actual_date);
  const canAct = ACTION_RAISERS.indexOf(State.user.role) >= 0;
  /* Start / end dates: the project's Delivery Head or the PMO administrator (the server checks the same). */
  const canDates = State.user.role === 'admin' || (State.user.role === 'dh' && p.dh_user_id === State.user.id);
  const dl = (k, v) => `<div class="r"><dt>${k}</dt><dd>${v}</dd></div>`;
  const pmName = (r.users.find(u => u.id === p.pm_user_id) || {}).name || '—';
  const dhName = (r.users.find(u => u.id === p.dh_user_id) || {}).name || '—';

  d.innerHTML = `
    <div class="dhead">
      <button class="close" type="button" id="drClose" aria-label="Close">${ic('x')}</button>
      <span class="eyebrow">${esc(p.code)} · ${esc(p.bu)} · ${esc(p.project_type)}</span>
      <h2 id="dr-title">${esc(p.name)}</h2>
      <p>${esc(p.client)}</p>
      <div class="hfig">
        <div><span class="lb">Health</span><span class="stat">${h ? h.index : '—'}</span></div>
        <div><span class="lb">State</span>${chip(h ? h.state : null)}${row.pm_rag ? `<div class="v" style="margin-top:6px;font-size:12.5px;color:var(--ink-3)">PM says ${esc(row.pm_rag)}</div>` : ''}</div>
        <div><span class="lb">SPI / CPI</span><span class="v">${n2(row.spi)} / ${n2(row.cpi)}</span></div>
        <div><span class="lb">Complete</span><span class="v">${pct(row.pct_complete)}</span></div>
        <div><span class="lb">+4 weeks</span><span class="v">${project4(row.trend) === null ? '—' : project4(row.trend)}</span></div>
      </div>
    </div>
    <div class="dtools">
      ${downloadTools(p.id)}
      ${openDeps.length ? `<button class="btn sec sm" type="button" id="drLetter">${ic('mail')} Draft client letter</button>` : ''}
      ${canAct ? `<button class="btn sm" type="button" id="drAction">${ic('plus')} Raise action</button>` : ''}
      ${r.can_edit ? `<button class="btn sm" type="button" id="drStatus">${ic('edit')} Report this week</button>` : ''}
    </div>
    <div class="dbody">
      <div class="dsec" style="margin-top:0"><h4><span class="n">01</span> DCC Intelligence</h4><div class="intel" id="intel"></div></div>
      ${h ? `<div class="dsec"><h4><span class="n">02</span> What makes up the score · ${h.index}/100</h4>
        <p style="font-size:13px;margin-bottom:var(--s-3)">Six components, each scored 0–100 against the organisation baseline, then weighted. Open a component to see every signal behind it.</p>
        ${healthBreakdown(h)}</div>` : ''}
      <div class="dsec"><h4><span class="n">03</span> Health across ${plural(r.snapshots.length, 'weekly snapshot')}</h4>${trendChartProject(r.snapshots)}</div>
      ${r.metrics ? `<div class="dsec"><h4><span class="n">★</span> Process metrics vs baseline</h4>
        <p style="font-size:13.5px;margin-bottom:var(--s-3)">${mxSummaryTxt((row.process_summary) || r.metrics.reduce((a, m) => { a[m.status]++; a.out = a.below + a.above; return a; }, { within: 0, below: 0, above: 0, tracked: 0, nodata: 0, out: 0 }))} · hover a metric name for its formula</p>
        ${metricsTable(r.metrics)}</div>` : ''}
      <div class="dsec"><h4><span class="n">04</span> Key facts</h4><dl class="dl">
        ${dl('Stage / status', `${esc(p.stage || '—')} · ${esc(p.status)}`)}
        ${dl('Start → end', `<span id="drDates">${fmtDate(p.start_date)} → ${fmtDate(p.end_date)}</span>${canDates ? ` <button class="lnk" type="button" id="drDatesEdit">${ic('edit')} Edit</button>
          <form id="drDatesForm" class="hide" style="display:flex;gap:var(--s-2);flex-wrap:wrap;align-items:center;margin-top:var(--s-2)">
            <input id="drStart" type="date" value="${esc((p.start_date || '').slice(0, 10))}" aria-label="Project start date" style="width:auto;min-height:34px">
            <span class="muted">→</span>
            <input id="drEnd" type="date" value="${esc((p.end_date || '').slice(0, 10))}" aria-label="Project end date" style="width:auto;min-height:34px">
            <button class="btn sm" type="submit">Save</button><button class="btn sec sm" type="button" id="drDatesCancel">Cancel</button></form>` : ''}`)}
        ${dl('Project value', inr(p.contract_value))}
        ${dl('Project budget', inr(p.budget_cr))}
        ${dl('Expenses budget', inr(p.expenses_budget_cr))}
        ${dl('Actual cost to date', inr(p.actual_cost_cr))}
        ${dl('Net margin', nmTxt(p.net_margin_pct))}
        ${dl('Type / category', `${esc(p.project_type || '—')} · ${esc(p.project_category || '—')}`)}
        ${dl('Methodology', esc(p.delivery_methodology || '—'))}
        ${dl('Technology / platform', esc(p.technology || '—'))}
        ${dl('Completed', pct(isNil(p.pct_completed) ? row.pct_completed : p.pct_completed))}
        ${dl('Timesheet compliance', pct(p.timesheet_pct))}
        ${dl('Baselined efforts', hrs(p.baselined_effort_hours))}
        ${dl('Presales efforts', hrs(p.presales_hours))}
        ${dl('Budgeted hours', hrs(p.budgeted_hours))}
        ${dl('Revised planned efforts', hrs(p.planned_effort_hours))}
        ${dl('Actual efforts', hrs(p.actual_effort_hours))}
        ${dl('Effort variance', evTxt(p.effort_variance_pct))}
        ${p.margin_at_bid !== undefined ? dl('Margin bid / now', `${p.margin_at_bid}% / ${pct(row.margin_at_completion)}`) : ''}
        ${dl('Commercial basis', esc(p.commercial_basis))}
        ${dl('Project manager', esc(pmName))}
        ${dl('Delivery Head', esc(dhName))}
        ${dl('Budget consumed', pct(row.budget_consumed_pct))}
        ${dl('Open risks', String(openRisks.length))}
        ${dl('Open with client', String(openDeps.length))}
        ${dl('Last report', row.week_ending ? 'w/e ' + fmtDate(row.week_ending) : '—')}
        ${dl('Milestones done', `${doneMs.length} of ${r.milestones.length}`)}
      </dl></div>
      ${r.cumulative && r.cumulative.weeks ? (() => { const c = r.cumulative, wl = r.weekly.slice(-8), last = wl[wl.length - 1] || {}, ev = varPct(c.actual_hrs, c.planned_hrs);
        return `<div class="dsec"><h4><span class="n">E</span> Weekly effort · ${plural(c.weeks, 'week')} recorded${info('cum')}</h4>
        <dl class="dl"><div><dt>Last week (w/e ${fmtShort(last.week_ending)})</dt><dd>${fmtH(last.actual_hrs)} of ${fmtH(last.planned_hrs)} hrs</dd></div>
          <div><dt>To date</dt><dd>${fmtH(c.actual_hrs)} of ${fmtH(c.planned_hrs)} hrs · ${evTxt(ev)}</dd></div>
          ${isNil(c.velocity) ? '' : `<div><dt>Velocity · backlog</dt><dd>${c.velocity} SP/week · ${fmtH(c.sp_backlog)} SP${c.weeks_of_backlog ? ' ≈ ' + c.weeks_of_backlog + ' weeks' : ''}</dd></div>`}</dl>
        ${colChart(wl.map(w => fmtShort(w.week_ending)), wl.map(w => w.planned_hrs), wl.map(w => w.actual_hrs))}</div>`; })() : ''}
      ${r.ncs && r.ncs.length ? `<div class="dsec"><h4><span class="n">A</span> Audit — non-conformances · ${r.ncs.filter(n => n.status !== 'Closed').length} open${info('ncs')}</h4>
        ${r.ncs.slice().sort((a, b) => (a.status === 'Closed') - (b.status === 'Closed')).map(n => `<div class="item"><div><b>${esc(n.ref)} · ${esc(n.title)}</b><div class="s">${esc(n.severity)} · raised ${fmtDate(n.raised_date)} · due ${fmtDate(n.due_date)}${n.action_taken ? ' · action: ' + esc(n.action_taken) : ''}</div></div><div class="ag">${chip(NC_CHIP[n.status] || 'n', esc(n.status))}</div></div>`).join('')}</div>` : ''}
      ${r.milestones.length ? `<div class="dsec"><h4><span class="n">05</span> Milestones · ${r.milestones.filter(m => m.status === 'Completed' || m.actual_date).length} of ${r.milestones.length} completed</h4>
        <div class="tblwrap"><table class="tight" style="min-width:820px"><thead><tr><th>Milestone</th><th class="r">Plan end</th><th class="r">Forecast end</th><th class="r">Actual end</th><th class="r">% done</th><th>Status</th><th>Sign-off</th><th>Invoice</th></tr></thead><tbody>
        ${r.milestones.map(m => { const slip = m.actual_date ? Math.max(0, daysBetween(m.baseline_date, m.actual_date)) : Math.max(0, daysBetween(m.baseline_date, m.forecast_date));
          return `<tr><td><span class="wrap">${esc(m.name)}</span>${m.remarks ? `<span class="subl">${esc(m.remarks)}</span>` : ''}</td><td class="r">${fmtDate(m.baseline_date)}</td>
            <td class="r${slip && !m.actual_date ? ' bad' : ''}">${fmtDate(m.forecast_date)}${slip && !m.actual_date ? `<span class="subl bad">${slip} d late</span>` : ''}</td><td class="r">${fmtDate(m.actual_date)}</td>
            <td class="r">${isNil(m.pct_complete) ? '—' : m.pct_complete + '%'}</td><td>${msStatusChip(m.status)}</td><td>${esc(m.signoff_status || '—')}</td><td>${m.is_billing ? 'Yes' : 'No'}</td></tr>`; }).join('')}
        </tbody></table></div></div>` : ''}
      ${r.billing && r.billing.length ? `<div class="dsec"><h4><span class="n">₹</span> Billing · ${inr(r.billing.filter(b => b.status === 'Completed').reduce((a, b) => a + Number(b.amount_cr || 0), 0))} billed · ${inr(r.billing.filter(b => b.status !== 'Completed').reduce((a, b) => a + Number(b.amount_cr || 0), 0))} to bill</h4>
        ${r.billing.map(b => `<div class="item"><div><b>${esc(b.milestone_name)}</b><div class="s">${fmtDate(b.billing_date)}${b.remarks ? ' · ' + esc(b.remarks) : ''}</div></div><div class="ag">${inr(b.amount_cr)}<br>${chip(b.status === 'Completed' ? 'g' : b.status === 'On-Hold' ? 'r' : 'b', esc(b.status))}</div></div>`).join('')}</div>` : ''}
      <div class="dsec"><h4><span class="n">06</span> RAID — issues &amp; dependencies${openDeps.length ? ' · ' + openDeps.length + ' open' : ''}</h4>
      ${openDeps.length ? openDeps.map(x => { const age = Math.max(0, daysBetween(x.raised_date, todayISO()));
        return `<div class="item"><div><b>${chip(x.iad_type === 'Issue' ? 'r' : 'b', esc(x.iad_type || 'Dependency'))} ${esc(x.description)}</b><div class="s">${esc(x.owner_at_client || 'No named owner')}${x.milestone_blocked ? ' · impacts ' + esc(x.milestone_blocked) : ''}${x.value_blocked ? ' · ' + inr(x.value_blocked) : ''} · ${esc(x.status)}${x.last_followup_date ? ` · last follow-up ${fmtDate(x.last_followup_date)}${x.followup_mode ? ' by ' + esc(x.followup_mode).toLowerCase() : ''}` : ' · no follow-up recorded'}</div></div>
        <div class="ag ${age > 30 ? 'bad' : age > 14 ? 'warn' : ''}">${age} d</div></div>`; }).join('')
      : `<p class="muted" style="font-size:13.5px">No open issues or dependencies.</p>`}</div>
      ${(r.defects && r.defects.length) || (r.pci && r.pci.length) ? `<div class="dsec"><h4><span class="n">Q</span> Quality — defects and process compliance</h4>
        ${r.defects && r.defects.length ? `<div class="tblwrap" style="margin-bottom:var(--s-4)"><table class="tight" style="min-width:560px"><thead><tr><th>Defect type</th><th>Phase injected</th><th class="r">Total</th><th class="r">Reopened</th><th>Milestone</th></tr></thead><tbody>
          ${r.defects.map(x => `<tr><td>${esc(x.defect_type)}</td><td>${esc(x.phase_injected || '—')}</td><td class="r">${x.total}</td><td class="r">${isNil(x.reopen_count) ? '—' : x.reopen_count}</td><td>${esc(x.milestone_name || '—')}</td></tr>`).join('')}
          <tr><td><b>Total</b></td><td></td><td class="r"><b>${r.defects.reduce((a, x) => a + Number(x.total || 0), 0)}</b></td><td class="r">${r.defects.reduce((a, x) => a + Number(x.reopen_count || 0), 0)}</td><td></td></tr></tbody></table></div>` : ''}
        ${r.pci && r.pci.length ? r.pci.map(x => `<div class="item"><div><b>PCI audit ${fmtDate(x.audit_date)}</b><div class="s">${isNil(x.open_ncs) ? 'Open non-conformances not recorded' : plural(Number(x.open_ncs), 'open non-conformance')}</div></div><div class="ag"><span class="${x.pci_score >= 90 ? 'good' : x.pci_score >= 80 ? 'warn' : 'bad'}" style="font-size:15px;font-weight:700">${isNil(x.pci_score) ? '—' : x.pci_score + '%'}</span></div></div>`).join('') : ''}</div>` : ''}
      ${r.activities && r.activities.length ? `<div class="dsec"><h4><span class="n">W</span> Weekly achievements &amp; next-week plan · w/e ${fmtDate(r.activities[0].week_ending)}</h4>
        <div class="tblwrap"><table class="tight" style="min-width:560px"><thead><tr><th>Activity</th><th>This week</th><th>Next action</th></tr></thead><tbody>
        ${r.activities.filter(a => a.week_ending === r.activities[0].week_ending).map(a => `<tr><td><span class="wrap">${esc(a.activity)}</span></td><td><span class="wrap">${esc(a.this_week_status || '—')}</span></td><td><span class="wrap">${esc(a.next_action || '—')}</span></td></tr>`).join('')}
        </tbody></table></div></div>` : ''}
      <div class="dsec"><h4><span class="n">07</span> RAID — risks &amp; assumptions${openRisks.length ? ' · ' + openRisks.length + ' open' : ''}</h4>
        ${openRisks.length ? riskMatrix(r.risks) + openRisks.map(x => `<div class="item"><div><b>${esc(x.ref)} · ${esc(x.description)}</b><div class="s">${esc(x.probability)} probability · ${esc(x.impact)} impact · ${esc(x.owner_name || 'unowned')}${x.mitigation ? ' · ' + esc(x.mitigation) : ''}</div></div>
          <div class="ag">${Math.max(0, daysBetween(x.raised_date, todayISO()))} d</div></div>`).join('') : '<p class="muted" style="font-size:13.5px">No open risks recorded. An empty register scores 75, not 100.</p>'}</div>
      ${r.actions.length ? `<div class="dsec"><h4><span class="n">08</span> Action items · ${r.actions.length}</h4>${r.actions.map(a => `
        <div class="item"><div><b>${a.ref ? esc(a.ref) + ' · ' : ''}${esc(a.title)}</b><div class="s">due ${fmtDate(a.due_date)} · ${esc(a.status)}${a.response ? ' · “' + esc(a.response) + '”' : ''}</div></div>
        <div class="ag">${prioChip(a.priority)}</div></div>`).join('')}</div>` : ''}
    </div>`;
  $('#drClose').addEventListener('click', closeDrawer);
  $('#drClose').focus();
  wireDownloads(d);
  const ab = $('#drAction'); if (ab) ab.addEventListener('click', () => { closeDrawer(); go('actions', { newFor: p.id }); });
  const sb = $('#drStatus'); if (sb) sb.addEventListener('click', () => { closeDrawer(); go('status', { projectId: p.id }); });
  const lb = $('#drLetter'); if (lb) lb.addEventListener('click', () => openLetter(p.id, p.code));
  const de = $('#drDatesEdit'), df = $('#drDatesForm');
  if (de && df) {
    de.addEventListener('click', () => { df.classList.remove('hide'); de.classList.add('hide'); $('#drStart').focus(); });
    $('#drDatesCancel').addEventListener('click', () => { df.classList.add('hide'); de.classList.remove('hide'); });
    df.addEventListener('submit', async e => {
      e.preventDefault();
      try {
        await updateProjectDates(p.id, { start_date: $('#drStart').value, end_date: $('#drEnd').value });
        toast('Project dates saved'); openProject(p.id);
      } catch (err) { toast((err.payload && err.payload.message) || 'Could not save the dates', true); }
    });
  }
  runAnalysis(p.id, false);
}

export async function runAnalysis(pid, refresh) {
  const host = $('#intel'); if (!host) return;
  const cached = State.analysis[pid];
  if (cached && !refresh && Date.now() - cached.at < 10 * 60 * 1000) return paintAnalysis(pid, cached.out);
  host.innerHTML = `<div class="ihead"><span class="eyebrow">${ic('spark')} Diagnosing</span></div><p style="margin-top:var(--s-3);display:flex;gap:var(--s-3);align-items:center">${dots()} Reading twelve weeks of status, the milestones, risks and client items…</p>`;
  try {
    const out = await analyseProject(pid);
    State.analysis[pid] = { at: Date.now(), out };
    if (State.project && State.project.project.id === pid) paintAnalysis(pid, out);
  } catch (e) { host.innerHTML = '<p class="muted">The diagnosis could not be prepared just now.</p>'; }
}
export function paintAnalysis(pid, a) {
  const host = $('#intel'); if (!host) return;
  const vs = { 'On track': 'g', Watch: 'a', Intervene: 'r' }[a.verdict] || 'n';
  host.innerHTML = `
    <div class="ihead">${chip(vs, esc(a.verdict))}${srcLine(a)}<span class="sp"></span><button class="btn sec sm" type="button" id="reAnalyse">${ic('refresh')} Re-run</button></div>
    <h3>${esc(a.headline)}</h3>
    <p>${esc(a.diagnosis)}</p>
    ${a.root_causes && a.root_causes.length ? `<div class="sub">Root causes</div>${a.root_causes.map((c, i) => `<div class="cause"><span class="n">0${i + 1}</span><div><b>${esc(c.factor)}.</b> ${esc(c.evidence)}</div></div>`).join('')}` : ''}
    ${a.outlook ? `<div class="sub">Outlook</div><div class="outlook"><span>${esc(a.outlook.milestone || 'Next milestone')}</span>${chip(a.outlook.on_time_likelihood === 'High' ? 'g' : a.outlook.on_time_likelihood === 'Low' ? 'r' : 'a', esc(a.outlook.on_time_likelihood) + ' chance on time')}<span class="muted" style="font-size:13px">${esc(a.outlook.reasoning)}</span></div>` : ''}
    ${a.consistency_flags && a.consistency_flags.length ? `<div class="sub">What does not add up</div>${a.consistency_flags.map(f => `<div class="flag">${ic('flag')}<span>${esc(f)}</span></div>`).join('')}` : ''}
    ${a.actions && a.actions.length ? `<div class="sub">Recommended actions</div>${a.actions.map((x, i) => `<div class="rec"><div><b>${esc(x.title)}</b><span>${esc(x.detail)}</span>
        <span class="m">${esc(ROLE_LABEL[x.owner_role] || x.owner_role)} · within ${x.due_in_days} days · ${esc(x.priority)}</span></div>
        ${a.can_raise ? `<button class="btn sec sm" type="button" data-raise="${i}">${ic('plus')} Raise</button>` : ''}</div>`).join('')}` : ''}
    ${a.client_ask ? `<div class="sub">Ask of the client</div><p style="margin:0">${esc(a.client_ask)}</p>` : ''}`;
  $('#reAnalyse').addEventListener('click', () => runAnalysis(pid, true));
  $$('[data-raise]').forEach(b => b.addEventListener('click', () => raiseRecommended(pid, a.actions[Number(b.dataset.raise)], b)));
}
/* Turn a recommendation into a real action item, owned by the named person in that role. */
export async function raiseRecommended(pid, x, btn) {
  const pr = State.project && State.project.project;
  const users = (State.project && State.project.users) || [];
  let owner = null;
  if (x.owner_role === 'pm') owner = pr.pm_user_id;
  else if (x.owner_role === 'dh') owner = pr.dh_user_id;
  else if (x.owner_role === 'director') owner = (users.find(u => u.role === 'director' && u.bu === pr.bu) || users.find(u => u.role === 'director') || {}).id;
  else if (x.owner_role === 'ceo') owner = (users.find(u => u.role === 'ceo') || {}).id;
  if (!owner) owner = pr.pm_user_id;
  btn.disabled = true;
  try {
    await createAction({ project_id: pid, title: x.title, detail: x.detail, owner_user_id: owner,
      due_date: new Date(Date.now() + x.due_in_days * 864e5).toISOString().slice(0, 10), priority: x.priority });
    btn.innerHTML = ic('ok') + ' Raised'; toast('Action item raised with ' + ((users.find(u => u.id === owner) || {}).name || 'owner'));
  } catch (e) { btn.disabled = false; toast('Could not raise that item', true); }
}
