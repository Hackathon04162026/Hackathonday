package com.hackathonday.migrationhelper.policy;

import java.util.Locale;
import java.util.Objects;

public record PolicyLookupKey(String ecosystem, String component, String version) {

	public PolicyLookupKey {
		ecosystem = normalizeKey(Objects.requireNonNull(ecosystem, "ecosystem"));
		component = normalizeKey(Objects.requireNonNull(component, "component"));
		version = normalizeVersion(Objects.requireNonNull(version, "version"));
	}

	private static String normalizeKey(String value) {
		return value.trim().toLowerCase(Locale.ROOT);
	}

	private static String normalizeVersion(String value) {
		return value.trim();
	}
}
