# Codex Worker Assignment Plan

## Repo-Verified Status Snapshot

Last verified against the repository on 2026-04-16.

### Worker 1: Platform and API Core
Status: Partial

Completed based on repo:
- Spring Boot app skeleton, bootstrap, and configuration model exist under `migration-helper/src/main/java/com/hackathonday/migrationhelper/`.
- Shared REST endpoints are implemented in `ScanController` for `POST /api/scans`, `POST /api/scans/path`, `GET /api/scans`, `GET /api/scans/{id}`, and `GET /api/scans/{id}/report`.
- Canonical request/response DTOs exist under `api/contract/`.
- Scan lifecycle state and in-memory scan tracking exist in `scan/`.
- Report aggregation entry point exists in `report/ScanReportAssembler.java`.

Still incomplete or placeholder:
- Archive and path scans are still placeholder-driven in `ScanService`; ingestion is not actually wired in.
- Final aggregation is only partially complete because `PlaceholderReportContributor` is still active and several downstream systems are not fully integrated.

### Worker 2: Ingestion and Workspace Normalization
Status: Partial

Completed based on repo:
- Ingestion design is documented in `docs/worker-2-ingestion-design.md`.
- Normalized workspace contract is documented in `docs/worker-2-normalized-workspace-contract.md`.
- Fixture inputs exist in `fixtures/ingestion/` for valid, corrupt, nested-repo, and oversized upload scenarios.
- Supporting fixture generation script exists in `scripts/generate-worker2-fixtures.ps1`.

Still incomplete or placeholder:
- No production archive extraction, upload validation, temp workspace management, or local-path normalization implementation was found in the Java app.
- `ScanService` still emits the warning that workspace normalization will be supplied later.

### Worker 3: Detection Framework, Node, and Java
Status: Complete

Completed based on repo:
- Detector SPI, evidence model, confidence model, and dependency graph primitives exist in `migration-helper/src/main/java/com/hackathonday/migrationhelper/detection/`.
- Node.js detection is implemented in `NodeJsDetector.java`.
- Maven and Gradle detection are implemented in `MavenDetector.java` and `GradleDetector.java`.
- Tests exist for Node, Maven, and Gradle detectors under `src/test/java/com/hackathonday/migrationhelper/detection/`.
- Maven inherited version handling and managed dependency markers are explicitly covered in the implementation and tests.

### Worker 4: Python, .NET, Go, Docker, and CI Runtime Detection
Status: Partial

Completed based on repo:
- Python detection exists in `report/PythonReportContributor.java`.
- .NET detection exists in `report/dotnet/DotNetReportContributor.java`.
- Go detection exists in `detection/GoDetector.java` with an adapter in `report/go/GoReportContributor.java`.
- Docker and CI detection exists in `report/DockerAndCiReportContributor.java`.
- Ecosystem-specific fixtures/tests exist for Python, .NET, Go, and Docker/CI.

Still incomplete or off-plan:
- Python and .NET still enter the pipeline through report contributors instead of the same first-class detector SPI pattern used by Worker 3.
- The live report path does not yet mirror the richer CI/policy end state represented in the checked-in mock report.

### Worker 5: Support Policy and Recommendations
Status: Partial

Completed based on repo:
- Bundled support-policy dataset and policy domain model exist under `migration-helper/src/main/java/com/hackathonday/migrationhelper/policy/` and `src/main/resources/policy/`.
- Lookup, support status calculation, and recommendation-oriented service classes are present.
- Policy-focused tests exist, including `PolicySupportStatusCalculatorTest`.
- The report pipeline now evaluates detector findings through `DetectorFindingPolicyEvaluator` and `PolicyEvaluationService`.

Still incomplete or broken:
- The bundled policy catalog still does not cover every detector ecosystem that appears in the mock UI data, so some live report paths remain unmapped.
- The report pipeline still has a coverage gap between detector output richness and policy status/recommendation coverage across the full product surface.

### Worker 6: UI, Test Harness, and Developer Experience
Status: Partial

Completed based on repo:
- A thin static UI exists under `migration-helper/src/main/resources/static/` with `index.html`, `app.js`, and `styles.css`.
- Mock UI fixtures exist under `migration-helper/src/main/resources/static/mock-data/`.
- A UI smoke test exists in `src/test/java/com/hackathonday/migrationhelper/MigrationHelperUiSmokeTests.java`.
- Basic developer documentation exists in `migration-helper/README.md`.

