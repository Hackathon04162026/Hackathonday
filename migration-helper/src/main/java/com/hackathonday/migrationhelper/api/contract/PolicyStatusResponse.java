package com.hackathonday.migrationhelper.api.contract;

public record PolicyStatusResponse(
		String ecosystem,
		String component,
		String version,
		String supportStatus,
		String source
) {
}
