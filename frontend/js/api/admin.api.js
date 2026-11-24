/* Administration.  Backend: routes/admin.routes.js */
import { get, post, put } from './client.js';

const enc = encodeURIComponent;

/* ---- users (admin) ---- */
export const listUsers = () => get('/admin/users');
export const createUser = (user) => post('/admin/users', user);
export const updateUser = (id, user) => put(`/admin/users/${enc(id)}`, user);

/* ---- engagements (admin) ---- */
/* { projects, users } */
export const listAdminProjects = () => get('/admin/projects');
export const createProject = (project) => post('/admin/projects', project);
export const updateProject = (id, project) => put(`/admin/projects/${enc(id)}`, project);

/* ---- process performance baseline: everyone reads, admin changes ---- */
/* { metrics, defaults, person_day_hours } */
export const getMetricsBaseline = () => get('/metrics/baseline');
export const updateMetricsBaseline = (baseline) => put('/admin/metrics-baseline', { baseline });

/* ---- health-index weights (read: admin, CEO; change: admin) ---- */
export const getWeights = () => get('/admin/weights');
export const updateWeights = (weights) => put('/admin/weights', { weights });

/* ---- weekly snapshot (admin, CEO, DH) and audit log (admin) ---- */
export const runSnapshot = (weekEnding) => post('/admin/snapshot', weekEnding ? { week_ending: weekEnding } : {});
export const getAuditLog = () => get('/admin/audit');
