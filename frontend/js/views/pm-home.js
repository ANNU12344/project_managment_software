/* Project manager home screen: a tile per own project with its health, this week's report state
   and open action items.  API: api/action.api.js */
import { $, $$, esc } from '../core/dom.js';
import { C, HC } from '../core/constants.js';
import { chip, fmtDate, fmtShort, inr, isNil, pct, plural, todayISO } from '../core/format.js';
import { ic } from '../core/icons.js';
import { listActions } from '../api/action.api.js';
import { deltaOf, projCell, spark } from '../charts/spark.js';
import { State } from '../core/state.js';
import { go, setMain, setTools } from './shell.js';
import { briefShell, loadBrief, wireOpeners } from './ai-brief.js';
import { wireDownloads } from './dashboard.js';
import { mxSummaryTxt } from './process-metrics.js';
import { pmoDashboard } from './pmo-dashboard.js';
import { prioChip } from './health-breakdown.js';
import { weekEndingISO } from './weekly-status.js';
import { fmtH } from './weekly-monthly.js';

/* ---------- PM home ---------- */
export async function viewPmHome() {
  const [acts] = await Promise.all([listActions()]);
  const mine = State.portfolio;
  const wk = weekEndingISO();
  const openActs = acts.actions.filter(a => a.status !== 'Closed' && a.owner_user_id === State.user.id);
  const reported = mine.filter(p => p.week_ending === wk).length;
  const hour = new Date().getHours();
  const hello = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  setMain(`
    <div class="pagehead"><span class="eyebrow">Project Manager${State.user.bu ? ' · ' + esc(State.user.bu) : ''}</span>
      <h1>${hello}, ${esc(greetName(State.user.name))}</h1>
      <p class="lede">Everything above this screen is computed from what you report. ${reported === mine.length ? 'This week is reported for every project — thank you.' : `${mine.length - reported} of your ${plural(mine.length, 'project')} still ${mine.length - reported === 1 ? 'needs' : 'need'} this week's status (week ending ${fmtDate(wk)}).`}</p>
      <div class="meta"><div>Projects <b>${mine.length}</b></div><div>Reported this week <b>${reported} of ${mine.length}</b></div><div>Action items on me <b>${openActs.length}</b></div></div></div>
    ${briefShell()}
    ${pmoDashboard(mine, 'pm')}
    <div class="tiles">${mine.map(p => {
      const d = deltaOf(p.trend), done = p.week_ending === wk;
      return `<div class="tile">
        <div class="top"><div><span class="eyebrow">${esc(p.code)}</span><h3>${esc(p.name)}</h3><div class="client">${esc(p.client)}</div></div>${chip(p.state)}</div>
        <div class="fig"><span class="stat" style="color:${HC[p.state] || C.ink3}">${isNil(p.health) ? '—' : p.health}</span>
          <div><div class="mono muted">HEALTH / 100</div>${spark(p.trend, d < 0 ? C.bad : d > 0 ? C.good : C.ink3, 120, 30)}</div>
          <div style="margin-left:auto;text-align:right"><div class="mono muted">+4 WK</div>${projCell(p)}</div></div>
        <dl class="facts">
          <div><dt>Hours last week</dt><dd>${p.week_effort ? fmtH(p.week_effort.actual_hrs) + ' of ' + fmtH(p.week_effort.planned_hrs) : '—'}</dd></div>
          <div><dt>Hours to date</dt><dd>${p.cumulative ? fmtH(p.cumulative.actual_hrs) + ' of ' + fmtH(p.cumulative.planned_hrs) : '—'}</dd></div>
          <div><dt>Open audit NCs</dt><dd class="${p.open_ncs ? 'bad' : ''}">${p.open_ncs || 'none'}${p.major_ncs ? ' · ' + p.major_ncs + ' major' : ''}</dd></div>
          <div><dt>Complete</dt><dd>${pct(p.pct_complete)}</dd></div>
          <div><dt>Next milestone</dt><dd>${esc(p.next_milestone || '—')}</dd></div>
          <div><dt>Forecast</dt><dd class="${p.slip_days ? 'bad' : ''}">${fmtDate(p.next_milestone_date)}${p.slip_days ? ` · ${p.slip_days} d late` : ''}</dd></div>
          <div><dt>Open with client</dt><dd class="${p.open_deps ? 'bad' : ''}">${p.open_deps || 'none'}</dd></div>
          <div><dt>Open risks</dt><dd>${p.open_risks}</dd></div>
          <div><dt>Stage</dt><dd>${esc(p.stage || '—')}</dd></div>
          <div><dt>Project value</dt><dd>${inr(p.contract_value)}</dd></div>
          <div><dt>Effort variance</dt><dd>${evTxt(p.effort_variance_pct)}</dd></div>
          <div><dt>Net margin</dt><dd>${nmTxt(p.net_margin_pct)}</dd></div>
          <div style="grid-column:1/-1"><dt>Process metrics vs baseline</dt><dd style="font-size:12.5px">${p.process_summary ? mxSummaryTxt(p.process_summary) : '—'}</dd></div>
        </dl>
        <div>${done ? `<span class="done">${ic('ok')} Reported for week ending ${fmtShort(wk)}</span>` : `<span class="due">${ic('clock')} Not yet reported for week ending ${fmtShort(wk)}</span>`}</div>
        <div class="foot"><button class="btn sm" type="button" data-report="${p.id}">${ic('edit')} ${done ? 'Update' : 'Report'} this week</button>
          <button class="btn sec sm" type="button" data-open="${p.id}">Open</button>
          <button class="btn sec sm" type="button" data-trend="${p.id}">${ic('chart')} Weeks</button>
          <button class="btn sec sm" type="button" data-dl-xlsx="${p.id}">${ic('download')} .xlsx</button>
          <button class="btn sec sm" type="button" data-dl-pdf="${p.id}">${ic('file')} PDF</button></div></div>`;
    }).join('')}</div>
    <section class="blk"><div class="sh"><span class="n">02</span><h2>Action items on you</h2><span class="note">Raised by your Delivery Head, Director, the CEO or the quality auditor</span></div>
      ${openActs.length ? `<div class="tblwrap"><table><thead><tr><th>ID</th><th>Item</th><th>Project</th><th>Raised by</th><th class="r">Due</th><th>Priority</th><th>Status</th></tr></thead><tbody>
        ${openActs.map(a => `<tr><td class="nw mono" style="font-size:12px"><b>${esc(a.ref || '—')}</b></td><td><span class="wrap">${esc(a.title)}</span>${a.detail ? `<span class="subl">${esc(a.detail)}</span>` : ''}</td><td>${esc(a.project_code || '—')}</td><td>${esc(a.raised_by_name || '—')}</td>
          <td class="r${a.due_date && a.due_date < todayISO() ? ' bad' : ''}">${fmtDate(a.due_date)}</td><td>${prioChip(a.priority)}</td><td>${esc(a.status)}</td></tr>`).join('')}
      </tbody></table></div><div class="actions-row"><button class="btn sec" type="button" id="toActs">Respond to action items ${ic('arrow')}</button></div>` : '<div class="empty">Nothing is waiting on you.</div>'}
    </section>`);
  $$('[data-report]').forEach(b => b.addEventListener('click', () => go('status', { projectId: b.dataset.report })));
  $$('[data-trend]').forEach(b => b.addEventListener('click', () => go('trends', { scope: b.dataset.trend })));
  const ta = $('#toActs'); if (ta) ta.addEventListener('click', () => go('actions'));
  setTools('');
  wireDownloads(); wireOpeners($('#main'));
  loadBrief(false);
}
/* First name for a full name ("Sandeep Tinna" → Sandeep); surname when the first part is an initial ("A. Nair" → Nair). */
export const greetName = n => { const t = String(n || '').trim().split(/\s+/); return /\.$/.test(t[0]) || t[0].length < 2 ? t[t.length - 1] : t[0]; };
/* Effort variance: over plan is bad. Net margin: thin is bad. Both are shown with their sign/percent. */
export const evTxt = v => isNil(v) ? '<span class="muted">—</span>' : `<span class="${v >= 10 ? 'bad' : v > 0 ? 'warn' : 'good'}" style="font-weight:600">${v > 0 ? '+' : ''}${Number(v).toFixed(1)}%</span>`;
export const nmTxt = v => isNil(v) ? '<span class="muted">—</span>' : `<span class="${v < 15 ? 'bad' : v < 25 ? 'warn' : 'good'}" style="font-weight:600">${Number(v).toFixed(1)}%</span>`;
export const hrs = v => isNil(v) ? '—' : Number(v).toLocaleString('en-IN') + ' hrs';
