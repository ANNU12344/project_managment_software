/* Action items.  Backend: routes/action.routes.js */
import { get, post, put } from './client.js';

/* { actions } — items in the user's scope or owned by the user */
export const listActions = () => get('/actions');
/* DH / Director / CEO / admin / auditor. Needs title, owner_user_id, due_date (else 'validation' with payload.fields). */
export const createAction = (action) => post('/actions', action);
/* owner, raiser or a senior role: { status, response, owner_user_id, due_date, priority } */
export const updateAction = (id, changes) => put(`/actions/${encodeURIComponent(id)}`, changes);
