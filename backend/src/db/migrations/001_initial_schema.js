/* 001 — the schema as it stands in production today (22 tables).
 *
 * Idempotent: CREATE TABLE IF NOT EXISTS, then any column that an older database is missing is added.
 * So it is safe on a new database, on the current data/dcc.sqlite, and on one made by an old release.
 */
const T = { id: 'TEXT', s: 'TEXT', txt: 'TEXT', num: 'REAL', int: 'INTEGER', dt: 'TEXT', blob: 'BLOB' };

const TABLES = {
  users: `
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL,
    bu TEXT NULL,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL`,

  projects: `
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    client TEXT NOT NULL,
    bu TEXT NOT NULL,
    project_type TEXT NOT NULL,
    commercial_basis TEXT NOT NULL,
    status TEXT NOT NULL,
    pm_user_id TEXT NULL,
    dh_user_id TEXT NULL,
    contract_value REAL NOT NULL DEFAULT 0,
    margin_at_bid REAL NOT NULL DEFAULT 0,
    start_date TEXT NULL,
    end_date TEXT NULL,
    created_at TEXT NOT NULL`,

  status_reports: `
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    week_ending TEXT NOT NULL,
    submitted_by TEXT NULL,
    submitted_at TEXT NULL,
    pct_complete REAL NULL,
    budget_consumed_pct REAL NULL,
    effort_baseline_pd REAL NULL,
    effort_actual_pd REAL NULL,
    etc_pd REAL NULL,
    margin_at_completion REAL NULL,
    unbilled_wip REAL NULL,
    ar_over_90 REAL NULL,
    defects_open INTEGER NULL,
    defects_leaked INTEGER NULL,
    defects_reopened INTEGER NULL,
    sla_breaches INTEGER NULL,
    timesheet_compliance REAL NULL,
    over_allocated INTEGER NULL,
    attrition_flag INTEGER NULL,
    pm_rag TEXT NULL,
    pm_rag_reason TEXT NULL,
    narrative TEXT NULL,
    spi REAL NULL,
    cpi REAL NULL,
    health_index REAL NULL,
    health_state TEXT NULL,
    source TEXT NULL,
    created_at TEXT NOT NULL`,

  milestones: `
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    ref TEXT NOT NULL,
    name TEXT NOT NULL,
    baseline_date TEXT NULL,
    forecast_date TEXT NULL,
    actual_date TEXT NULL,
    value_cr REAL NULL,
    is_billing INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL,
    slip_reason TEXT NULL,
    updated_at TEXT NOT NULL`,

  risks: `
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    ref TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NULL,
    probability TEXT NOT NULL,
    impact TEXT NOT NULL,
    owner_name TEXT NULL,
    mitigation TEXT NULL,
    target_date TEXT NULL,
    status TEXT NOT NULL,
    raised_date TEXT NOT NULL,
    closed_date TEXT NULL,
    updated_at TEXT NOT NULL`,

  dependencies: `
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    ref TEXT NOT NULL,
    description TEXT NOT NULL,
    owner_at_client TEXT NULL,
    raised_date TEXT NOT NULL,
    committed_date TEXT NULL,
    milestone_blocked TEXT NULL,
    value_blocked REAL NULL,
    status TEXT NOT NULL,
    closed_date TEXT NULL,
    updated_at TEXT NOT NULL`,

  billing: `
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    milestone_name TEXT NOT NULL,
    amount_cr REAL NULL,
    billing_date TEXT NULL,
    status TEXT NOT NULL,
    remarks TEXT NULL,
    updated_at TEXT NOT NULL`,

  defects: `
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    defect_type TEXT NOT NULL,
    total REAL NOT NULL DEFAULT 0,
    phase_injected TEXT NULL,
    reopen_count REAL NULL,
    milestone_name TEXT NULL,
    updated_at TEXT NOT NULL`,

  pci_audits: `
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    audit_date TEXT NOT NULL,
    pci_score REAL NULL,
    open_ncs REAL NULL,
    updated_at TEXT NOT NULL`,

  weekly_activities: `
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    week_ending TEXT NOT NULL,
    activity TEXT NOT NULL,
    this_week_status TEXT NULL,
    next_action TEXT NULL,
    updated_at TEXT NOT NULL`,

  weekly_efforts: `
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    week_ending TEXT NOT NULL,
    planned_hrs REAL NULL, actual_hrs REAL NULL,
    req_hrs REAL NULL, design_hrs REAL NULL, dev_hrs REAL NULL, testing_hrs REAL NULL, uat_hrs REAL NULL,
    pm_hrs REAL NULL, review_hrs REAL NULL, design_review_hrs REAL NULL, code_review_hrs REAL NULL,
    design_review_defects REAL NULL, code_review_defects REAL NULL, post_delivery_defects REAL NULL,
    size_fp REAL NULL, requirements_added REAL NULL, requirement_changes REAL NULL,
    sp_planned REAL NULL, sp_completed REAL NULL, sp_backlog REAL NULL,
    remarks TEXT NULL,
    source TEXT NULL,
    updated_by TEXT NULL,
    updated_at TEXT NOT NULL`,

  timesheet_entries: `
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    upload_id TEXT NULL,
    employee_id TEXT NOT NULL,
    employee_name TEXT NULL,
    work_date TEXT NOT NULL,
    week_ending TEXT NOT NULL,
    phase TEXT NOT NULL,
    hours REAL NOT NULL,
    task TEXT NULL,
    created_at TEXT NOT NULL`,

  project_weeks: `
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    week_ending TEXT NOT NULL,
    data TEXT NOT NULL,
    saved_at TEXT NOT NULL,
    saved_by TEXT NULL`,

  ncs: `
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    ref TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NULL,
    category TEXT NULL,
    severity TEXT NOT NULL,
    raised_by TEXT NOT NULL,
    raised_date TEXT NOT NULL,
    due_date TEXT NULL,
    status TEXT NOT NULL,
    assigned_to TEXT NULL,
    action_taken TEXT NULL,
    closed_date TEXT NULL,
    updated_at TEXT NOT NULL`,

  nc_comments: `
    id TEXT PRIMARY KEY,
    nc_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    body TEXT NOT NULL,
    created_at TEXT NOT NULL`,

  files: `
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    mime TEXT NULL,
    size INTEGER NOT NULL,
    data BLOB NOT NULL,
    uploaded_by TEXT NOT NULL,
    uploaded_at TEXT NOT NULL`,

  quality_reports: `
    id TEXT PRIMARY KEY,
    kind TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NULL,
    project_id TEXT NULL,
    template_id TEXT NULL,
    parent_id TEXT NULL,
    version INTEGER NULL,
    file_id TEXT NOT NULL,
    status TEXT NOT NULL,
    due_date TEXT NULL,
    review_comment TEXT NULL,
    uploaded_by TEXT NOT NULL,
    uploaded_at TEXT NOT NULL,
    reviewed_by TEXT NULL,
    reviewed_at TEXT NULL`,

  action_items: `
    id TEXT PRIMARY KEY,
    project_id TEXT NULL,
    title TEXT NOT NULL,
    detail TEXT NULL,
    raised_by TEXT NOT NULL,
    raised_by_role TEXT NOT NULL,
    owner_user_id TEXT NULL,
    due_date TEXT NULL,
    priority TEXT NOT NULL,
    status TEXT NOT NULL,
    response TEXT NULL,
    created_at TEXT NOT NULL,
    closed_at TEXT NULL`,

  snapshots: `
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    week_ending TEXT NOT NULL,
    health_index REAL NULL,
    health_state TEXT NULL,
    spi REAL NULL,
    cpi REAL NULL,
    pct_complete REAL NULL,
    margin_at_completion REAL NULL,
    slip_days INTEGER NULL,
    open_risks INTEGER NULL,
    open_deps INTEGER NULL,
    taken_at TEXT NOT NULL`,

  uploads: `
    id TEXT PRIMARY KEY,
    uploaded_by TEXT NOT NULL,
    filename TEXT NOT NULL,
    uploaded_at TEXT NOT NULL,
    rows_ok INTEGER NOT NULL DEFAULT 0,
    rows_error INTEGER NOT NULL DEFAULT 0,
    committed INTEGER NOT NULL DEFAULT 0,
    report TEXT NULL`,

  config: `
    k TEXT PRIMARY KEY,
    v TEXT NOT NULL`,

  audit_log: `
    id TEXT PRIMARY KEY,
    at TEXT NOT NULL,
    user_id TEXT NULL,
    action TEXT NOT NULL,
    entity TEXT NULL,
    entity_id TEXT NULL,
    detail TEXT NULL`
};

