/* Workbook records editor (one editor for every sheet, from /meta/records). */
import { $$, esc } from '../core/dom.js';
import { fmtDate, isNil } from '../core/format.js';
import { ic } from '../core/icons.js';
import { State } from '../core/state.js';

/* ---------- workbook records on screen: one editor for every sheet, built from /meta/records ---------- */
export const WIDE_COLS = ['description', 'mitigation', 'contingency', 'remarks', 'activity', 'this_week_status', 'next_action', 'name', 'milestone_name', 'owner_at_client'];
export const REC_NOTE = {
  activities: 'This week — one row per activity', milestones: 'Forecast end later than plan end needs Remarks · completed needs an actual end date',
  billing: 'One row per invoice, amount in ₹ crore', raid: 'Risks, assumptions, issues and dependencies in one log — Type says which. Close items, never delete them', risks: 'RAID log — close items, never delete them', iad: 'Issues and dependencies with a named owner and the last follow-up',
  defects: 'Counts by type and phase injected — the process metrics read these', pci: 'Process compliance audits'
};
export function lastWeekPlan(acts, week) {
  const prev = (acts || []).filter(a => a.week_ending < week).sort((a, b) => String(b.week_ending).localeCompare(String(a.week_ending)));
  if (!prev.length) return '';
  const wk = prev[0].week_ending, rows = prev.filter(a => a.week_ending === wk && a.next_action);
  return rows.length ? `<div class="banner">${ic('info')}<div><strong>Planned last week (w/e ${fmtDate(wk)}):</strong> ${rows.map(a => `${esc(a.activity)} — ${esc(a.next_action)}`).join(' · ')}</div></div>` : '';
}
export function recSection(n, kind, rows, extraTop) {
  const spec = State.recMeta.records[kind];
  return `<section class="blk"><div class="sh"><span class="n">${n}</span><h2>${esc(spec.label)}</h2><span class="note">${esc(REC_NOTE[kind] || '')}</span>
    <span class="tools"><button class="btn sec sm" type="button" data-add-rec="${kind}">${ic('plus')} Add row</button></span></div>
    ${extraTop || ''}
    <div class="rows" id="rec_${kind}">${(rows || []).map(r => recRow(kind, r)).join('')}</div>
    ${(rows || []).length ? '' : `<div class="empty" id="recempty_${kind}">Nothing recorded yet.</div>`}</section>`;
}
export function recRow(kind, r) {
  r = r || {};
  const spec = State.recMeta.records[kind];
  const cols = spec.cols.filter(c => !(kind === 'activities' && c.key === 'week_ending'));
  const v = c => c.key === 'is_billing' ? (r.is_billing === 1 ? 'Yes' : r.is_billing === 0 ? 'No' : '') : (isNil(r[c.key]) ? '' : String(r[c.key]));
  const ctl = c => {
    const val = v(c);
    if (c.kind === 'pick') return `<select data-f="${c.key}"><option value="">—</option>${c.options.map(o => `<option${val === o ? ' selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
    if (c.kind === 'date') return `<input data-f="${c.key}" type="date" value="${esc(val.slice(0, 10))}">`;
    if (c.kind === 'num' || c.kind === 'pct') return `<input data-f="${c.key}" type="number" step="any" min="0"${c.kind === 'pct' ? ' max="100"' : ''} value="${esc(val)}">`;
    return `<input data-f="${c.key}" value="${esc(val)}"${r.id ? '' : ` placeholder="e.g. ${esc(c.eg || '')}"`}>`;
  };
  return `<div class="rowitem" data-rec="${kind}" data-id="${esc(r.id || '')}">
    <div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(180px,1fr))">
      ${cols.map(c => `<div class="field"${WIDE_COLS.indexOf(c.key) >= 0 ? ' style="grid-column:span 2"' : ''}><label>${esc(c.h)}${c.req ? ' *' : ''}</label>${ctl(c)}</div>`).join('')}
      <div class="field" style="justify-content:end"><button class="btn sec sm del" type="button" data-del-rec="${kind}" data-id="${esc(r.id || '')}">Remove</button></div>
    </div></div>`;
}
export function collectRecords() {
  const out = {};
  Object.keys((State.recMeta || { records: {} }).records).forEach(kind => {
    const rows = $$(`#rec_${kind} .rowitem`).map(el => {
      const o = {};
      el.querySelectorAll('[data-f]').forEach(i => { const v = i.value.trim(); if (v !== '') o[i.dataset.f] = v; });
      return o;
    }).filter(o => Object.keys(o).length);
    if (rows.length) out[kind] = rows;
  });
  return out;
}
