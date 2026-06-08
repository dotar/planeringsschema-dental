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

- `index.html`: main app shell, top navigation, settings/randomizer/report modals, and classic-script loader.
- `css/app.css`: layout, grid styling, visual states, responsive behavior, modal styling, and theme refinements.
- `js/mockdata.js`: mock domain data plus generated day/evening/night shift datasets for local/prototype operation.
- `js/schema.js`: runtime schema assertions and diagnostics banner helpers for mock/settings data shape issues.
- `js/state.js`: shared runtime state, viewer/coordinator settings, shift-data switching, persistence helpers for local UI preferences, and data access helpers.
- `js/schedule-templates.js`: date controls, shift-template selection, labels, and default time-slot setup.
- `js/history.js`: assignment undo/redo batching for edit-mode assignment changes.
- `js/invalidation.js`: cell-level invalidation helpers used for partial validation after assignment mutations.
- `js/ui-grid.js`: schedule grid rendering, assignment interactions, summaries, report metrics, and person pill UI state.
- `js/validation.js`: training, compatibility, placement validation, warning rendering, and validation UI diffing.
- `js/assignment-warnings.js`: auto-generation unassigned-person warning helpers.
- `js/randomizer.js`: auto-generation controls, operational-station toggles, and assignment logic.
- `js/ui-modals.js`: navigation mode handling, mock coordinator login, first-run tour, modals, toasts, inactivity handling, and responsive topbar helpers.
- `js/settings.js`: settings panels, entity editors, training editor, collaboration-rule editor, and drag/drop helpers for settings tables.
- `js/main.js`: app bootstrap, high-level event wiring, theme initialization, mock save hook, and global Bootstrap tooltip/popover setup.
- `scripts/validate-mockdata.js`: Node-based mock-data integrity check for orphaned training references.
- Runtime model: client-side only, no backend API, no real authentication, and no schedule persistence layer by default.

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
