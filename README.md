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
│   ├── scheduling-calculations.js # Shared, DOM-independent training, staffing, and work-period rules.
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
│   ├── validate-mockdata.js   # Node check for orphaned training references and reconciliation behavior.
│   └── scheduling-calculations.test.js # Node regression tests for shared rules and classic-script consumers.
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
- **Kapacitet**: operational cells where `assigned !== required capacity` (both under and over capacity). Breaks require zero staff; assignments remaining on breaks retain their warning but do not contribute to coverage.
- **Utbildning**: cells that have assigned personnel and at least one assigned person is not trained for that station.
- **Kompatibilitet**: cells with at least one incompatible person pair assigned together.
- **Dubbelpass**: later cells containing the same person on the same station in consecutive work periods. Intervening breaks are skipped.
- **Icke-operativ**: cells with assignments on nonoperational stations. Empty nonoperational cells generate no staffing warning.
- **Frånvarande**: cells with assigned absent personnel.

Each category counts unique cells. **Alla** counts their union, so a cell with several issues is counted once.

The text `Kapacitet x/y tilldelade` in the summary describes total assigned capacity (`x`) versus total required capacity (`y`) across operational stations and work periods only. Assignments on nonoperational stations stay visible and can be edited manually, but contribute to neither coverage total.


## Derived report metrics

The **Rapport** button in the top navigation opens a modal with derived KPIs for the active date/factory/template context.

- **Coverage %**: `assigned / required` across all operational stations and work slots in the visible context.
- **Untrained assignments**: work-period assignment rows lacking a valid `personId + stationId` qualification across all shift datasets, including supplemental night staff and overtime personnel. The active shift uses live training data; other shifts supply additional qualifications. Training belongs to the person ID, not the selected shift or displayed name.
- **Understaffed stations**: unique stations that have one or more work slots with `assigned < defaultCapacity`.
- **Conflict count**: individual incompatible-pair events plus consecutive same-person/same-station work-period events, skipping breaks. Repetitions are compared only within the selected date, factory, shift dataset, and day type. Three consecutive work periods produce two rotation events.
- **Nonoperational assignments**: shown in a separate section with slot, station, and person. Closure warnings do not increase the conflict count. Training, compatibility, and rotation checks still include assigned work on these stations.
- **Workload distribution**: assignment counts per present person, including top-loaded/low-loaded people, spread, mean, and standard deviation.

Report counts need not equal summary counts: two untrained assignments in one cell count as two report assignments and one summary cell. The station coverage breakdown includes operational stations only; workload population and assignment counting are unchanged.

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
node --test scripts/scheduling-calculations.test.js
node --test scripts/assignment-state.test.js
~~~

The scheduling regression suite covers cross-shift qualifications, closed-station staffing, rotation across breaks, counting units, generation, and full/partial validation. No test dependencies are required.

The mock-data check verifies that raw training rows do not reference missing people or stations, then confirms reconciliation remains clean.

The assignment tests exercise real state, history, generation, deletion, and schema code with rendering stubbed out. Shift datasets own their arrays; runtime edits must mutate those arrays in place so the active `DB` aliases stay connected. Deleting a person, station, group, or time slot clears assignment undo/redo because that history cannot restore deleted settings. Shared-station deletions clean dependent assignments and training in every shift.

### Browser regression checklist

Serve the app locally and use Coordinator mode. Use temporary in-memory fixtures rather than changing production mock data.

- Place qualified night staff in the final evening period, then personnel from each shift during weekend overtime. Picker styling, pill borders, summary, and report must recognize their qualifications.
- Toggle an occupied station off and on in both settings and auto-generation controls. Assignments must remain visible; closed stations contribute to neither staffing total and have a separate summary filter and report section. Group toggles refresh once.
- Repeat a person/station across a break, then move or remove an assignment and undo/redo. The later cell and report event must update immediately; an intervening work period prevents a repetition.
- Generate with training and rotation avoidance enabled, including retained future assignments. No closed station is filled and both work-period neighbors are checked.
- Switch date, factory, shift, and day type; verify isolation and Viewer warning preferences. Check the console for errors.
- Generate, remove a person, switch shifts and return using both header and settings selectors; verify the person stays removed. Repeat with picker placement, drag-and-drop, remove/add, and undo/redo. Context changes must clear history without reversing the final edit.
- Generate with **Behåll befintliga tilldelningar** enabled and disabled; check another factory/date, Friday, and day/evening weekend overtime remain separate.
- Save training and delete a person, station, group/resource group, and time slot. Confirm deletions clear history, cancellations preserve it, and shared-station references are cleaned across shifts.

Acceptance fixture: one operational station with capacity one across two work periods, a qualified borrowed person in both periods, and one assignment at a closed station. Expect **2/2 assigned, 100% coverage, zero untrained assignments, one rotation event, and one separately flagged closed-station assignment**. Empty closed cells have no staffing warning. Summary counts remain unique affected cells; report counts retain their individual units.

## License

MIT
