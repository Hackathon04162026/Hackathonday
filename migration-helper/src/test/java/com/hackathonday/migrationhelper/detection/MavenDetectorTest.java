package com.hackathonday.migrationhelper.detection;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.assertj.core.api.Assertions.assertThat;

class MavenDetectorTest {

	@TempDir
	Path tempDir;

	@Test
	void detectsManagedDependenciesAndParentInheritance() throws Exception {
		Path parentDir = Files.createDirectories(tempDir.resolve("parent"));
		Files.writeString(parentDir.resolve("pom.xml"), """
				<project xmlns="http://maven.apache.org/POM/4.0.0">
				  <modelVersion>4.0.0</modelVersion>
				  <groupId>com.example</groupId>
				  <artifactId>parent</artifactId>
				  <version>1.0.0</version>
				  <dependencyManagement>
				    <dependencies>
				      <dependency>
				        <groupId>org.slf4j</groupId>
				        <artifactId>slf4j-api</artifactId>
				        <version>2.0.13</version>
				      </dependency>
				    </dependencies>
				  </dependencyManagement>
				</project>
				""", StandardCharsets.UTF_8);
		Files.writeString(tempDir.resolve("pom.xml"), """
				<project xmlns="http://maven.apache.org/POM/4.0.0">
				  <modelVersion>4.0.0</modelVersion>
				  <parent>
				    <groupId>com.example</groupId>
				    <artifactId>parent</artifactId>
				    <version>1.0.0</version>
				    <relativePath>parent/pom.xml</relativePath>
				  </parent>
				  <artifactId>child</artifactId>
				  <dependencies>
				    <dependency>
				      <groupId>org.slf4j</groupId>
				      <artifactId>slf4j-api</artifactId>
				    </dependency>
				    <dependency>
				      <groupId>junit</groupId>
				      <artifactId>junit</artifactId>
				      <version>4.13.2</version>
				      <scope>test</scope>
				    </dependency>
				  </dependencies>
				</project>
				""", StandardCharsets.UTF_8);

		DetectionReport report = new MavenDetector().detect(tempDir);

		DetectedTechnology technology = report.technologies().get(0);
		assertThat(technology.tool()).isEqualTo("maven");
		assertThat(technology.attributes()).containsEntry("projectVersionStatus", "INHERITED");
		assertThat(technology.dependencyGraph().nodes()).anySatisfy(node -> {
			if ("slf4j-api".equals(node.name())) {
				assertThat(node.coordinate().versionStatus()).isEqualTo(DependencyVersionStatus.MANAGED);
				assertThat(node.coordinate().version()).isEqualTo("2.0.13");
			}
		});
		assertThat(technology.dependencyGraph().edges()).extracting(DependencyEdge::relation)
				.contains(DependencyRelation.INHERITS_FROM, DependencyRelation.MANAGES);
	}
}
