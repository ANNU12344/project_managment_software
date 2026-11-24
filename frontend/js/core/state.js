/* Shared client state: one mutable object every module imports.
 * Exposed as window.__DCC so it can be inspected from the browser console while debugging.
 *
 * Set at sign-in / switch:
 *   user        the signed-in user { id, email, name, role, bu }  (the account being viewed, when switched)
 *   real        the administrator's own account while "viewing as" someone else, else null
 *   view        the screen router.js draws: dashboard | status | upload | clients | actions | admin |
 *               trends | history | commercial | timesheets | audit | faq
 *
 * Data kept between screens (reloaded by the screen that needs it):
 *   portfolio   rows from GET /portfolio          actions   rows from GET /actions
 *   project     the project open in the drawer
 *
 * AI (cleared on save / switch so it is never stale):
 *   ai          AI service status                 brief, briefFor   the Monday brief and the user it was for
 *   analysis    { projectId: diagnosis }          ask, asking       Ask DCC conversation and "answer pending" flag
 *
 * Other screens add their own keys on first use (baseline, baselineList, pdFields, recMeta,
 * switchUsers, auditTab, ncFilter …).
 */
export const State = { user: null, real: null, view: 'dashboard', portfolio: [], actions: [], project: null, brief: null, briefFor: null, ai: null, analysis: {}, ask: [] };
window.__DCC = State;
