# Planeringsschema Dental

A browser-based planning tool for assigning personnel to stations and time slots across multiple factories and shifts.

The app is a lightweight frontend project (HTML, CSS, JavaScript) that uses Bootstrap and Bootstrap Icons from CDN and reads data from a local mock data file.

## Features

- Select factory, shift context (day/evening/night), date, and shift template.
- Assign personnel via drag-and-drop or picker overlays.
- View validation states for capacity, training, and compatibility conflicts.
- Open a derived metrics report modal from top navigation with coverage %, untrained assignments, understaffed stations, and conflict count.
- Use randomizer controls to auto-place personnel by group/station rules.
- Manage personnel, groups, stations, time slots, and collaboration rules in settings.
- Switch theme (light/dark) and use built-in toasts, tooltips, and modals.

## Architecture

- `index.html`: main app shell and UI containers.
- `app.css`: layout, grid styling, visual states, and responsive behavior.
- `app.js`: rendering, assignment logic, randomizer, validation, settings, and theme handling.
- `mockdata.js`: mock domain data used for local/prototype operation.
- Runtime model: client-side only, no backend API, no persistence layer by default.

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
- **Conflict count**: overlapping assignments where one person appears on more than one station in the same time slot.

The modal also includes station-level breakdown and conflict details to help prioritize manual fixes.

## Current limitations

- No persistent storage: current save flow logs filtered assignments to the console.
- No authentication/authorization model (single-user local usage assumption).
- No backend validation, audit history, or conflict resolution workflow.
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

## License

MIT
