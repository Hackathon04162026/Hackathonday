package com.hackathonday.migrationhelper.api.contract;

import java.time.Instant;
import java.util.List;

public record ScanDetailResponse(
		String id,
		String status,
		String sourceType,
		String displayName,
		String requestedBy,
		String sourceReference,
		Instant createdAt,
		Instant startedAt,
		Instant completedAt,
		Instant updatedAt,
		List<String> lifecycle,
		List<WarningResponse> warnings
) {
}
