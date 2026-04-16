package com.hackathonday.migrationhelper.api.contract;

import java.time.Instant;

public record ReportMetadata(
		String sourceType,
		String sourceReference,
		String requestedBy,
		Instant createdAt,
		Instant startedAt,
		Instant completedAt
) {
}
