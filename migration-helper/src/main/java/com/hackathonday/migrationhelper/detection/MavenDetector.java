package com.hackathonday.migrationhelper.detection;

import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.Node;
import org.w3c.dom.NodeList;

import javax.xml.XMLConstants;
import javax.xml.parsers.DocumentBuilderFactory;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

public final class MavenDetector implements Detector {

	@Override
	public String id() {
		return "maven";
	}

	@Override
	public boolean supports(Path projectRoot) {
		return Files.exists(projectRoot.resolve("pom.xml"));
	}

	@Override
	public DetectionReport detect(Path projectRoot) throws IOException {
		Path pomPath = projectRoot.resolve("pom.xml");
		Document document = parseXml(pomPath);
		Element project = document.getDocumentElement();

		String groupId = firstNonBlank(text(project, "groupId"), parentValue(project, "groupId"));
		String artifactId = text(project, "artifactId");
		String version = firstNonBlank(text(project, "version"), parentValue(project, "version"));
		DependencyVersionStatus versionStatus = text(project, "version") != null ? DependencyVersionStatus.EXACT
				: parentValue(project, "version") != null ? DependencyVersionStatus.INHERITED : DependencyVersionStatus.UNRESOLVED;

		List<DetectionEvidence> evidence = new ArrayList<>();
		evidence.add(new DetectionEvidence(EvidenceType.BUILD_FILE, pomPath, "pom.xml detected", 1.0d));

		DependencyGraph.Builder graph = DependencyGraph.builder("maven-project");
		graph.node("maven-project", DependencyNodeKind.PROJECT, artifactId,
				new DependencyCoordinate(groupId, artifactId, version, versionStatus, DependencyScope.BUILD,
						Map.of("packaging", firstNonBlank(text(project, "packaging"), "jar"))),
				Map.of("path", pomPath.toString()));

		Optional<Path> parentPom = resolveParentPom(projectRoot, project);
		if (parentPom.isPresent()) {
			graph.node("maven-parent", DependencyNodeKind.PARENT, parentPom.get().getFileName().toString(),
					new DependencyCoordinate(null, parentPom.get().getFileName().toString(), null,
							DependencyVersionStatus.ABSENT, DependencyScope.BUILD, Map.of()),
					Map.of("path", parentPom.get().toString()));
			graph.edge("maven-project", "maven-parent", DependencyRelation.INHERITS_FROM, Map.of("resolved", "true"));
			evidence.add(new DetectionEvidence(EvidenceType.PARENT_DESCRIPTOR, parentPom.get(),
					"Resolved Maven parent pom", 0.8d));
		}

		Map<String, String> managedVersions = collectManagedVersions(project, parentPom);
		if (!managedVersions.isEmpty()) {
			evidence.add(new DetectionEvidence(EvidenceType.MANAGED_DEPENDENCY, pomPath,
					"dependencyManagement entries found", 0.8d));
		}

		for (Dependency dependency : collectDependencies(project)) {
			DependencyCoordinate coordinate = coordinateFor(dependency, managedVersions);
			String nodeId = dependency.scope().name().toLowerCase() + ":" + dependency.artifactId();
			graph.node(nodeId, DependencyNodeKind.DEPENDENCY, dependency.artifactId(), coordinate,
					Map.of("scope", dependency.scope().name().toLowerCase()));
			graph.edge("maven-project", nodeId, DependencyRelation.DECLARES,
					Map.of("scope", dependency.scope().name().toLowerCase()));
			if (coordinate.versionStatus() == DependencyVersionStatus.MANAGED) {
				graph.edge("maven-project", nodeId, DependencyRelation.MANAGES,
						Map.of("version", coordinate.version() == null ? "" : coordinate.version()));
			}
			evidence.add(new DetectionEvidence(EvidenceType.DEPENDENCY, pomPath,
					dependency.groupId() + ":" + dependency.artifactId(), 0.6d));
		}

		DetectedTechnology technology = new DetectedTechnology(TechnologyFamily.JAVA, "maven", "Java (Maven)",
				Confidence.of(0.95d), evidence, graph.build(), Map.of("buildFile", pomPath.toString(),
				"projectVersionStatus", versionStatus.name()));
		return new DetectionReport(id(), List.of(technology));
	}

	private static DependencyCoordinate coordinateFor(Dependency dependency, Map<String, String> managedVersions) {
		String coordinateVersion = dependency.version();
		DependencyVersionStatus status = DependencyVersionStatus.EXACT;
		if (coordinateVersion == null || coordinateVersion.isBlank()) {
			coordinateVersion = managedVersions.get(keyFor(dependency.groupId(), dependency.artifactId()));
			if (coordinateVersion != null) {
				status = DependencyVersionStatus.MANAGED;
			} else {
				status = DependencyVersionStatus.UNRESOLVED;
			}
		} else if (coordinateVersion.contains("${")) {
			status = DependencyVersionStatus.UNRESOLVED;
		}
		return new DependencyCoordinate(dependency.groupId(), dependency.artifactId(), coordinateVersion, status,
				dependency.scope(), Map.of());
	}

