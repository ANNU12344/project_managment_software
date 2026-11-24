/* Data-access layer: one model per table (or table pair). Only models contain SQL. */
const records = require('./record.model');
const { Nc, NcComment } = require('./nc.model');

module.exports = {
  User: require('./user.model'),
  Project: require('./project.model'),
  StatusReport: require('./status-report.model'),
  WeeklyEffort: require('./weekly-effort.model'),
  ActionItem: require('./action-item.model'),
  Snapshot: require('./snapshot.model'),
  AppConfig: require('./config.model'),
  AuditLog: require('./audit-log.model'),
  Upload: require('./upload.model'),
  TimesheetEntry: require('./timesheet.model'),
  ProjectWeek: require('./project-week.model'),
  StoredFile: require('./file.model'),
  QualityReport: require('./quality-report.model'),
  Session: require('./session.model'),
  NcCategory: require('./nc-category.model'),
  Nc,
  NcComment,
  Milestone: records.Milestone,
  Risk: records.Risk,
  Dependency: records.Dependency,
  Billing: records.Billing,
  Defect: records.Defect,
  PciAudit: records.PciAudit,
  Activity: records.Activity,
  Raid: records.Raid,
  RECORD_MODELS: records.RECORD_MODELS
};
