package com.hackathonday.migrationhelper.detection;

import java.util.List;

public record DetectionReport(String detectorId, List<DetectedTechnology> technologies) {

	public DetectionReport {
		technologies = List.copyOf(technologies);
	}

	public static DetectionReport empty(String detectorId) {
		return new DetectionReport(detectorId, List.of());
	}
}
