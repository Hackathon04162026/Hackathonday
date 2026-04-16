package com.hackathonday.migrationhelper.detection;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;

public record DependencyGraph(String rootNodeId, List<DependencyNode> nodes, List<DependencyEdge> edges) {

	public DependencyGraph {
		nodes = List.copyOf(nodes);
		edges = List.copyOf(edges);
	}

	public static Builder builder(String rootNodeId) {
		return new Builder(rootNodeId);
	}

	public static final class Builder {

		private final String rootNodeId;
		private final List<DependencyNode> nodes = new ArrayList<>();
		private final List<DependencyEdge> edges = new ArrayList<>();

		private Builder(String rootNodeId) {
			this.rootNodeId = rootNodeId;
		}

		public Builder node(String id, DependencyNodeKind kind, String name, DependencyCoordinate coordinate,
				Map<String, String> attributes) {
			nodes.add(new DependencyNode(id, kind, name, coordinate, attributes));
			return this;
		}

		public Builder edge(String fromId, String toId, DependencyRelation relation, Map<String, String> attributes) {
			edges.add(new DependencyEdge(fromId, toId, relation, attributes));
			return this;
		}

		public DependencyGraph build() {
			return new DependencyGraph(rootNodeId, Collections.unmodifiableList(nodes), Collections.unmodifiableList(edges));
		}
	}
}
