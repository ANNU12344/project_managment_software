/* Downloadable status packs.
 * Built from the same role-scoped, redacted rows the screens show, so a download can
 * never carry a field the person could not see on screen.
 */
const XLSX = require('xlsx');
const PD = require('../domain/project-details');
const MX = require('../domain/metrics');
const STATUS_TXT = { within: 'Within limits', below: 'Below LSL', above: 'Above USL', tracked: 'Tracked (no limits)', nodata: 'No data' };

const STATE = { g: 'On track', a: 'Watch', r: 'Intervene' };
// const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
/* Dates go out as DD-MM-YYYY (2026-11-11 → 11-11-2026). Stored values stay ISO. Azure SQL can
   hand back Date objects rather than strings, so both are handled; anything else passes through. */
const dmy = v => {
  if (v === null || v === undefined || v === '') return v;
  const iso = v instanceof Date ? (isNaN(v) ? '' : v.toISOString().slice(0, 10)) : String(v).slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : v;
};

function sheet(rows, widths) {
  const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ '': 'Nothing recorded' }]);
  if (widths) ws['!cols'] = widths.map(w => ({ wch: w }));
  return ws;
}

function workbook(sheets) {
  const wb = XLSX.utils.book_new();
  wb.Props = { Title: 'Delivery Command Centre — status pack', Company: 'Uneecops Technologies Limited' };
  for (const [name, ws] of sheets) XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31));
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

function portfolioRows(ps, isPm) {
  return ps.map(p => {
    const r = {
      'Code': p.code, 'Project': p.name, 'Client': p.client, 'Business unit': p.bu,
      'Project manager': p.pm, 'Delivery Head': p.dh,
      'Start date': dmy(p.start_date), 'End date': dmy(p.end_date), 'Stage': p.stage, 'Status': p.status, 'Type': p.project_type,
      'Project value (₹ Cr)': p.contract_value, 'Project budget (₹ Cr)': p.budget_cr, 'Expenses budget (₹ Cr)': p.expenses_budget_cr,
      'Actual cost (₹ Cr)': p.actual_cost_cr, 'Net margin %': p.net_margin_pct,
      'Presales (hrs)': p.presales_hours, 'Budgeted hours': p.budgeted_hours,
      'Planned efforts (hrs)': p.planned_effort_hours, 'Actual efforts (hrs)': p.actual_effort_hours,
      'Effort variance %': p.effort_variance_pct,
      'Health (0-100)': p.health, 'State': STATE[p.state] || 'No report',
      'Trend over snapshots': p.trend && p.trend.length > 1 ? Math.round(p.trend[p.trend.length - 1] - p.trend[0]) : null,
      'SPI': p.spi, 'CPI': p.cpi, '% complete': p.pct_complete, 'Budget consumed %': p.budget_consumed_pct,
      'Next milestone': p.next_milestone, 'Forecast date': dmy(p.next_milestone_date), 'Slip (days)': p.slip_days,
      'Open risks': p.open_risks, 'Open with client': p.open_deps, 'Oldest client item (days)': p.oldest_dep_days,
      'Week ending': dmy(p.week_ending), 'PM band': p.pm_rag, 'PM reason': p.pm_rag_reason
    };
    if (!isPm) Object.assign(r, {
      'Margin at bid %': p.margin_at_bid,
      'Margin at completion %': p.margin_at_completion, 'Billing held by client (₹ Cr)': p.dep_value_blocked,
      'Unbilled WIP (₹ Cr)': p.unbilled_wip, 'Receivable > 90 d (₹ Cr)': p.ar_over_90
    });
    return r;
  });
}

function summaryRows(user, ps, asOf) {
  const rep = ps.filter(p => p.health !== null && p.health !== undefined);
  const avg = rep.length ? Math.round(rep.reduce((s, p) => s + p.health, 0) / rep.length) : null;
  const rows = [
    ['Prepared for', `${user.name} (${user.role})`],
    ['As of', dmy(asOf)],
    ['Projects', ps.length],
    ['Average health', avg],
    ['Intervene', ps.filter(p => p.state === 'r').length],
    ['Watch', ps.filter(p => p.state === 'a').length],
    ['On track', ps.filter(p => p.state === 'g').length],
    ['Milestones slipping', ps.filter(p => p.slip_days > 0).length],
    ['Open items with clients', ps.reduce((s, p) => s + (p.open_deps || 0), 0)]
  ];
  if (ps.length) {
    rows.push(['Contract value in view (₹ Cr)', +ps.reduce((s, p) => s + (p.contract_value || 0), 0).toFixed(2)]);
    rows.push(['Billing held by clients (₹ Cr)', +ps.reduce((s, p) => s + (p.dep_value_blocked || 0), 0).toFixed(2)]);
  }
  return rows.map(([k, v]) => ({ 'Measure': k, 'Value': v }));
}

