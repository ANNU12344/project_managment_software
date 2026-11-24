const portfolioService = require('../services/portfolio.service');
const projectService = require('../services/project.service');

/* GET /portfolio */
async function portfolio(req, res) {
  res.json({ projects: await portfolioService.portfolio(req.user) });
}

/* GET /clients — every open client item in scope */
async function clients(req, res) {
  res.json({ items: await portfolioService.clientItems(req.user) });
}

/* GET /history/portfolio?weeks=12 */
async function history(req, res) {
  res.json(await projectService.portfolioHistory(req.user, req.query.weeks));
}

module.exports = { portfolio, clients, history };
