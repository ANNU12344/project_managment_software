/* Gives every request an id (X-Request-Id, reused from the caller if sent), a logger that
 * carries it (req.log), and one log line when the response finishes.
 */
const crypto = require('crypto');
const logger = require('../utils/logger');

const ID_PATTERN = /^[\w-]{8,64}$/;

module.exports = function requestLogger(req, res, next) {
  const incoming = req.get('x-request-id');
  req.id = incoming && ID_PATTERN.test(incoming) ? incoming : crypto.randomUUID();
  res.setHeader('X-Request-Id', req.id);
  req.log = logger.child({ requestId: req.id });

  const started = process.hrtime.bigint();
  res.on('finish', () => {
    const ms = Number(process.hrtime.bigint() - started) / 1e6;
    const isApi = req.originalUrl.indexOf('/api') === 0;
    const fields = {
      method: req.method, url: req.originalUrl, status: res.statusCode, ms: Math.round(ms * 10) / 10,
      userId: req.session && req.session.user ? req.session.user.id : undefined
    };
    if (res.statusCode >= 500) req.log.error('request failed', fields);
    else if (res.statusCode >= 400) req.log.warn('request rejected', fields);
    else if (isApi) req.log.info('request', fields);
    else req.log.debug('static', fields);        // static files and the SPA shell
  });
  next();
};
