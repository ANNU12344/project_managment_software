const M = require('../models');
const X = require('../services/export.service');
const portfolioService = require('../services/portfolio.service');
const projectService = require('../services/project.service');
const adminService = require('../services/admin.service');
const { sendXlsx } = require('../utils/http');
const { today } = require('../utils/dates');
const { AppError } = require('../utils/errors');

/* GET /export/portfolio.xlsx */
async function portfolio(req, res) {
  const ps = await portfolioService.portfolio(req.user);
  const ex = await portfolioService.portfolioExtras(req.user, ps);
  ex.baseline = await adminService.baselineOf();
  await M.AuditLog.log(req.user.id, 'export.portfolio', 'export', null, { projects: ps.length });
  sendXlsx(res, `DCC-Portfolio-Status-${today()}.xlsx`, X.portfolioPack(req.user, ps, ex, today(), req.user.role === 'pm'));
}

/* GET /export/project/:id.xlsx */
async function project(req, res) {
  let d;
  try { d = await projectService.projectDetail(req.user, req.params.id); }
  catch (e) { if (e instanceof AppError) throw new AppError(e.status, 'not_available'); throw e; }
  await M.AuditLog.log(req.user.id, 'export.project', 'project', d.project.id, null);
  sendXlsx(res, `DCC-${d.project.code}-Status-${today()}.xlsx`, X.projectPack(d));
}

module.exports = { portfolio, project };
