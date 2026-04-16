# Migration Helper

This repo is now a frontend-only React + Vite app built for static hosting.

## Run the React app

From `migration-helper/`:

```powershell
npm install
npm run dev
```

Open the local Vite URL after the dev server starts.

## Build for static hosting

```powershell
npm run build
```

The static site is emitted to `dist/`. Because the Vite config uses a relative `base`, the output can be deployed to common static hosts without rewriting asset URLs.

## Data model

The app is fully self-contained and reads its sample scan data from `public/mock-data/`.

## Tests

- `npm test` runs the React helper tests.

## Where to look next

For day-to-day setup, mock-data workflow, and fixture locations, read [docs/worker-6-dev-experience.md](../docs/worker-6-dev-experience.md).
