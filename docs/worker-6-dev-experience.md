# Worker 6 Dev Experience

This guide is the quick reference for the Worker 6 UI shell, test harness, and fixture workflow.

## Run The App

From `migration-helper/`:

```powershell
.\mvnw.cmd spring-boot:run
```

Then open `http://localhost:8080/`.

If you want to run the backend checks as well:

```powershell
.\mvnw.cmd test
```

## Use The UI Shell

The shell is the static page at `migration-helper/src/main/resources/static/index.html`.

It gives you the archive upload form, path scan form, scan list, filter controls, detail drawer, and JSON export actions. The shell is intentionally thin, so the live behavior comes from the Spring Boot endpoints once the app is running.

## Mock Data Vs Live API

There is no separate frontend build pipeline here. For Worker 6, "mock data mode" means loading the checked-in browser fixtures from `migration-helper/src/main/resources/static/mock-data/` and keeping the golden copies in test resources.

Use mock data mode when you are:

- building or adjusting the UI shell
- verifying report rendering against known detector outputs
- extending tests without needing a running API

Use live API mode when you are:

- validating the shell against real `/api/scans` responses
- checking scan history, detail loading, or report export flows
- coordinating with Worker 1 and the backend endpoint contract

The live API endpoints are:

- `POST /api/scans`
- `POST /api/scans/path`
- `GET /api/scans`
- `GET /api/scans/{id}`
- `GET /api/scans/{id}/report`

## Fixture Map

Golden and mock fixtures live in these source-of-truth locations:

- `migration-helper/src/main/resources/static/mock-data` for browser-ready mock scan list, detail, and report payloads
- `migration-helper/src/test/resources/ui-fixtures` for golden Worker 6 request/response payloads used by smoke tests
- `fixtures/ingestion` for archive-ingestion scenarios
- `fixtures/detection/docker-ci` for Docker and CI detector samples plus `expected-detectors.json`
- `migration-helper/src/test/resources/fixtures/dotnet` for .NET workspace fixtures
- `migration-helper/src/test/resources/go-fixtures/multimodule` for Go workspace fixtures and `expected-detector-findings.json`
- `migration-helper/src/test/resources/python-fixtures` for Python workspace fixtures and expected detector output

Generated copies under `migration-helper/target/test-classes` are build output only. Do not edit those files directly.

## Extension Tips

- Keep new fixtures small, deterministic, and colocated with the test that uses them.
- Update the expected output file next to the fixture instead of hand-authoring generated JSON elsewhere.
- If the UI shell changes, update this doc and the root README together so local setup stays obvious.
