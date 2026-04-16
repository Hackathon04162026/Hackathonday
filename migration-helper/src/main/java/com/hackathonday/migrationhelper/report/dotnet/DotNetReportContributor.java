package com.hackathonday.migrationhelper.report.dotnet;

import com.hackathonday.migrationhelper.api.contract.DetectorFindingResponse;
import com.hackathonday.migrationhelper.report.ReportContribution;
import com.hackathonday.migrationhelper.report.ReportContributor;
import com.hackathonday.migrationhelper.scan.ScanRecord;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.InvalidPathException;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import javax.xml.XMLConstants;
import javax.xml.parsers.DocumentBuilderFactory;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.NodeList;
import org.xml.sax.InputSource;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 100)
public class DotNetReportContributor implements ReportContributor {

	private static final Pattern GLOBAL_JSON_VERSION = Pattern.compile("\"version\"\\s*:\\s*\"([^\"]+)\"");
	private static final List<String> PROJECT_EXTENSIONS = List.of(".csproj", ".fsproj", ".vbproj");

	@Override
	public ReportContribution contribute(ScanRecord scan) {
		Path workspaceRoot = resolveWorkspaceRoot(scan.normalizedWorkspacePath());
		if (workspaceRoot == null) {
			return ReportContribution.empty();
		}

		List<DetectorFindingResponse> findings = new ArrayList<>();
		findings.addAll(findSdkFindings(workspaceRoot));
		findings.addAll(findProjectFindings(workspaceRoot));
		findings.sort(Comparator
				.comparing(DetectorFindingResponse::ecosystem)
				.thenComparing(DetectorFindingResponse::component)
				.thenComparing(DetectorFindingResponse::detectedVersion)
				.thenComparing(finding -> finding.evidence().toString()));

		if (findings.isEmpty()) {
			return ReportContribution.empty();
		}

		return new ReportContribution(List.of(), List.copyOf(findings), List.of(), List.of());
	}

	private List<DetectorFindingResponse> findSdkFindings(Path workspaceRoot) {
		List<DetectorFindingResponse> findings = new ArrayList<>();
		try (var paths = Files.walk(workspaceRoot)) {
			paths.filter(path -> path.getFileName() != null && path.getFileName().toString().equalsIgnoreCase("global.json"))
					.forEach(path -> readGlobalJson(path).ifPresent(version -> findings.add(new DetectorFindingResponse(
							"dotnet",
							"sdk",
							version,
							"HIGH",
							false,
							evidence(path, workspaceRoot, "global.json", "sdk.version", version, "explicit")
					))));
		} catch (IOException ignored) {
			return findings;
		}
		return findings;
	}

	private List<DetectorFindingResponse> findProjectFindings(Path workspaceRoot) {
		List<DetectorFindingResponse> findings = new ArrayList<>();
		try (var paths = Files.walk(workspaceRoot)) {
			paths.filter(Files::isRegularFile)
					.filter(this::isProjectFile)
					.sorted()
					.forEach(path -> parseProjectFile(path, workspaceRoot, findings));
		} catch (IOException ignored) {
			return findings;
		}
		return findings;
	}

	private void parseProjectFile(Path projectFile, Path workspaceRoot, List<DetectorFindingResponse> findings) {
		Optional<Document> document = parseXml(projectFile);
		if (document.isEmpty()) {
			return;
		}

		Document xml = document.get();
		for (String framework : readTargetFrameworks(xml)) {
			findings.add(new DetectorFindingResponse(
					"dotnet",
					"target-framework",
					framework,
					"HIGH",
					false,
					evidence(projectFile, workspaceRoot, projectFile.getFileName().toString(), "targetFramework", framework, "explicit")
			));
		}

		Map<String, String> centralVersions = readCentralPackageVersions(projectFile);
		NodeList packageReferences = xml.getElementsByTagNameNS("*", "PackageReference");
		for (int i = 0; i < packageReferences.getLength(); i++) {
			Element packageReference = (Element) packageReferences.item(i);
			String component = firstNonBlank(
					packageReference.getAttribute("Include"),
					packageReference.getAttribute("Update")
			);
			if (component.isBlank()) {
				continue;
			}

			String version = firstNonBlank(
					packageReference.getAttribute("Version"),
					packageReference.getAttribute("VersionOverride"),
					childText(packageReference, "Version"),
					childText(packageReference, "VersionOverride")
			);
			boolean indirect = false;
			String confidence = "HIGH";
			String versionSource = "explicit";

			if (version.isBlank()) {
				String centralVersion = centralVersions.get(component);
				if (centralVersion != null && !centralVersion.isBlank()) {
					version = centralVersion;
					indirect = true;
					versionSource = "directory.packages.props";
				} else {
					version = "UNRESOLVED";
					indirect = true;
					confidence = "LOW";
					versionSource = "unresolved";
				}
			}

			findings.add(new DetectorFindingResponse(
					"dotnet",
					component,
					version,
					confidence,
					indirect,
					evidence(projectFile, workspaceRoot, projectFile.getFileName().toString(), "packageReference", component, versionSource)
			));
		}
	}

