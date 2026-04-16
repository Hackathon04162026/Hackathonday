package com.hackathonday.migrationhelper.api.contract;

import java.util.List;

public record RecommendationResponse(
		String ecosystem,
		String component,
		String currentVersion,
		String recommendedVersion,
		List<String> alternativeVersions,
		String rationale
) {
}
