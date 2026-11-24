/* Reference data the screens are built from.  Backend: routes/meta.routes.js */
import { get } from './client.js';

/* { fields } — the project-details field list (same list drives the upload sheet and the form) */
export const getProjectDetailFields = () => get('/meta/project-details');
/* record specs: milestones, billing, RAID, IAD, defects, PCI, weekly activities */
export const getRecordSpecs = () => get('/meta/records');
/* { fields, groups, phases } — weekly effort fields */
export const getWeeklyMeta = () => get('/meta/weekly');
/* every rule and formula, for the FAQ screen */
export const getFaq = () => get('/meta/faq');
