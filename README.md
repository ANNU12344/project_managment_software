# Delivery Command Centre

Project monitoring for Uneecops Technologies Limited. Project managers report once a week —
on screen or by uploading a sheet — and everyone above them reads the same certified numbers,
scoped to their role.

Four roles. There is no Client Partner role: the Delivery Head owns the client relationship,
so the client-dependency register sits on the Delivery Head's screen.

| Role | Sees | Can change |
|---|---|---|
| **Project Manager** | Own projects | Weekly status, milestones, risks, client dependencies; responds to action items |
| **Delivery Head** | Own portfolio | Raises action items |
| **Director — BU** | Own business unit | Raises action items |
| **CEO** | Everything | Raises action items |
| **Administrator** | Everything | Users, engagements, health-index weights, snapshots |

---

## Run it on a laptop in two minutes

```bash
npm install
cp .env.example .env          # defaults are fine
npm run seed                  # 12 users, 8 engagements, 12 weeks of history each
npm start                     # http://localhost:8080
```

Sign in with any seeded account — password `Uneecops@2026`:

| Account | Role |
|---|---|
| `ceo@uneecops.in` | CEO |
| `s.raghavan@uneecops.in` | Delivery Head |
| `d.govind@uneecops.in` | Director — Govt Digital |
| `v.menon@uneecops.in` | Project Manager |
| `admin@uneecops.in` | Administrator |

SQLite is used locally so there is nothing to provision. The same code runs on Azure SQL by
changing one environment variable — the SQL is written in a portable subset on purpose.

---

## Deploy to Azure

### 1. Create the database

```bash
az sql server create -g rg-dcc -n uneecops-dcc -l centralindia \
  --admin-user dccadmin --admin-password '<strong password>'
az sql db create -g rg-dcc -s uneecops-dcc -n dcc --service-objective S0
az sql server firewall-rule create -g rg-dcc -s uneecops-dcc \
  -n allow-azure --start-ip-address 0.0.0.0 --end-ip-address 0.0.0.0
```

The application creates its own tables and indexes on first start — there is no migration step.

### 2. Create the web app

```bash
az appservice plan create -g rg-dcc -n plan-dcc --is-linux --sku B1
az webapp create -g rg-dcc -p plan-dcc -n uneecops-dcc --runtime "NODE:22-lts"
az webapp config set -g rg-dcc -n uneecops-dcc --startup-file "node backend/src/server.js"
```

### 3. Application settings

```bash
az webapp config appsettings set -g rg-dcc -n uneecops-dcc --settings \
  DB_DRIVER=mssql \
  SQL_SERVER=uneecops-dcc.database.windows.net \
  SQL_DATABASE=dcc \
  SQL_USER=dccadmin \
  SQL_PASSWORD='<strong password>' \
  SESSION_SECRET='<a long random string>' \
  COOKIE_SECURE=true \
  SNAPSHOT_IN_PROCESS=false \
  WEBSITE_NODE_DEFAULT_VERSION=~22
```

### 4. Deploy and seed

```bash
zip -r app.zip . -x 'node_modules/*' 'data/*' '.env'
az webapp deploy -g rg-dcc -n uneecops-dcc --src-path app.zip --type zip
az webapp ssh -g rg-dcc -n uneecops-dcc --command "cd /home/site/wwwroot && npm run seed"
```

Then sign in as the administrator, change the seeded passwords, and replace the sample
engagements with real ones.

### 5. The weekly snapshot

`SNAPSHOT_IN_PROCESS=false` turns off the in-process scheduler, which is right as soon as the
app runs on more than one instance. Point a Timer-triggered Azure Function or a Logic App at:

```
POST https://uneecops-dcc.azurewebsites.net/api/admin/snapshot
```

authenticated as an administrator, every Monday at 06:00 IST (`0 30 0 * * 1` in UTC).

**Do not skip this.** The snapshot is what makes trend, ageing and forecast accuracy possible.
A week that is not snapshotted is portfolio history that cannot be recovered afterwards.

---

## How the health index works

One score per engagement, 0–100, computed on every save, upload and snapshot. Never typed.
Version 2 measures each project against the organisation's own process performance baseline
(`metricsToFollow.xlsx`) and the PMO project workbook — see `backend/src/domain/health.js`.

| Component | Default weight | Signals (weight within the component) |
|---|---|---|
| Schedule | 25% | SVb (30), milestones completed on plan (20), worst open slip (20), open milestones past plan end (10), SPI (20) |
| Effort & cost | 25% | EVb vs baseline (40), net margin vs baseline (40), CPI (20) |
| Quality | 20% | Defect rate (40), DRE (30), testing efficiency (15), review effectiveness (15), phase defect rates (25); SLA breaches on AMC |
| Risk & dependencies | 15% | Open RAID exposure (55), open IADs by age (30), IADs not followed up in 14 days (15) |
| Process compliance | 10% | Latest PCI score, open NCs, audit age |
| Billing & people | 5% | Billing past its date (50), timesheet compliance (30), over-allocation & resignations (20) |

**One scoring rule for every baseline metric:** at or better than Goal → 100; between Goal and the
limit → 100 down to 75; outside LSL/USL → 59 down to 0. A metric outside its control limits
therefore always lands in the Intervene band. Signals with no data are left out of their
component; a component with no data at all scores 70 (unknown, not good).

Bands: **≥ 80 on track · 60–79 watch · < 60 intervene.** Weights are set by the administrator;
changing them recomputes every engagement and is written to the audit log. Each project shows
every signal behind its score (project drawer → What makes up the score).

