package com.hackathonday.migrationhelper.report.dotnet;

import static org.hamcrest.Matchers.containsInAnyOrder;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.io.IOException;
import java.net.URISyntaxException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Objects;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
class DotNetReportContributorTests {

	@Autowired
	private MockMvc mockMvc;

	@Test
	void reportIncludesDotNetSdkFrameworkAndPackageFindings(@TempDir Path tempDir) throws Exception {
		Path workspaceRoot = tempDir.resolve("workspace-root");
		copyFixtureTree(Path.of(Objects.requireNonNull(getClass().getResource("/fixtures/dotnet")).toURI()), workspaceRoot);

		String response = mockMvc.perform(post("/api/scans/path")
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{
								  "path": "%s",
								  "displayName": "DotNet Fixture"
								}
								""".formatted(workspaceRoot.toString().replace("\\", "\\\\"))))
				.andExpect(status().isAccepted())
				.andReturn()
				.getResponse()
				.getContentAsString();

		String id = response.replaceAll(".*\"id\":\"([^\"]+)\".*", "$1");

		mockMvc.perform(get("/api/scans/{id}/report", id))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.detectors[*].ecosystem").value(containsInAnyOrder("dotnet", "dotnet", "dotnet", "dotnet")))
				.andExpect(jsonPath("$.detectors[?(@.component=='sdk')].detectedVersion").value(containsInAnyOrder("8.0.201")))
				.andExpect(jsonPath("$.detectors[?(@.component=='target-framework')].detectedVersion").value(containsInAnyOrder("net8.0")))
				.andExpect(jsonPath("$.detectors[?(@.component=='Newtonsoft.Json')].indirect").value(containsInAnyOrder(false)))
				.andExpect(jsonPath("$.detectors[?(@.component=='Serilog')].indirect").value(containsInAnyOrder(true)))
				.andExpect(jsonPath("$.detectors[?(@.component=='Serilog')].detectedVersion").value(containsInAnyOrder("3.1.1")))
				.andExpect(jsonPath("$.warnings[?(@.code=='PIPELINE_PLACEHOLDER')]").exists());
	}

	private void copyFixtureTree(Path sourceRoot, Path targetRoot) throws IOException {
		try (var paths = Files.walk(sourceRoot)) {
			paths.forEach(path -> {
				try {
					Path relative = sourceRoot.relativize(path);
					Path target = targetRoot.resolve(relative.toString());
					if (Files.isDirectory(path)) {
						Files.createDirectories(target);
					} else {
						Files.createDirectories(target.getParent());
						Files.copy(path, target);
					}
				} catch (IOException e) {
					throw new IllegalStateException(e);
				}
			});
		}
	}
}
