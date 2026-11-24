/* Audit workflow: non-conformances (NCs), NC categories, quality reports and their files.
 * Backend: routes/audit.routes.js */
import { get, post, put, del, postForm, getFile } from './client.js';

const enc = encodeURIComponent;

/* ---- non-conformances ---- */
/* { ncs, statuses, severities, categories, can_raise } */
export const listNcs = () => get('/ncs');
/* { nc, comments } */
export const getNc = (id) => get(`/ncs/${enc(id)}`);
/* auditor: { project_id, title, severity, category?, due_date?, description? } */
export const raiseNc = (nc) => post('/ncs', nc);
/* PM: { status: 'Closure requested', action_taken }. Auditor: any status, due_date, severity, comment */
export const updateNc = (id, changes) => put(`/ncs/${enc(id)}`, changes);
export const addNcComment = (id, body) => post(`/ncs/${enc(id)}/comments`, { body });

/* ---- NC categories (CMMI practice areas), table nc_categories ---- */
/* { categories: [{ id, code, name, label, active, nc_count }], can_edit }; includeRemoved adds inactive ones */
export const listNcCategories = (includeRemoved) => get('/nc-categories' + (includeRemoved ? '?all=1' : ''));
/* auditor / admin: { code?, name }. Duplicate -> ApiError code 'duplicate_category' */
export const addNcCategory = (category) => post('/nc-categories', category);
/* { code?, name?, active? } — active: true restores a removed category */
export const updateNcCategory = (id, changes) => put(`/nc-categories/${enc(id)}`, changes);
/* deactivates it: no longer offered for new NCs, NCs already raised keep it */
export const removeNcCategory = (id) => del(`/nc-categories/${enc(id)}`);

/* ---- quality reports ---- */
/* { templates, submissions, reviews, projects, statuses, can_template } */
export const getQualityReports = () => get('/quality');
/* auditor: { title, description, due_date } + file */
export const addQualityTemplate = (fields, file) => postForm('/quality/templates', fields, file);
/* project's PM: { project_id, note } + file */
export const submitQualityReport = (templateId, fields, file) => postForm(`/quality/templates/${enc(templateId)}/submit`, fields, file);
/* auditor: { status, comment } + optional reviewed file */
export const reviewQualityReport = (submissionId, fields, file) => postForm(`/quality/submissions/${enc(submissionId)}/review`, fields, file);
/* { blob, filename } */
export const downloadStoredFile = (fileId) => getFile(`/files/${enc(fileId)}`);
