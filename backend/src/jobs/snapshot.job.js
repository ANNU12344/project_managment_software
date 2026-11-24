/* In-process weekly snapshot: checks hourly, fires once per week on Monday (UTC).
 * Right for a single instance. With more than one instance set SNAPSHOT_IN_PROCESS=false and call
 * POST /api/admin/snapshot from a Timer-triggered Azure Function or Logic App instead.
 */
const { takeSnapshot } = require('../services/snapshot.service');
const { today, weekEnding } = require('../utils/dates');
const logger = require('../utils/logger').child({ component: 'snapshot-job' });

const HOUR = 60 * 60 * 1000;

function start() {
  let lastWeek = null;
  const tick = async () => {
    try {
      const wk = weekEnding(today());
      if (new Date().getUTCDay() === 1 && lastWeek !== wk) {
        const r = await takeSnapshot(wk);
        lastWeek = wk;
        logger.info('weekly snapshot taken', { week: r.week_ending, projects: r.projects });
      }
    } catch (err) {
      logger.error('weekly snapshot failed', { err });
    }
  };
  const timer = setInterval(tick, HOUR);
  timer.unref();
  tick();
  logger.info('scheduler started');
  return () => clearInterval(timer);
}

module.exports = { start };
