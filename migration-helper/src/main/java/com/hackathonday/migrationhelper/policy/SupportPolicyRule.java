package com.hackathonday.migrationhelper.policy;

import java.util.List;

public record SupportPolicyRule(
		String ecosystem,
		String component,
		String exactVersion,
		String minimumVersion,
		String maximumVersion,
		String versionPrefix,
		SupportPolicyStatus supportStatus,
		String recommendedVersion,
		List<String> alternativeVersions,
		PolicySourceMetadata sourceMetadata
) {

	public SupportPolicyRule {
		ecosystem = normalizeRequired(ecosystem, "ecosystem");
		component = normalizeRequired(component, "component");
		exactVersion = normalizeOptional(exactVersion);
		minimumVersion = normalizeOptional(minimumVersion);
		maximumVersion = normalizeOptional(maximumVersion);
		versionPrefix = normalizeOptional(versionPrefix);
		recommendedVersion = normalizeOptional(recommendedVersion);
		alternativeVersions = List.copyOf(alternativeVersions == null ? List.of() : alternativeVersions);
		if (supportStatus == null) {
			throw new IllegalArgumentException("supportStatus must not be null");
		}
		if (sourceMetadata == null) {
			throw new IllegalArgumentException("sourceMetadata must not be null");
		}
		validateVersionSelector();
	}

	public boolean matches(PolicyLookupQuery query) {
		if (!ecosystem.equalsIgnoreCase(query.ecosystem())) {
			return false;
		}
		if (!componentMatches(query.component())) {
			return false;
		}
		return versionMatches(query.version());
	}

	public int specificityScore() {
		int score = 0;
		score += component.equals("*") ? 10 : 100;
		score += versionSpecificity();
		return score;
	}

	private boolean componentMatches(String queryComponent) {
		return component.equals("*") || component.equalsIgnoreCase(queryComponent);
	}

	private boolean versionMatches(String queryVersion) {
		if (queryVersion == null || queryVersion.isBlank()) {
			return exactVersion.isBlank() && minimumVersion.isBlank() && maximumVersion.isBlank() && versionPrefix.isBlank();
		}
		if (!exactVersion.isBlank()) {
			return exactVersion.equalsIgnoreCase(queryVersion);
		}
		if (!versionPrefix.isBlank()) {
			return queryVersion.startsWith(versionPrefix);
		}
		if (!minimumVersion.isBlank() || !maximumVersion.isBlank()) {
			if (!minimumVersion.isBlank() && VersionComparator.compare(queryVersion, minimumVersion) < 0) {
				return false;
			}
			return maximumVersion.isBlank() || VersionComparator.compare(queryVersion, maximumVersion) <= 0;
		}
		return true;
	}

	private int versionSpecificity() {
		if (!exactVersion.isBlank()) {
			return 400;
		}
		if (!versionPrefix.isBlank()) {
			return 250 + versionPrefix.length();
		}
		if (!minimumVersion.isBlank() || !maximumVersion.isBlank()) {
			int score = 200;
			if (!minimumVersion.isBlank()) {
				score += 20;
			}
			if (!maximumVersion.isBlank()) {
				score += 20;
			}
			return score;
		}
		return 50;
	}

	private void validateVersionSelector() {
		int selectors = 0;
		if (!exactVersion.isBlank()) {
			selectors++;
		}
		if (!minimumVersion.isBlank() || !maximumVersion.isBlank()) {
			selectors++;
		}
		if (!versionPrefix.isBlank()) {
			selectors++;
		}
		if (selectors > 1) {
			throw new IllegalArgumentException("Only one version selector may be configured per rule");
		}
	}

	private static String normalizeRequired(String value, String fieldName) {
		if (value == null || value.isBlank()) {
			throw new IllegalArgumentException(fieldName + " must not be blank");
		}
		return value.trim();
	}

	private static String normalizeOptional(String value) {
		if (value == null) {
			return "";
		}
		return value.trim();
	}
}
