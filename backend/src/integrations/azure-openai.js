/* Azure OpenAI client — the only file that talks to a model.
 *
 * AZURE_OPENAI_ENDPOINT     https://<resource>.openai.azure.com
 * AZURE_OPENAI_DEPLOYMENT   deployment name, e.g. gpt-4.1
 * AZURE_OPENAI_API_VERSION  optional, defaults below
 * AZURE_OPENAI_API_KEY      optional. Without it the app authenticates with Entra ID:
 *                           the App Service managed identity in Azure, `az login` on a laptop.
 *
 * Nothing else in the app knows which model or provider sits behind this file.
 */
const config = require('../config');
const ENDPOINT = config.ai.endpoint;
const DEPLOYMENT = config.ai.deployment;
const API_VERSION = config.ai.apiVersion;
const API_KEY = config.ai.apiKey;
const TIMEOUT_MS = config.ai.timeoutMs;

/* After a refusal or an outage, stop calling for a while so screens fall back to
   rule-based insight at once instead of waiting on a timeout every time. */
let blockedUntil = 0, blockedCode = null;
const block = (code, ms) => { blockedUntil = Date.now() + ms; blockedCode = code; };

let credential = null;
async function authHeaders() {
  if (API_KEY) return { 'api-key': API_KEY };
  if (!credential) {
    const { DefaultAzureCredential } = require('@azure/identity');
    credential = new DefaultAzureCredential();
  }
  const t = await credential.getToken('https://cognitiveservices.azure.com/.default');
  return { Authorization: 'Bearer ' + t.token };
}

const configured = () => !!(ENDPOINT && DEPLOYMENT);
const url = () => `${ENDPOINT}/openai/deployments/${encodeURIComponent(DEPLOYMENT)}/chat/completions?api-version=${API_VERSION}`;

async function post(body, signal, force) {
  if (!configured()) { const e = new Error('ai_not_configured'); e.code = 'ai_not_configured'; throw e; }
  if (!force && Date.now() < blockedUntil) { const e = new Error(blockedCode); e.code = blockedCode; throw e; }
  let r;
  try {
    r = await fetch(url(), {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, await authHeaders()),
      body: JSON.stringify(body),
      signal: signal || AbortSignal.timeout(TIMEOUT_MS)
    });
  } catch (err) {
    if (!(signal && signal.aborted)) block('ai_unreachable', 60 * 1000);
    const e = new Error('ai_unreachable'); e.code = 'ai_unreachable'; e.detail = String(err && err.message); throw e;
  }
  if (!r.ok) {
    const text = await r.text().catch(() => '');
    const e = new Error(`ai_http_${r.status}`); e.code = 'ai_http_' + r.status; e.detail = text.slice(0, 500);
    if (r.status === 401 || r.status === 403) block(e.code, 5 * 60 * 1000);
    else if (r.status === 429 || r.status >= 500) block(e.code, 30 * 1000);
    throw e;
  }
  blockedUntil = 0;
  return r;
}

/* One-shot completion. With json:true the model is held to a JSON object and the
   parsed object is returned. */
async function complete({ system, user, json, maxTokens, temperature }) {
  const r = await post({
    messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
    temperature: temperature === undefined ? 0.3 : temperature,
    max_tokens: maxTokens || 1200,
    ...(json ? { response_format: { type: 'json_object' } } : {})
  });
  const j = await r.json();
  const text = (j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || '';
  return json ? JSON.parse(text) : text;
}

/* Streamed chat. Calls onDelta(text) for each fragment as it arrives. */
async function stream({ system, messages, maxTokens, temperature }, onDelta, signal) {
  const r = await post({
    messages: [{ role: 'system', content: system }].concat(messages),
    temperature: temperature === undefined ? 0.3 : temperature,
    max_tokens: maxTokens || 1200,
    stream: true
  }, signal);
  const decoder = new TextDecoder();
  let buf = '';
  for await (const chunk of r.body) {
    buf += decoder.decode(chunk, { stream: true });
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
      if (!line.startsWith('data:')) continue;
      const data = line.slice(5).trim();
      if (data === '[DONE]') return;
      try {
        const j = JSON.parse(data);
        const d = j.choices && j.choices[0] && j.choices[0].delta && j.choices[0].delta.content;
        if (d) onDelta(d);
      } catch (e) { /* keep-alive or partial frame */ }
    }
  }
}

/* A one-token call, cached for five minutes, so the UI can say whether the model is
   actually reachable rather than merely configured. */
let probeAt = 0, probeOut = null;
async function probe() {
  if (!configured()) return { reachable: false, error: null };
  if (probeOut && Date.now() - probeAt < 5 * 60 * 1000) return probeOut;
  try {
    await post({ messages: [{ role: 'user', content: 'ok' }], max_tokens: 1 }, AbortSignal.timeout(15000), true);
    probeOut = { reachable: true, error: null };
  } catch (e) {
    probeOut = { reachable: false, error: e.code === 'ai_http_401' || e.code === 'ai_http_403' ? 'access denied (' + e.code.slice(-3) + ')' : (e.code || 'unreachable') };
  }
  probeAt = Date.now();
  return probeOut;
}

module.exports = { configured, complete, stream, probe, model: () => DEPLOYMENT };
