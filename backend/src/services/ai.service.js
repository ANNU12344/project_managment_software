/* Intelligence layer: portfolio brief, project diagnosis, narrative draft, escalation letter and
 * free-form questions. Falls back to rule-based insight when Azure OpenAI is not configured.
 */
const M = require('../models');
const I = require('./insights.service');
const AI = require('../integrations/azure-openai');
const config = require('../config');
const portfolioService = require('./portfolio.service');
const projectService = require('./project.service');
const { AppError, forbidden } = require('../utils/errors');

const briefCache = new Map();            // key -> { at, out }; a brief is stable within a reporting week
const BRIEF_TTL = 20 * 60 * 1000;

async function status() {
  const pr = await AI.probe();
  return { configured: I.configured(), reachable: pr.reachable, error: pr.error, model: I.configured() ? config.ai.deployment : null };
}

async function brief(user, refresh) {
  const ps = await portfolioService.portfolio(user);
  const key = user.id + ':' + ps.map(p => p.id + p.health + p.week_ending + p.open_deps).join('|');
  const hit = briefCache.get(key);
  if (hit && !refresh && Date.now() - hit.at < BRIEF_TTL) return Object.assign({ cached: true }, hit.out);
  const out = await I.brief(user, ps, await portfolioService.portfolioExtras(user, ps));
  out.generated_at = new Date().toISOString();
  if (out.source === 'ai') briefCache.set(key, { at: Date.now(), out });
  return out;
}

/* project detail + its portfolio row; a project outside scope reads as 'not_available' */
async function projectContext(user, id) {
  let d;
  try { d = await projectService.projectDetail(user, id); }
  catch (e) { if (e instanceof AppError) throw new AppError(e.status, 'not_available'); throw e; }
  const row = (await portfolioService.portfolio(user)).find(p => p.id === d.project.id);
  return { d, row };
}

async function analyse(user, id) {
  const c = await projectContext(user, id);
  const out = await I.analyse(user, c.row, c.d);
  await M.AuditLog.log(user.id, 'ai.analyse', 'project', c.d.project.id, { source: out.source });
  return Object.assign({ generated_at: new Date().toISOString() }, out);
}

async function narrative(user, id, draft) {
  const c = await projectContext(user, id);
  if (!c.d.can_edit) throw forbidden();
  return I.narrative(user, c.row, c.d, draft || {});
}

async function escalation(user, id) {
  const c = await projectContext(user, id);
  const out = await I.escalation(user, c.row, c.d);
  await M.AuditLog.log(user.id, 'ai.escalation', 'project', c.d.project.id, { source: out.source });
  return out;
}

/* Streams answer fragments through onText; throws on failure. */
async function ask(user, question, history, onText, signal) {
  const ps = await portfolioService.portfolio(user);
  await I.ask(user, ps, await portfolioService.portfolioExtras(user, ps), question, history, onText, signal);
  await M.AuditLog.log(user.id, 'ai.ask', 'ai', null, { q: question.slice(0, 200) });
}

/* map an AI failure to the code the front end shows */
const askErrorCode = e => e.code === 'ai_not_configured' ? 'not_configured'
  : (e.code === 'ai_http_401' || e.code === 'ai_http_403') ? 'denied' : 'unavailable';

module.exports = { status, brief, analyse, narrative, escalation, ask, askErrorCode };
