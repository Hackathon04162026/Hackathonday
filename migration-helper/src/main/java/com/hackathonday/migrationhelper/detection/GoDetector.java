package com.hackathonday.migrationhelper.detection;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Stream;
import org.springframework.stereotype.Component;

@Component
public final class GoDetector implements Detector {

	private final GoManifestParser parser = new GoManifestParser();

	@Override
	public String id() {
		return "go";
	}

	@Override
	public boolean supports(Path projectRoot) throws IOException {
		return !findManifests(projectRoot).isEmpty();
	}

	@Override
	public DetectionReport detect(Path projectRoot) throws IOException {
		List<DetectedTechnology> technologies = new ArrayList<>();
		for (Path manifest : findManifests(projectRoot)) {
			GoManifestParser.GoManifest goManifest = parser.parse(manifest);
			String relativePath = relativePath(projectRoot, manifest);
			technologies.add(runtimeTechnology(manifest, relativePath, goManifest));
			for (GoManifestParser.GoDependency dependency : goManifest.dependencies()) {
				technologies.add(dependencyTechnology(manifest, relativePath, goManifest, dependency));
			}
		}
		return new DetectionReport(id(), technologies);
	}

	private List<Path> findManifests(Path projectRoot) throws IOException {
		try (Stream<Path> paths = Files.walk(projectRoot)) {
			return paths
					.filter(Files::isRegularFile)
					.filter(this::isGoManifest)
					.sorted(Comparator.comparing(path -> relativePath(projectRoot, path)))
					.toList();
		}
	}

	private DetectedTechnology runtimeTechnology(
			Path manifest,
			String relativePath,
			GoManifestParser.GoManifest goManifest
	) {
		String version = goManifest.goVersion() == null || goManifest.goVersion().isBlank()
				? "UNRESOLVED"
				: goManifest.goVersion();
		DependencyVersionStatus versionStatus = "UNRESOLVED".equals(version)
				? DependencyVersionStatus.UNRESOLVED
				: DependencyVersionStatus.EXACT;
		Confidence confidence = "UNRESOLVED".equals(version) ? Confidence.of(0.40d) : Confidence.of(0.94d);

		DependencyGraph graph = DependencyGraph.builder("go-manifest:" + relativePath)
				.node("go-manifest", DependencyNodeKind.MANIFEST, manifest.getFileName().toString(),
						new DependencyCoordinate(null, "go", version, versionStatus, DependencyScope.BUILD,
								Map.of("manifestPath", relativePath, "modulePath", safeValue(goManifest.modulePath()))),
						Map.of("manifestPath", relativePath, "modulePath", safeValue(goManifest.modulePath())))
				.build();

		List<DetectionEvidence> evidence = new ArrayList<>();
		evidence.add(new DetectionEvidence(EvidenceType.MANIFEST, manifest,
				"Go manifest detected", 1.0d));
		if (!"UNRESOLVED".equals(version)) {
			evidence.add(new DetectionEvidence(EvidenceType.PROPERTY, manifest,
					"go directive declared", 0.94d));
		}

		Map<String, String> attributes = new LinkedHashMap<>();
		attributes.put("kind", "runtime");
		attributes.put("manifestPath", relativePath);
		attributes.put("component", "go");
		attributes.put("detectedVersion", version);
		attributes.put("indirect", "false");
		attributes.put("modulePath", safeValue(goManifest.modulePath()));
		attributes.put("versionStatus", versionStatus.name());

		return new DetectedTechnology(TechnologyFamily.GO, "go-runtime",
				"Go runtime", confidence, evidence, graph, attributes);
	}

	private DetectedTechnology dependencyTechnology(
			Path manifest,
			String relativePath,
			GoManifestParser.GoManifest goManifest,
			GoManifestParser.GoDependency dependency
	) {
		DependencyVersionStatus versionStatus = "UNRESOLVED".equals(dependency.version())
				? DependencyVersionStatus.UNRESOLVED
				: DependencyVersionStatus.EXACT;
		Confidence confidence = versionStatus == DependencyVersionStatus.UNRESOLVED
				? Confidence.of(0.40d)
				: Confidence.of(0.93d);

		DependencyGraph graph = DependencyGraph.builder("go-manifest:" + relativePath)
				.node("go-manifest", DependencyNodeKind.MANIFEST, manifest.getFileName().toString(),
						new DependencyCoordinate(null, "go", goManifest.goVersion(), goManifest.goVersion() == null
								|| goManifest.goVersion().isBlank() ? DependencyVersionStatus.UNRESOLVED
										: DependencyVersionStatus.EXACT,
								DependencyScope.BUILD,
								Map.of("manifestPath", relativePath, "modulePath", safeValue(goManifest.modulePath()))),
						Map.of("manifestPath", relativePath, "modulePath", safeValue(goManifest.modulePath())))
				.node(dependencyNodeId(dependency), DependencyNodeKind.DEPENDENCY, dependency.modulePath(),
						new DependencyCoordinate(namespaceOf(dependency.modulePath()), dependency.modulePath(),
								dependency.version(), versionStatus, DependencyScope.COMPILE,
								Map.of("indirect", Boolean.toString(dependency.indirect()))),
						Map.of("lineNumber", Integer.toString(dependency.lineNumber()), "indirect",
								Boolean.toString(dependency.indirect())))
				.edge("go-manifest", dependencyNodeId(dependency), DependencyRelation.DECLARES,
						Map.of("indirect", Boolean.toString(dependency.indirect())))
				.build();

		List<DetectionEvidence> evidence = List.of(new DetectionEvidence(
				EvidenceType.DEPENDENCY,
				manifest,
				dependency.rawLine(),
				dependency.indirect() ? 0.85d : 0.95d
		));

		Map<String, String> attributes = new LinkedHashMap<>();
		attributes.put("kind", "dependency");
		attributes.put("manifestPath", relativePath);
		attributes.put("component", dependency.modulePath());
		attributes.put("detectedVersion", dependency.version());
		attributes.put("indirect", Boolean.toString(dependency.indirect()));
		attributes.put("lineNumber", Integer.toString(dependency.lineNumber()));
		attributes.put("rawLine", dependency.rawLine());
		attributes.put("modulePath", safeValue(goManifest.modulePath()));
		attributes.put("versionStatus", versionStatus.name());

		return new DetectedTechnology(TechnologyFamily.GO, dependency.modulePath(), dependency.modulePath(), confidence,
				evidence, graph, attributes);
	}

	private boolean isGoManifest(Path path) {
		String fileName = path.getFileName().toString();
		return fileName.equals("go.mod") || fileName.equals("go.work");
	}

	private String namespaceOf(String modulePath) {
		if (modulePath == null || modulePath.isBlank()) {
			return null;
		}
		int slashIndex = modulePath.indexOf('/');
		if (slashIndex > 0) {
			return modulePath.substring(0, slashIndex);
		}
		return modulePath;
	}

	private String dependencyNodeId(GoManifestParser.GoDependency dependency) {
		return "dependency:" + dependency.modulePath() + "@" + dependency.lineNumber();
	}

	private String relativePath(Path workspaceRoot, Path file) {
		return workspaceRoot.relativize(file).toString().replace('\\', '/');
	}

	private String safeValue(String value) {
		return value == null ? "" : value;
	}
}
