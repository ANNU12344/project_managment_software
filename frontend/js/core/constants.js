/* Colours, health band names, role labels and role groups. */

export const C = { blue: '#6C63F0', navy: '#1E1B4B', good: '#12A26B', warn: '#D98E04', bad: '#E5484D', ink: '#0F1222', ink3: '#8A8FA6', rule: '#E7E6F2', rule2: '#F0EFF7', cat2: '#2FB9A0', cat3: '#F0975A', cat4: '#C05FD0', bright: '#A78BFA' };
export const HC = { g: C.good, a: C.warn, r: C.bad };
export const HN = { g: 'On track', a: 'Watch', r: 'Intervene' };
export const ROLE_LABEL = { pm: 'Project Manager', dh: 'Delivery Head', director: 'Director — BU', ceo: 'CEO', admin: 'Administrator', auditor: 'Quality Auditor' };
export const SENIOR = ['dh', 'director', 'ceo', 'admin'];
/* Who may raise an action item: the senior roles and the quality auditor (each item gets an ACT- ID). */
export const ACTION_RAISERS = SENIOR.concat(['auditor']);
