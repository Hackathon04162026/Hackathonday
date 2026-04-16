package com.hackathonday.migrationhelper.policy;

import java.util.List;
import java.util.Objects;

public record PolicyRecommendation(
		String ecosystem,
		String component,
		String currentVersion,
		PolicySupportStatus supportStatus,
		String recommendedVersion,
		List<String> alternativeVersions,
		String rationale
) {

	public PolicyRecommendation {
		ecosystem = normalize(Objects.requireNonNull(ecosystem, "ecosystem"));
		component = normalize(Objects.requireNonNull(component, "component"));
		currentVersion = normalize(Objects.requireNonNull(currentVersion, "currentVersion"));
		supportStatus = Objects.requireNonNull(supportStatus, "supportStatus");
		recommendedVersion = normalize(recommendedVersion);
		alternativeVersions = List.copyOf(alternativeVersions == null ? List.of() : alternativeVersions);
		rationale = normalize(rationale);
	}

	private static String normalize(String value) {
		return value == null ? null : value.trim();
	}
}
