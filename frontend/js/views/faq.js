/* How it works / FAQ screen: every rule and formula, read from the server so it always matches
   the code that computes the numbers.  API: api/meta.api.js (getFaq) */
import { esc } from '../core/dom.js';
import { isNil } from '../core/format.js';
import { FX } from '../core/formulas.js';
import { ic } from '../core/icons.js';
import { getFaq } from '../api/meta.api.js';
import { setMain, setTools } from './shell.js';

/* ================================================================ how it works / FAQ */
export async function viewFaq() {
  const d = await getFaq();
  const L = d.health.labels, Wt = d.health.weights;
  const f = v => isNil(v) ? '—' : v;
  const qa = [
    ['Who fills what, and how often?', 'The project manager fills the weekly status (Weekly status screen) or uploads the project workbook, every week. Effort is entered week by week — or filled from an uploaded timesheet. The auditor raises non-conformances and reviews quality reports. The PMO administrator sets weights and baseline limits. Nobody types a health score.'],
    ['Where does the health score come from?', 'It is calculated from the project data — milestones, weekly effort, RAID log, defects, PCI audits, NCs and billing — measured against the organisation baseline. Hover any health figure to see why it is what it is, or open the project and look at "What makes up the score".'],
    ['Why is my effort variance positive?', 'More hours have been booked than planned. To date = all weekly actual hours ÷ all weekly planned hours. Check that planned hours are entered each week, and that timesheets cover the right project.'],
    ['What does net margin mean, and when is it a loss?', FX.nm + ' Margin at bid is what was planned when the order was won; the forecast margin is the PM\'s view of the final figure.'],
    ['Are SPI and CPI required?', 'No. They are optional. If you track earned value, enter them; the score uses them as two signals. If you leave them blank the score uses the other signals.'],
    ['Do I have to give function points or total requirements?', 'No — size (FP), requirements added and requirement changes are optional. Agile projects can record story points planned, completed and the backlog each week instead; DCC shows velocity and weeks of backlog.'],
    ['How do weekly entries become "to date" figures?', 'Every week\'s hours are added up. The backlog is the latest week\'s figure, not a sum. Effort variance and EVb use these totals; EVb compares with the baseline pro-rated to date.'],
    ['What happens when I upload a timesheet?', 'Each row adds to that week\'s actual hours and to the phase its activity belongs to. Re-uploading the same person and day replaces it. Planned hours you entered are kept. If a project already has a starting total from before weekly tracking began, enter it once as an opening-balance week.'],
    ['How do I see what was reported in an earlier week?', 'History & compare. The whole project is saved at the end of each week whenever anything is reported, and every Monday. Pick a week to see it as it stood, or compare two weeks to see exactly what changed.'],
    ['Why is the IAD sheet now part of RAID?', 'Risks, assumptions, issues and dependencies are one register, the RAID log, with a Type column. The earlier IAD sheet still uploads; its rows become RAID issues or dependencies.'],
    ['What can the auditor do, and what do I do with an NC?', 'The auditor raises a non-conformance on a project and assigns it to the PM. The PM records the action taken and requests closure; the auditor verifies and closes it, or reopens it. Everyone above the PM sees the status. Open NCs lower the Process compliance part of the health score.'],
    ['How do quality reports work?', 'The auditor publishes a template. The PM downloads it, fills it for the project and uploads it — each upload is a new version. The auditor marks it Accepted or Rework requested with a comment, and can upload a reviewed version back.']
  ];
  setMain(`
    <div class="pagehead"><span class="eyebrow">Help</span><h1>How it works</h1>
      <p class="lede">Every number in DCC, how it is calculated, and the questions people ask most. The tables below are read from the live system, so they always match what the screens show.</p></div>
    <section class="blk"><div class="sh"><span class="n">1</span><h2>The health score</h2></div>
      <p style="max-width:80ch">${esc(FX.health)}</p>
      <div class="tblwrap" style="margin-top:12px"><table class="tight"><thead><tr><th>Component</th><th class="r">Weight</th><th>What it looks at</th></tr></thead><tbody>
        <tr><td>${esc(L.schedule)}</td><td class="r">${Wt.schedule}%</td><td>Schedule variance (SVb), milestones finished on their plan date, the worst open slip, open milestones past their plan end, SPI if given</td></tr>
        <tr><td>${esc(L.effort_cost)}</td><td class="r">${Wt.effort_cost}%</td><td>Effort variance against the baseline (EVb), net margin against the baseline, CPI if given</td></tr>
        <tr><td>${esc(L.quality)}</td><td class="r">${Wt.quality}%</td><td>Defect rate, defect removal efficiency, testing efficiency, review effectiveness, defect rate by phase; SLA breaches on AMC</td></tr>
        <tr><td>${esc(L.risk)}</td><td class="r">${Wt.risk}%</td><td>Open RAID risks weighted by probability × impact and age, open issues and dependencies by age, items not followed up in 14 days</td></tr>
        <tr><td>${esc(L.compliance)}</td><td class="r">${Wt.compliance}%</td><td>Latest PCI audit score, open non-conformances (Major −15, Minor −6, Observation −2, −5 more if past due)</td></tr>
        <tr><td>${esc(L.billing_people)}</td><td class="r">${Wt.billing_people}%</td><td>Billing past its date, timesheet compliance, over-allocation and resignations</td></tr>
      </tbody></table></div>
      <div class="banner">${ic('info')}<div><strong>One scoring rule for every baseline metric.</strong> At or better than the goal = 100. Between the goal and a control limit = 100 down to 75. Outside LSL or USL = 59 or less. A signal with no data is left out; a component with no data at all scores 70 — unknown, not good. ${d.health.bands.green}+ On track · ${d.health.bands.amber}–${d.health.bands.green - 1} Watch · below ${d.health.bands.amber} Intervene.</div></div></section>
    <section class="blk"><div class="sh"><span class="n">2</span><h2>Dashboard measures</h2></div>
      <div class="tblwrap"><table class="tight"><thead><tr><th>Measure</th><th>How it is calculated</th></tr></thead><tbody>
        ${[['Effort variance', 'ev'], ['Net margin', 'nm'], ['Budget used', 'budget_used'], ['Planned vs actual', 'pva'], ['Velocity', 'velocity'], ['Backlog', 'backlog'], ['Slip', 'slip'], ['Open risks', 'risks'], ['Open issues & dependencies', 'iad'], ['Open NCs', 'ncs'], ['SPI', 'spi'], ['CPI', 'cpi'], ['PCI', 'pci'], ['To date', 'cum']].map(([l, k]) => `<tr><td>${l}</td><td>${esc(FX[k])}</td></tr>`).join('')}
      </tbody></table></div></section>
    <section class="blk"><div class="sh"><span class="n">3</span><h2>Process metrics and the baseline</h2><span class="note">1 person-day = ${d.person_day_hours} hours · — = tracked, no limits</span></div>
      <div class="tblwrap"><table class="tight" style="min-width:900px"><thead><tr><th>Metric</th><th>How it is calculated</th><th class="r">LSL</th><th class="r">Goal</th><th class="r">USL</th></tr></thead><tbody>
        ${d.metrics.map(m => `<tr><td>${esc(m.label)}</td><td style="font-size:12.5px">${esc(m.formula)}${m.unit !== '%' ? ` <span class="muted">(${esc(m.unit)})</span>` : ''}</td><td class="r">${f(m.lsl)}</td><td class="r">${f(m.goal)}</td><td class="r">${f(m.usl)}</td></tr>`).join('')}
      </tbody></table></div></section>
    <section class="blk"><div class="sh"><span class="n">4</span><h2>Weekly effort and timesheets</h2></div>
      <div class="tblwrap"><table class="tight"><thead><tr><th>Weekly field</th><th>To date</th><th>Notes</th></tr></thead><tbody>
        ${d.weekly.map(x => `<tr><td>${esc(x.label)}</td><td>${x.agg === 'last' ? 'Latest week' : 'Sum of the weeks'}</td><td class="muted" style="font-size:12.5px">${esc(x.hint || '')}${x.optional ? ' Optional.' : ''}</td></tr>`).join('')}
      </tbody></table></div>
      <p style="margin-top:10px;font-size:14px"><b>Timesheet activities:</b> ${d.phases.map(p => `${esc(p)} → ${['actual'].concat((d.phase_map[p] || []).map(k => k.replace(/_hrs$/, '').replace(/_/g, ' '))).join(' + ')}`).join(' · ')}</p></section>
    <section class="blk"><div class="sh"><span class="n">5</span><h2>Questions people ask</h2></div>
      ${qa.map(([q, a]) => `<details class="faq"><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('')}</section>`);
  setTools('');
}
