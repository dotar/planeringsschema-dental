# Planeringsschema Dental

A browser-based planning tool for assigning personnel to stations and time slots across multiple factories and shifts.

The app is a lightweight frontend project (HTML, CSS, JavaScript) that uses Bootstrap and Bootstrap Icons from CDN and reads data from a local mock data file.

## Features

- Select factory, shift context (day/evening/night), date, and shift template.
- Assign personnel via drag-and-drop or picker overlays.
- View validation states for capacity, training, consecutive same-station assignments, double bookings, and compatibility conflicts.
- Open a derived metrics report modal from top navigation with coverage %, untrained assignments, understaffed stations, workload distribution, and rule-issue details.
- Use randomizer controls to auto-place personnel by group/station rules.
- Manage personnel, groups, stations, time slots, collaboration rules, viewer settings, and coordinator inactivity settings in settings.
- Switch between Viewer and Coordinator modes; Coordinator mode unlocks planning/settings actions behind a mock login flow.
- Switch theme (light/dark) and use built-in toasts, tooltips, popovers, modals, and a first-run tour.

## Architecture

At a high level, the app is a static browser mockup: `index.html` loads Bootstrap from CDN, creates the UI shell, then loads the local JavaScript files as classic scripts in dependency order. Runtime state lives in browser memory, while a few UI preferences are stored in `localStorage`; there is no backend API, real authentication, or durable schedule persistence.

### Runtime flow

1. `js/mockdata.js` builds the mock domain data and generated day/evening/night shift datasets.
2. `js/schema.js` validates the data shape and can show a diagnostics banner if mock/settings data becomes inconsistent.
3. `js/state.js` exposes shared state, shift switching, local UI settings, and data lookup helpers.
4. Feature modules render and mutate the UI (`ui-grid`, `validation`, `randomizer`, `settings`, `ui-modals`).
5. `js/main.js` bootstraps the app, wires top-level events, initializes theme/tooltips/popovers, and keeps the mock save flow as a console log.

### Project tree

~~~text
planeringsschema-dental/
├── index.html                 # App shell, top navigation, modal containers, schedule host, and classic-script loader.
├── css/
│   └── app.css                # Layout, grid styling, themes, responsive behavior, modal styling, and visual states.
├── js/
│   ├── mockdata.js            # Mock factories/personnel/stations/training plus generated day/evening/night datasets.
│   ├── schema.js              # Runtime data-shape assertions and diagnostics banner helpers.
│   ├── state.js               # Shared state, shift switching, local UI preferences, and data lookup helpers.
│   ├── schedule-templates.js  # Date controls, shift-template labels, and default time-slot setup.
│   ├── history.js             # Undo/redo batching for edit-mode assignment changes.
│   ├── invalidation.js        # Cell-level invalidation keys for partial revalidation.
│   ├── ui-grid.js             # Schedule grid, assignment interactions, summaries, report metrics, and person pills.
│   ├── validation.js          # Placement checks, warning rendering, and validation UI diffing.
│   ├── assignment-warnings.js # Auto-generation unassigned-person indicators.
│   ├── randomizer.js          # Auto-generation controls, operational-station toggles, and assignment logic.
│   ├── ui-modals.js           # Viewer/Coordinator mode, mock login, first-run tour, toasts, confirmations, and topbar behavior.
│   ├── settings.js            # Entity editors, training editor, collaboration rules, and settings drag/drop behavior.
│   └── main.js                # App bootstrap, top-level event wiring, theme/tooltips/popovers, and mock save hook.
├── scripts/
│   └── validate-mockdata.js   # Node check for orphaned training references and reconciliation behavior.
├── favicon.svg
├── logo.svg
├── LICENSE
└── README.md
~~~

## Tech stack

- HTML
- CSS
- JavaScript
- Bootstrap 5
- Bootstrap Icons

## Definition of warning metrics (summary bar)

The coordinator warning summary uses **unique grid cells** as its counting unit.

- **Alla**: number of unique cells with at least one issue.
- **Kapacitet**: cells where `assigned !== required capacity` (both under and over capacity).
- **Utbildning**: cells that have assigned personnel and at least one assigned person is not trained for that station.
- **Kompatibilitet**: cells with at least one incompatible person pair assigned together.

The text `Kapacitet x/y tilldelade` in the summary describes total assigned capacity (`x`) versus total required capacity (`y`) across the visible planning grid.


## Derived report metrics

The **Rapport** button in the top navigation opens a modal with derived KPIs for the active date/factory/template context.

- **Coverage %**: `assigned / required` across all operational stations and work slots in the visible context.
- **Untrained assignments**: assigned rows where `DB.training` lacks the `personId + stationId` mapping.
- **Understaffed stations**: unique stations that have one or more work slots with `assigned < defaultCapacity`.
- **Conflict count**: currently counts report rule issues for same-station compatibility conflicts and direct consecutive same-person/same-station assignments.
- **Workload distribution**: assignment counts per present person, including top-loaded/low-loaded people, spread, mean, and standard deviation.

The modal also includes station-level breakdown, workload rows, and conflict/rule details to help prioritize manual fixes.

## Current limitations

- No persistent storage: current save flow logs filtered assignments to the console.
- No authentication/authorization model (single-user local usage assumption).
- No backend validation or conflict resolution workflow. Client-side schema diagnostics and assignment undo/redo exist, but there is no durable audit history.
- No import/export pipeline for schedules.
- Limited mobile optimization for dense planning interactions.
- Mock data model and local file loading are suitable for prototype/testing, not production operations.

## Definition of done for production rollout

A production rollout is considered done when all points below are complete:

- Backend persistence is implemented (schedules, templates, settings, metadata).
- Authentication and role-based authorization are in place.
- Server-side validation mirrors client-side capacity/training/compatibility checks.
- Save/load flows are reliable, tested, and observable (logging/monitoring/alerts).
- Key user journeys are covered by automated tests (unit + integration + end-to-end smoke).
- Security and privacy requirements are validated (access control, data handling, backups).

## Running locally

No build step is required.

Open the HTML file directly in a browser, or serve the project through a simple local web server.

### PHP

~~~bash
php -S localhost:8000
~~~

### Python

~~~bash
python -m http.server 8000
~~~

Then open the app in your browser.

## Development checks

Validate the raw mock data and reconciliation helper with Node:

~~~bash
node scripts/validate-mockdata.js
~~~

This check verifies that raw training rows do not reference missing people or stations, then confirms reconciliation remains clean.

## License

MIT
