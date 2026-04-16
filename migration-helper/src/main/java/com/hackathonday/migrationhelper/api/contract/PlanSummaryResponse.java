package com.hackathonday.migrationhelper.api.contract;

import java.time.Instant;

public record PlanSummaryResponse(
		String id,
		String productName,
		String programLead,
		String currentStage,
		int epicCount,
		int featureCount,
		int storyCount,
		Instant createdAt,
		Instant updatedAt
) {
}
