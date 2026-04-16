# Mixed Enterprise Workspace

This sample combines multiple platforms in one repository to demonstrate cross-platform detection.

It intentionally includes:
- Java 11 / Spring Boot 2.7 style service code with older helper libraries
- Angular 15 portal code with legacy UI dependencies and repeated logic
- React dashboard code with noisy data handling and duplicated transforms
- .NET 7 API scaffolding with direct SQL access and verbose mapping logic
- Python FastAPI job code with legacy branching and PII hints in fixture data
- Docker and CI files so the workspace looks like a real enterprise monorepo

The sample is small on purpose, but each area contains enough structure for the
scanner to detect technology mix, upgrade pressure, security smells, and
modernization hotspots.
