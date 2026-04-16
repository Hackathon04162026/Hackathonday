package com.hackathonday.migrationhelper.detection;

import java.util.Map;

public record DependencyNode(String id, DependencyNodeKind kind, String name, DependencyCoordinate coordinate,
		Map<String, String> attributes) {

	public DependencyNode {
		attributes = Map.copyOf(attributes == null ? Map.of() : attributes);
	}
}
