package com.hackathonday.migrationhelper.api.contract;

import java.util.List;

public record RefinementStoryResponse(
		String problemStatement,
		String storySummary,
		List<String> acceptanceCriteria,
		List<String> dependencies,
		List<String> references,
		String estimation,
		List<String> definitionOfReadyValidation,
		List<String> gaps,
		List<String> normalizationNotes
) {
}
