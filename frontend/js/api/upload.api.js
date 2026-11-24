/* Workbook and timesheet uploads. Both are two steps: stage (validate, nothing saved) then commit.
 * Backend: routes/upload.routes.js */
import { get, post, postForm, getFile } from './client.js';

const enc = encodeURIComponent;

/* ---- PMO project workbook ---- */
/* { upload_id, ok, summary, errors } */
export const stageWorkbook = (file) => postForm('/upload', {}, file);
export const commitWorkbook = (uploadId) => post(`/upload/${enc(uploadId)}/commit`);
/* { uploads } — the user's last 20 uploads */
export const listUploads = () => get('/uploads');

/* ---- timesheets ---- */
export const getTimesheets = () => get('/timesheets');
export const stageTimesheet = (file) => postForm('/timesheets/upload', {}, file);
export const commitTimesheet = (uploadId) => post(`/timesheets/${enc(uploadId)}/commit`);
export const downloadTimesheetTemplate = () => getFile('/timesheets/template');
