# Worker 2 Normalized Workspace Contract

## Detector Entry Point

Detectors must receive a single directory path pointing to:

`workspace/root`

Everything outside that directory is ingestion metadata and is not required for detection.

## On-Disk Layout

```text
<scan-temp>/
  input/
    original-upload.zip
    or
    source-path.txt
  metadata/
    ingestion-summary.json
    warnings.json
    source.json
  workspace/
    root/
      <normalized project files>
```

## Contract Rules

- `workspace/root` must exist for every successful scan.
- The directory tree under `workspace/root` should mirror the extracted or staged project contents as closely as possible.
- Absolute source-machine paths must not be embedded in file names under `workspace/root`.
- Hidden files must be preserved because detectors may depend on them.
- File timestamps do not need to be preserved for detection.
- File permissions should be preserved when practical, but detectors must not rely on executable bits.
- Symlinks that resolve within `workspace/root` may be materialized or preserved based on platform support.
- Symlinks that escape the workspace must be skipped and recorded as warnings.

## Nested Repository Handling

Nested repositories are allowed inside `workspace/root`.

Examples:

- `workspace/root/services/api/package.json`
- `workspace/root/libs/shared/pom.xml`
- `workspace/root/tools/cli/go.mod`

Ingestion must not flatten or split nested repositories. Detectors are expected to recurse.

## Metadata Files

The following metadata files are reserved for ingestion:

- `metadata/source.json`
- `metadata/ingestion-summary.json`
- `metadata/warnings.json`

Recommended `source.json` fields:

- `scanId`
- `sourceType` as `archive-upload` or `local-path`
- `originalName`
- `canonicalSourcePath` for local-path scans only
- `receivedAt`

Recommended `ingestion-summary.json` fields:

- `fileCount`
- `directoryCount`
- `nestedRepositoryHints`
- `skippedEntryCount`
- `extractedBytes`

## Detector Expectations

- Treat all paths under `workspace/root` as read-only.
- Ignore `input/` and `metadata/`.
- Do not assume a single repository.
- Do not assume a specific top-level folder name inside the archive.
- Handle partial workspaces where some files were skipped and warnings were recorded.

## Example

```text
scan-1234/
  input/
    sample-monorepo.zip
  metadata/
    source.json
    ingestion-summary.json
    warnings.json
  workspace/
    root/
      package.json
      services/
        billing/
          package.json
      backend/
        pom.xml
      .github/
        workflows/
          ci.yml
```