/* One row per project, one column per metric; the status of each sits beside its value. */
function processRows(ps, baseline) {
  return ps.map(p => {
    const r = { 'Code': p.code, 'Project': p.name };
    const ev = MX.evaluate(p, baseline);
    ev.forEach(m => { r[m.label] = m.value; r[m.label + ' — status'] = STATUS_TXT[m.status]; });
    const s = MX.summary(ev);
    r['Within limits'] = s.within; r['Out of limits'] = s.out; r['No data'] = s.nodata;
    return r;
  });
}
function baselineRows(baseline) {
  const B = Object.assign({}, MX.BASELINE, baseline || {});
  return MX.METRICS.map(m => ({ 'Metric': m.label, 'Unit': m.unit, 'LSL': B[m.key].lsl, 'Goal': B[m.key].goal,
    'USL': B[m.key].usl, 'Stdev': B[m.key].sd, 'How calculated': m.formula }));
}

function portfolioPack(user, ps, extra, asOf, isPm) {
  const deps = extra.deps.map(({ p, d, age }) => ({
    'Project': p.code, 'Pending with client': d.description, 'Owner at client': d.owner_at_client,
    'Raised': dmy(d.raised_date), 'Age (days)': age, 'Committed date': dmy(d.committed_date),
    'Milestone blocked': d.milestone_blocked,
    'Value held (₹ Cr)': d.value_blocked,
    'Status': d.status
  }));
  const risks = extra.risks.map(({ p, r, age }) => ({
    'Project': p.code, 'Ref': r.ref, 'Risk': r.description, 'Category': r.category,
    'Probability': r.probability, 'Impact': r.impact, 'Owner': r.owner_name,
    'Mitigation': r.mitigation, 'Age (days)': age, 'Status': r.status
  }));
  return workbook([
    ['Summary', sheet(summaryRows(user, ps, asOf), [34, 28])],
    ['Portfolio status', sheet(portfolioRows(ps, isPm), [13, 34, 34, 16, 16, 16, 12, 12, 14, 10, 18, 12, 12, 12, 12, 10, 10, 12, 13, 13, 11, 12, 11, 12, 7, 7, 11, 13, 30, 13, 10, 10, 12, 14, 12, 9, 40, 12, 14, 14, 14])],
    ['Open with clients', sheet(deps, [13, 44, 34, 12, 10, 14, 12, 12, 16])],
    ['Open risks', sheet(risks, [13, 7, 44, 12, 11, 9, 14, 40, 10, 12])],
    ['Management dashboard', sheet(ps.map(p => ({
      'Project': p.code, 'Project': p.name, 'Stage': p.stage, 'Status': p.status,
      'Effort variance %': p.effort_variance_pct, 'Planned efforts (hrs)': p.planned_effort_hours, 'Actual efforts (hrs)': p.actual_effort_hours,
      'Net margin %': p.net_margin_pct, 'Open defects': p.open_defects, 'Risks open': p.open_risks, 'IAD open': p.open_deps,
      'Upcoming milestone': p.next_milestone, 'Milestone forecast': dmy(p.next_milestone_date), 'Defect rate': p.defect_rate,
      'Milestones completed': (p.milestone_counts || {}).completed, 'Milestones in progress': (p.milestone_counts || {}).in_progress,
      'Milestones yet to start': (p.milestone_counts || {}).yet_to_start, 'Current milestone status': p.current_milestone_status,
      'Latest PCI %': p.pci_score, 'Open NCs': p.pci_open_ncs })), [13, 34, 18, 12, 12, 14, 14, 11, 11, 10, 9, 30, 14, 10, 12, 12, 12, 16, 10, 9])],
    ['Process metrics', sheet(processRows(ps, extra.baseline), [13, 34].concat(MX.METRICS.map(() => 14)))],
    ['Process baseline', sheet(baselineRows(extra.baseline), [44, 18, 10, 10, 10, 10, 70])]
  ]);
}

