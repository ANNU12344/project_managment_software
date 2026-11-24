/* Weekly status screen (PM): pick a project and week, then fill in the status figures, this
   week's effort, project details and the workbook records (milestones, RAID, billing …).
   Field lists come from the server (meta API) so the form always matches the upload sheet.
   Saving is handled in weekly-status-wire.js.
   API: api/portfolio.api.js, api/project.api.js, api/status.api.js, api/meta.api.js */
import { $, $$, esc } from '../core/dom.js';
import { C, HC, ROLE_LABEL } from '../core/constants.js';
import { fmtDate, fmtTime, isNil, plural } from '../core/format.js';
import { info } from '../core/formulas.js';
import { ic } from '../core/icons.js';
import { getPortfolio } from '../api/portfolio.api.js';
import { getProject } from '../api/project.api.js';
import { getStatus } from '../api/status.api.js';
import { getProjectDetailFields, getRecordSpecs } from '../api/meta.api.js';
import { State } from '../core/state.js';
import { setMain, setTools } from './shell.js';
import { downloadTools, wireDownloads } from './dashboard.js';
import { lastWeekPlan, recSection } from './records-editor.js';
import { wireStatus } from './weekly-status-wire.js';
import { fmtH, varPct } from './weekly-monthly.js';

/* ================================================================ PM: weekly status */
export function fieldNum(id, label, hint, value, prev, extra) {
  const moved = !isNil(prev) && !isNil(value) && Number(prev) !== Number(value);
  return `<div class="field"><label for="${id}">${label}</label>
    <input id="${id}" type="number" step="any" value="${isNil(value) ? '' : value}" data-prev="${isNil(prev) ? '' : prev}" ${extra || ''}>
    ${hint ? `<span class="hint">${hint}</span>` : ''}${!isNil(prev) ? `<span class="was${moved ? ' moved' : ''}" id="${id}_was">last report ${prev}${moved ? ' · changed' : ''}</span>` : ''}<span class="err hide" id="${id}_e"></span></div>`;
}
export function weekEndingISO() {
  const x = new Date(); const day = x.getUTCDay();
  x.setUTCDate(x.getUTCDate() + (day === 0 ? 0 : 7 - day));
  return x.toISOString().slice(0, 10);
}

