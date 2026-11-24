/* Close helpers for drawer / Ask / modal; scrim click and Escape key (side effect on import). */
import { $ } from '../core/dom.js';

/* ================================================================ project drawer */
export function closeDrawer() { $('#drawer').className = 'drawer'; if (!$('#ask').classList.contains('on')) $('#scrim').className = ''; }
export function closeAsk() { $('#ask').className = 'drawer'; if (!$('#drawer').classList.contains('on')) $('#scrim').className = ''; }
export function closeModal() { $('#modal').className = ''; }
export function closeAll() { ['#drawer', '#ask'].forEach(s => { const el = $(s); if (el) el.className = 'drawer'; }); const sc = $('#scrim'); if (sc) sc.className = ''; closeModal(); }
$('#scrim').addEventListener('click', () => { closeDrawer(); closeAsk(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') { if ($('#modal').classList.contains('on')) closeModal(); else { closeDrawer(); closeAsk(); } } });
