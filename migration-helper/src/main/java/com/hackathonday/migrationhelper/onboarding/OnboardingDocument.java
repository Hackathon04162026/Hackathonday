package com.hackathonday.migrationhelper.onboarding;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.hackathonday.migrationhelper.api.contract.OnboardingJourneyType;
import java.util.List;

@JsonIgnoreProperties(ignoreUnknown = true)
public record OnboardingDocument(
		String id,
		String documentName,
		String roleFocus,
		List<OnboardingJourneyType> journeyTypes,
		String section,
		int topicOrder,
		List<String> keywords,
		String summary,
		String owner,
		String channel,
		String escalationContact,
		String updatedOn,
		boolean stale
) {
}
