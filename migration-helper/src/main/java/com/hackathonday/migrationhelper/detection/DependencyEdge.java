package com.hackathonday.migrationhelper.detection;

import java.util.Map;

public record DependencyEdge(String fromId, String toId, DependencyRelation relation, Map<String, String> attributes) {

	public DependencyEdge {
		attributes = Map.copyOf(attributes == null ? Map.of() : attributes);
	}
}
