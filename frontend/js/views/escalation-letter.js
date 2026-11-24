/* Client escalation letter: a draft letter about overdue client dependencies, shown in a modal
   for the user to review and copy.  API: api/ai.api.js (draftEscalation) */
import { $, esc } from '../core/dom.js';
import { dots, ic } from '../core/icons.js';
import { toast } from '../components/toast.js';
import { draftEscalation } from '../api/ai.api.js';
import { srcLine } from './ai-brief.js';
import { closeModal } from '../components/overlays.js';

/* ---------- client escalation letter ---------- */
export async function openLetter(pid, code) {
  const m = $('#modal');
  m.innerHTML = `<div id="mscrim" style="position:absolute;inset:0;background:rgba(16,22,29,.4)"></div><div class="mbox" role="dialog" aria-modal="true" aria-labelledby="m-title" style="position:relative">
    <div class="mhead"><div><span class="eyebrow">${ic('spark')} ${esc(code)} · Client letter</span><h3 id="m-title">Drafting a formal follow-up</h3></div><button type="button" id="mClose" aria-label="Close">${ic('x')}</button></div>
    <div class="mbody" id="mBody"><p style="display:flex;gap:var(--s-3);align-items:center">${dots()} Writing to the named owners at the client, item by item…</p></div></div>`;
  m.className = 'on';
  $('#mClose').addEventListener('click', closeModal); $('#mscrim').addEventListener('click', closeModal);
  try {
    const r = await draftEscalation(pid);
    $('#m-title').textContent = 'Draft ready to review';
    $('#mBody').innerHTML = `${srcLine(r)}<div class="letter"><span class="subj">${esc(r.subject)}</span>${esc(r.body)}</div>
      <p class="muted" style="font-size:12.5px;margin-top:var(--s-3)">Review before sending. Nothing is sent from here.</p>`;
    m.querySelector('.mbox').insertAdjacentHTML('beforeend', `<div class="mfoot"><button class="btn" type="button" id="mCopy">${ic('copy')} Copy letter</button>
      <a class="btn sec" href="mailto:?subject=${encodeURIComponent(r.subject)}&body=${encodeURIComponent(r.body)}">${ic('mail')} Open in email</a>
      <button class="btn sec" type="button" id="mDl">${ic('download')} Save as .txt</button></div>`);
    $('#mCopy').addEventListener('click', async () => { try { await navigator.clipboard.writeText(r.subject + '\n\n' + r.body); toast('Letter copied'); } catch (e) { toast('Copy failed — select the text instead', true); } });
    $('#mDl').addEventListener('click', () => {
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([r.subject + '\n\n' + r.body], { type: 'text/plain' }));
      a.download = `${code}-client-letter.txt`; document.body.appendChild(a); a.click(); setTimeout(() => a.remove(), 0);
    });
  } catch (e) { $('#mBody').innerHTML = '<p>The letter could not be drafted just now.</p>'; }
}
