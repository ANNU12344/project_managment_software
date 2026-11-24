/* HTTP client for the DCC backend (/api).
 *
 * Every call to the server goes through this file, so errors are handled the same way everywhere:
 *   - 401 (signed out / session expired) -> the handler set with onUnauthorized() runs (shows the login screen)
 *   - any other non-2xx                  -> throws ApiError with the server's { error, message, fields, errors }
 *   - network failure                    -> throws ApiError with code 'network_error'
 *
 * Views never call fetch() directly; they call the functions in js/api/*.api.js, which mirror the
 * backend route files (backend/src/routes/*.routes.js) one to one.
 */

const BASE = '/api';

/* Error thrown for any failed call. `code` is the server's `error` field (e.g. 'validation', 'forbidden'). */
export class ApiError extends Error {
  constructor(status, payload, requestId) {
    const p = payload || {};
    super(p.error || (status ? 'request_failed' : 'network_error'));
    this.name = 'ApiError';
    this.status = status;                    // HTTP status, 0 when the server could not be reached
    this.code = this.message;                // same as message, kept for readability
    this.payload = p;                        // full body: { error, message?, fields?, errors?, count? }
    this.requestId = p.request_id || requestId || null;
  }
}

/* A readable sentence for any ApiError, for toasts and banners. */
export function errorMessage(err, fallback) {
  if (!err) return fallback || 'Something went wrong.';
  const p = err.payload || {};
  if (p.message) return p.message;
  if (p.fields) { const first = Object.values(p.fields)[0]; if (first) return first; }
  if (err.code === 'network_error') return 'The server could not be reached. Check your connection and try again.';
  if (err.status === 403) return 'You do not have access to do that.';
  if (err.status === 404) return 'That item no longer exists.';
  if (err.status === 429) return 'Too many attempts. Try again in a few minutes.';
  if (err.status >= 500) return 'The server hit a problem.' + (err.requestId ? ` Reference: ${err.requestId}` : '');
  return fallback || 'Something went wrong.';
}

/* Set once at start-up (main.js): what to do when the session has ended. */
let unauthorizedHandler = () => {};
export function onUnauthorized(fn) { unauthorizedHandler = fn; }

async function send(path, init, opts) {
  opts = opts || {};
  let r;
  try { r = await fetch(BASE + path, Object.assign({ credentials: 'same-origin' }, init)); }
  catch (e) { throw new ApiError(0, null); }
  if (r.status === 401 && !opts.allow401) {
    unauthorizedHandler();
    throw new ApiError(401, { error: 'not_authenticated' });
  }
  return r;
}

async function readJson(r) {
  try { return await r.json(); } catch (e) { return null; }
}

/* JSON request. body is an object (sent as JSON) or undefined. */
export async function request(method, path, body, opts) {
  const init = { method, headers: {} };
  if (body !== undefined) { init.headers['Content-Type'] = 'application/json'; init.body = JSON.stringify(body); }
  const r = await send(path, init, opts);
  const j = await readJson(r);
  if (!r.ok) throw new ApiError(r.status, j, r.headers.get('X-Request-Id'));
  return j;
}

export const get = (path, opts) => request('GET', path, undefined, opts);
export const post = (path, body, opts) => request('POST', path, body === undefined ? {} : body, opts);
export const put = (path, body) => request('PUT', path, body === undefined ? {} : body);
export const del = (path) => request('DELETE', path);

/* Builds '?a=1&b=2' from an object, skipping empty values. */
export function query(params) {
  const q = Object.keys(params || {}).filter(k => params[k] !== undefined && params[k] !== null && params[k] !== '')
    .map(k => encodeURIComponent(k) + '=' + encodeURIComponent(params[k])).join('&');
  return q ? '?' + q : '';
}

/* multipart/form-data POST: plain fields plus an optional file under the name 'file'. */
export async function postForm(path, fields, file) {
  const fd = new FormData();
  Object.keys(fields || {}).forEach(k => { if (fields[k] !== undefined && fields[k] !== null) fd.append(k, fields[k]); });
  if (file) fd.append('file', file);
  const r = await send(path, { method: 'POST', body: fd });
  const j = await readJson(r);
  if (!r.ok) throw new ApiError(r.status, j, r.headers.get('X-Request-Id'));
  return j;
}

/* GET a file the server builds. Returns { blob, filename } (filename from Content-Disposition). */
export async function getFile(path) {
  const r = await send(path, { method: 'GET' });
  if (!r.ok) throw new ApiError(r.status, await readJson(r), r.headers.get('X-Request-Id'));
  const m = (r.headers.get('Content-Disposition') || '').match(/filename="([^"]+)"/);
  return { blob: await r.blob(), filename: m ? m[1] : null };
}

/* POST that answers with server-sent events (data: {json}\n\n). onEvent gets each parsed object. */
export async function postStream(path, body, onEvent, signal) {
  const r = await send(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal });
  if (!r.ok) throw new ApiError(r.status, await readJson(r), r.headers.get('X-Request-Id'));
  const reader = r.body.getReader(), dec = new TextDecoder();
  let buf = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf('\n\n')) >= 0) {
      const frame = buf.slice(0, i).trim(); buf = buf.slice(i + 2);
      if (frame.startsWith('data:')) onEvent(JSON.parse(frame.slice(5)));
    }
  }
}
