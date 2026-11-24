/* Number, date and text formatting helpers. */
import { esc } from './dom.js';
import { HN } from './constants.js';

export const isNil = v => v === null || v === undefined || v === '';
export const inr = v => isNil(v) ? '—' : '₹' + Number(v).toFixed(1) + ' Cr';
export const pct = v => isNil(v) ? '—' : Number(v).toFixed(1) + '%';
export const n2 = v => isNil(v) ? '—' : Number(v).toFixed(2);
export const bandOf = v => isNil(v) ? 'n' : v >= 80 ? 'g' : v >= 60 ? 'a' : 'r';
export const chip = (s, label) => `<span class="chip ${s || 'n'}"><i></i>${label || HN[s] || 'No report'}</span>`;
// const fmtDate = d => { if (!d) return '—'; const x = new Date(d); return isNaN(x) ? d : x.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }); };
export const fmtDate = d => { if (!d) return '—'; const x = new Date(d); if (isNaN(x)) return d; return String(x.getDate()).padStart(2, '0') + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + x.getFullYear(); };
// const fmtShort = d => { if (!d) return ''; const x = new Date(d); return isNaN(x) ? d : x.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }); };
export const fmtShort = d => { if (!d) return ''; const x = new Date(d); if (isNaN(x)) return d; return String(x.getDate()).padStart(2, '0') + '-' + String(x.getMonth() + 1).padStart(2, '0'); };

export const fmtTime = d => { if (!d) return ''; const x = new Date(d); return x.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }); };
export const daysBetween = (a, b) => (!a || !b) ? 0 : Math.round((new Date(b) - new Date(a)) / 86400000);
export const todayISO = () => new Date().toISOString().slice(0, 10);
export const plural = (n, w, ws) => `${n} ${n === 1 ? w : (ws || w + 's')}`;
export const tip = html => `data-tip="${esc(html)}"`;
