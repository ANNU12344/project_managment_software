const aiService = require('../services/ai.service');
const { validation } = require('../utils/errors');

/* GET /ai/status */
async function status(req, res) {
  res.json(await aiService.status());
}

/* POST /ai/brief  { refresh? } */
async function brief(req, res) {
  res.json(await aiService.brief(req.user, (req.body || {}).refresh));
}

/* POST /ai/project/:id */
async function analyse(req, res) {
  res.json(await aiService.analyse(req.user, req.params.id));
}

/* POST /ai/narrative/:id  { draft } */
async function narrative(req, res) {
  res.json(await aiService.narrative(req.user, req.params.id, (req.body || {}).draft));
}

/* POST /ai/escalation/:id */
async function escalation(req, res) {
  res.json(await aiService.escalation(req.user, req.params.id));
}

/* POST /ai/ask — server-sent events: {t: text} fragments, then {done: true} or {error} */
async function ask(req, res) {
  const question = String((req.body || {}).question || '').trim();
  if (!question) throw validation();
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();
  const send = o => res.write('data: ' + JSON.stringify(o) + '\n\n');
  const ctrl = new AbortController();
  res.on('close', () => ctrl.abort());
  try {
    await aiService.ask(req.user, question, (req.body || {}).history, t => send({ t }), ctrl.signal);
    send({ done: true });
  } catch (e) {
    if (!ctrl.signal.aborted) send({ error: aiService.askErrorCode(e) });
    if (e.code !== 'ai_not_configured' && !ctrl.signal.aborted) req.log.error('ai.ask failed', { code: e.code, detail: e.detail, err: e });
  }
  res.end();
}

module.exports = { status, brief, analyse, narrative, escalation, ask };
