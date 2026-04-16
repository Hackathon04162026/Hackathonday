# Mixed Enterprise Workspace

This sample combines multiple platforms in one repository to demonstrate cross-platform detection.

It intentionally includes:
- Java 8 / Spring Boot 2.6 style service code with older helper libraries
- Angular 12 portal code with legacy UI dependencies and repeated logic
- React 17 dashboard code with noisy data handling and duplicated transforms
- .NET 5 API scaffolding with direct SQL access and verbose mapping logic
- Python FastAPI job code with legacy branching and PII hints in fixture data
- Docker and CI files so the workspace looks like a real enterprise monorepo

The sample is small on purpose, but each area contains enough structure for the
scanner to detect technology mix, upgrade pressure, security smells, and
modernization hotspots.
