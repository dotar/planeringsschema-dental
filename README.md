# Planeringsschema Dental

A browser-based planning tool for assigning personnel to stations and time slots across multiple factories and shifts.

The app is built as a simple frontend project with HTML, CSS, and JavaScript, uses Bootstrap and Bootstrap Icons from CDN, and loads its data from a separate mock data file. :contentReference[oaicite:0]{index=0} :contentReference[oaicite:1]{index=1}

## Features

- Factory selection
- Evening and night planning views
- Date selection with today/tomorrow shortcuts
- Shift template selection
- Drag-and-drop assignment of personnel
- Validation and warning states in the planning grid
- Randomizer with group and station selection
- Settings for personnel, groups, stations, time slots, and collaboration rules
- Light/dark theme toggle
- Toasts, tooltips, and modal-based editing

The main UI includes a factory selector, context switch for evening/night, date picker, template selector, randomizer, save action, settings modal, and theme toggle. :contentReference[oaicite:2]{index=2}  
The settings modal contains tabs for personnel, groups, stations, time slots, collaboration rules, and credits. :contentReference[oaicite:3]{index=3}  
The JavaScript also includes random placement logic, drag-and-drop handling, conflict checking, station operational state handling, and assignment rebuilding. :contentReference[oaicite:4]{index=4} 

## Tech stack

- HTML
- CSS
- JavaScript
- Bootstrap 5
- Bootstrap Icons

The HTML loads Bootstrap 5.3.7 and Bootstrap Icons 1.13.1 from CDN. :contentReference[oaicite:6]{index=6}

## Project structure

Rename the files however you want. A typical structure could look like this:

~~~text
index.html
app.css
app.js
mockdata.js
~~~

Suggested mapping:

- `index.html` – main application shell
- `app.css` – layout, grid, visual states, picker styling, and responsive scaling
- `app.js` – application logic, rendering, validation, drag-and-drop, randomizer, settings, and theme handling
- `mockdata.js` – data source used by the app

The HTML currently loads one CSS file and two JavaScript files with cache-busting query strings during development. :contentReference[oaicite:7]{index=7} :contentReference[oaicite:8]{index=8}

## How it works

The application renders a scheduling grid inside a scalable grid container and rebuilds the board when the selected factory, date, shift context, or template changes. :contentReference[oaicite:9]{index=9} :contentReference[oaicite:10]{index=10}

Assignments can be made manually through drag-and-drop or picker overlays, and the randomizer can fill operational stations based on filters such as selected groups and whether consecutive assignments on the same station should be avoided. :contentReference[oaicite:11]{index=11} :contentReference[oaicite:12]{index=12}

The UI includes validation visuals for warning and invalid states, tooltip messaging on cells, and toast-based user feedback. :contentReference[oaicite:13]{index=13} :contentReference[oaicite:14]{index=14}

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

## Notes

This project currently uses a separate mock data file and appears designed for local testing or prototype use rather than production persistence. The current save function only logs filtered assignments to the console. :contentReference[oaicite:15]{index=15}

## Roadmap ideas

- Persist data to backend or local storage
- Import/export schedules
- User authentication and roles
- Print/export friendly views
- Search and filtering
- Better mobile layout
- Reporting and staffing summaries

## License

MIT
