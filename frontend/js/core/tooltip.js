/* Global hover tooltip for any element with data-tip (side effect on import). */
import { $ } from './dom.js';

/* ================================================================ tooltip */
(function tooltips() {
  const t = $('#tip');
  document.addEventListener('mouseover', e => {
    const el = e.target.closest && e.target.closest('[data-tip]');
    if (!el) { t.className = ''; return; }
    t.innerHTML = el.getAttribute('data-tip'); t.className = 'on';
  });
  document.addEventListener('mousemove', e => {
    if (!t.className) return;
    const w = t.offsetWidth, h = t.offsetHeight;
    let x = e.clientX + 14, y = e.clientY + 14;
    if (x + w > window.innerWidth - 8) x = e.clientX - w - 14;
    if (y + h > window.innerHeight - 8) y = e.clientY - h - 14;
    t.style.left = x + 'px'; t.style.top = y + 'px';
  });
  document.addEventListener('scroll', () => t.className = '', true);
})();
