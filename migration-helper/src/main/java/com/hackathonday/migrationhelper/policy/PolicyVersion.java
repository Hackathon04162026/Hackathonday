package com.hackathonday.migrationhelper.policy;

import java.util.Objects;

public record PolicyVersion(String version, SupportStatus supportStatus, boolean preferredNextVersion) {

	public PolicyVersion {
		version = requireText(version, "version");
		supportStatus = Objects.requireNonNull(supportStatus, "supportStatus");
	}

	private static String requireText(String value, String field) {
		if (value == null || value.isBlank()) {
			throw new IllegalArgumentException(field + " must not be blank");
		}
		return value;
	}
}
