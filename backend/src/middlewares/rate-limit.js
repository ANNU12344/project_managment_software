/* Simple in-memory fixed-window rate limiter (per IP). Enough for a single instance;
 * move to a shared store (Redis) when the app runs on more than one instance.
 *
 *   countIf(res) — optional: count a request only when it returns true after the response is sent
 *                  (e.g. only failed logins, so a whole office behind one IP can still sign in).
 */
const { AppError } = require('../utils/errors');

module.exports = function rateLimit({ windowMs, max, code, countIf }) {
  const hits = new Map();          // ip -> { count, resetAt }
  const sweep = setInterval(() => {
    const t = Date.now();
    for (const [k, v] of hits) if (v.resetAt <= t) hits.delete(k);
  }, windowMs);
  sweep.unref();

  const entry = (key, t) => {
    let h = hits.get(key);
    if (!h || h.resetAt <= t) { h = { count: 0, resetAt: t + windowMs }; hits.set(key, h); }
    return h;
  };

  return (req, res, next) => {
    const t = Date.now();
    const key = req.ip || 'unknown';
    const h = entry(key, t);
    if (h.count >= max) {
      res.setHeader('Retry-After', Math.ceil((h.resetAt - t) / 1000));
      return next(new AppError(429, code || 'too_many_requests', 'Too many attempts. Try again in a few minutes.'));
    }
    if (countIf) res.on('finish', () => { if (countIf(res)) entry(key, Date.now()).count++; });
    else h.count++;
    next();
  };
};