- **An empty RAID log scores 75, not 100.** Scoring it perfect would reward not keeping one.
- A project manager's own RAG band is recorded as an override with a reason, and never replaces
  the computed index.

## Weekly reporting

**On screen** — *Weekly status*. One project, one week. A new week opens pre-filled from the
previous week so the PM changes what moved rather than retyping what did not; the band and
narrative always start blank. Milestones, risks and client dependencies are edited on the same
screen.

**By sheet** — *Upload sheet*. Download the template, fill five sheets, upload. The file is
validated before anything is written and every error names the sheet, row, field and the fix.
Nothing is saved until Commit is pressed.

The template is generated from the same field list the API loads on, so the two cannot drift:

```bash
npm run template
```

Validation rules that are enforced rather than suggested:

- `PROJECT_CODE` must be a project assigned to the person uploading
- a band that is not Green needs a reason
- a milestone forecast later than its baseline needs a slippage reason
- a client dependency needs a **named person** at the client — "the department" is not an owner

---

### The project workbook (projectdetails.xlsx)

Data entry follows the PMO's project workbook. The template (Upload screen) has the same sheets,
headers and value lists, in the same order — **Project Information, Project Performance,
Milestone, Billing, Risk (RAID), IAD, Weekly achievements & next-week plan, defects, PCI** — plus
three sheets the app adds: **Process Metrics** (phase-wise effort for the CMMi metrics),
**Weekly Status (health index)** (optional) and **Calculated Metrics** (live Excel formulas).

- One workbook per project: child sheets belong to the project on Project Information, or carry
  a Project Code column. The PMO's own workbook uploads as it is — the parser finds the header
  row under title rows, skips the hint rows that list allowed values, and accepts the workbook's
  spellings ("Desing & Development", "Acctual efforts (hrs)", "Forcast End Date").
- Every sheet is described once in `backend/src/domain/records.js` (record sheets) and
  `backend/src/domain/project-details.js` (Project Information / Performance / Process Metrics); the upload,
  the template, the on-screen forms and the exports all read those specs.
- Defect counts for the process metrics come from the defects sheet (by type and phase injected),
  so nothing is typed twice. Effort variance uses revised planned efforts; EVb uses baselined efforts.
- The portfolio opens on the **Management dashboard** (PM: **Dashboard PM**) — total projects,
  average effort variance and net margin, open risks and IADs, then project-wise effort variance,
  planned vs actual, net margin, open defects, risks, IADs, upcoming milestone, defect rate,
  milestone counts and current milestone status.
- Values from before the workbook (status Active, type "AMC / O&M", IAD "Received / closed"…) are
  moved on to the workbook lists automatically at start-up.

### Project details

Each project carries master data the PM maintains — on the *Weekly status* screen (section 00)
or on the **Project Details** sheet of the template: name, start and end date, stage, status,
type, presales efforts (hrs), project value, project budget, budgeted hours, expenses budget,
planned efforts (hrs), actual efforts (hrs) and actual cost to date. Money is in ₹ crore,
effort in hours. Two figures are computed, never typed:

| Measure | Formula |
|---|---|
| Effort variance % | (Actual efforts − Planned efforts) ÷ Planned efforts × 100 |
| Net margin % | (Project value − Total actual cost) ÷ Project value × 100 |

The template computes both with Excel formulas so the PM sees them while filling in.
`PROJECT_MANAGER` on the sheet is a check, not an assignment — reassigning a project is done by
the administrator (Administration → Engagements → Edit). The field list lives in
`backend/src/domain/project-details.js` and drives the database columns, the sheet, the form and the exports.

### Process metrics against the baseline

The organisation's process performance baseline (from `metricsToFollow.xlsx`) sets LSL, Goal,
USL and standard deviation for 19 metrics — net margin, EVb, defect rates by phase, effort
shares, RSI, review effectiveness, testing efficiency, DRE, SVb, review efficiencies and review
effort. Each project is measured against it from the phase-wise effort and defect counts the PM
enters (Weekly status → Project details, or the Project Details sheet), and every value is
marked within limits, below LSL, above USL, tracked (no limits) or no data.

- Definitions follow common CMMi practice and live in `backend/src/domain/metrics.js` — the server value,
  the on-screen formula and the Excel template formula all come from there. 1 person-day = 8 hours.
- The administrator edits the limits under Administration → Process performance baseline;
  every change is audited and applies to every project immediately.
- The portfolio shows a projects × metrics capability grid; each project shows its metrics
  with the LSL–USL band, goal and value; both Excel packs carry a Process metrics sheet.

## Project layout

```
backend/       Express API + SQLite — routes → controllers → services → models   (see backend/README.md)
frontend/      the web app the backend serves: index.html, css/, js/, assets/   (see frontend/README.md)
scripts/       Excel template generator (npm run template)
data/          the SQLite database (not committed)
```

There is deliberately no bundler, framework or transpiler: the front end is plain ES modules the
browser loads as they are, so a maintainer can open and read any file.

Business rules referred to above now live in `backend/src/domain/` (`health.js`, `metrics.js`,
`project-details.js`, `records.js`); access rules (who sees and changes what) in
`backend/src/services/access.service.js`.

## Security notes before this carries real data

- Seeded passwords are shared and must be changed. Move to Entra ID (MSAL) when the pilot ends —
  `backend/src/services/auth.service.js` is where sign-in lives.
- Sessions are kept in the SQLite `sessions` table, so a restart does not sign anyone out. That is
  right for one instance; move to Redis before scaling out to several.
- Salary is never stored or shown, at any role. Project managers do not see contract value or margin.
- Every login, status save, upload commit, action item and weight change is written to `audit_log`.
