package com.hackathonday.migrationhelper.detection;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public final class NodeJsDetector implements Detector {

	private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

	@Override
	public String id() {
		return "nodejs";
	}

	@Override
	public boolean supports(Path projectRoot) {
		return Files.exists(projectRoot.resolve("package.json"));
	}

	@Override
	public DetectionReport detect(Path projectRoot) throws IOException {
		Path packageJsonPath = projectRoot.resolve("package.json");
		JsonNode packageJson = OBJECT_MAPPER.readTree(Files.readString(packageJsonPath, StandardCharsets.UTF_8));
		String detectedTool = detectPackageManager(projectRoot, packageJson);
		Path detectedLockfile = lockfileFor(projectRoot, detectedTool);

		List<DetectionEvidence> evidence = new ArrayList<>();
		evidence.add(new DetectionEvidence(EvidenceType.MANIFEST, packageJsonPath, "package.json manifest", 0.8d));
		if (detectedLockfile != null) {
			evidence.add(new DetectionEvidence(EvidenceType.LOCKFILE, detectedLockfile,
					detectedLockfile.getFileName().toString() + " detected", 1.0d));
		}

		double confidenceScore = switch (detectedTool) {
			case "pnpm", "yarn" -> detectedLockfile != null ? 0.98d : 0.70d;
			case "npm" -> detectedLockfile != null ? 0.94d : 0.55d;
			default -> 0.45d;
		};

		DependencyGraph.Builder graph = DependencyGraph.builder("package-json");
		graph.node("package-json", DependencyNodeKind.MANIFEST, "package.json",
				new DependencyCoordinate(null, packageJson.path("name").asText(null), packageJson.path("version").asText(null),
						DependencyVersionStatus.ABSENT, DependencyScope.BUILD, Map.of()),
				Map.of("path", packageJsonPath.toString()));
		if (detectedLockfile != null) {
			String lockNodeId = lockNodeId(detectedTool);
			graph.node(lockNodeId, DependencyNodeKind.LOCKFILE, detectedLockfile.getFileName().toString(),
					new DependencyCoordinate(null, detectedLockfile.getFileName().toString(), null,
							DependencyVersionStatus.ABSENT, DependencyScope.BUILD, Map.of()),
					Map.of("path", detectedLockfile.toString()));
			graph.edge("package-json", lockNodeId, DependencyRelation.LOCKS, Map.of("manager", detectedTool));
		}

		populatePackageDependencies(graph, packageJson);

		Map<String, String> attributes = new LinkedHashMap<>();
		attributes.put("packageManager", detectedTool);
		attributes.put("manifest", packageJsonPath.toString());
		if (detectedLockfile != null) {
			attributes.put("lockfile", detectedLockfile.toString());
		}

		DetectedTechnology technology = new DetectedTechnology(TechnologyFamily.NODE_JS, detectedTool,
				"Node.js (" + detectedTool + ")", Confidence.of(confidenceScore), evidence, graph.build(), attributes);
		return new DetectionReport(id(), List.of(technology));
	}

	private static String detectPackageManager(Path projectRoot, JsonNode packageJson) {
		if (Files.exists(projectRoot.resolve("pnpm-lock.yaml"))) {
			return "pnpm";
		}
		if (Files.exists(projectRoot.resolve("yarn.lock"))) {
			return "yarn";
		}
		if (Files.exists(projectRoot.resolve("package-lock.json")) || Files.exists(projectRoot.resolve("npm-shrinkwrap.json"))) {
			return "npm";
		}
		JsonNode packageManager = packageJson.path("packageManager");
		if (packageManager.isTextual()) {
			String value = packageManager.asText();
			int atIndex = value.indexOf('@');
			return atIndex > 0 ? value.substring(0, atIndex) : value;
		}
		return "npm";
	}

	private static Path lockfileFor(Path projectRoot, String detectedTool) {
		return switch (detectedTool) {
			case "pnpm" -> chooseExisting(projectRoot.resolve("pnpm-lock.yaml"));
			case "yarn" -> chooseExisting(projectRoot.resolve("yarn.lock"));
			default -> chooseExisting(projectRoot.resolve("package-lock.json"), projectRoot.resolve("npm-shrinkwrap.json"));
		};
	}

	private static Path chooseExisting(Path... candidates) {
		for (Path candidate : candidates) {
			if (Files.exists(candidate)) {
				return candidate;
			}
		}
		return null;
	}

	private static String lockNodeId(String detectedTool) {
		return detectedTool + "-lockfile";
	}

	private static void populatePackageDependencies(DependencyGraph.Builder graph, JsonNode packageJson) {
		addPackageDependencies(graph, packageJson, "dependencies", DependencyScope.COMPILE);
		addPackageDependencies(graph, packageJson, "devDependencies", DependencyScope.TEST);
		addPackageDependencies(graph, packageJson, "peerDependencies", DependencyScope.PROVIDED);
		addPackageDependencies(graph, packageJson, "optionalDependencies", DependencyScope.OPTIONAL);
	}

	private static void addPackageDependencies(DependencyGraph.Builder graph, JsonNode packageJson, String section,
			DependencyScope scope) {
		JsonNode dependencies = packageJson.path(section);
		if (!dependencies.isObject()) {
			return;
		}
		dependencies.fields().forEachRemaining(entry -> {
			String dependencyName = entry.getKey();
			JsonNode value = entry.getValue();
			if (!value.isTextual()) {
				return;
			}
			String version = value.asText();
			String nodeId = section + ":" + dependencyName;
			graph.node(nodeId, DependencyNodeKind.DEPENDENCY, dependencyName,
					new DependencyCoordinate(namespaceFromPackage(dependencyName), dependencyName, version,
							DependencyVersionStatus.EXACT, scope, Map.of("section", section)),
					Map.of("section", section));
			graph.edge("package-json", nodeId, DependencyRelation.DECLARES, Map.of("section", section));
		});
	}

	private static String namespaceFromPackage(String dependencyName) {
		if (dependencyName != null && dependencyName.startsWith("@")) {
			int slashIndex = dependencyName.indexOf('/');
			return slashIndex > 0 ? dependencyName.substring(0, slashIndex) : dependencyName;
		}
		return null;
	}
}
