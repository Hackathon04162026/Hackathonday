package com.hackathonday.migrationhelper.policy;

import com.hackathonday.migrationhelper.api.contract.PolicyStatusResponse;
import com.hackathonday.migrationhelper.api.contract.RecommendationResponse;
import java.util.List;

record SupportPolicyDataset(
		String schemaVersion,
		String generatedOn,
		List<PolicySource> sources,
		List<ComponentPolicy> policies
) {
}

record PolicySource(String id, String name, String url, String retrievedOn) {
}

record ComponentPolicy(String ecosystem, String component, List<VersionPolicy> versions) {
}

record VersionPolicy(
		String version,
		String releaseDate,
		String supportEndDate,
		String preferredUpgrade,
		List<String> alternativeUpgrades,
		String sourceId
) {
}

record PolicyMatch(ComponentPolicy componentPolicy, VersionPolicy versionPolicy, PolicySource source) {
}

record PolicyEvaluation(
		List<PolicyStatusResponse> policyStatuses,
		List<RecommendationResponse> recommendations
) {
}

enum SupportState {
	SUPPORTED("supported"),
	EXPIRING_SOON("expiring-soon"),
	UNSUPPORTED("unsupported"),
	UNKNOWN_VERSION("unknown-version");

	private final String apiValue;

	SupportState(String apiValue) {
		this.apiValue = apiValue;
	}

	String apiValue() {
		return apiValue;
	}
}
