package com.hackathonday.migrationhelper.api.contract;

public record OnboardingQueryRequest(
		String role,
		OnboardingJourneyType journeyType,
		String question
) {
}
