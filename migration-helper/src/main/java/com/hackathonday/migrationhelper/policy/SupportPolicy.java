package com.hackathonday.migrationhelper.policy;

import java.util.List;
import java.util.Objects;

public record SupportPolicy(
		String ecosystem,
		String component,
		String displayName,
		String description,
		List<String> aliases,
		List<PolicyVersionRule> versions
) {

	public SupportPolicy {
		ecosystem = normalize(Objects.requireNonNull(ecosystem, "ecosystem"));
		component = normalize(Objects.requireNonNull(component, "component"));
		displayName = normalize(Objects.requireNonNull(displayName, "displayName"));
		description = normalize(description);
		aliases = List.copyOf(aliases == null ? List.of() : aliases);
		versions = List.copyOf(versions == null ? List.of() : versions);
	}

	private static String normalize(String value) {
		return value == null ? null : value.trim();
	}
}
