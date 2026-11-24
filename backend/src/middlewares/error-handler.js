/* Central error handling. Every error a route throws or passes to next() ends here.
 *
 *   AppError          -> its status and { error, message?, ... } body
 *   multer / body-parser errors -> 400 with a stable code
 *   anything else     -> 500 { error: 'server_error', request_id }; the detail goes to the log only
 */
const { AppError } = require('../utils/errors');
const config = require('../config');
const logger = require('../utils/logger');

/* Unknown /api route: JSON 404 instead of the SPA shell. */
function apiNotFound(req, res) {
  res.status(404).json({ error: 'not_found' });
}

function fromKnown(err) {
  if (err instanceof AppError) return err;
  if (err && err.code === 'LIMIT_FILE_SIZE') return new AppError(400, 'file_too_large');
  if (err && err.name === 'MulterError') return new AppError(400, 'bad_upload', err.message);
  if (err && err.type === 'entity.parse.failed') return new AppError(400, 'bad_json');
  if (err && err.type === 'entity.too.large') return new AppError(413, 'payload_too_large');
  return null;
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const log = req.log || logger;
  const known = fromKnown(err);

  if (known) {
    if (known.status >= 500) log.error('request error', { code: known.code, err });
    if (res.headersSent) return res.end();
    return res.status(known.status).json(known.toJSON());
  }

  log.error('unhandled error', { method: req.method, url: req.originalUrl, err });
  if (res.headersSent) return res.end();
  const body = { error: 'server_error', request_id: req.id };
  if (!config.isProd) body.message = String((err && err.message) || err);   // detail only outside production
  res.status(500).json(body);
}

module.exports = { errorHandler, apiNotFound };
