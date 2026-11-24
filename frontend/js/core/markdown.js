/* Minimal, safe markdown renderer for AI output. */
import { esc } from './dom.js';

/* Minimal, safe markdown for model output: escape first, then bold, bullets, tables. */
export function md(src) {
  const inline = s => s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/`([^`]+)`/g, '<code>$1</code>');
  const lines = esc(src).split('\n');
  let out = '', list = null, table = [];
  const flushList = () => { if (list) { out += `<${list.t}>${list.items.map(i => `<li>${inline(i)}</li>`).join('')}</${list.t}>`; list = null; } };
  const flushTable = () => {
    if (!table.length) return;
    const rows = table.filter(r => !/^\|?\s*:?-{2,}/.test(r)).map(r => r.replace(/^\||\|$/g, '').split('|').map(c => inline(c.trim())));
    if (rows.length) out += `<table><thead><tr>${rows[0].map(c => `<th>${c}</th>`).join('')}</tr></thead><tbody>${rows.slice(1).map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
    table = [];
  };
  for (const raw of lines) {
    const l = raw.trim();
    if (l.startsWith('|')) { flushList(); table.push(l); continue; }
    flushTable();
    let m;
    if ((m = l.match(/^[-*•]\s+(.*)/))) { if (!list || list.t !== 'ul') { flushList(); list = { t: 'ul', items: [] }; } list.items.push(m[1]); continue; }
    if ((m = l.match(/^\d+[.)]\s+(.*)/))) { if (!list || list.t !== 'ol') { flushList(); list = { t: 'ol', items: [] }; } list.items.push(m[1]); continue; }
    flushList();
    if (!l) continue;
    const h = l.match(/^#{1,4}\s+(.*)/);
    out += h ? `<p><strong>${inline(h[1])}</strong></p>` : `<p>${inline(l)}</p>`;
  }
  flushList(); flushTable();
  return out;
}