export async function viewStatus(opts) {
  opts = opts || {};
  const r = await getPortfolio();
  State.portfolio = r.projects;
  const mine = State.portfolio;
  if (!mine.length) { setMain(`<div class="pagehead"><h1>Weekly status</h1></div><div class="empty">No projects are assigned to you. Ask the PMO to assign you as project manager.</div>`); return; }
  const pid = opts.projectId || (State.statusPid && mine.some(p => p.id === State.statusPid) ? State.statusPid : mine[0].id);
  State.statusPid = pid;
  const proj = await getProject(pid);
  const row = mine.find(p => p.id === pid) || {};
  const week = opts.week || weekEndingISO();
  const thisWeek = (await getStatus(pid, week)).report;
  const hist = proj.history.filter(s => s.week_ending < week);
  const prev = hist.length ? hist[hist.length - 1] : null;
  const carried = !thisWeek;
  const cur = thisWeek || (prev ? Object.assign({}, prev, { pm_rag: '', pm_rag_reason: '', narrative: '', submitted_at: null }) : {});
  const P = k => prev ? prev[k] : null;
  const h = proj.health;
  if (!State.pdFields) State.pdFields = (await getProjectDetailFields()).fields;
  if (!State.recMeta) State.recMeta = await getRecordSpecs();
  const pj = proj.project;
  const pmUser = (proj.users.find(u => u.id === pj.pm_user_id) || {});
  State.hasWeekly = (proj.weekly || []).length > 0;

  setMain(`
    <div class="pagehead"><div class="row"><div class="grow"><span class="eyebrow">${ROLE_LABEL[State.user.role]} · ${esc(row.code || '')}</span><h1>Weekly status</h1>
      <p class="lede">The only screen anyone has to fill in. Every number on the Delivery Head, Director and CEO screens is computed from what you enter here.</p></div>
      <div style="text-align:right"><span class="mono muted">COMPUTED HEALTH</span><div class="stat" style="color:${HC[h ? h.state : 'n'] || C.ink3}">${h ? h.index : '—'}</div></div></div></div>
    <div class="toolbar">
      <select id="stProj" aria-label="Project">${mine.map(p => `<option value="${p.id}"${p.id === pid ? ' selected' : ''}>${esc(p.code)} — ${esc(p.name)}</option>`).join('')}</select>
      <label class="mono muted" for="stWeek" style="margin-left:var(--s-3)">WEEK ENDING</label>
      <input id="stWeek" type="date" value="${week}" style="min-width:160px">
      <span class="spacer"></span>
      <span class="mono muted" id="stSaved">${cur.submitted_at ? 'Last saved ' + fmtDate(cur.submitted_at) + ' ' + fmtTime(cur.submitted_at) : 'Not reported for this week yet'}</span>
    </div>
    ${carried && prev ? `<div class="banner">${ic('info')}<div><strong>Carried forward from week ending ${fmtDate(prev.week_ending)}.</strong>
      Change what actually moved and save — nothing is stored against this week until you do. Your band and narrative start blank on purpose. Every field shows last week's figure beneath it.</div></div>` : ''}
    <form id="stForm">
      <section class="blk"><div class="sh"><span class="n">00</span><h2>Project details</h2><span class="note">${pj.details_updated_at ? 'Last updated ' + fmtDate(pj.details_updated_at) : 'Not filled in yet'} · update whenever these change</span></div>
        ${detailsForm(pj, pmUser)}
      </section>
      ${weeklySection(proj, week)}
      <!-- Hidden on request: "Progress and performance" section removed from the Weekly status form.
      <section class="blk"><div class="sh"><span class="n">01</span><h2>Progress and performance</h2></div>
        <div class="form f4">
          ${fieldNum('pct_complete', 'Percent complete', '0–100', cur.pct_complete, P('pct_complete'))}
          ${fieldNum('budget_consumed_pct', 'Budget consumed %', 'Spend against baseline', cur.budget_consumed_pct, P('budget_consumed_pct'))}
          ${fieldNum('spi', 'SPI (optional)', 'Earned ÷ planned value · blank if not tracked', cur.spi, P('spi'))}
          ${fieldNum('cpi', 'CPI (optional)', 'Earned value ÷ actual cost · blank if not tracked', cur.cpi, P('cpi'))}
          ${fieldNum('effort_baseline_pd', 'Baseline effort (pd)', 'At plan freeze', cur.effort_baseline_pd, P('effort_baseline_pd'))}
          ${fieldNum('effort_actual_pd', 'Actual effort (pd)', 'To date', cur.effort_actual_pd, P('effort_actual_pd'))}
          ${fieldNum('etc_pd', 'Estimate to complete (pd)', 'Your current view', cur.etc_pd, P('etc_pd'))}
          ${fieldNum('timesheet_compliance', 'Timesheet compliance %', 'Team filed last week', cur.timesheet_compliance, P('timesheet_compliance'))}
          ${State.user.role !== 'pm' ? fieldNum('margin_at_completion', 'Margin at completion %', 'Current forecast', cur.margin_at_completion, P('margin_at_completion')) : ''}
        </div></section> -->
      <!-- Hidden on request: "Quality, cash and people" section removed from the Weekly status form (defects are covered in the Defects records).
      <section class="blk"><div class="sh"><span class="n">02</span><h2>Quality, cash and people</h2></div>
        <div class="form f4">
          ${fieldNum('defects_open', 'Defects open', '', cur.defects_open, P('defects_open'))}
          ${fieldNum('defects_leaked', 'Defects leaked to UAT', '', cur.defects_leaked, P('defects_leaked'))}
          ${fieldNum('defects_reopened', 'Defects reopened', '', cur.defects_reopened, P('defects_reopened'))}
          ${fieldNum('sla_breaches', 'SLA breaches', 'AMC projects only', cur.sla_breaches, P('sla_breaches'))}
          ${State.user.role !== 'pm' ? fieldNum('unbilled_wip', 'Unbilled WIP (₹ Cr)', 'Delivered, not invoiceable', cur.unbilled_wip, P('unbilled_wip')) : ''}
          ${State.user.role !== 'pm' ? fieldNum('ar_over_90', 'Receivable over 90 d (₹ Cr)', '', cur.ar_over_90, P('ar_over_90')) : ''}
          ${fieldNum('over_allocated', 'Over-allocated people', 'Booked beyond 100%', cur.over_allocated, P('over_allocated'))}
          ${fieldNum('attrition_flag', 'Resignation on project', '1 = yes, 0 = no', cur.attrition_flag, P('attrition_flag'))}
        </div></section> -->
      <section class="blk"><div class="sh"><span class="n">01</span><h2>Your read</h2><span class="note">A band that is not Green needs a reason</span></div>
        <div class="intel" style="margin-bottom:var(--s-5)" id="assist">
          <div class="ihead"><span class="eyebrow">${ic('spark')} DCC Intelligence · writing assistant</span><span class="sp"></span>
            <button class="btn ai sm" type="button" id="aiDraft">${ic('spark')} Draft &amp; check with AI</button></div>
          <p style="margin:var(--s-3) 0 0;font-size:13.5px" id="assistMsg">Reads the figures above against last week, then drafts “What moved”, suggests a band and flags anything your Delivery Head will question. You stay the author — edit freely.</p>
          <div id="assistOut"></div>
        </div>
        <div class="form">
          <div class="field"><label for="pm_rag">Your band</label>
            <select id="pm_rag">${['', 'Green', 'Amber', 'Red'].map(v => `<option value="${v}"${cur.pm_rag === v ? ' selected' : ''}>${v || '— not stated —'}</option>`).join('')}</select>
            <span class="hint">The system computes its own index; this is your override and it is logged.</span></div>
          <div class="field wide" style="grid-column:2/-1"><label for="pm_rag_reason">Reason</label>
            <input id="pm_rag_reason" value="${esc(cur.pm_rag_reason || '')}">
            <span class="err hide" id="pm_rag_reason_e"></span></div>
          <div class="field wide"><label for="narrative">What moved this week</label>
            <textarea id="narrative" placeholder="Two or three sentences. This is what the Delivery Head reads first.">${esc(cur.narrative || '')}</textarea></div>
        </div></section>
      ${recSection('03', 'activities', (proj.activities || []).filter(a => a.week_ending === week), lastWeekPlan(proj.activities, week))}
      ${recSection('04', 'milestones', proj.milestones)}
      ${recSection('05', 'billing', proj.billing)}
      ${recSection('06', 'raid', proj.raid)}
      ${recSection('07', 'defects', proj.defects)}
      ${recSection('08', 'pci', proj.pci)}
      <div class="actions-row">
        <button class="btn" type="submit" id="stSave">${ic('ok')} Save this week</button>
        <span class="mono muted" id="stMsg"></span>
      </div>
    </form>`);
  setTools(downloadTools(pid));
  wireDownloads();
  wireStatus(pid, proj);
}

/* This week's effort & process entry, with the running total to date beside each field. */
export function weeklySection(proj, week) {
  const F = proj.weekly_fields || [], G = proj.weekly_groups || {};
  const rows = (proj.weekly || []).slice().sort((a, b) => String(a.week_ending).localeCompare(String(b.week_ending)));
  const cur = rows.find(r => r.week_ending === week) || {};
  const before = rows.filter(r => r.week_ending < week);
  const prior = {};
  F.forEach(f => { const v = before.map(r => r[f.key]).filter(x => !isNil(x)).map(Number); prior[f.key] = !v.length ? null : f.agg === 'last' ? v[v.length - 1] : v.reduce((a, b) => a + b, 0); });
  const ts = cur.source === 'timesheet';
  const toDate = f => isNil(prior[f.key]) && isNil(cur[f.key]) ? null : Number(prior[f.key] || 0) + Number(cur[f.key] || 0);
  const fld = f => `<div class="field"><label for="wk_${f.key}">${esc(f.label)}</label>
    <input id="wk_${f.key}" data-wk="${f.key}" data-prior="${isNil(prior[f.key]) ? '' : prior[f.key]}" data-agg="${f.agg}" type="number" step="any" min="0" value="${isNil(cur[f.key]) ? '' : cur[f.key]}">
    <span class="was" id="wk_${f.key}_td">${f.agg === 'last' ? 'latest week counts' : 'to date ' + fmtH(toDate(f))}</span></div>`;
  const groups = Object.keys(G).map(g => {
    const fs = F.filter(f => f.group === g); if (!fs.length) return '';
    const body = `<div class="form f4">${fs.map(fld).join('')}</div>`;
    if (g === 'size' || g === 'agile') return `<details class="wkopt"${fs.some(f => !isNil(cur[f.key]) || !isNil(prior[f.key])) ? ' open' : ''}><summary>${esc(G[g])}</summary>${body}</details>`;
    return `<div class="sh" style="margin:var(--s-4) 0 var(--s-2)"><h3>${esc(G[g])}</h3></div>${body}`;
  }).join('');
  return `<section class="blk"><div class="sh"><span class="n">${ic('clock')}</span><h2>Weekly effort &amp; process — this week</h2>
    <span class="note">Week ending ${fmtDate(week)} · enter this week's figures only; "to date" adds up all weeks${info('cum')}</span></div>
    ${ts ? `<div class="banner">${ic('info')}<div><strong>Hours for this week came from an uploaded timesheet.</strong> Edit here only to correct them — the next timesheet upload for this week replaces the hours again.</div></div>` : ''}
    <div class="kpis" style="grid-template-columns:repeat(3,1fr);margin-bottom:var(--s-4)">
      <div class="kpi"><span class="lbl">Planned to date</span><div class="row"><span class="stat" id="wkPT" style="font-size:30px">—</span></div><div class="sub">hours, all weeks up to this one</div></div>
      <div class="kpi"><span class="lbl">Actual to date</span><div class="row"><span class="stat" id="wkAT" style="font-size:30px">—</span></div><div class="sub">hours, all weeks up to this one</div></div>
      <div class="kpi"><span class="lbl">Effort variance to date ${info('ev')}</span><div class="row"><span class="stat" id="wkEV" style="font-size:30px">—</span></div><div class="sub">(actual − planned) ÷ planned</div></div>
    </div>
    ${groups}
    <div class="form" style="margin-top:var(--s-3)"><div class="field wide"><label for="wk_remarks">Remarks for this week</label><input id="wk_remarks" data-wk="remarks" value="${esc(cur.remarks || '')}"></div></div>
    <p class="muted" style="font-size:13px;margin-top:8px">${plural(before.length, 'earlier week')} recorded. See them on <a href="#trends" data-v="trends" class="lnk">Weekly &amp; monthly</a>, or fill hours from a <a href="#timesheets" data-v="timesheets" class="lnk">timesheet upload</a>.</p></section>`;
}
export function liveWeekly() {
  const td = el => { const p = el.dataset.prior === '' ? null : Number(el.dataset.prior), v = el.value === '' ? null : Number(el.value); return p === null && v === null ? null : (p || 0) + (v || 0); };
  $$('[data-wk][data-agg="sum"]').forEach(el => { const t = $('#' + el.id + '_td'); if (t) t.textContent = 'to date ' + fmtH(td(el)); });
  const pl = $('#wk_planned_hrs'), ac = $('#wk_actual_hrs'); if (!pl || !ac) return;
  const P = td(pl), A = td(ac);
  $('#wkPT').textContent = fmtH(P); $('#wkAT').textContent = fmtH(A);
  const ev = varPct(A, P), e = $('#wkEV');
  e.textContent = isNil(ev) ? '—' : (ev > 0 ? '+' : '') + ev + '%'; e.style.color = isNil(ev) ? C.ink3 : ev > 10 ? C.bad : C.good;
}

/* Project master data form, built from the server's field list. */
export function detailsForm(pj, pmUser) {
  const F = State.pdFields;
  const val = f => f.kind === 'date' ? esc((pj[f.key] || '').slice(0, 10)) : esc(isNil(pj[f.key]) ? '' : pj[f.key]);
  const input = f => {
    const id = 'pd_' + f.key;
    let ctl;
    if (f.kind === 'pick') ctl = `<select id="${id}" data-pd="${f.key}"><option value="">—</option>${f.options.map(o => `<option${pj[f.key] === o ? ' selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
    /* Project start / end dates are set by the Delivery Head or the PMO administrator: read-only for a PM,
       and without data-pd so the form never sends them (the server drops them from a PM in any case). */
    else if (f.kind === 'date' && State.user.role === 'pm' && (f.key === 'start_date' || f.key === 'end_date'))
      return `<div class="field"><label for="${id}">${esc(f.label)}</label><input id="${id}" type="date" value="${val(f)}" readonly disabled><span class="hint">Set by the Delivery Head or PMO administrator</span></div>`;
    else if (f.kind === 'date') ctl = `<input id="${id}" data-pd="${f.key}" type="date" value="${val(f)}">`;
    else if (f.kind === 'num' || f.kind === 'pct') ctl = `<input id="${id}" data-pd="${f.key}" type="number" step="any" min="0"${f.kind === 'pct' ? ' max="100"' : ''} value="${val(f)}">`;
    else ctl = `<input id="${id}" data-pd="${f.key}" value="${val(f)}">`;
    return `<div class="field"><label for="${id}">${esc(f.label)}</label>${ctl}${f.hint ? `<span class="hint">${esc(f.hint)}</span>` : ''}<span class="err hide" id="${id}_e"></span></div>`;
  };
  const group = (sheet, note) => `<div class="sh" style="margin:var(--s-5) 0 var(--s-3)"><h3>${esc(sheet)}</h3>${note ? `<span class="note">${note}</span>` : ''}</div>
    <div class="form f4">${F.filter(f => f.sheet === sheet && !f.hidden && f.key !== 'name').map(input).join('')}</div>`;
  return `<div class="sh" style="margin:0 0 var(--s-3)"><h3>Project Information</h3></div>
    <div class="form f4">
      <div class="field"><label>Project code</label><input value="${esc(pj.code)}" readonly></div>
      ${input(F.find(f => f.key === 'name'))}
      <div class="field"><label>Project manager</label><input value="${esc(pmUser.name || '—')}" readonly><span class="hint">Reassignment is done by the PMO administrator</span></div>
      ${F.filter(f => f.sheet === 'Project Information' && f.key !== 'name').map(input).join('')}
    </div>
    ${group('Project Performance', 'Progress to date · Actual cost is needed for net margin')}
    ${State.hasWeekly ? `<div class="banner" style="margin-top:var(--s-5)">${ic('info')}<div><strong>Process metrics come from your weekly entries.</strong> Effort by phase, review hours and findings, size and requirements are added up from the weekly section above (and timesheets) — no need to fill cumulative figures here.</div></div>`
      : group('Process Metrics', 'Optional · cumulative to date. Or fill the weekly section above week by week and these are added up for you')}
    <div class="kpis" style="grid-template-columns:repeat(2,1fr);margin:var(--s-5) 0 0">
      <div class="kpi"><span class="lbl">Effort variance · (actual − planned) ÷ planned</span><div class="row"><span class="stat" id="pdEV" style="font-size:34px">—</span></div><div class="sub" id="pdEVs">Fill planned and actual efforts</div></div>
      <div class="kpi"><span class="lbl">Net margin · (value − actual cost) ÷ value</span><div class="row"><span class="stat" id="pdNM" style="font-size:34px">—</span></div><div class="sub" id="pdNMs">Fill project value and actual cost</div></div>
    </div>`;
}
export function liveDetails() {
  const g = k => { const el = $('#pd_' + k); if (!el || el.value === '') return null; const v = Number(el.value); return isNaN(v) ? null : v; };
  const pl = g('planned_effort_hours'), ac = g('actual_effort_hours'), v = g('contract_value'), c = g('actual_cost_cr');
  const ev = pl && ac !== null ? Math.round((ac - pl) / pl * 1000) / 10 : null;
  const nm = v && c !== null ? Math.round((v - c) / v * 1000) / 10 : null;
  const paint = (id, x, good, txt) => { const el = $(id); if (!el) return; el.textContent = x === null ? '—' : (id === '#pdEV' && x > 0 ? '+' : '') + x.toFixed(1) + '%'; el.style.color = x === null ? C.ink3 : good(x) ? C.good : C.bad; $(id + 's').textContent = txt; };
  paint('#pdEV', ev, x => x <= 0, ev === null ? 'Fill planned and actual efforts' : `${ac.toLocaleString('en-IN')} hrs actual against ${pl.toLocaleString('en-IN')} planned`);
  paint('#pdNM', nm, x => x >= 15, nm === null ? 'Fill project value and actual cost' : `₹${c} Cr spent of a ₹${v} Cr project`);
}
