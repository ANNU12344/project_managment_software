/* Reference data the screens are built from: field lists, record specs, and the FAQ
 * (every rule and formula, straight from the code).
 */
const M = require('../models');
const PD = require('../domain/project-details');
const RC = require('../domain/records');
const W = require('../domain/weekly');
const TS = require('../domain/timesheet');
const MX = require('../domain/metrics');
const H = require('../domain/health');
const { NC_STATUS, NC_SEVERITY, QR_STATUS } = require('../domain/quality');
const nc = require('./nc.service');

const projectDetailFields = () => ({ fields: PD.FIELDS });
const recordSpecs = () => RC.publicSpecs();
const weeklyFields = () => ({ fields: W.FIELDS, groups: W.GROUPS, phases: TS.PHASES });

async function faq() {
  const base = Object.assign({}, MX.BASELINE, await M.AppConfig.get('metric_baseline', MX.BASELINE));
  return {
    health: { labels: H.LABELS, weights: H.weightsFrom(await M.AppConfig.get('health_weights', H.DEFAULT_WEIGHTS)), bands: H.BANDS },
    metrics: MX.METRICS.map(m => Object.assign({ key: m.key, label: m.label, unit: m.unit, formula: m.formula }, base[m.key] || {})),
    person_day_hours: MX.PD_HOURS, weekly: W.FIELDS, phases: TS.PHASES, phase_map: TS.PHASE_FIELD,
    nc: { statuses: NC_STATUS, severities: NC_SEVERITY, categories: await nc.categoryLabels() }, quality: { statuses: QR_STATUS }
  };
}

module.exports = { projectDetailFields, recordSpecs, weeklyFields, faq };
