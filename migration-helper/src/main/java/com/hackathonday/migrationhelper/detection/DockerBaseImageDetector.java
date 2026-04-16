package com.hackathonday.migrationhelper.detection;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Stream;
import org.springframework.stereotype.Component;

@Component
public final class DockerBaseImageDetector implements Detector {

	private static final Pattern FROM_PATTERN = Pattern.compile("(?i)^FROM(?:\\s+--\\S+)*\\s+(?<reference>[^\\s]+)(?:\\s+AS\\s+\\S+)?(?:\\s+#.*)?$");

	@Override
	public String id() {
		return "docker";
	}

	@Override
	public boolean supports(Path projectRoot) throws IOException {
		try (Stream<Path> paths = Files.walk(projectRoot)) {
			return paths.filter(Files::isRegularFile).anyMatch(this::isDockerfile);
		}
	}

	@Override
	public DetectionReport detect(Path projectRoot) throws IOException {
		List<Path> dockerfiles = listDockerfiles(projectRoot);
		List<DetectedTechnology> technologies = new ArrayList<>();
		for (Path dockerfile : dockerfiles) {
			technologies.addAll(scanDockerfile(projectRoot, dockerfile));
		}
		return technologies.isEmpty() ? DetectionReport.empty(id()) : new DetectionReport(id(), technologies);
	}

	private List<Path> listDockerfiles(Path projectRoot) throws IOException {
		try (Stream<Path> paths = Files.walk(projectRoot)) {
			return paths.filter(Files::isRegularFile)
					.filter(this::isDockerfile)
					.sorted(Comparator.comparing(path -> relativePath(projectRoot, path)))
					.toList();
		}
	}

	private List<DetectedTechnology> scanDockerfile(Path projectRoot, Path dockerfile) {
		List<DetectedTechnology> technologies = new ArrayList<>();
		String relativePath = relativePath(projectRoot, dockerfile);
		Path relativeSource = projectRoot.relativize(dockerfile);
		try {
			List<String> lines = Files.readAllLines(dockerfile, StandardCharsets.UTF_8);
			for (int index = 0; index < lines.size(); index++) {
				Matcher matcher = FROM_PATTERN.matcher(lines.get(index).trim());
				if (!matcher.matches()) {
					continue;
				}

				DockerBaseImageReference reference = parseReference(matcher.group("reference"));
				technologies.add(createTechnology(relativePath, relativeSource, dockerfile, index + 1, reference));
			}
		} catch (IOException ignored) {
			return List.of();
		}
		return technologies;
	}

	private DetectedTechnology createTechnology(String relativePath, Path relativeSource, Path dockerfile, int lineNumber,
			DockerBaseImageReference reference) {
		String rootId = "dockerfile:" + relativePath + ":" + lineNumber;
		String nodeId = "base-image:" + lineNumber;
		DependencyVersionStatus versionStatus = "UNRESOLVED".equals(reference.version())
				? DependencyVersionStatus.UNRESOLVED
				: DependencyVersionStatus.EXACT;
		DependencyGraph graph = DependencyGraph.builder(rootId)
				.node(rootId, DependencyNodeKind.BUILD_FILE, dockerfile.getFileName().toString(),
						new DependencyCoordinate(null, dockerfile.getFileName().toString(), null,
								DependencyVersionStatus.ABSENT, DependencyScope.BUILD, Map.of("path", relativePath)),
						Map.of("path", relativePath))
				.node(nodeId, DependencyNodeKind.DEPENDENCY, reference.component(),
						new DependencyCoordinate(null, reference.component(), reference.version(), versionStatus,
								DependencyScope.BUILD, Map.of("reference", reference.rawReference())),
						Map.of("lineNumber", Integer.toString(lineNumber), "reference", reference.rawReference()))
				.edge(rootId, nodeId, DependencyRelation.DEPENDS_ON,
						Map.of("instruction", "FROM", "lineNumber", Integer.toString(lineNumber)))
				.build();

		List<DetectionEvidence> evidence = List.of(new DetectionEvidence(
				EvidenceType.BUILD_FILE,
				relativeSource,
				"Docker base image declared on line " + lineNumber,
				reference.indirect() ? 0.55d : 1.0d
		));

		Map<String, String> attributes = new LinkedHashMap<>();
		attributes.put("file", relativePath);
		attributes.put("lineNumber", Integer.toString(lineNumber));
		attributes.put("rawReference", reference.rawReference());
		attributes.put("detectedVersion", reference.version());
		attributes.put("indirect", Boolean.toString(reference.indirect()));

		double confidenceScore = reference.indirect() ? 0.35d : "UNRESOLVED".equals(reference.version()) ? 0.55d : 0.90d;
		return new DetectedTechnology(
				TechnologyFamily.DOCKER,
				reference.component(),
				"Docker base image (" + reference.component() + ")",
				Confidence.of(confidenceScore),
				evidence,
				graph,
				attributes
		);
	}

	private DockerBaseImageReference parseReference(String rawReference) {
		String trimmed = stripQuotes(rawReference.trim());
		if (containsTemplateExpression(trimmed)) {
			return new DockerBaseImageReference(trimmed, trimmed, "UNRESOLVED", true);
		}

		String withoutDigest = stripDigest(trimmed);
		int tagSeparator = withoutDigest.lastIndexOf(':');
		int pathSeparator = withoutDigest.lastIndexOf('/');
		if (tagSeparator > pathSeparator) {
			String component = withoutDigest.substring(0, tagSeparator);
			String version = withoutDigest.substring(tagSeparator + 1);
			return new DockerBaseImageReference(trimmed, component, version.isBlank() ? "UNRESOLVED" : version, false);
		}

		if (trimmed.contains("@")) {
			int digestSeparator = trimmed.indexOf('@');
			String version = digestSeparator >= 0 && digestSeparator + 1 < trimmed.length()
					? trimmed.substring(digestSeparator + 1)
					: "UNRESOLVED";
			return new DockerBaseImageReference(trimmed, withoutDigest, version, false);
		}

		return new DockerBaseImageReference(trimmed, withoutDigest, "UNRESOLVED", false);
	}

	private boolean isDockerfile(Path path) {
		String name = path.getFileName().toString().toLowerCase(Locale.ROOT);
		return "dockerfile".equals(name) || name.startsWith("dockerfile.");
	}

	private boolean containsTemplateExpression(String value) {
		return value.contains("$") || value.contains("{") || value.contains("}");
	}

	private String stripDigest(String reference) {
		int digestSeparator = reference.indexOf('@');
		return digestSeparator >= 0 ? reference.substring(0, digestSeparator) : reference;
	}

	private String stripQuotes(String value) {
		if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
			return value.substring(1, value.length() - 1);
		}
		return value;
	}

	private String relativePath(Path root, Path file) {
		return root.relativize(file).toString().replace('\\', '/');
	}

	private record DockerBaseImageReference(String rawReference, String component, String version, boolean indirect) {
	}
}
