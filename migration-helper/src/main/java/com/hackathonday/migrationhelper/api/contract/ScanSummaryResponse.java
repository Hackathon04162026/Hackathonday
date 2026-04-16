package com.hackathonday.migrationhelper.api.contract;

import java.time.Instant;
import java.util.List;

public record ScanSummaryResponse(
		String id,
		String status,
		String sourceType,
		String displayName,
		String requestedBy,
		Instant createdAt,
		Instant updatedAt,
		List<WarningResponse> warnings
) {
}