/* Columns added after the first release (were ALTERed in at runtime by server/migrate.js). */
const ADDED_COLUMNS = {
  projects: {
    details_updated_at: T.dt, details_updated_by: T.id, stage: T.txt, presales_hours: T.num, budget_cr: T.num, budgeted_hours: T.num,
    baselined_effort_hours: T.num, planned_effort_hours: T.num, delivery_methodology: T.txt, technology: T.txt, project_category: T.txt,
    actual_effort_hours: T.num, pct_completed: T.num, expenses_budget_cr: T.num, timesheet_pct: T.num, actual_cost_cr: T.num,
    forecast_end_date: T.dt, req_effort_hrs: T.num, design_effort_hrs: T.num, dev_effort_hrs: T.num, testing_effort_hrs: T.num,
    uat_effort_hrs: T.num, review_effort_hrs: T.num, design_review_hrs: T.num, code_review_hrs: T.num, design_review_defects: T.num,
    code_review_defects: T.num, post_delivery_defects: T.num, size_delivered: T.num, total_requirements: T.num, requirement_changes: T.num,
    req_defects: T.num, design_dev_defects: T.num, testing_defects: T.num, uat_defects: T.num, review_defects: T.num
  },
  milestones: {
    plan_start: T.dt, forecast_start: T.dt, actual_start: T.dt, estimated_effort_hrs: T.num, actual_effort_hrs: T.num,
    pct_complete: T.num, signoff_status: T.txt, target_date: T.dt, remarks: T.txt
  },
  risks: { contingency: T.txt },
  dependencies: { iad_type: T.txt, last_followup_date: T.dt, followup_mode: T.txt },
  action_items: { ref: T.txt }
};

