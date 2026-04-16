package com.hackathonday.migrationhelper.detection;

import java.util.Map;

public record DependencyCoordinate(String namespace, String name, String version, DependencyVersionStatus versionStatus,
		DependencyScope scope, Map<String, String> attributes) {

	public DependencyCoordinate {
		attributes = Map.copyOf(attributes == null ? Map.of() : attributes);
	}
}
