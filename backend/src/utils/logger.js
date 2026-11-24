/* Structured logger, no dependencies.
 *
 *   LOG_FORMAT=json    one JSON object per line (production: Azure App Service / Log Analytics read stdout)
 *   LOG_FORMAT=pretty  coloured, human-readable lines (local development)
 *   LOG_LEVEL=error|warn|info|debug
 *
 * logger.child({ requestId }) returns a logger that adds those fields to every line.
 */
const config = require('../config');

const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const COLORS = { error: '\x1b[31m', warn: '\x1b[33m', info: '\x1b[36m', debug: '\x1b[90m' };
const RESET = '\x1b[0m';
const threshold = LEVELS[config.log.level] !== undefined ? LEVELS[config.log.level] : LEVELS.info;
const useColor = process.stdout.isTTY;

function serializeError(err) {
  if (!(err instanceof Error)) return err;
  const out = { name: err.name, message: err.message };
  if (err.code) out.code = err.code;
  if (err.status) out.status = err.status;
  if (err.stack) out.stack = err.stack;
  return out;
}

function normalise(fields) {
  const out = {};
  Object.keys(fields || {}).forEach(k => {
    const v = fields[k];
    if (v === undefined) return;
    out[k] = v instanceof Error ? serializeError(v) : v;
  });
  return out;
}

function write(level, base, msg, fields) {
  if (LEVELS[level] > threshold) return;
  const data = Object.assign({}, base, normalise(fields));
  const stream = level === 'error' || level === 'warn' ? process.stderr : process.stdout;

  if (config.log.format === 'json') {
    stream.write(JSON.stringify(Object.assign({ time: new Date().toISOString(), level, msg }, data)) + '\n');
    return;
  }
  const time = new Date().toISOString().slice(11, 23);
  const lvl = level.toUpperCase().padEnd(5);
  const err = data.err; delete data.err;
  const extra = Object.keys(data).length ? ' ' + Object.keys(data).map(k => `${k}=${typeof data[k] === 'object' ? JSON.stringify(data[k]) : data[k]}`).join(' ') : '';
  const head = useColor ? `${COLORS[level]}${lvl}${RESET}` : lvl;
  stream.write(`${time} ${head} ${msg}${extra}\n`);
  if (err && err.stack) stream.write(err.stack + '\n');
}

function make(base) {
  return {
    error: (msg, fields) => write('error', base, msg, fields),
    warn: (msg, fields) => write('warn', base, msg, fields),
    info: (msg, fields) => write('info', base, msg, fields),
    debug: (msg, fields) => write('debug', base, msg, fields),
    child: (fields) => make(Object.assign({}, base, fields))
  };
}

module.exports = make({});
