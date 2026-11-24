# DCC front end

Plain HTML, CSS and JavaScript ES modules. **No build step, no framework, no npm packages**: the
browser loads the files exactly as they are here. The backend (`backend/src/app.js`) serves this folder,
so there is nothing to run separately: `npm run dev` from the repository root and open http://localhost:8080.

## Layout

```
frontend/
  index.html          the only page; loads the 4 stylesheets and js/main.js
  assets/             logo.png, templates/ (Excel workbook template, made by `npm run template`)
  css/
    base.css          design tokens (colours, spacing, fonts), reset, typography — load first
    layout.css        login screen and app shell (sidebar, top bar)
    components.css    shared pieces: cards, tables, chips, forms, banners, charts, drawers, modal
    views.css         styles for one screen each: admin, upload, print report, audit …
  js/
    main.js           entry point: global behaviours, 401 handling, "who is signed in?"
    router.js         draws the screen in State.view
    api/              the ONLY code that calls the server — one file per backend route file
    core/             helpers: dom, format, formulas, icons, markdown, state, download, tooltip
    components/       toast, overlays (drawer / modal / Ask close helpers)
    charts/           small SVG charts (sparklines, lines, bars, heatmap, portfolio charts)
    views/            one file per screen, plus pieces of screens (drawer, brief, forms)
```

## How a screen talks to the server

```
views/actions.js  ──>  api/action.api.js  ──>  api/client.js  ──>  /api/actions  ──>  backend/src/routes/action.routes.js
   createAction({...})     post('/actions', body)      fetch + error handling
```

| Front end `api/` file | Backend route file | Covers |
|---|---|---|
| `auth.api.js` | `auth.routes.js` | login, logout, me, admin "view as" |
| `portfolio.api.js` | `portfolio.routes.js` | portfolio, client items, portfolio history |
| `project.api.js` | `project.routes.js` | project detail, dates, weekly effort, week history |
| `status.api.js` | `status.routes.js` | weekly status save, record delete |
| `upload.api.js` | `upload.routes.js` | workbook and timesheet upload / commit |
| `export.api.js` | `export.routes.js` | Excel status packs |
| `ai.api.js` | `ai.routes.js` | brief, diagnosis, narrative, escalation, Ask DCC |
| `action.api.js` | `action.routes.js` | action items |
| `admin.api.js` | `admin.routes.js` | users, engagements, baseline, weights, snapshot, audit log |
| `audit.api.js` | `audit.routes.js` | NCs, NC categories, quality reports, files |
| `meta.api.js` | `meta.routes.js` | field lists, record specs, FAQ |

When a backend route is added or changed, change the matching `api/*.api.js` file; views only call
those functions and never build URLs themselves.

## Errors

`api/client.js` handles every response the same way:

- **401** (session ended): the login screen is shown (`onUnauthorized` in `main.js`) and the call throws.
- **any other error**: throws `ApiError` with `status`, `code` (the server's `error`), `payload`
  (`message`, `fields`, `errors` …) and `requestId`.
- **no connection**: `ApiError` with `code === 'network_error'`.

In a view:

```js
try { await createAction(body); toast('Action item raised'); }
catch (err) { toast(errorMessage(err, 'Could not raise that item'), true); }
```

`errorMessage()` gives a readable sentence (server message, first field error, or a sensible default; for
server errors it includes the reference id to quote to support, which matches the `requestId` in the server log).

## Adding a screen

1. `js/views/<name>.js` exporting `async function view<Name>()` that calls `setMain(html)` and `setTools(html)` from `shell.js`.
2. Add it to `route()` in `js/router.js`.
3. Add the nav item for the roles that may see it in `navItems()` in `js/views/shell.js`.
4. Screen-only styles go at the end of `css/views.css`.
