/* Audit workflow lists: non-conformances (NCs) and quality reports.
 * NC categories are not here: they are data, kept in the nc_categories table
 * (models/nc-category.model.js, managed on the Audit & quality screen). */

/* "In Progress" removed on request: Open → Closure requested (PM) → Closed / Reopened (auditor). */
const NC_STATUS = ['Open', 'Closure requested', 'Closed', 'Reopened'];
const NC_SEVERITY = ['Major', 'Minor', 'Observation'];

const QR_STATUS = ['Submitted', 'Under review', 'Accepted', 'Rework requested'];

module.exports = { NC_STATUS, NC_SEVERITY, QR_STATUS };
