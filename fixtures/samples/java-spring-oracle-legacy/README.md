# Java Spring Oracle Legacy

Legacy Java sample with:
- Java 8
- Spring Boot 2.1.x
- Oracle JDBC plus older commons/http libraries
- PL-SQL package artifact
- hardcoded credentials and audit/export URLs
- branching-heavy service logic with repeated review rules

What the scanner should notice:
- secret-like values in `application.properties` and service code
- PII hints in customer e-mail, national ID, and audit trail payloads
- dynamic SQL in the PL/SQL package
- duplicated decision paths that increase cognitive complexity
- older libraries that are typical upgrade blockers in enterprise apps
