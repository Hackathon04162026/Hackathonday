# Hackathon Day Modernization Accelerator

This repository is a hackathon project that demonstrates a folder-first application modernization workflow.

The goal is to help a team point at a legacy application, quickly understand what is inside it, and turn that analysis into a practical modernization plan. The current implementation is a React + Vite frontend that presents sample legacy projects, mock scan outputs, findings, documentation-ready summaries, and roadmap guidance in a single UI.

## What The Project Does

The demo is built around a simple flow:

1. Select a sample legacy project or enter a local folder path.
2. Run a quick analysis against that workspace.
3. Review detected technologies, lifecycle status, findings, and recommendations.
4. Generate documentation-style summaries and migration roadmap output.
5. Use the result as a starting point for deeper modernization planning.

The UI is static-hosting-friendly and currently runs against checked-in mock data, which makes it easy to demo locally or deploy to GitHub Pages without needing a backend service.

## Main Pieces

- `migration-helper/` contains the React + Vite application.
- `sample-projects/` contains demo legacy applications across Java, Angular, React, .NET, Python, and a mixed workspace.
- `fixtures/` contains ingestion and detection fixtures used for demo and validation scenarios.
- `plugins/sample-project-analyzer/` contains the repo-local plugin metadata and sample-project catalog used by the app.
- `docs/` contains hackathon planning notes, UX guidance, and supporting documentation.
- `scripts/` contains helper scripts for fixture generation and presentation assets.

## Quick Start

### Option 1: Run From The App Folder

```powershell
cd migration-helper
npm install
npm run dev
```

### Option 2: Use The Repo Helper Script

If you have the portable Node runtime expected by this repo under `tools/`, you can run:

```powershell
.\run.ps1 -Mode dev
```

Other modes:

```powershell
.\run.ps1 -Mode build
.\run.ps1 -Mode test
```

## Frontend Commands

From `migration-helper/`:

```powershell
npm run dev
npm run build
npm test
```

## Demo Inputs

The app is designed around the sample workspaces in `sample-projects/`, including:

- `java-spring-oracle-legacy`
- `angular-mssql-legacy`
- `react-node-postgres-legacy`
- `dotnet-sqlserver-legacy`
- `python-django-postgres-legacy`
- `mixed-enterprise-workspace`

These projects are meant to simulate common modernization cases such as outdated runtimes, legacy database dependencies, hardcoded configuration, mixed stacks, and migration planning tradeoffs.

## Data And Fixtures

The current UI uses checked-in mock payloads and sample catalogs rather than a live scanning backend.

- Browser-ready mock payloads live in `migration-helper/public/mock-data/`
- Ingestion scenarios live in `fixtures/ingestion/`
- Docker and CI detector samples live in `fixtures/detection/docker-ci/`

## Best Use For This Repo

This project is best suited for:

- hackathon demos
- modernization accelerator prototypes
- UI experimentation around technology discovery and migration planning
- showing how a consistent report shape can drive overview, analysis, documentation, and roadmap experiences

## Related Docs

- `migration-helper/README.md` for app-specific setup
- `sample-projects/README.md` for the sample workspace catalog
- `docs/worker-6-dev-experience.md` for React UI and fixture workflow notes
