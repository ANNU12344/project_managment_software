/* Plain-words formula text (the i tips) and the project health tooltip. */
import { esc } from './dom.js';
import { HN } from './constants.js';
import { bandOf, isNil, tip } from './format.js';

/* Every figure's formula in plain words — shown as ⓘ beside labels and in the FAQ. */
export const FX = {
  health: 'Health (0–100) = weighted average of six components, each measured against the organisation baseline: Schedule 25% · Effort & cost 25% · Quality 20% · Risk & dependencies 15% · Process compliance 10% · Billing & people 5%. 80 or more = On track · 60–79 = Watch · below 60 = Intervene. Open the project to see every signal behind it.',
  ev: 'Effort variance % = (Actual hours − Planned hours) ÷ Planned hours × 100. "To date" adds up every weekly entry so far. Positive = more effort than planned (over), negative = less.',
  nm: 'Net margin % (to date) = (Project value − Actual cost to date) ÷ Project value × 100. It shows how much of the order value is still left after what has been spent so far. Negative = the cost is already more than the project value, i.e. a loss.',
  evb: 'EVb % = (Actual hours − Baselined hours) ÷ Baselined hours × 100. With weekly entries the baseline is pro-rated to date. Measured against the baseline limits.',
  defect_rate: 'Defect rate = all defects found ÷ actual effort in person-days (1 person-day = 8 hours).',
  pva: 'Planned vs actual hours to date. Grey bar = planned, coloured bar = actual (red when actual is higher than planned).',
  risks: 'Open risks and assumptions in the RAID log (status not Closed).',
  iad: 'Open issues and dependencies in the RAID log (status not Closed).',
  ncs: 'Open non-conformances raised by the quality auditor (not yet Closed).',
  velocity: 'Velocity = average story points completed per week over the last 4 weeks.',
  backlog: 'Backlog = story points left at the end of the latest week. Weeks of backlog = backlog ÷ velocity.',
  budget_used: 'Budget used % = Actual cost to date ÷ Project budget × 100. Above 100% = the budget is exceeded.',
  margin_bid: 'Margin at bid = the margin planned when the order was won.',
  forecast_margin: "Margin at completion = the PM's weekly forecast of the final margin when the project ends.",
  spi: 'SPI (optional) = Earned value ÷ Planned value. Below 1.00 = behind schedule. Leave blank if you do not track earned value.',
  cpi: 'CPI (optional) = Earned value ÷ Actual cost. Below 1.00 = over cost. Leave blank if you do not track earned value.',
  pci: 'PCI = process compliance score from the latest audit (0–100%).',
  slip: 'Slip = days between the plan end date and the current forecast end date of the next open milestone.',
  upcoming: 'The next open milestone by forecast end date.',
  cum: 'To date = the sum of every weekly entry up to and including that week (backlog: the latest value).',
  open_defects: 'Open defects from the weekly report.',
  milestones: 'Milestones by status: Completed (actual end date given), In progress, On hold, Yet to start.',
  billed: 'Billed = billing rows marked Completed. To bill = billing rows still Open or On-Hold.'
};
export const info = k => FX[k] ? `<span class="ifx" tabindex="0" role="img" aria-label="How this is calculated" ${tip(esc(FX[k]))}>i</span>` : '';
/* why a project's health is what it is (from the portfolio row) */
export function healthTip(p) {
  if (!p || isNil(p.health)) return 'No weekly report yet.';
  const L = p.health_labels || {}, parts = p.health_parts || {};
  return `<b>${esc(p.code)} · Health ${p.health} — ${HN[bandOf(p.health)]}</b><br>` +
    Object.keys(parts).map(k => `${esc(L[k] || k)} ${parts[k]} × ${(p.health_weights || {})[k]}%`).join('<br>') +
    ((p.health_why || []).length ? `<br><b>Held down by:</b> ` + p.health_why.map(w => `${esc(w.component)} ${w.score}${w.signal ? ` (${esc(w.signal)})` : ''}`).join('; ') : '') +
    '<br><i>Open the project for every signal.</i>';
}
