package com.hackathonday.migrationhelper.detection;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public final class GradleDetector implements Detector {

	private static final Pattern DEPENDENCY_PATTERN = Pattern.compile(
			"(?m)^\\s*(?<configuration>[A-Za-z0-9_]+)\\s*(?:\\(|\\s)\\s*(?<notation>platform\\(|enforcedPlatform\\(|['\"])(?<coordinate>[^'\")]+)['\"]?\\)?");

	@Override
	public String id() {
		return "gradle";
	}

	@Override
	public boolean supports(Path projectRoot) {
		return Files.exists(projectRoot.resolve("build.gradle")) || Files.exists(projectRoot.resolve("build.gradle.kts"));
	}

	@Override
	public DetectionReport detect(Path projectRoot) throws IOException {
		Path buildFile = Files.exists(projectRoot.resolve("build.gradle.kts")) ? projectRoot.resolve("build.gradle.kts")
				: projectRoot.resolve("build.gradle");
		String content = Files.readString(buildFile, StandardCharsets.UTF_8);

		List<DependencyDeclaration> declarations = parseDependencies(content);
		boolean platformDeclaredInText = content.contains("platform(") || content.contains("enforcedPlatform(");
		boolean hasPlatform = platformDeclaredInText || declarations.stream().anyMatch(DependencyDeclaration::platform);
		List<DetectionEvidence> evidence = new ArrayList<>();
		evidence.add(new DetectionEvidence(EvidenceType.BUILD_FILE, buildFile, "Gradle build file detected", 1.0d));
		if (hasPlatform) {
			evidence.add(new DetectionEvidence(EvidenceType.PLATFORM, buildFile, "Platform dependency found", 0.8d));
		}

		DependencyGraph.Builder graph = DependencyGraph.builder("gradle-project");
		graph.node("gradle-project", DependencyNodeKind.PROJECT, buildFile.getFileName().toString(),
				new DependencyCoordinate(null, buildFile.getFileName().toString(), null, DependencyVersionStatus.ABSENT,
						DependencyScope.BUILD, Map.of()),
				Map.of("path", buildFile.toString()));

		for (int index = 0; index < declarations.size(); index++) {
			DependencyDeclaration declaration = declarations.get(index);
			DependencyCoordinate coordinate = coordinateFor(declaration, hasPlatform);
			String nodeId = "dependency-" + index;
			graph.node(nodeId, declaration.platform() ? DependencyNodeKind.PLATFORM : DependencyNodeKind.DEPENDENCY,
					declaration.artifactId(), coordinate, Map.of("configuration", declaration.configuration()));
			graph.edge("gradle-project", nodeId,
					declaration.platform() ? DependencyRelation.MANAGES : DependencyRelation.DECLARES,
					Map.of("configuration", declaration.configuration()));
			if (!declaration.platform() && declaration.versionStatus() == DependencyVersionStatus.MANAGED) {
				graph.edge("gradle-project", nodeId, DependencyRelation.MANAGES, Map.of("managedBy", "platform"));
			}
			evidence.add(new DetectionEvidence(declaration.platform() ? EvidenceType.PLATFORM : EvidenceType.DEPENDENCY,
					buildFile, declaration.coordinate(), 0.5d));
		}

		double confidence = declarations.isEmpty() ? 0.70d : 0.92d;
		DetectedTechnology technology = new DetectedTechnology(TechnologyFamily.JAVA, "gradle", "Java (Gradle)",
				Confidence.of(confidence), evidence, graph.build(), Map.of("buildFile", buildFile.toString(),
				"buildFileType", buildFile.getFileName().toString().endsWith(".kts") ? "kotlin-dsl" : "groovy-dsl"));
		return new DetectionReport(id(), List.of(technology));
	}

	private static DependencyCoordinate coordinateFor(DependencyDeclaration declaration, boolean hasPlatform) {
		DependencyVersionStatus status = declaration.versionStatus();
		String version = declaration.version();
		if (status == DependencyVersionStatus.UNRESOLVED && hasPlatform && !declaration.platform()) {
			status = DependencyVersionStatus.MANAGED;
		}
		return new DependencyCoordinate(declaration.groupId(), declaration.artifactId(), version, status,
				declaration.scope(), Map.of("configuration", declaration.configuration()));
	}

	private static List<DependencyDeclaration> parseDependencies(String content) {
		List<DependencyDeclaration> declarations = new ArrayList<>();
		Matcher matcher = DEPENDENCY_PATTERN.matcher(content);
		while (matcher.find()) {
			String configuration = matcher.group("configuration");
			String notationPrefix = matcher.group("notation");
			String coordinate = matcher.group("coordinate").trim();
			boolean platform = notationPrefix.startsWith("platform") || notationPrefix.startsWith("enforcedPlatform");
			declarations.add(parseDeclaration(configuration, coordinate, platform));
		}
		return declarations;
	}

	private static DependencyDeclaration parseDeclaration(String configuration, String coordinate, boolean platform) {
		String[] parts = coordinate.split(":");
		String groupId = parts.length > 0 ? parts[0] : null;
		String artifactId = parts.length > 1 ? parts[1] : coordinate;
		String version = parts.length > 2 ? parts[2] : null;
		DependencyVersionStatus versionStatus;
		if (platform) {
			versionStatus = DependencyVersionStatus.MANAGED;
		} else if (version == null || version.isBlank()) {
			versionStatus = DependencyVersionStatus.UNRESOLVED;
		} else if (version.contains("$")) {
			versionStatus = DependencyVersionStatus.UNRESOLVED;
		} else {
			versionStatus = DependencyVersionStatus.EXACT;
		}
		return new DependencyDeclaration(configuration, groupId, artifactId, version, versionStatus, platform,
				scopeFor(configuration));
	}

	private static DependencyScope scopeFor(String configuration) {
		if (configuration.startsWith("test")) {
			return DependencyScope.TEST;
		}
		if (configuration.equals("runtimeOnly")) {
			return DependencyScope.RUNTIME;
		}
		if (configuration.equals("compileOnly")) {
			return DependencyScope.PROVIDED;
		}
		if (configuration.equals("implementation") || configuration.equals("api")) {
			return DependencyScope.COMPILE;
		}
		return DependencyScope.UNKNOWN;
	}

	private record DependencyDeclaration(String configuration, String groupId, String artifactId, String version,
			DependencyVersionStatus versionStatus, boolean platform, DependencyScope scope) {

		private String coordinate() {
			return groupId + ":" + artifactId + ":" + (version == null ? "" : version);
		}
	}
}
