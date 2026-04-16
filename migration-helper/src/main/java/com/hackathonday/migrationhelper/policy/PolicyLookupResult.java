package com.hackathonday.migrationhelper.policy;

import java.util.List;

public record PolicyLookupResult(
		String ecosystem,
		String component,
		String version,
		SupportPolicyStatus supportStatus,
		String recommendedVersion,
		List<String> alternativeVersions,
		PolicySourceMetadata sourceMetadata
) {

	public static PolicyLookupResult unknown(PolicyLookupQuery query) {
		return new PolicyLookupResult(
				query.ecosystem(),
				query.component(),
				query.version(),
				SupportPolicyStatus.UNKNOWN_VERSION,
				"",
				List.of(),
				PolicySourceMetadata.unknown()
		);
	}

	public PolicyLookupResult {
		if (ecosystem == null || ecosystem.isBlank()) {
			throw new IllegalArgumentException("ecosystem must not be blank");
		}
		if (component == null || component.isBlank()) {
			throw new IllegalArgumentException("component must not be blank");
		}
		if (version == null) {
			version = "";
		}
		if (supportStatus == null) {
			throw new IllegalArgumentException("supportStatus must not be null");
		}
		if (recommendedVersion == null) {
			recommendedVersion = "";
		}
		alternativeVersions = List.copyOf(alternativeVersions == null ? List.of() : alternativeVersions);
		if (sourceMetadata == null) {
			sourceMetadata = PolicySourceMetadata.unknown();
		}
	}
}
