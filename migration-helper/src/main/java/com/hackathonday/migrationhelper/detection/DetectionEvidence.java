package com.hackathonday.migrationhelper.detection;

import java.nio.file.Path;

public record DetectionEvidence(EvidenceType type, Path sourcePath, String summary, double weight) {

	public DetectionEvidence {
		if (weight < 0.0d || weight > 1.0d) {
			throw new IllegalArgumentException("Evidence weight must be between 0 and 1.");
		}
	}
}
