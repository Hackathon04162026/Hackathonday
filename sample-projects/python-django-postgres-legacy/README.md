# Python Django Postgres Legacy

Small legacy Django sample for modernization demos.

This fixture intentionally mixes:
- Python 3.10 plus Django 4.1 and DRF
- PostgreSQL access through `psycopg2-binary`
- hardcoded secrets and debug-friendly settings
- sample PII hints in test data
- duplicated helper logic
- SQL-injection-prone query previews
- nested branching for cognitive-complexity detection

It is meant to be small, readable, and believable so the analyzer can surface
realistic upgrade and refactoring guidance without requiring a full app.
