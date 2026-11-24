/* Application errors.
 *
 * Services throw these; the error-handling middleware turns them into the response.
 * The JSON body keeps the shape the front end already reads:
 *   { error: '<code>', message?: '...', fields?: {...}, errors?: [...], ... }
 */
class AppError extends Error {
  /**
   * @param {number} status  HTTP status
   * @param {string} code    machine-readable code, sent as `error`
   * @param {string} [message] human-readable message, sent as `message`
   * @param {object} [extra]   more fields merged into the body (fields, errors, count …)
   */
  constructor(status, code, message, extra) {
    super(message || code);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.publicMessage = message || null;
    this.extra = extra || null;
  }

  toJSON() {
    const body = { error: this.code };
    if (this.publicMessage) body.message = this.publicMessage;
    if (this.extra) Object.assign(body, this.extra);
    return body;
  }
}

const badRequest = (code, message, extra) => new AppError(400, code, message, extra);
/* 400 validation — `message` for a single sentence, `extra.fields` for per-field messages */
const validation = (message, extra) => new AppError(400, 'validation', message, extra);
const unauthorized = () => new AppError(401, 'not_authenticated');
const forbidden = (message, extra) => new AppError(403, 'forbidden', message, extra);
const notFound = (code) => new AppError(404, code || 'not_found');

module.exports = { AppError, badRequest, validation, unauthorized, forbidden, notFound };
