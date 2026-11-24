/* Weekly status form behaviour: collects every field (status, project details, records, this
   week's effort) into one payload, saves it, deletes record rows, and asks AI for a narrative
   suggestion. The form itself is drawn by weekly-status.js.
   API: api/status.api.js, api/ai.api.js */
import { $, $$, esc } from '../core/dom.js';
import { chip } from '../core/format.js';
import { dots, ic } from '../core/icons.js';
import { toast } from '../components/toast.js';
import { saveStatus, deleteRecord } from '../api/status.api.js';
import { draftNarrative } from '../api/ai.api.js';
import { State } from '../core/state.js';
import { srcLine } from './ai-brief.js';
import { liveDetails, liveWeekly, viewStatus } from './weekly-status.js';
import { collectRecords, recRow } from './records-editor.js';

export const NUM_FIELDS = ['pct_complete', 'budget_consumed_pct', 'spi', 'cpi', 'effort_baseline_pd', 'effort_actual_pd', 'etc_pd',
  'margin_at_completion', 'timesheet_compliance', 'defects_open', 'defects_leaked', 'defects_reopened',
  'sla_breaches', 'unbilled_wip', 'ar_over_90', 'over_allocated', 'attrition_flag'];
export function collectStatus() {
  const val = id => { const el = $('#' + id); if (!el) return undefined; const v = el.value.trim(); return v === '' ? '' : Number(v); };
  const payload = { week_ending: $('#stWeek').value };
  NUM_FIELDS.forEach(k => { const v = val(k); if (v !== undefined) payload[k] = v; });
  payload.pm_rag = $('#pm_rag').value;
  payload.pm_rag_reason = $('#pm_rag_reason').value.trim();
  payload.narrative = $('#narrative').value.trim();
  payload.records = collectRecords();
  const wk = {}; let any = false;
  $$('[data-wk]').forEach(el => { wk[el.dataset.wk] = el.value.trim(); if (el.value.trim() !== '') any = true; });
  if (any) payload.weekly = wk;
  const det = {};
  $$('[data-pd]').forEach(el => { det[el.dataset.pd] = el.value.trim(); });
  if (Object.keys(det).length) payload.details = det;
  return payload;
}

export function wireStatus(pid, proj) {
  $$('[data-pd]').forEach(el => el.addEventListener('input', liveDetails)); liveDetails();
  $$('[data-wk]').forEach(el => el.addEventListener('input', liveWeekly)); liveWeekly();
  $('#stProj').addEventListener('change', e => { State.statusPid = e.target.value; viewStatus({ projectId: e.target.value }); });
  $('#stWeek').addEventListener('change', e => viewStatus({ projectId: pid, week: e.target.value }));
  $$('#stForm input[type=number][data-prev]').forEach(inp => inp.addEventListener('input', () => {
    const w = $('#' + inp.id + '_was'); if (!w || inp.dataset.prev === '') return;
    const moved = inp.value !== '' && Number(inp.value) !== Number(inp.dataset.prev);
    w.className = 'was' + (moved ? ' moved' : ''); w.textContent = `last report ${inp.dataset.prev}${moved ? ' · changed' : ''}`;
  }));
  $$('[data-add-rec]').forEach(b => b.addEventListener('click', () => {
    const k = b.dataset.addRec, host = $('#rec_' + k);
    host.insertAdjacentHTML('beforeend', recRow(k, {}));
    const empty = $('#recempty_' + k); if (empty) empty.remove();
    wireDeletes(); const first = host.lastElementChild.querySelector('input,select'); if (first) first.focus();
  }));
  wireDeletes();
  function wireDeletes() {
    $$('button[data-del-rec]').forEach(b => {
      if (b._w) return; b._w = true;
      b.addEventListener('click', async () => {
        const row = b.closest('.rowitem');
        if (b.dataset.id) {
          if (!confirm('Remove this row? It is deleted from the project, not just this week.')) return;
          try { await deleteRecord(b.dataset.delRec, b.dataset.id); } catch (e) { toast('Could not remove that row', true); return; }
        }
        row.remove(); toast('Row removed');
      });
    });
  }
  $('#aiDraft').addEventListener('click', async () => {
    const b = $('#aiDraft'); b.disabled = true;
    $('#assistOut').innerHTML = `<p style="display:flex;gap:10px;align-items:center;margin-top:var(--s-3)">${dots()} Comparing this week with last week…</p>`;
    try {
      const d = collectStatus(); delete d.records; delete d.details;
      const r = await draftNarrative(pid, d);
      $('#assistOut').innerHTML = `
        <div class="sub">Suggested “What moved”</div>
        <div class="letter" style="margin-top:0">${esc(r.narrative)}</div>
        ${r.suggested_band ? `<div class="outlook" style="margin-top:var(--s-3)"><span class="mono muted">SUGGESTED BAND</span>${chip(r.suggested_band === 'Green' ? 'g' : r.suggested_band === 'Red' ? 'r' : 'a', esc(r.suggested_band))}<span class="muted" style="font-size:13px">${esc(r.band_reason)}</span></div>` : ''}
        ${r.flags && r.flags.length ? `<div class="sub">Your Delivery Head will likely ask</div>${r.flags.map(f => `<div class="flag">${ic('flag')}<span>${esc(f)}</span></div>`).join('')}` : ''}
        <div class="actions-row" style="border-top:1px solid var(--rule)"><button class="btn sm" type="button" id="useDraft">${ic('ok')} Use this draft</button>
          ${r.suggested_band ? `<button class="btn sec sm" type="button" id="useBand">Apply band ${esc(r.suggested_band)}</button>` : ''}${srcLine(r)}</div>`;
      $('#useDraft').addEventListener('click', () => { $('#narrative').value = r.narrative; $('#narrative').focus(); toast('Draft placed in “What moved” — edit as you like'); });
      const ub = $('#useBand'); if (ub) ub.addEventListener('click', () => { $('#pm_rag').value = r.suggested_band; if (r.band_reason && !$('#pm_rag_reason').value) $('#pm_rag_reason').value = r.band_reason; toast('Band applied'); });
    } catch (e) { $('#assistOut').innerHTML = '<p class="muted" style="margin-top:var(--s-3)">The assistant could not be reached just now.</p>'; }
    finally { b.disabled = false; }
  });
  $('#stForm').addEventListener('submit', async e => {
    e.preventDefault();
    $$('.err').forEach(x => { x.className = 'err hide'; x.textContent = ''; });
    $$('input.bad,select.bad').forEach(x => x.classList.remove('bad'));
    const payload = collectStatus();
    const b = $('#stSave'); b.disabled = true; b.textContent = 'Saving…';
    try {
      const r = await saveStatus(pid, payload);
      toast(r.health ? `Saved · computed health ${r.health.index} (${r.health.stateName})` : 'Status saved');
      State.brief = null; delete State.analysis[pid];
      await viewStatus({ projectId: pid, week: payload.week_ending });
    } catch (err) {
      const f = err.payload && err.payload.fields;
      if (f) Object.keys(f).forEach(k => { const el = $('#' + k), e2 = $('#' + k + '_e'); if (el) el.classList.add('bad'); if (e2) { e2.textContent = f[k]; e2.className = 'err'; } });
      toast(f ? 'Please fix the highlighted fields' : (err.payload && err.payload.message) || 'Could not save', true);
      b.disabled = false; b.innerHTML = ic('ok') + ' Save this week';
    }
  });
}
