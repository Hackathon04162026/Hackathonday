package com.hackathonday.migrationhelper.planning;

import java.util.Locale;

enum ReviewStage {
	EPICS,
	FEATURES;

	static ReviewStage from(String value) {
		if (value == null || value.isBlank()) {
			throw new IllegalArgumentException("Unknown review stage: " + value);
		}

		return switch (value.trim().toLowerCase(Locale.ROOT)) {
			case "epics", "epic" -> EPICS;
			case "features", "feature" -> FEATURES;
			default -> throw new IllegalArgumentException("Unknown review stage: " + value);
		};
	}
}
