/* Sign-in (public) and the administrator's "view as" switch (signed in). */
const { Router } = require('express');
const h = require('../utils/async-handler');
const rateLimit = require('../middlewares/rate-limit');
const c = require('../controllers/auth.controller');

/* 20 failed sign-ins per IP per 15 minutes; successful sign-ins are not counted */
const loginLimit = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, code: 'too_many_attempts', countIf: res => res.statusCode === 401 });

const publicRoutes = Router();
publicRoutes.post('/login', loginLimit, h(c.login));
publicRoutes.post('/logout', c.logout);
publicRoutes.get('/me', h(c.me));

const switchRoutes = Router();
switchRoutes.get('/switch/users', h(c.switchUsers));
switchRoutes.post('/switch', h(c.switchTo));
switchRoutes.post('/switch/stop', h(c.stopSwitch));

module.exports = { publicRoutes, switchRoutes };
