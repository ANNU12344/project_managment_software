# DCC backend

Express 5 + SQLite (better-sqlite3). Serves the JSON API under `/api` and the front end in `../frontend`.

## Run

```bash
npm install
cp .env.example .env
npm run seed        # migrations + demo data (13 users, 8 projects)
npm run dev         # http://localhost:8080, restarts on change
npm start           # production start
npm run migrate     # apply new migrations only
```

## Layout

```
backend/src/
  server.js            start-up: config check, migrations, HTTP, scheduler, graceful shutdown
  app.js               Express app: middleware, /api, static front end, error handler
  config/              the only place that reads process.env (validated at start-up)
  db/
    connection.js      SQLite connection, async all/get/run/exec
    migrate.js         runs db/migrations/NNN_*.js once each, recorded in schema_migrations
    migrations/        001 schema · 002 legacy data fixes · 003 sessions table
    seeds/             demo data (npm run seed)
  models/              data access — the only files with SQL, one per table
  domain/              pure business rules, no I/O: health index, metrics, record specs,
                       project-detail fields, weekly effort, timesheet parsing, roles, NC lists
  services/            business logic: access rules, project state, portfolio, status save,
                       uploads, NCs, quality, admin, AI, export. Throw AppError, never touch req/res
  controllers/         read the request, call a service, send the response
  routes/              URL -> middleware -> controller, one file per area; index.js mounts them
  middlewares/         auth guards, request logger, error handler, session store, uploads,
                       rate limit, security headers
  integrations/        Azure OpenAI client
  jobs/                weekly snapshot scheduler
  utils/               logger, errors, dates, http helpers
```

A request flows: `routes` → `middlewares` → `controller` → `service` (→ `domain` rules) → `model` → SQLite.

## Errors

Services throw `AppError` (`utils/errors.js`): `validation()`, `notFound()`, `forbidden()`, `badRequest(code)`.
The error middleware sends `{ error: '<code>', message?, fields?, errors? }` with the status. Anything
unexpected becomes `500 { error: 'server_error', request_id }`; the stack goes to the log only.

## Logs

One line per request with `requestId` (also sent back as `X-Request-Id`), method, url, status, time and user.
`LOG_FORMAT=json` in production (Azure Log Analytics reads stdout), `pretty` locally. Inside a request use `req.log`.

## Changing the schema

Add `db/migrations/004_<what>.js` exporting `{ name, up(db, log) }`. Never edit a migration that has already run.
