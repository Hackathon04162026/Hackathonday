package com.hackathonday.migrationhelper.api.contract;

import java.time.Instant;

public record ReviewCheckpointResponse(
		String stage,
		String status,
		String reviewer,
		String notes,
		Instant reviewedAt
) {
}
