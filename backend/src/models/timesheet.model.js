/* timesheet_entries — one line per person, day and phase */
const db = require('../db/connection');
const { now } = require('../utils/dates');

const TimesheetEntry = {
  removeDay: (pid, employeeId, day) => db.run('DELETE FROM timesheet_entries WHERE project_id=? AND employee_id=? AND work_date=?', [pid, employeeId, day]),
  insert: (uploadId, r) => db.run('INSERT INTO timesheet_entries (id,project_id,upload_id,employee_id,employee_name,work_date,week_ending,phase,hours,task,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
    [db.uid('tse'), r.project_id, uploadId, r.employee_id, r.employee_name, r.work_date, r.week_ending, r.phase, r.hours, r.task, now()]),
  forWeek: (pid, wk) => db.all('SELECT * FROM timesheet_entries WHERE project_id=? AND week_ending=?', [pid, wk]),
  summaryRows: () => db.all('SELECT project_id, week_ending, employee_id, phase, hours FROM timesheet_entries')
};

module.exports = TimesheetEntry;
