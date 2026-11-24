const metaService = require('../services/meta.service');

/* GET /meta/project-details */
function projectDetails(req, res) { res.json(metaService.projectDetailFields()); }

/* GET /meta/records */
function records(req, res) { res.json(metaService.recordSpecs()); }

/* GET /meta/weekly */
function weekly(req, res) { res.json(metaService.weeklyFields()); }

/* GET /meta/faq */
async function faq(req, res) { res.json(await metaService.faq()); }

module.exports = { projectDetails, records, weekly, faq };
