/* Roles. There is no Client Partner role: the Delivery Head owns the client relationship. */
const ROLES = {
  pm:       { label: 'Project Manager', rank: 1 },
  dh:       { label: 'Delivery Head',   rank: 2 },
  director: { label: 'Director — BU',   rank: 3 },
  ceo:      { label: 'CEO',             rank: 4 },
  admin:    { label: 'Administrator',   rank: 5 },
  auditor:  { label: 'Quality Auditor', rank: 3 }
};

/* roles that may raise action items, and that may update any action item */
const ACTION_RAISERS = ['dh', 'director', 'ceo', 'admin', 'auditor'];
const SENIOR_ROLES = ['dh', 'director', 'ceo', 'admin'];

module.exports = { ROLES, ACTION_RAISERS, SENIOR_ROLES };