	private Map<String, String> readCentralPackageVersions(Path projectFile) {
		Path current = projectFile.getParent();
		while (current != null) {
			Path propsFile = current.resolve("Directory.Packages.props");
			if (Files.isRegularFile(propsFile)) {
				Optional<Document> document = parseXml(propsFile);
				if (document.isEmpty()) {
					return Map.of();
				}
				Map<String, String> versions = new LinkedHashMap<>();
				NodeList packageVersions = document.get().getElementsByTagNameNS("*", "PackageVersion");
				for (int i = 0; i < packageVersions.getLength(); i++) {
					Element packageVersion = (Element) packageVersions.item(i);
					String component = firstNonBlank(packageVersion.getAttribute("Include"), packageVersion.getAttribute("Update"));
					String version = firstNonBlank(packageVersion.getAttribute("Version"), childText(packageVersion, "Version"));
					if (!component.isBlank() && !version.isBlank()) {
						versions.put(component, version);
					}
				}
				return versions;
			}
			current = current.getParent();
		}
		return Map.of();
	}

	private List<String> readTargetFrameworks(Document xml) {
		List<String> frameworks = new ArrayList<>();
		NodeList targetFrameworks = xml.getElementsByTagNameNS("*", "TargetFramework");
		for (int i = 0; i < targetFrameworks.getLength(); i++) {
			String value = textContent(targetFrameworks.item(i));
			if (!value.isBlank()) {
				frameworks.add(value);
			}
		}

		NodeList targetFrameworksPlural = xml.getElementsByTagNameNS("*", "TargetFrameworks");
		for (int i = 0; i < targetFrameworksPlural.getLength(); i++) {
			String value = textContent(targetFrameworksPlural.item(i));
			if (!value.isBlank()) {
				for (String part : value.split(";")) {
					String framework = part.trim();
					if (!framework.isBlank()) {
						frameworks.add(framework);
					}
				}
			}
		}

		return frameworks;
	}

	private Optional<Document> parseXml(Path file) {
		try {
			DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
			factory.setNamespaceAware(true);
			factory.setFeature(XMLConstants.FEATURE_SECURE_PROCESSING, true);
			factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
			factory.setExpandEntityReferences(false);
			return Optional.of(factory.newDocumentBuilder().parse(file.toFile()));
		} catch (Exception ignored) {
			return Optional.empty();
		}
	}

	private Optional<String> readGlobalJson(Path file) {
		try {
			String text = Files.readString(file);
			Matcher matcher = GLOBAL_JSON_VERSION.matcher(text);
			if (matcher.find()) {
				return Optional.of(matcher.group(1).trim());
			}
			return Optional.empty();
		} catch (IOException ignored) {
			return Optional.empty();
		}
	}

	private boolean isProjectFile(Path path) {
		String fileName = path.getFileName().toString().toLowerCase(Locale.ROOT);
		return PROJECT_EXTENSIONS.stream().anyMatch(fileName::endsWith);
	}

	private Path resolveWorkspaceRoot(String normalizedWorkspacePath) {
		if (normalizedWorkspacePath == null || normalizedWorkspacePath.isBlank()) {
			return null;
		}
		try {
			Path workspaceRoot = Paths.get(normalizedWorkspacePath);
			if (Files.isDirectory(workspaceRoot)) {
				return workspaceRoot;
			}
		} catch (InvalidPathException ignored) {
			return null;
		}
		return null;
	}

	private Map<String, Object> evidence(
			Path sourceFile,
			Path workspaceRoot,
			String sourceType,
			String matchType,
			String value,
			String versionSource
	) {
		Map<String, Object> evidence = new LinkedHashMap<>();
		evidence.put("sourcePath", workspaceRoot.relativize(sourceFile).toString().replace('\\', '/'));
		evidence.put("sourceType", sourceType);
		evidence.put("matchType", matchType);
		evidence.put("value", value);
		evidence.put("versionSource", versionSource);
		return evidence;
	}

	private String childText(Element element, String childName) {
		NodeList children = element.getElementsByTagNameNS("*", childName);
		if (children.getLength() == 0) {
			return "";
		}
		return textContent(children.item(0));
	}

	private String textContent(org.w3c.dom.Node node) {
		return node == null ? "" : Objects.toString(node.getTextContent(), "").trim();
	}

	private String firstNonBlank(String... values) {
		for (String value : values) {
			if (value != null && !value.isBlank()) {
				return value.trim();
			}
		}
		return "";
	}
}