	private static Map<String, String> collectManagedVersions(Element project, Optional<Path> parentPom) {
		Map<String, String> managedVersions = new LinkedHashMap<>();
		Element dependencyManagement = firstChildElement(project, "dependencyManagement");
		if (dependencyManagement != null) {
			Element dependencies = firstChildElement(dependencyManagement, "dependencies");
			if (dependencies != null) {
				for (Element dependency : childElements(dependencies, "dependency")) {
					String version = text(dependency, "version");
					if (version != null) {
						managedVersions.put(keyFor(text(dependency, "groupId"), text(dependency, "artifactId")), version);
					}
				}
			}
		}
		parentPom.ifPresent(path -> {
			try {
				Document parentDocument = parseXml(path);
				Element parentProject = parentDocument.getDocumentElement();
				managedVersions.putAll(collectManagedVersions(parentProject, Optional.empty()));
			} catch (IOException ignored) {
				// Best-effort parent resolution only.
			}
		});
		return managedVersions;
	}

	private static List<Dependency> collectDependencies(Element project) {
		List<Dependency> dependencies = new ArrayList<>();
		Element dependenciesRoot = firstChildElement(project, "dependencies");
		if (dependenciesRoot == null) {
			return dependencies;
		}
		for (Element dependency : childElements(dependenciesRoot, "dependency")) {
			String groupId = text(dependency, "groupId");
			String artifactId = text(dependency, "artifactId");
			String version = text(dependency, "version");
			DependencyScope scope = scopeOf(text(dependency, "scope"));
			dependencies.add(new Dependency(groupId, artifactId, version, scope));
		}
		return dependencies;
	}

	private static Optional<Path> resolveParentPom(Path projectRoot, Element project) {
		Element parent = firstChildElement(project, "parent");
		if (parent == null) {
			return Optional.empty();
		}
		String relativePath = text(parent, "relativePath");
		Path parentPath = (relativePath == null || relativePath.isBlank()) ? projectRoot.resolve("../pom.xml").normalize()
				: projectRoot.resolve(relativePath).normalize();
		if (Files.exists(parentPath)) {
			return Optional.of(parentPath);
		}
		return Optional.empty();
	}

	private static Document parseXml(Path pomPath) throws IOException {
		try (InputStream inputStream = Files.newInputStream(pomPath)) {
			DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
			factory.setFeature(XMLConstants.FEATURE_SECURE_PROCESSING, true);
			factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
			factory.setNamespaceAware(false);
			Document document = factory.newDocumentBuilder().parse(inputStream);
			document.getDocumentElement().normalize();
			return document;
		} catch (Exception exception) {
			throw new IOException("Unable to parse pom.xml at " + pomPath, exception);
		}
	}

	private static String text(Element element, String childName) {
		Element child = firstChildElement(element, childName);
		return child == null ? null : child.getTextContent().trim();
	}

	private static String parentValue(Element project, String childName) {
		Element parent = firstChildElement(project, "parent");
		return parent == null ? null : text(parent, childName);
	}

	private static Element firstChildElement(Element element, String childName) {
		NodeList children = element.getChildNodes();
		for (int index = 0; index < children.getLength(); index++) {
			Node child = children.item(index);
			if (child instanceof Element childElement && childName.equals(childElement.getTagName())) {
				return childElement;
			}
		}
		return null;
	}

	private static List<Element> childElements(Element element, String childName) {
		List<Element> elements = new ArrayList<>();
		NodeList children = element.getChildNodes();
		for (int index = 0; index < children.getLength(); index++) {
			Node child = children.item(index);
			if (child instanceof Element childElement && childName.equals(childElement.getTagName())) {
				elements.add(childElement);
			}
		}
		return elements;
	}

	private static String keyFor(String groupId, String artifactId) {
		return groupId + ":" + artifactId;
	}

	private static DependencyScope scopeOf(String scope) {
		if (scope == null || scope.isBlank()) {
			return DependencyScope.COMPILE;
		}
		return switch (scope) {
			case "test" -> DependencyScope.TEST;
			case "runtime" -> DependencyScope.RUNTIME;
			case "provided" -> DependencyScope.PROVIDED;
			default -> DependencyScope.UNKNOWN;
		};
	}

	private static String firstNonBlank(String first, String fallback) {
		return first != null && !first.isBlank() ? first : fallback;
	}

	private record Dependency(String groupId, String artifactId, String version, DependencyScope scope) {
	}
}
