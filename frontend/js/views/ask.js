/* Ask DCC chat drawer: plain-language questions about the portfolio, answered from what the
   user's role can see. The answer streams in word by word (server-sent events).  API: api/ai.api.js */
import { $, $$, esc } from '../core/dom.js';
import { ROLE_LABEL } from '../core/constants.js';
import { plural } from '../core/format.js';
import { dots, ic } from '../core/icons.js';
import { md } from '../core/markdown.js';
import { State } from '../core/state.js';
import { askQuestion } from '../api/ai.api.js';
import { aiStatus } from './ai-brief.js';
import { closeAsk, closeDrawer } from '../components/overlays.js';

/* what to show for each error code the server streams back */
const ASK_ERRORS = {
  not_configured: 'The AI service is not configured on this server yet, so I cannot answer questions. The rule-based brief and diagnosis still work.',
  denied: 'The AI service refused access. An Azure administrator needs to grant this app the **Cognitive Services OpenAI User** role on the model resource. Until then the brief and diagnosis run on rules.',
  unavailable: 'The AI service could not be reached just now. Please try again in a moment.'
};

/* ================================================================ Ask DCC */
export function askSuggestions() {
  const r = State.user.role;
  if (r === 'pm') return ['What will my Delivery Head ask me about this week?', 'Which of my client items is oldest, and what does it block?', 'Is my reported band consistent with my numbers?', 'Summarise my projects in three lines'];
  return ['Which projects are most likely to miss their next milestone?', 'How much billing is held by clients, and by whom?', 'Where is margin eroding against bid?', 'Which PM reports look inconsistent with the numbers?', 'Draft three talking points for my Monday review'];
}
export function openAsk() {
  closeDrawer();
  const a = $('#ask');
  a.innerHTML = `
    <div class="ahead"><button class="close" type="button" id="askClose" aria-label="Close">${ic('x')}</button>
      <span class="eyebrow">${ic('spark')} DCC Intelligence</span><h2>Ask DCC</h2>
      <p>Answers come only from the projects your role can see — ${plural(State.portfolio.length, 'project')} as ${esc(ROLE_LABEL[State.user.role])}.</p></div>
    <div class="msgs" id="askMsgs"></div>
    <div class="foot" id="askFoot"></div>
    <form class="ain" id="askForm"><textarea id="askQ" placeholder="Ask about health, milestones, clients, margin…" aria-label="Question" rows="1"></textarea>
      <button class="btn" type="submit" id="askSend" aria-label="Send">${ic('send')}</button></form>`;
  a.className = 'drawer on'; $('#scrim').className = 'on';
  $('#askClose').addEventListener('click', closeAsk);
  paintAsk();
  aiStatus().then(s => { $('#askFoot').textContent = s.reachable ? `Model · ${s.model} on Azure OpenAI · answers can be wrong; check the figures before you act.` : s.configured ? `The AI service is configured but not reachable (${s.error || 'unknown'}).` : 'The AI service is not configured on this server.'; });
  $('#askForm').addEventListener('submit', e => { e.preventDefault(); sendAsk($('#askQ').value); });
  $('#askQ').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendAsk($('#askQ').value); } });
  setTimeout(() => $('#askQ').focus(), 50);
}
export function paintAsk() {
  const host = $('#askMsgs'); if (!host) return;
  if (!State.ask.length) {
    host.innerHTML = `<span class="eyebrow" style="color:var(--ink-3)">Try asking</span><div class="sugg" style="margin-top:var(--s-3)">${askSuggestions().map(q => `<button type="button" data-q="${esc(q)}">${esc(q)}</button>`).join('')}</div>`;
    $$('[data-q]').forEach(b => b.addEventListener('click', () => sendAsk(b.dataset.q)));
    return;
  }
  host.innerHTML = State.ask.map(m => m.role === 'user' ? `<div class="q">${esc(m.content)}</div>` : `<div class="a">${m.pending && !m.content ? `<p style="display:flex;gap:10px;align-items:center" class="muted">${dots()} Reading the portfolio…</p>` : md(m.content)}</div>`).join('');
  host.scrollTop = host.scrollHeight;
}
export async function sendAsk(q) {
  q = String(q || '').trim(); if (!q || State.asking) return;
  State.asking = true; $('#askQ').value = ''; $('#askSend').disabled = true;
  const history = State.ask.filter(m => !m.pending && !m.error).map(m => ({ role: m.role, content: m.content }));
  State.ask.push({ role: 'user', content: q });
  const ans = { role: 'assistant', content: '', pending: true };
  State.ask.push(ans); paintAsk();
  try {
    let last = 0;
    await askQuestion(q, history, o => {
      if (o.t) ans.content += o.t;
      if (o.error) { ans.error = true; ans.content = ASK_ERRORS[o.error] || ASK_ERRORS.unavailable; }
      if (Date.now() - last > 60) { last = Date.now(); paintAsk(); }     // repaint at most ~16 times a second
    });
  } catch (e) {
    if (e.status === 401) return;                // the login screen is already showing
    ans.error = true; ans.content = 'The connection dropped before the answer finished.';
  }
  ans.pending = false; State.asking = false; paintAsk();
  const s = $('#askSend'); if (s) s.disabled = false;
}
