package com.hackathonday.migrationhelper.api.contract;

public record OnboardingCitationResponse(
		String documentName,
		String section,
		String owner,
		String channel,
		String updatedOn,
		boolean outdated
) {
}
