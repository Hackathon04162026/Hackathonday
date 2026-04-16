# Worker 2 Ingestion Design

## Scope

Worker 2 owns the filesystem-facing ingestion stage for two entry points:

1. Archive upload ingestion.
2. Local path scan ingestion.

The ingestion stage must prepare a normalized workspace on disk for downstream detectors without changing the shared API contracts defined by Worker 1.

## Responsibilities

- Validate uploaded archives by extension, content type, and size before extraction.
- Reject unsupported archive formats and obviously malformed payloads early.
- Extract accepted archives into a temp workspace with bounded cleanup rules.
- Normalize both uploads and local paths into the same detector-facing workspace layout.
- Emit warnings for non-fatal conditions and failures for terminal conditions through the shared warning/error model.
- Preserve enough source metadata for traceability without forcing detectors to understand original input transport details.

## Non-Goals

- No detector-specific logic.
- No policy lookup or recommendation logic.
- No API contract changes.
- No inference of dependency or runtime information during ingestion.

## Accepted Inputs

### Archive Uploads

Initial supported archive formats:

- `.zip`
- `.tar`
- `.tar.gz`
- `.tgz`

Validation gates:

- Require a recognized extension.
- Enforce a maximum compressed upload size.
- Enforce a maximum extracted size budget.
- Enforce a maximum file count budget during extraction.
- Reject symlink traversal and path traversal attempts.

### Local Path Scans

Validation gates:

- Require the submitted path to exist.
- Require the path to be readable by the scanner process.
- Normalize to an absolute canonical path before copying or mounting into the workspace.
- Reject paths that resolve through traversal tricks or disappear before scan start.

## Normalization Flow

1. Create a scan temp root using the scan id.
2. Materialize the original source into `input/`.
3. Expand or stage the scan target into `workspace/root/`.
4. Record ingestion metadata and warnings in `metadata/`.
5. Hand only the normalized workspace root to detectors.

## Warning and Failure Mapping

Warnings are for degraded but usable inputs. Examples:

- Unsupported files inside an otherwise valid archive.
- Multiple nested repositories found.
- File skipped because it exceeds a per-file extraction limit.
- Broken symlink ignored.

Failures are terminal. Examples:

- Upload exceeds configured size limit.
- Archive is corrupt or unreadable.
- No readable files remain after extraction.
- Local path does not exist or is inaccessible.
- Archive extraction attempts path escape.

Suggested stable warning codes:

- `INGESTION_NESTED_REPOSITORY_DETECTED`
- `INGESTION_FILE_SKIPPED_TOO_LARGE`
- `INGESTION_UNSUPPORTED_ENTRY_SKIPPED`
- `INGESTION_BROKEN_SYMLINK_SKIPPED`

Suggested stable failure codes:

- `INGESTION_UPLOAD_TOO_LARGE`
- `INGESTION_ARCHIVE_UNSUPPORTED`
- `INGESTION_ARCHIVE_CORRUPT`
- `INGESTION_PATH_NOT_FOUND`
- `INGESTION_PATH_NOT_READABLE`
- `INGESTION_EXTRACTION_PATH_ESCAPE`
- `INGESTION_EMPTY_WORKSPACE`

## Temp Workspace Lifecycle

Required temp layout:

- Create under a single scanner-controlled temp base.
- Name with scan id plus a short random suffix.
- Mark the workspace for deletion after report generation or terminal failure.
- Support best-effort cleanup on startup for abandoned temp workspaces older than a retention threshold.

## Coordination Notes

- Worker 1: own the request/response DTOs; Worker 2 should only populate existing warning/error fields.
- Workers 3 and 4: consume only the normalized workspace contract in `docs/worker-2-normalized-workspace-contract.md`.
- Worker 6: use the fixture set in `fixtures/ingestion/` for ingestion-focused smoke tests once endpoints exist.