const INDEXES = [
  'CREATE INDEX IF NOT EXISTS ix_sr_proj ON status_reports(project_id, week_ending)',
  'CREATE INDEX IF NOT EXISTS ix_ms_proj ON milestones(project_id)',
  'CREATE INDEX IF NOT EXISTS ix_rk_proj ON risks(project_id)',
  'CREATE INDEX IF NOT EXISTS ix_dp_proj ON dependencies(project_id)',
  'CREATE INDEX IF NOT EXISTS ix_ai_proj ON action_items(project_id)',
  'CREATE INDEX IF NOT EXISTS ix_sn_proj ON snapshots(project_id, week_ending)',
  'CREATE INDEX IF NOT EXISTS ix_bl_proj ON billing(project_id)',
  'CREATE INDEX IF NOT EXISTS ix_df_proj ON defects(project_id)',
  'CREATE INDEX IF NOT EXISTS ix_pc_proj ON pci_audits(project_id)',
  'CREATE INDEX IF NOT EXISTS ix_wa_proj ON weekly_activities(project_id)',
  'CREATE INDEX IF NOT EXISTS ix_we_proj ON weekly_efforts(project_id, week_ending)',
  'CREATE INDEX IF NOT EXISTS ix_ts_proj ON timesheet_entries(project_id, week_ending)',
  'CREATE INDEX IF NOT EXISTS ix_pw_proj ON project_weeks(project_id, week_ending)',
  'CREATE INDEX IF NOT EXISTS ix_nc_proj ON ncs(project_id)',
  'CREATE INDEX IF NOT EXISTS ix_ncc_nc ON nc_comments(nc_id)',
  'CREATE INDEX IF NOT EXISTS ix_qr_proj ON quality_reports(project_id)'
];

module.exports = {
  name: 'initial_schema',
  async up(db, log) {
    for (const [name, cols] of Object.entries(TABLES)) await db.exec(`CREATE TABLE IF NOT EXISTS ${name} (${cols});`);
    let added = 0;
    for (const [table, cols] of Object.entries(ADDED_COLUMNS)) {
      const have = (await db.all(`PRAGMA table_info(${table})`)).map(c => c.name);
      for (const [col, type] of Object.entries(cols)) {
        if (have.indexOf(col) >= 0) continue;
        await db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${type} NULL;`);
        added++;
      }
    }
    if (added) log.info('added missing columns', { count: added });
    for (const sql of INDEXES) await db.exec(sql + ';');
  }
};