function projectPack(d) {
  const p = d.project, h = d.health;
  const summary = [
    ['Code', p.code], ['Project', p.name], ['Client', p.client], ['Business unit', p.bu],
    ['Project type', p.project_type], ['Commercial basis', p.commercial_basis],
    ['Project manager', d.pmName], ['Health (0-100)', h ? h.index : null],
    ['State', h ? (STATE[h.state] || h.state) : 'No report'], ['As of week ending', h ? dmy(h.week_ending) : null]
  ];
  summary.push(['Start date', dmy(p.start_date)], ['End date', dmy(p.end_date)], ['Stage', p.stage], ['Status', p.status]);
  PD.FIELDS.filter(f => f.kind === 'num').forEach(f => summary.push([f.label, p[f.key]]));
  const m = PD.metrics(p);
  summary.push(['Effort variance % (actual vs planned)', m.effort_variance_pct], ['Net margin % (value vs actual cost)', m.net_margin_pct]);
  if (!d.isPm) summary.push(['Margin at bid %', p.margin_at_bid]);
  if (h && h.parts) Object.keys(h.parts).forEach(k => summary.push([`Score — ${(h.labels || {})[k] || k} (${h.weights[k]}%)`, h.parts[k]]));
  if (h && h.detail) Object.keys(h.detail).forEach(k => (h.detail[k].basis || []).forEach(b => summary.push([`   ${(h.labels || {})[k] || k} · ${b.label}`, `${b.value} → ${b.score === null ? 'no data' : b.score}`])));

  const pmOnly = !!d.isPm;
  const hist = d.history.map(s => {
    const r = {
      'Week ending': dmy(s.week_ending), 'Health': s.health_index, '% complete': s.pct_complete,
      'Budget consumed %': s.budget_consumed_pct, 'SPI': s.spi, 'CPI': s.cpi,
      'Defects open': s.defects_open, 'Defects leaked': s.defects_leaked, 'SLA breaches': s.sla_breaches,
      'Timesheet %': s.timesheet_compliance, 'PM band': s.pm_rag, 'PM reason': s.pm_rag_reason,
      'What moved': s.narrative, 'Source': s.source
    };
    if (!pmOnly) Object.assign(r, { 'Margin at completion %': s.margin_at_completion, 'Unbilled WIP (₹ Cr)': s.unbilled_wip, 'AR > 90 d (₹ Cr)': s.ar_over_90 });
    return r;
  }).reverse();
  const ms = d.milestones.map(m => ({
    'Milestone': m.name, 'Plan start': dmy(m.plan_start), 'Plan end': dmy(m.baseline_date), 'Forecast start': dmy(m.forecast_start), 'Forecast end': dmy(m.forecast_date),
    'Actual start': dmy(m.actual_start), 'Actual end': dmy(m.actual_date), 'Estimated efforts (hrs)': m.estimated_effort_hrs, 'Actual efforts (hrs)': m.actual_effort_hrs,
    '% completed': m.pct_complete, 'To be invoiced': m.is_billing ? 'Yes' : 'No', 'Status': m.status, 'Sign-off': m.signoff_status,
    'Target date': dmy(m.target_date), 'Remarks': m.remarks || m.slip_reason
  }));
  const rk = d.risks.map(r => ({
    'RAID ID': r.ref, 'Description': r.description, 'Owner': r.owner_name, 'Impact': r.impact, 'Probability': r.probability,
    'Raised': dmy(r.raised_date), 'Target / due': dmy(r.target_date), 'Status': r.status, 'Mitigation / next steps': r.mitigation,
    'Contingency': r.contingency, 'Closed': dmy(r.closed_date)
  }));
  const dp = d.dependencies.map(x => ({
    'ID': x.ref, 'Type': x.iad_type, 'Description': x.description, 'Owner': x.owner_at_client,
    'Raised': dmy(x.raised_date), 'Milestone impacted': x.milestone_blocked,
    'Last follow-up': dmy(x.last_followup_date), 'Follow-up mode': x.followup_mode, 'Closed': dmy(x.closed_date),
    'Value held (₹ Cr)': x.value_blocked, 'Status': x.status
  }));
  const acts = d.actions.map(a => ({
    'ID': a.ref, 'Action': a.title, 'Detail': a.detail, 'Priority': a.priority, 'Due': dmy(a.due_date),
    'Status': a.status, 'Response': a.response
  }));
  return workbook([
    ['Summary', sheet(summary.map(([k, v]) => ({ 'Measure': k, 'Value': v })), [30, 44])],
    ['Weekly history', sheet(hist, [12, 8, 11, 13, 6, 6, 10, 11, 10, 10, 9, 36, 50, 8, 14, 14, 14])],
    ['Milestones', sheet(ms, [6, 34, 12, 12, 12, 11, 10, 34])],
    ['RAID', sheet(rk, [7, 44, 12, 11, 9, 14, 40, 12, 12])],
    ['IAD', sheet(dp, [6, 44, 34, 12, 12, 12, 14, 16])],
    ['Action items', sheet(acts, [20, 40, 40, 9, 12, 12, 36])],
    ['Billing', sheet((d.billing || []).map(b => ({ 'Milestone': b.milestone_name, 'Amount (₹ Cr)': b.amount_cr, 'Billing date': dmy(b.billing_date), 'Status': b.status, 'Remarks': b.remarks })), [36, 12, 12, 12, 40])],
    ['Defects', sheet((d.defects || []).map(x => ({ 'Defect type': x.defect_type, 'Phase injected': x.phase_injected, 'Total': x.total, 'Reopened': x.reopen_count, 'Milestone': x.milestone_name })), [26, 22, 8, 10, 36])],
    ['PCI', sheet((d.pci || []).map(x => ({ 'Audit date': dmy(x.audit_date), 'PCI score %': x.pci_score, 'Open NCs': x.open_ncs })), [12, 12, 10])],
    ['Weekly plan', sheet((d.activities || []).map(a => ({ 'Week ending': dmy(a.week_ending), 'Activity': a.activity, 'This week status': a.this_week_status, 'Next action': a.next_action })), [12, 34, 44, 44])],
    ['Process metrics', sheet((d.metrics || []).map(m => ({
      'Metric': m.label, 'Value': m.value, 'Unit': m.unit, 'LSL': m.lsl, 'Goal': m.goal, 'USL': m.usl,
      'Status': STATUS_TXT[m.status], 'Deviation from goal (σ)': m.z, 'How calculated': m.formula })), [44, 10, 18, 9, 9, 9, 18, 12, 80])]
  ]);
}

module.exports = { portfolioPack, projectPack };
