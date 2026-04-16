# Worker 6 Dev Experience

This guide is the quick reference for the Worker 6 React UI, test harness, and fixture workflow.

## Run The App

From `migration-helper/`:

```powershell
npm install
npm run dev
```

Then open the local Vite URL.

If you want to run the frontend checks as well:

```powershell
npm test
```

## Use The React App

The UI now lives in the React app under `migration-helper/src/` and builds to `migration-helper/dist/`.

It gives you the archive upload form, path scan form, scan list, filter controls, detail drawer, and JSON export actions. The experience is static-hosting-friendly and powered by checked-in mock payloads.

## Mock Data Workflow

For Worker 6, the app loads checked-in browser fixtures from `migration-helper/public/mock-data/`.

Use the mock data workflow when you are:

- building or adjusting the UI shell
- verifying report rendering against known detector outputs
- extending tests without needing a running API

## Fixture Map

Golden and mock fixtures live in these source-of-truth locations:

- `migration-helper/public/mock-data` for browser-ready mock scan list, detail, and report payloads
- `fixtures/ingestion` for archive-ingestion scenarios
- `fixtures/detection/docker-ci` for Docker and CI detector samples plus `expected-detectors.json`

## Extension Tips

- Keep new fixtures small, deterministic, and colocated with the test that uses them.
- If the React UI changes, update this doc and the root README together so local setup stays obvious.
