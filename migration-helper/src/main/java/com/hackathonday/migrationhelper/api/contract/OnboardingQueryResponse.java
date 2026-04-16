package com.hackathonday.migrationhelper.api.contract;

import java.util.List;

public record OnboardingQueryResponse(
		String agentName,
		String answer,
		List<OnboardingCitationResponse> citedDocuments,
		List<String> warnings,
		List<String> nextQuestions,
		String suggestedEscalation
) {
}
