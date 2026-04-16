package com.hackathonday.migrationhelper.policy;

import java.util.Arrays;
import java.util.List;
import java.util.Objects;

public record ComponentPolicy(String ecosystem, String component, List<PolicyVersion> versions) {

	public ComponentPolicy {
		ecosystem = requireText(ecosystem, "ecosystem");
		component = requireText(component, "component");
		versions = List.copyOf(Objects.requireNonNull(versions, "versions"));
	}

	public static ComponentPolicy of(String ecosystem, String component, PolicyVersion... versions) {
		return new ComponentPolicy(ecosystem, component, Arrays.asList(versions));
	}

	private static String requireText(String value, String field) {
		if (value == null || value.isBlank()) {
			throw new IllegalArgumentException(field + " must not be blank");
		}
		return value;
	}
}
