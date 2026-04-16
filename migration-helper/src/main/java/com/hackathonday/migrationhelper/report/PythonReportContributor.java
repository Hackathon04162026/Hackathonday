package com.hackathonday.migrationhelper.report;

import com.hackathonday.migrationhelper.api.contract.DetectorFindingResponse;
import com.hackathonday.migrationhelper.scan.ScanRecord;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Stream;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class PythonReportContributor implements ReportContributor {

	private static final Pattern REQUIRES_PYTHON = Pattern.compile("^requires-python\\s*=\\s*(.+)$");
	private static final Pattern TOML_KEY_VALUE = Pattern.compile("^(?<key>[A-Za-z0-9_.-]+)\\s*=\\s*(?<value>.+)$");
	private static final Pattern REQUIREMENT_LINE = Pattern.compile(
			"^(?<name>[A-Za-z0-9_.-]+)(?:\\[(?<extras>[^\\]]+)])?(?:\\s*(?<operator>==|===|~=|!=|<=|>=|<|>)\\s*(?<version>[^;#\\s]+))?.*$"
	);
	private static final Pattern QUOTED_VALUE = Pattern.compile("^\"(?<value>.*)\"$");
	private static final Pattern TOML_VERSION = Pattern.compile("version\\s*=\\s*\"(?<value>[^\"]+)\"");
	private static final Pattern TOML_PYTHON_VERSION = Pattern.compile("python(?:_full)?_version\\s*=\\s*\"(?<value>[^\"]+)\"");

	@Override
	public ReportContribution contribute(ScanRecord scan) {
		Path workspaceRoot = resolveWorkspaceRoot(scan.normalizedWorkspacePath());
		if (workspaceRoot == null) {
			return ReportContribution.empty();
		}

		List<DetectorFindingResponse> findings = new ArrayList<>();
		try (Stream<Path> paths = Files.walk(workspaceRoot)) {
			paths.filter(Files::isRegularFile)
					.sorted(Comparator.comparing(path -> relativePath(workspaceRoot, path)))
					.forEach(path -> scanFile(workspaceRoot, path, findings));
		} catch (IOException ex) {
			return ReportContribution.empty();
		}

		if (findings.isEmpty()) {
			return ReportContribution.empty();
		}
		return new ReportContribution(List.of(), List.copyOf(findings), List.of(), List.of());
	}

	private Path resolveWorkspaceRoot(String normalizedWorkspacePath) {
		if (normalizedWorkspacePath == null || normalizedWorkspacePath.isBlank()) {
			return null;
		}

		Path workspaceRoot = Path.of(normalizedWorkspacePath);
		if (Files.isDirectory(workspaceRoot)) {
			return workspaceRoot;
		}
		return null;
	}

	private void scanFile(Path workspaceRoot, Path file, List<DetectorFindingResponse> findings) {
		String fileName = file.getFileName().toString().toLowerCase(Locale.ROOT);
		if ("pyproject.toml".equals(fileName)) {
			scanPyProject(workspaceRoot, file, findings);
			return;
		}
		if ("pipfile".equals(fileName)) {
			scanPipfile(workspaceRoot, file, findings);
			return;
		}
		if (fileName.startsWith("requirements") && fileName.endsWith(".txt")) {
			scanRequirements(workspaceRoot, file, findings);
		}
	}

	private void scanPyProject(Path workspaceRoot, Path file, List<DetectorFindingResponse> findings) {
		try {
			List<String> lines = Files.readAllLines(file);
			String section = "";
			boolean inProjectDependencies = false;
			for (int i = 0; i < lines.size(); i++) {
				String trimmed = stripInlineComment(lines.get(i)).trim();
				if (trimmed.isEmpty()) {
					continue;
				}

				if (isTomlSection(trimmed)) {
					section = trimmed.substring(1, trimmed.length() - 1);
					inProjectDependencies = false;
					continue;
				}

				if ("project".equals(section)) {
					Matcher requiresPython = REQUIRES_PYTHON.matcher(trimmed);
					if (requiresPython.matches()) {
						addRuntimeFinding(workspaceRoot, file, i + 1, "pyproject.toml", "requires-python",
								unquote(requiresPython.group(1)), findings);
						continue;
					}

					if (trimmed.startsWith("dependencies")) {
						inProjectDependencies = trimmed.contains("[") && !trimmed.contains("]");
						extractQuotedRequirements(workspaceRoot, file, i + 1, "pyproject.toml", "project.dependencies",
								trimmed, findings);
						continue;
					}

					if (inProjectDependencies) {
						extractQuotedRequirements(workspaceRoot, file, i + 1, "pyproject.toml", "project.dependencies",
								trimmed, findings);
						if (trimmed.contains("]")) {
							inProjectDependencies = false;
						}
					}
					continue;
				}

				if (section.startsWith("tool.poetry.dependencies") || section.startsWith("tool.poetry.group.")) {
					Matcher keyValue = TOML_KEY_VALUE.matcher(trimmed);
					if (keyValue.matches()) {
						String key = keyValue.group("key");
						String value = keyValue.group("value").trim();
						if ("python".equalsIgnoreCase(key)) {
							addRuntimeFinding(workspaceRoot, file, i + 1, "pyproject.toml", "tool.poetry.dependencies",
									extractTomlValue(value), findings);
						} else {
							addKeyedDependencyFinding(workspaceRoot, file, i + 1, "pyproject.toml",
									"tool.poetry.dependencies", key, value, findings);
						}
					}
				}
			}
		} catch (IOException ex) {
			// Keep scanning other manifests if one file cannot be read.
		}
	}

	private void scanPipfile(Path workspaceRoot, Path file, List<DetectorFindingResponse> findings) {
		try {
			List<String> lines = Files.readAllLines(file);
			String section = "";
			for (int i = 0; i < lines.size(); i++) {
				String trimmed = stripInlineComment(lines.get(i)).trim();
				if (trimmed.isEmpty()) {
					continue;
				}

				if (isTomlSection(trimmed)) {
					section = trimmed.substring(1, trimmed.length() - 1);
					continue;
				}

				if (!"packages".equals(section) && !"dev-packages".equals(section) && !"requires".equals(section)) {
					continue;
				}

				Matcher keyValue = TOML_KEY_VALUE.matcher(trimmed);
				if (!keyValue.matches()) {
					continue;
				}

				String key = keyValue.group("key");
				String value = keyValue.group("value").trim();
				if ("requires".equals(section) && ("python_version".equalsIgnoreCase(key) || "python_full_version".equalsIgnoreCase(key))) {
					addRuntimeFinding(workspaceRoot, file, i + 1, "Pipfile", "requires", extractTomlValue(value), findings);
				} else if (!"requires".equals(section)) {
					addKeyedDependencyFinding(workspaceRoot, file, i + 1, "Pipfile", section, key, value, findings);
				}
			}
		} catch (IOException ex) {
			// Keep scanning other manifests if one file cannot be read.
		}
	}

	private void scanRequirements(Path workspaceRoot, Path file, List<DetectorFindingResponse> findings) {
		try {
			List<String> lines = Files.readAllLines(file);
			for (int i = 0; i < lines.size(); i++) {
				String trimmed = stripInlineComment(lines.get(i)).trim();
				if (trimmed.isEmpty() || trimmed.startsWith("-")) {
					continue;
				}

				Matcher matcher = REQUIREMENT_LINE.matcher(trimmed);
				if (!matcher.matches() || matcher.group("operator") == null || matcher.group("version") == null) {
					continue;
				}

				String name = normalizeComponent(matcher.group("name"));
				String operator = matcher.group("operator");
				String version = matcher.group("version");
				boolean indirect = !"==".equals(operator) && !"===".equals(operator);
				findings.add(createFinding(
						workspaceRoot,
						file,
						i + 1,
						"python",
						name,
						indirect ? operator + version : version,
						indirect ? "MEDIUM" : "HIGH",
						indirect,
						"requirements.txt",
						"dependency",
						trimmed
				));
			}
		} catch (IOException ex) {
			// Keep scanning other manifests if one file cannot be read.
		}
	}

	private void extractQuotedRequirements(
			Path workspaceRoot,
			Path file,
			int lineNumber,
			String manifestType,
			String field,
			String rawLine,
			List<DetectorFindingResponse> findings
	) {
		Matcher matcher = Pattern.compile("\"([^\"]+)\"").matcher(rawLine);
		while (matcher.find()) {
			addRequirementExpression(workspaceRoot, file, lineNumber, manifestType, field, matcher.group(1), findings);
		}
	}

	private void addKeyedDependencyFinding(
			Path workspaceRoot,
			Path file,
			int lineNumber,
			String manifestType,
			String field,
			String component,
			String rawValue,
			List<DetectorFindingResponse> findings
	) {
		String spec = extractTomlValue(rawValue);
		if (spec == null || spec.isBlank() || spec.equals("*")) {
			return;
		}
		boolean indirect = isIndirectSpecifier(spec);
		findings.add(createFinding(
				workspaceRoot,
				file,
				lineNumber,
				"python",
				normalizeComponent(component),
				indirect ? spec : stripExactMarker(spec),
				indirect ? "MEDIUM" : "HIGH",
				indirect,
				manifestType,
				field,
				rawValue
		));
	}

	private void addRuntimeFinding(
			Path workspaceRoot,
			Path file,
			int lineNumber,
			String manifestType,
			String field,
			String rawValue,
			List<DetectorFindingResponse> findings
	) {
		String spec = extractTomlValue(rawValue);
		if (spec == null || spec.isBlank()) {
			return;
		}
		boolean indirect = isIndirectSpecifier(spec);
		findings.add(createFinding(
				workspaceRoot,
				file,
				lineNumber,
				"python",
				"python-runtime",
				indirect ? spec : stripExactMarker(spec),
				indirect ? "MEDIUM" : "HIGH",
				indirect,
				manifestType,
				field,
				rawValue
		));
	}

	private void addRequirementExpression(
			Path workspaceRoot,
			Path file,
			int lineNumber,
			String manifestType,
			String field,
			String requirement,
			List<DetectorFindingResponse> findings
	) {
		Matcher matcher = REQUIREMENT_LINE.matcher(requirement.trim());
		if (!matcher.matches()) {
			return;
		}

		String operator = matcher.group("operator");
		String version = matcher.group("version");
		if (operator == null || version == null) {
			return;
		}

		boolean indirect = !"==".equals(operator) && !"===".equals(operator);
		findings.add(createFinding(
				workspaceRoot,
				file,
				lineNumber,
				"python",
				normalizeComponent(matcher.group("name")),
				indirect ? operator + version : version,
				indirect ? "MEDIUM" : "HIGH",
				indirect,
				manifestType,
				field,
				requirement
		));
	}

	private DetectorFindingResponse createFinding(
			Path workspaceRoot,
			Path file,
			int lineNumber,
			String ecosystem,
			String component,
			String detectedVersion,
			String confidence,
			boolean indirect,
			String manifestType,
			String field,
			String rawValue
	) {
		String relativePath = relativePath(workspaceRoot, file);
		return new DetectorFindingResponse(
				ecosystem,
				component,
				detectedVersion,
				confidence,
				indirect,
				Map.of(
						"relativePath", relativePath,
						"lineNumber", lineNumber,
						"manifestType", manifestType,
						"field", field,
						"rawValue", rawValue
				)
		);
	}

	private boolean isTomlSection(String trimmed) {
		return trimmed.startsWith("[") && trimmed.endsWith("]");
	}

	private boolean isIndirectSpecifier(String specifier) {
		String trimmed = specifier.trim();
		return trimmed.startsWith(">") || trimmed.startsWith("<") || trimmed.startsWith("~") || trimmed.startsWith("!") || trimmed.startsWith("^") || trimmed.startsWith("*");
	}

	private String stripExactMarker(String specifier) {
		String trimmed = specifier.trim();
		if (trimmed.startsWith("===")) {
			return trimmed.substring(3).trim();
		}
		if (trimmed.startsWith("==")) {
			return trimmed.substring(2).trim();
		}
		return trimmed;
	}

	private String extractTomlValue(String rawValue) {
		String trimmed = rawValue.trim();
		Matcher quoted = QUOTED_VALUE.matcher(trimmed);
		if (quoted.matches()) {
			return quoted.group("value");
		}

		Matcher version = TOML_VERSION.matcher(trimmed);
		if (version.find()) {
			return version.group("value");
		}

		Matcher pythonVersion = TOML_PYTHON_VERSION.matcher(trimmed);
		if (pythonVersion.find()) {
			return pythonVersion.group("value");
		}

		return trimmed;
	}

	private String stripInlineComment(String line) {
		return line.replaceFirst("\\s+#.*$", "");
	}

	private String unquote(String value) {
		Matcher matcher = QUOTED_VALUE.matcher(value.trim());
		if (matcher.matches()) {
			return matcher.group("value");
		}
		return value.trim();
	}

	private String normalizeComponent(String component) {
		return component.trim().toLowerCase(Locale.ROOT).replace('_', '-');
	}

	private String relativePath(Path workspaceRoot, Path file) {
		return workspaceRoot.relativize(file).toString().replace('\\', '/');
	}
}
