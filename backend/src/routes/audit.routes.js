/* Audit workflow: non-conformances, NC categories, quality reports and their files. */
const { Router } = require('express');
const h = require('../utils/async-handler');
const upload = require('../middlewares/upload');
const nc = require('../controllers/nc.controller');
const q = require('../controllers/quality.controller');

const r = Router();
r.get('/ncs', h(nc.list));
r.post('/ncs', h(nc.raise));
r.get('/ncs/:id', h(nc.get));
r.put('/ncs/:id', h(nc.update));
r.post('/ncs/:id/comments', h(nc.comment));
r.get('/nc-categories', h(nc.listCategories));
r.post('/nc-categories', h(nc.addCategory));
r.put('/nc-categories/:id', h(nc.updateCategory));
r.delete('/nc-categories/:id', h(nc.removeCategory));

r.get('/quality', h(q.overview));
r.post('/quality/templates', upload.document, h(q.addTemplate));
r.post('/quality/templates/:id/submit', upload.document, h(q.submit));
r.post('/quality/submissions/:id/review', upload.document, h(q.review));
r.get('/files/:id', h(q.download));

module.exports = r;
