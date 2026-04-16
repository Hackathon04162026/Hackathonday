package com.hackathonday.migrationhelper;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class DockerAndCiReportContributorIntegrationTests {

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private ObjectMapper objectMapper;

	@Test
	void detectsDockerBaseImagesAndCiRuntimeVersionsFromWorkspace(@TempDir Path tempDir) throws Exception {
		Files.writeString(tempDir.resolve("Dockerfile"), """
				FROM eclipse-temurin:21-jre
				FROM ${BUILD_IMAGE} AS build
				""");

		Path workflowDirectory = tempDir.resolve(".github/workflows");
		Files.createDirectories(workflowDirectory);
		Files.writeString(workflowDirectory.resolve("ci.yml"), """
				name: ci
				on:
				  push:
				jobs:
				  build:
				    runs-on: ubuntu-latest
				    steps:
				      - uses: actions/setup-node@v4
				        with:
				          node-version: 20
				      - uses: actions/setup-dotnet@v4
				        with:
				          dotnet-version: 8.0.x
				""");

		String path = tempDir.toString().replace("\\", "\\\\");
		String created = mockMvc.perform(post("/api/scans/path")
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{
								  "path": "%s",
								  "displayName": "Docker and CI workspace"
								}
								""".formatted(path)))
				.andExpect(status().isAccepted())
				.andExpect(jsonPath("$.sourceType").value("LOCAL_PATH"))
				.andReturn()
				.getResponse()
				.getContentAsString();

		String scanId = objectMapper.readTree(created).get("id").asText();

		String reportJson = mockMvc.perform(get("/api/scans/{id}/report", scanId))
				.andExpect(status().isOk())
				.andReturn()
				.getResponse()
				.getContentAsString();

		JsonNode report = objectMapper.readTree(reportJson);
		JsonNode detectors = report.get("detectors");
		JsonNode policyStatuses = report.get("policyStatuses");
		JsonNode recommendations = report.get("recommendations");

		assertThat(detectors).hasSize(2);
		assertDetector(detectors, "docker", "eclipse-temurin", "21-jre", false);
		assertDetector(detectors, "docker", "${BUILD_IMAGE}", "UNRESOLVED", true);
		assertThat(policyStatuses).hasSize(2);
		assertThat(policyStatuses.findValuesAsText("supportStatus")).contains("SUPPORTED", "UNKNOWN");
		assertThat(recommendations).hasSize(1);
		assertThat(recommendations.get(0).get("component").asText()).isEqualTo("${BUILD_IMAGE}");
		assertThat(recommendations.get(0).get("rationale").asText()).contains("Resolve the indirect version reference");
	}

	private void assertDetector(JsonNode detectors, String ecosystem, String component, String detectedVersion, boolean indirect) {
		assertThat(detectors.findValuesAsText("ecosystem")).contains(ecosystem);
		boolean matchFound = false;

		for (JsonNode detector : detectors) {
			if (!ecosystem.equals(detector.get("ecosystem").asText())) {
				continue;
			}
			if (!component.equals(detector.get("component").asText())) {
				continue;
			}
			if (!detectedVersion.equals(detector.get("detectedVersion").asText())) {
				continue;
			}
			if (indirect != detector.get("indirect").asBoolean()) {
				continue;
			}
			matchFound = true;
			break;
		}

		assertThat(matchFound)
				.as("Expected detector %s/%s=%s indirect=%s", ecosystem, component, detectedVersion, indirect)
				.isTrue();
	}
}
