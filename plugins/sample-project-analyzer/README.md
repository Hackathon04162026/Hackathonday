# Sample Project Analyzer

This repo-local plugin describes the folder-first analysis pattern for the hackathon app.

Use it with regular workspace folders under:

- `D:/Project/Hackathonday/sample-projects/java-spring-oracle-legacy`
- `D:/Project/Hackathonday/sample-projects/angular-mssql-legacy`
- `D:/Project/Hackathonday/sample-projects/react-node-postgres-legacy`
- `D:/Project/Hackathonday/sample-projects/dotnet-sqlserver-legacy`
- `D:/Project/Hackathonday/sample-projects/python-django-postgres-legacy`
- `D:/Project/Hackathonday/sample-projects/mixed-enterprise-workspace`

Recommended flow:

1. Pick one folder from `sample-projects`.
2. Run stack, library, security, PII, and complexity analysis.
3. Normalize findings into the same report shape used by the UI.
4. Render overview, analysis, documentation, and roadmap pages from that shared result.

This plugin is intentionally folder-first instead of archive-first so it matches the demo inputs already checked into the repo.
