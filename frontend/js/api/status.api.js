/* Weekly status form and record deletes.  Backend: routes/status.routes.js */
import { get, post, del, query } from './client.js';

const enc = encodeURIComponent;

/* { week_ending, report } — the project's weekly report for that week (null if none yet) */
export const getStatus = (projectId, week) => get(`/status/${enc(projectId)}` + query({ week }));

/* Saves status figures, project details (payload.details), records (payload.records) and this
   week's effort (payload.weekly) together. Validation errors: ApiError code 'validation' with
   payload.fields (per field) or payload.errors (list). */
export const saveStatus = (projectId, payload) => post(`/status/${enc(projectId)}`, payload);

/* kind: milestones | risks | iad | raid | billing | defects | pci | activities */
export const deleteRecord = (kind, id) => del(`/records/${enc(kind)}/${enc(id)}`);
