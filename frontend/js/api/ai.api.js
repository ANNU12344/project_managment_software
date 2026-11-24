/* Intelligence layer (Azure OpenAI, with rule-based fallback).  Backend: routes/ai.routes.js */
import { get, post, postStream } from './client.js';

const enc = encodeURIComponent;

/* { configured, reachable, error, model } */
export const getAiStatus = () => get('/ai/status');
/* portfolio brief; cached on the server for 20 minutes unless refresh is true */
export const getBrief = (refresh) => post('/ai/brief', { refresh: !!refresh });
export const analyseProject = (id) => post(`/ai/project/${enc(id)}`);
/* project manager only: a narrative suggestion from the current draft of the weekly form */
export const draftNarrative = (id, draft) => post(`/ai/narrative/${enc(id)}`, { draft });
export const draftEscalation = (id) => post(`/ai/escalation/${enc(id)}`);

/* Streams the answer. onEvent receives { t: text } fragments, then { done: true } or
   { error: 'not_configured' | 'denied' | 'unavailable' }. */
export const askQuestion = (question, history, onEvent, signal) => postStream('/ai/ask', { question, history }, onEvent, signal);
