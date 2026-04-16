package com.hackathonday.migrationhelper.detection;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.assertj.core.api.Assertions.assertThat;

class GradleDetectorTest {

	@TempDir
	Path tempDir;

	@Test
	void detectsGradlePlatformAndManagedDependencies() throws Exception {
		Files.writeString(tempDir.resolve("build.gradle.kts"), """
				plugins {
				  java
				}

				dependencies {
				  implementation(platform("org.springframework.boot:spring-boot-dependencies:3.5.0"))
				  implementation("org.slf4j:slf4j-api")
				  testImplementation("org.junit.jupiter:junit-jupiter:5.10.2")
				}
				""", StandardCharsets.UTF_8);

		DetectionReport report = new GradleDetector().detect(tempDir);

		DetectedTechnology technology = report.technologies().get(0);
		assertThat(technology.tool()).isEqualTo("gradle");
		assertThat(technology.evidence()).extracting(DetectionEvidence::type).contains(EvidenceType.PLATFORM);
		assertThat(technology.dependencyGraph().nodes()).anySatisfy(node -> {
			if ("slf4j-api".equals(node.name())) {
				assertThat(node.coordinate().versionStatus()).isEqualTo(DependencyVersionStatus.MANAGED);
			}
		});
		assertThat(technology.dependencyGraph().nodes()).anySatisfy(node -> {
			if ("junit-jupiter".equals(node.name())) {
				assertThat(node.coordinate().versionStatus()).isEqualTo(DependencyVersionStatus.EXACT);
			}
		});
	}
}
