package com.hackathonday.migrationhelper.api.contract;

public record OnboardingTaskResponse(
		String title,
		String detail,
		String owner,
		String status
) {
}
