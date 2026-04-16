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
public final class CiRuntimeDetector implements Detector {

	private static final Pattern SETUP_ACTION_PATTERN = Pattern.compile("^(?:-\\s*)?uses:\\s*actions/setup-(node|python|java|dotnet|go)@([^\\s#]+)\\s*$", Pattern.CASE_INSENSITIVE);
	private static final Pattern VERSION_LINE_PATTERN = Pattern.compile("^(node-version|node-version-file|python-version|python-version-file|java-version|dotnet-version|go-version)\\s*:\\s*(.+?)\\s*$", Pattern.CASE_INSENSITIVE);

	@Override
	public String id() {
		return "ci-runtime";
	}

	@Override
	public boolean supports(Path projectRoot) throws IOException {
		try (Stream<Path> paths = Files.walk(projectRoot)) {
			return paths.filter(Files::isRegularFile).anyMatch(this::isCiWorkflow);
		}
	}

	@Override
	public DetectionReport detect(Path projectRoot) throws IOException {
		List<Path> workflows = listWorkflowFiles(projectRoot);
		List<DetectedTechnology> technologies = new ArrayList<>();
		for (Path workflow : workflows) {
			technologies.addAll(scanWorkflow(projectRoot, workflow));
		}
		return technologies.isEmpty() ? DetectionReport.empty(id()) : new DetectionReport(id(), technologies);
	}

	private List<Path> listWorkflowFiles(Path projectRoot) throws IOException {
		try (Stream<Path> paths = Files.walk(projectRoot)) {
			return paths.filter(Files::isRegularFile)
					.filter(this::isCiWorkflow)
					.sorted(Comparator.comparing(path -> relativePath(projectRoot, path)))
					.toList();
		}
	}

	private List<DetectedTechnology> scanWorkflow(Path projectRoot, Path workflow) {
		List<DetectedTechnology> technologies = new ArrayList<>();
		String relativePath = relativePath(projectRoot, workflow);
		try {
			List<String> lines = Files.readAllLines(workflow, StandardCharsets.UTF_8);
			for (int index = 0; index < lines.size(); index++) {
				Matcher actionMatcher = SETUP_ACTION_PATTERN.matcher(lines.get(index).trim());
				if (!actionMatcher.matches()) {
					continue;
				}

				String runtime = actionMatcher.group(1).toLowerCase(Locale.ROOT);
				String action = "actions/setup-" + runtime;
				RuntimeVersionMatch version = findVersionForAction(lines, index, runtime);
				technologies.add(createTechnology(relativePath, workflow, index + 1, action, version));
			}
		} catch (IOException ignored) {
			return List.of();
		}
		return technologies;
	}

	private DetectedTechnology createTechnology(String relativePath, Path workflow, int lineNumber, String action,
			RuntimeVersionMatch version) {
		String rootId = "ci-workflow:" + relativePath + ":" + lineNumber;
		String nodeId = "runtime:" + lineNumber;
		DependencyVersionStatus versionStatus = "UNRESOLVED".equals(version.detectedVersion())
				? DependencyVersionStatus.UNRESOLVED
				: DependencyVersionStatus.EXACT;
		DependencyGraph graph = DependencyGraph.builder(rootId)
				.node(rootId, DependencyNodeKind.BUILD_FILE, workflow.getFileName().toString(),
						new DependencyCoordinate(null, workflow.getFileName().toString(), null,
								DependencyVersionStatus.ABSENT, DependencyScope.BUILD, Map.of("path", relativePath)),
						Map.of("path", relativePath))
				.node(nodeId, DependencyNodeKind.DEPENDENCY, action,
						new DependencyCoordinate(null, action, version.detectedVersion(), versionStatus,
								DependencyScope.BUILD, Map.of("versionKey", version.versionKey())),
						Map.of("lineNumber", Integer.toString(lineNumber), "versionKey", version.versionKey()))
				.edge(rootId, nodeId, DependencyRelation.DEPENDS_ON,
						Map.of("action", action, "lineNumber", Integer.toString(lineNumber)))
				.build();

		List<DetectionEvidence> evidence = List.of(new DetectionEvidence(
				EvidenceType.BUILD_FILE,
				workflow,
				"CI runtime configured on line " + lineNumber,
				version.indirect() ? 0.55d : 1.0d
		));

		Map<String, String> attributes = new LinkedHashMap<>();
		attributes.put("file", relativePath);
		attributes.put("lineNumber", Integer.toString(lineNumber));
		attributes.put("action", action);
		attributes.put("versionKey", version.versionKey());
		attributes.put("rawValue", version.rawValue());
		attributes.put("detectedVersion", version.detectedVersion());
		attributes.put("indirect", Boolean.toString(version.indirect()));

		double confidenceScore = version.indirect() ? 0.35d : "UNRESOLVED".equals(version.detectedVersion()) ? 0.55d : 0.90d;
		return new DetectedTechnology(
				TechnologyFamily.CI,
				action,
				"CI runtime (" + action + ")",
				Confidence.of(confidenceScore),
				evidence,
				graph,
				attributes
		);
	}

	private RuntimeVersionMatch findVersionForAction(List<String> lines, int actionIndex, String runtime) {
		String versionKey = versionKeyFor(runtime);
		int actionIndent = indentation(lines.get(actionIndex));

		for (int index = actionIndex + 1; index < lines.size() && index <= actionIndex + 20; index++) {
			String trimmed = lines.get(index).trim();
			int indent = indentation(lines.get(index));
			if (index > actionIndex && indent <= actionIndent && trimmed.startsWith("- ")) {
				break;
			}

			Matcher matcher = VERSION_LINE_PATTERN.matcher(trimmed);
			if (!matcher.matches()) {
				continue;
			}

			String candidateKey = matcher.group(1);
			if (!candidateKey.equalsIgnoreCase(versionKey) && !candidateKey.equalsIgnoreCase(versionKey + "-file")) {
				continue;
			}

			String rawValue = stripQuotes(matcher.group(2));
			boolean indirect = candidateKey.endsWith("-file") || containsTemplateExpression(rawValue);
			String detectedVersion = indirect ? "UNRESOLVED" : rawValue;
			return new RuntimeVersionMatch(versionKey, rawValue, detectedVersion, indirect);
		}

		return new RuntimeVersionMatch(versionKey, "UNRESOLVED", "UNRESOLVED", true);
	}

	private String versionKeyFor(String runtime) {
		return switch (runtime) {
			case "node" -> "node-version";
			case "python" -> "python-version";
			case "java" -> "java-version";
			case "dotnet" -> "dotnet-version";
			case "go" -> "go-version";
			default -> runtime + "-version";
		};
	}

	private boolean isCiWorkflow(Path path) {
		String normalized = path.toString().replace('\\', '/').toLowerCase(Locale.ROOT);
		return normalized.startsWith(".github/workflows/")
				&& (normalized.endsWith(".yml") || normalized.endsWith(".yaml"));
	}

	private boolean containsTemplateExpression(String value) {
		return value.contains("$") || value.contains("{") || value.contains("}");
	}

	private String stripQuotes(String value) {
		if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
			return value.substring(1, value.length() - 1);
		}
		return value;
	}

	private int indentation(String line) {
		int count = 0;
		while (count < line.length() && Character.isWhitespace(line.charAt(count))) {
			count++;
		}
		return count;
	}

	private String relativePath(Path root, Path file) {
		return root.relativize(file).toString().replace('\\', '/');
	}

	private record RuntimeVersionMatch(String versionKey, String rawValue, String detectedVersion, boolean indirect) {
	}
}
