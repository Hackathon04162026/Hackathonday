package com.hackathonday.migrationhelper.api.contract;

import jakarta.validation.constraints.NotBlank;
import java.util.List;

public record RefinementStoryRequest(
		@NotBlank String notes,
		String candidateStorySummary,
		String candidateProblemStatement,
		String parentEpicLink,
		List<String> labels,
		String sprint,
		Integer estimatePoints,
		List<String> references,
		String teamContext
) {
}
