/* Bottom toast message. */
import { $ } from '../core/dom.js';

export function toast(msg, bad) {
  const t = $('#toast'); t.textContent = msg; t.className = 'on' + (bad ? ' bad' : '');
  clearTimeout(toast._t); toast._t = setTimeout(() => t.className = '', 3400);
}
