package com.hackathonday.migrationhelper.policy;

import java.time.LocalDate;
import java.util.Objects;

public record SupportPolicySource(String id, String displayName, String version, LocalDate publishedOn, String notes) {

	public SupportPolicySource {
		id = normalize(Objects.requireNonNull(id, "id"));
		displayName = normalize(Objects.requireNonNull(displayName, "displayName"));
		version = normalize(Objects.requireNonNull(version, "version"));
		notes = normalize(notes);
	}

	private static String normalize(String value) {
		return value == null ? null : value.trim();
	}
}
