/* RAID & dependencies screen: every open client issue and dependency in scope, oldest first,
   with the value it blocks.  API: api/portfolio.api.js (getPortfolio, getClientItems) */
import { $, $$, esc } from '../core/dom.js';
import { C, ROLE_LABEL } from '../core/constants.js';
import { chip, daysBetween, fmtDate, inr, plural, todayISO } from '../core/format.js';
import { ic } from '../core/icons.js';
import { getPortfolio, getClientItems } from '../api/portfolio.api.js';
import { bars } from '../charts/bars.js';
import { ageingChart } from '../charts/portfolio.js';
import { State } from '../core/state.js';
import { setMain, setTools } from './shell.js';
import { wireOpeners } from './ai-brief.js';
import { downloadTools, kpi, wireDownloads } from './dashboard.js';
import { openLetter } from './escalation-letter.js';

/* ================================================================ open with clients */
export async function viewClients() {
  const [pf, cl] = await Promise.all([getPortfolio(), getClientItems()]);
  State.portfolio = pf.projects;
  const items = cl.items;
  const blocked = items.reduce((s, x) => s + Number(x.value_blocked || 0), 0);
  const oldest = items.length ? items[0].age : 0;
  const over30 = items.filter(x => x.age > 30).length;
  const stale = items.filter(x => !x.last_followup_date || daysBetween(x.last_followup_date, todayISO()) > 7).length;
  const issues = items.filter(x => x.iad_type === 'Issue').length;
  const owners = {};
  items.forEach(x => { const k = x.owner_at_client || 'No named owner'; owners[k] = owners[k] || { n: 0, v: 0, max: 0 }; owners[k].n++; owners[k].v += Number(x.value_blocked || 0); owners[k].max = Math.max(owners[k].max, x.age); });
  const ownerRows = Object.keys(owners).map(k => [k.length > 34 ? k.slice(0, 33) + '…' : k, owners[k].max, owners[k].max > 30 ? C.bad : owners[k].max > 14 ? C.warn : C.blue, `<b>${esc(k)}</b><br>${plural(owners[k].n, 'item')} · oldest ${owners[k].max} days${owners[k].v ? ' · ' + inr(owners[k].v) + ' held' : ''}`]).sort((a, b) => b[1] - a[1]).slice(0, 7);
  setMain(`
    <div class="pagehead"><span class="eyebrow">${ROLE_LABEL[State.user.role]}</span><h1>Issues &amp; dependencies</h1>
      <p class="lede">Every open issue and dependency (IAD) across your projects — who owns it, how old it is, what it holds up and when it was last followed up.</p></div>
    <div class="kpis">
      ${kpi('Open items', String(items.length), `${plural(new Set(items.map(x => x.code)).size, 'project')} affected`, items.length ? 'dn' : 'up')}
      ${kpi('Billing held', blocked.toFixed(1), '₹ Cr behind client inputs', blocked ? 'dn' : '', null, 'Cr')}
      ${kpi('Oldest item', String(oldest), 'days open', oldest > 30 ? 'dn' : '', null, 'd')}
      ${kpi('No follow-up in 7 days', String(stale), `${issues} issues · ${items.length - issues} dependencies · ${over30} older than 30 days`, stale ? 'dn' : 'up')}
    </div>
    ${items.length ? `<div class="grid2">
      <div><span class="eyebrow">01 · Ageing</span><h3>How long items have been open</h3><div class="cap">Older than 30 days is marked — past that point it is an escalation, not a follow-up.</div>${ageingChart(items)}<div class="source">Source · client dependency register, raised date to today</div></div>
      <div><span class="eyebrow">02 · Owners</span><h3>Who the portfolio is waiting on</h3><div class="cap">Oldest open item per client-side owner, in days.</div>${bars(ownerRows, null, ' d')}</div>
    </div>
    <section class="blk"><div class="sh"><span class="n">03</span><h2>Every open item</h2><span class="note">Oldest first · “Draft letter” writes a formal follow-up to the named owners</span></div>
      <div class="tblwrap"><table><thead><tr><th>Project</th><th>Type</th><th>Issue / dependency</th><th>Owner</th><th class="r">Age</th><th>Impacts</th><th class="r">Value held</th><th>Last follow-up</th><th>Status</th><th></th></tr></thead><tbody>
      ${items.map(x => `<tr><td class="nw"><a href="#" data-open="${x.project_id}">${esc(x.code)}</a></td>
          <td>${chip(x.iad_type === 'Issue' ? 'r' : 'b', esc(x.iad_type || 'Dependency'))}</td>
          <td><span class="wrap">${esc(x.description)}</span></td><td><span class="wrap">${esc(x.owner_at_client || '—')}</span></td>
          <td class="r ${x.age > 30 ? 'bad' : x.age > 14 ? 'warn' : ''}" style="font-weight:${x.age > 14 ? 600 : 400}">${x.age} d</td>
          <td>${esc(x.milestone_blocked || '—')}</td><td class="r">${x.value_blocked ? inr(x.value_blocked) : '—'}</td>
          <td class="nw${!x.last_followup_date || daysBetween(x.last_followup_date, todayISO()) > 7 ? ' bad' : ''}">${x.last_followup_date ? fmtDate(x.last_followup_date) + (x.followup_mode ? `<span class="subl">${esc(x.followup_mode)}</span>` : '') : 'none'}</td>
          <td>${chip(x.age > 30 ? 'r' : x.age > 14 ? 'a' : 'n', esc(x.status))}</td>
          <td><button class="btn sec sm" type="button" data-letter="${x.project_id}" data-code="${esc(x.code)}">${ic('mail')} Draft letter</button></td></tr>`).join('')}
      </tbody></table></div></section>` : '<div class="empty">Nothing is currently pending with any client. Any slip right now is ours.</div>'}`);
  setTools(downloadTools());
  wireDownloads(); wireOpeners($('#main'));
  $$('a[data-open]').forEach(a => a.addEventListener('click', e => e.preventDefault()));
  $$('[data-letter]').forEach(b => b.addEventListener('click', () => openLetter(b.dataset.letter, b.dataset.code)));
}
