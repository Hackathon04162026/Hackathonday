package com.hackathonday.migrationhelper.api.contract;

public record WarningResponse(
		String code,
		String severity,
		String message
) {
}
