package com.hackathonday.migrationhelper.policy;

public record PolicyLookupQuery(
		String ecosystem,
		String component,
		String version
) {

	public PolicyLookupQuery {
		ecosystem = normalizeRequired(ecosystem, "ecosystem");
		component = normalizeRequired(component, "component");
		version = normalizeVersion(version);
	}

	private static String normalizeRequired(String value, String fieldName) {
		if (value == null || value.isBlank()) {
			throw new IllegalArgumentException(fieldName + " must not be blank");
		}
		return value.trim();
	}

	private static String normalizeVersion(String value) {
		if (value == null) {
			return "";
		}
		return value.trim();
	}
}
