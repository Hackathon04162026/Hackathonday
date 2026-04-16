package com.hackathonday.migrationhelper.detection;

import java.util.List;
import java.util.Map;

public record DetectedTechnology(TechnologyFamily family, String tool, String displayName, Confidence confidence,
		List<DetectionEvidence> evidence, DependencyGraph dependencyGraph, Map<String, String> attributes) {

	public DetectedTechnology {
		evidence = List.copyOf(evidence);
		attributes = Map.copyOf(attributes == null ? Map.of() : attributes);
	}
}
