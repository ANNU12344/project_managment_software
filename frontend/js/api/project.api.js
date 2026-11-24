/* One project: detail, dates, weekly effort register, week history.  Backend: routes/project.routes.js */
import { get, put, query } from './client.js';

const enc = encodeURIComponent;

/* everything the project drawer needs: project, health, metrics, milestones, RAID, history, users … */
export const getProject = (id) => get(`/projects/${enc(id)}`);

/* Delivery Head of the project or administrator only */
export const updateProjectDates = (id, dates) => put(`/projects/${enc(id)}/dates`, dates);

/* { rows, cumulative, fields, groups, can_edit } */
export const getWeeklyEffort = (id) => get(`/projects/${enc(id)}/weekly`);
export const saveWeeklyEffort = (id, weekEnding, row) => put(`/projects/${enc(id)}/weekly/${enc(weekEnding)}`, row);

/* the project as it stood each week */
export const getWeeks = (id) => get(`/projects/${enc(id)}/weeks`);
export const getWeek = (id, weekEnding) => get(`/projects/${enc(id)}/weeks/${enc(weekEnding)}`);
export const compareWeeks = (id, a, b) => get(`/projects/${enc(id)}/compare` + query({ a, b }));
