package com.hackathonday.migrationhelper.api.contract;

import java.time.Instant;
import java.util.List;

public record PlanDetailResponse(
		String id,
		String productName,
		String vision,
		String programLead,
		String currentStage,
		Instant createdAt,
		Instant updatedAt,
		List<String> desiredOutcomes,
		String targetUsers,
		List<BacklogItemResponse> epics,
		List<BacklogItemResponse> features,
		List<BacklogItemResponse> stories,
		List<ReviewCheckpointResponse> reviewCheckpoints,
		List<OnboardingTaskResponse> onboardingChecklist
) {
}
