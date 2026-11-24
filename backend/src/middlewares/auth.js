/* Authentication and role guards. */
const { unauthorized, forbidden } = require('../utils/errors');

/* Requires a signed-in session; puts the user on req.user. */
function requireAuth(req, res, next) {
  if (!req.session || !req.session.user) return next(unauthorized());
  req.user = req.session.user;
  next();
}

/* Requires one of the given roles. Use after requireAuth. */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return next(unauthorized());
    if (roles.indexOf(req.user.role) < 0) return next(forbidden(undefined, { need: roles }));
    next();
  };
}

module.exports = { requireAuth, requireRole };
