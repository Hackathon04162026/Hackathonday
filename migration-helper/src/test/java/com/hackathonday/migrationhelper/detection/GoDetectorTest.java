package com.hackathonday.migrationhelper.detection;

import static org.assertj.core.api.Assertions.assertThat;

import java.net.URISyntaxException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import org.junit.jupiter.api.Test;

class GoDetectorTest {

	private final GoDetector detector = new GoDetector();

	@Test
	void detectsGoRuntimeAndDependenciesAcrossNestedManifests() throws Exception {
		Path workspaceRoot = resolveFixture("/go-fixtures/multimodule/workspace/root");

		assertThat(detector.supports(workspaceRoot)).isTrue();

		DetectionReport report = detector.detect(workspaceRoot);
		assertThat(report.detectorId()).isEqualTo("go");
		assertThat(report.technologies()).hasSize(5);

		List<DetectedTechnology> technologies = report.technologies();
		DetectedTechnology runtime = technologies.get(0);
		assertThat(runtime.family()).isEqualTo(TechnologyFamily.GO);
		assertThat(runtime.tool()).isEqualTo("go-runtime");
		assertThat(runtime.attributes()).containsEntry("component", "go");
		assertThat(runtime.attributes()).containsEntry("detectedVersion", "1.22.3");
		assertThat(runtime.confidence().level()).isEqualTo(ConfidenceLevel.HIGH);

		DetectedTechnology indirectDependency = technologies.get(2);
		assertThat(indirectDependency.attributes()).containsEntry("component", "golang.org/x/text");
		assertThat(indirectDependency.attributes()).containsEntry("indirect", "true");
		assertThat(indirectDependency.attributes()).containsEntry("detectedVersion", "v0.21.0");

		DetectedTechnology unresolvedRuntime = technologies.get(3);
		assertThat(unresolvedRuntime.attributes()).containsEntry("component", "go");
		assertThat(unresolvedRuntime.attributes()).containsEntry("detectedVersion", "UNRESOLVED");
		assertThat(unresolvedRuntime.confidence().level()).isEqualTo(ConfidenceLevel.LOW);
	}

	private Path resolveFixture(String resourcePath) throws URISyntaxException {
		Path path = Path.of(getClass().getResource(resourcePath).toURI());
		assertThat(Files.isDirectory(path)).isTrue();
		return path;
	}
}
