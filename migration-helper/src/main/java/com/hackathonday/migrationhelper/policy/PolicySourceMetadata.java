package com.hackathonday.migrationhelper.policy;

import java.net.URI;

public record PolicySourceMetadata(
		String sourceId,
		String sourceName,
		String sourceVersion,
		URI sourceUri
) {

	public static PolicySourceMetadata unknown() {
		return new PolicySourceMetadata("unknown", "Unknown policy source", "", null);
	}

	public PolicySourceMetadata {
		if (sourceId == null || sourceId.isBlank()) {
			throw new IllegalArgumentException("sourceId must not be blank");
		}
		if (sourceName == null || sourceName.isBlank()) {
			throw new IllegalArgumentException("sourceName must not be blank");
		}
		if (sourceVersion == null) {
			sourceVersion = "";
		}
	}

	public String displayValue() {
		if (sourceVersion.isBlank()) {
			return sourceName;
		}
		return sourceName + " " + sourceVersion;
	}

	public String apiValue() {
		if (sourceUri == null) {
			return displayValue();
		}
		return displayValue() + " (" + sourceUri + ")";
	}
}
