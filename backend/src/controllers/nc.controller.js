const ncService = require('../services/nc.service');

/* GET /ncs */
async function list(req, res) { res.json(await ncService.list(req.user)); }

/* GET /ncs/:id */
async function get(req, res) { res.json(await ncService.get(req.user, req.params.id)); }

/* POST /ncs */
async function raise(req, res) { res.json({ ok: true, id: await ncService.raise(req.user, req.body) }); }

/* PUT /ncs/:id */
async function update(req, res) { await ncService.update(req.user, req.params.id, req.body); res.json({ ok: true }); }

/* POST /ncs/:id/comments */
async function comment(req, res) { await ncService.comment(req.user, req.params.id, (req.body || {}).body); res.json({ ok: true }); }

/* ---- NC categories ---- */

/* GET /nc-categories?all=1  (all=1 includes removed ones) */
async function listCategories(req, res) { res.json(await ncService.listCategories(req.user, req.query.all === '1')); }

/* POST /nc-categories  { code?, name } */
async function addCategory(req, res) { res.status(201).json({ ok: true, category: await ncService.addCategory(req.user, req.body) }); }

/* PUT /nc-categories/:id  { code?, name?, active? } */
async function updateCategory(req, res) { res.json({ ok: true, category: await ncService.updateCategory(req.user, req.params.id, req.body) }); }

/* DELETE /nc-categories/:id  — deactivates; NCs keep it */
async function removeCategory(req, res) { res.json({ ok: true, category: await ncService.removeCategory(req.user, req.params.id) }); }

module.exports = { list, get, raise, update, comment, listCategories, addCategory, updateCategory, removeCategory };
