package com.hackathonday.migrationhelper.policy;

import java.time.LocalDate;
import java.util.List;
import java.util.Objects;

public record PolicyVersionRule(
		String version,
		PolicySupportStatus supportStatus,
		LocalDate releaseDate,
		LocalDate supportEndsOn,
		LocalDate endOfLifeOn,
		String preferredNextVersion,
		List<String> alternativeVersions,
		String rationale
) {

	public PolicyVersionRule {
		version = normalize(Objects.requireNonNull(version, "version"));
		supportStatus = Objects.requireNonNull(supportStatus, "supportStatus");
		preferredNextVersion = normalize(preferredNextVersion);
		alternativeVersions = List.copyOf(alternativeVersions == null ? List.of() : alternativeVersions);
		rationale = normalize(rationale);
	}

	private static String normalize(String value) {
		return value == null ? null : value.trim();
	}
}
