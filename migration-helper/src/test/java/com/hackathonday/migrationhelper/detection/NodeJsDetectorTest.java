package com.hackathonday.migrationhelper.detection;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.assertj.core.api.Assertions.assertThat;

class NodeJsDetectorTest {

	@TempDir
	Path tempDir;

	@Test
	void detectsPnpmFromLockfileAndPackageJson() throws Exception {
		Files.writeString(tempDir.resolve("package.json"), """
				{
				  "name": "demo-app",
				  "version": "1.0.0",
				  "dependencies": {
				    "react": "^18.2.0"
				  }
				}
				""", StandardCharsets.UTF_8);
		Files.writeString(tempDir.resolve("pnpm-lock.yaml"), "lockfileVersion: '9'\n", StandardCharsets.UTF_8);

		DetectionReport report = new NodeJsDetector().detect(tempDir);

		assertThat(report.technologies()).hasSize(1);
		DetectedTechnology technology = report.technologies().get(0);
		assertThat(technology.family()).isEqualTo(TechnologyFamily.NODE_JS);
		assertThat(technology.tool()).isEqualTo("pnpm");
		assertThat(technology.confidence().level()).isEqualTo(ConfidenceLevel.CERTAIN);
		assertThat(technology.evidence()).extracting(DetectionEvidence::type).contains(EvidenceType.MANIFEST, EvidenceType.LOCKFILE);
		assertThat(technology.dependencyGraph().nodes()).anyMatch(node -> "react".equals(node.name()));
	}

	@Test
	void detectsYarnWhenYarnLockIsPresent() throws Exception {
		Files.writeString(tempDir.resolve("package.json"), """
				{
				  "name": "demo-app",
				  "packageManager": "pnpm@9.0.0"
				}
				""", StandardCharsets.UTF_8);
		Files.writeString(tempDir.resolve("yarn.lock"), "# yarn lockfile v1\n", StandardCharsets.UTF_8);

		DetectionReport report = new NodeJsDetector().detect(tempDir);

		DetectedTechnology technology = report.technologies().get(0);
		assertThat(technology.tool()).isEqualTo("yarn");
		assertThat(technology.attributes()).containsEntry("packageManager", "yarn");
	}
}
