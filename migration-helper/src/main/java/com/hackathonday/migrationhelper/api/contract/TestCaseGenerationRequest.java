package com.hackathonday.migrationhelper.api.contract;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import java.util.List;

public record TestCaseGenerationRequest(
		@NotBlank String storySummary,
		@NotEmpty List<@NotBlank String> acceptanceCriteria,
		String storyTitle,
		String environment
) {
}
