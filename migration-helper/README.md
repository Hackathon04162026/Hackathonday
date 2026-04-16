# Migration Helper

Worker 6 owns the UI shell, local test harness, and developer docs for this app.

## Run locally

From `migration-helper/`:

```powershell
.\mvnw.cmd spring-boot:run
```

Open `http://localhost:8080/` after the app starts.

## UI shell

The browser shell is the static page at `src/main/resources/static/index.html`.
It now ships with `styles.css`, `app.js`, and browser-ready mock payloads under `src/main/resources/static/mock-data/`.
The shell covers archive upload, path scans, scan history, result filtering, the detail drawer, and JSON export actions.

## API endpoints

- `POST /api/scans`
- `POST /api/scans/path`
- `GET /api/scans`
- `GET /api/scans/{id}`
- `GET /api/scans/{id}/report`

## Where to look next

For day-to-day Worker 6 setup, mock-data workflow, live API mode, and fixture locations, read [docs/worker-6-dev-experience.md](../docs/worker-6-dev-experience.md).