Still incomplete or not found:
- The mock-mode shell still drives most of the UX verification.
- There is no fully separate end-to-end browser harness or golden-report suite beyond the current smoke tests and fixtures.

## Overall Readout

- Clearly completed: Worker 3.
- Substantially present but incomplete: Workers 1, 2, 4, 5, and 6.
- Current repo health: the checked-in test suite passes as of 2026-04-16, but several plan items are still only partially complete.

## Worker 1: Platform and API Core
- Own the Java app skeleton, application bootstrap, configuration model, scan lifecycle state, and shared REST endpoints.
- Deliver the canonical request and response contracts for `POST /api/scans`, `POST /api/scans/path`, `GET /api/scans`, `GET /api/scans/{id}`, and `GET /api/scans/{id}/report`.
- Own final report aggregation so every subsystem lands in one normalized output shape.
- Coordinate merge order for shared model changes; no other worker should redefine core DTOs without Worker 1 approval.

## Worker 2: Ingestion and Workspace Normalization
- Own archive upload handling, file-type and size validation, extraction, temp workspace management, and local path scan ingestion.
- Define the normalized on-disk workspace structure consumed by detectors.
- Surface ingestion warnings and failures into the shared warning model without changing API contracts.
- Provide fixture inputs that simulate valid archives, corrupt archives, nested repos, and oversized uploads.

## Worker 3: Detection Framework, Node, and Java
- Own the detector SPI, evidence model, confidence model, and dependency graph primitives.
- Implement Node.js detection for npm, yarn, and pnpm using `package.json` and lockfiles.
- Implement Java detection for Maven and Gradle, including inherited version handling and managed dependency markers where resolvable.
- Publish normalized detector outputs only through the shared detector interface.

## Worker 4: Python, .NET, Go, Docker, and CI Runtime Detection
- Own detectors for Python, .NET, Go, Docker base images, and CI/runtime configuration files.
- Follow Worker 3’s detector SPI exactly; do not introduce a parallel detector model.
- Mark unresolved and indirect versions explicitly instead of inferring them.
- Contribute ecosystem-specific fixtures and expected outputs for integration tests.

## Worker 5: Support Policy and Recommendations
- Own the bundled support-policy dataset format, loaders, source metadata, validation, and policy lookup services.
- Implement support status mapping for supported, expiring soon, unsupported, and unknown-version states.
- Implement recommendation logic for preferred next version and alternative upgrade options.
- Consume detector output as input only; do not add direct file-system scanning logic in this workstream.

## Worker 6: UI, Test Harness, and Developer Experience
- Own the thin web UI: upload flow, session scan list, summary cards, filterable results table, detail drawer, and JSON export.
- Build UI first against mocked and sample API responses, then wire it to live endpoints after report aggregation stabilizes.
- Own end-to-end test fixtures, golden reports, smoke tests, and developer documentation for local usage and extension.
- Treat backend contracts as external dependencies and coordinate changes through Worker 1.

## Dependency and Handoff Rules
- Worker 1 must land the core API/report model before Workers 5 and 6 finalize their implementations.
- Worker 2 can work in parallel with Workers 3 and 4 after the normalized workspace contract is documented.
- Worker 3 defines the detector SPI first; Worker 4 builds on that SPI and should not fork it.
- Worker 5 can build policy loading immediately, but recommendation integration depends on stable detector output fields.
- Worker 6 can build the UI shell immediately using mocked responses, then switch to live data once Worker 1 completes report aggregation.

## Recommended Execution Waves
1. Wave 1: Workers 1 and 2 start; Worker 6 starts UI shell with mock data.
2. Wave 2: Worker 3 defines detector SPI and begins Node/Java; Worker 5 builds policy data model and loaders.
3. Wave 3: Worker 4 implements the remaining detectors on the stabilized SPI.
4. Wave 4: Worker 5 integrates recommendations; Worker 1 finalizes aggregation and reporting endpoints.
5. Wave 5: Worker 6 completes live UI wiring, end-to-end tests, golden reports, and developer docs.
