package com.hackathonday.migrationhelper;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.hackathonday.migrationhelper.api.contract.CreateScanRequest;
import com.hackathonday.migrationhelper.api.contract.PathScanRequest;
import com.hackathonday.migrationhelper.api.contract.ScanReportResponse;
import java.io.IOException;
import java.net.URISyntaxException;
import java.net.URL;
import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
class MigrationHelperUiSmokeTests {

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private ObjectMapper objectMapper;

	@Test
	void servesStaticUiEntrypointAtRootPath() throws Exception {
		mockMvc.perform(get("/"))
				.andExpect(status().isOk())
				.andExpect(content().contentTypeCompatibleWith(MediaType.TEXT_HTML))
				.andExpect(content().string(org.hamcrest.Matchers.containsString("Migration Helper")))
				.andExpect(content().string(org.hamcrest.Matchers.containsString("href=\"/styles.css\"")))
				.andExpect(content().string(org.hamcrest.Matchers.containsString("src=\"/app.js\"")))
				.andExpect(content().string(org.hamcrest.Matchers.containsString("id=\"archive-scan-form\"")))
				.andExpect(content().string(org.hamcrest.Matchers.containsString("id=\"path-scan-form\"")))
				.andExpect(content().string(org.hamcrest.Matchers.containsString("id=\"scan-detail-drawer\"")))
				.andExpect(content().string(org.hamcrest.Matchers.containsString("data-endpoint=\"/api/scans\"")));
	}

	@Test
	void servesStaticUiAssetsAndMockFixtures() throws Exception {
		mockMvc.perform(get("/styles.css"))
				.andExpect(status().isOk())
				.andExpect(content().contentTypeCompatibleWith("text/css"));

		mockMvc.perform(get("/app.js"))
				.andExpect(status().isOk())
				.andExpect(content().contentTypeCompatibleWith("text/javascript"));

		mockMvc.perform(get("/mock-data/scan-list.json"))
				.andExpect(status().isOk())
				.andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
				.andExpect(jsonPath("$[0].id").value("scan-local-001"));
	}

	@Test
	void sampleArchiveRequestPayloadPostsSuccessfully() throws Exception {
		CreateScanRequest request = readFixture("ui-fixtures/sample-archive-scan-request.json", CreateScanRequest.class);

		mockMvc.perform(post("/api/scans")
						.contentType(MediaType.APPLICATION_JSON)
						.content(objectMapper.writeValueAsString(request)))
				.andExpect(status().isAccepted())
				.andExpect(jsonPath("$.displayName").value(request.displayName()))
				.andExpect(jsonPath("$.sourceType").value("ARCHIVE_UPLOAD"));
	}

	@Test
	void samplePathRequestPayloadPostsSuccessfully() throws Exception {
		PathScanRequest request = readFixture("ui-fixtures/sample-path-scan-request.json", PathScanRequest.class);

		mockMvc.perform(post("/api/scans/path")
						.contentType(MediaType.APPLICATION_JSON)
						.content(objectMapper.writeValueAsString(request)))
				.andExpect(status().isAccepted())
				.andExpect(jsonPath("$.displayName").value(request.displayName()))
				.andExpect(jsonPath("$.sourceType").value("LOCAL_PATH"));
	}

	@Test
	void sampleReportPayloadDeserializesIntoUsableStructure() throws Exception {
		ScanReportResponse report = readFixture("ui-fixtures/sample-scan-report-response.json", ScanReportResponse.class);

		assertThat(report.id()).isEqualTo("scan-ui-sample");
		assertThat(report.workspace().normalizationStatus()).isEqualTo("READY");
		assertThat(report.detectors()).hasSize(2);
		assertThat(report.warnings()).extracting("code").contains("PIPELINE_PLACEHOLDER");
		assertThat(report.policyStatuses()).extracting("supportStatus").contains("SUPPORTED");
		assertThat(report.recommendations()).extracting("recommendedVersion").contains("21");
	}

	private <T> T readFixture(String resourcePath, Class<T> type) throws IOException, URISyntaxException {
		URL resource = getClass().getClassLoader().getResource(resourcePath);
		if (resource == null) {
			throw new IllegalStateException("Missing test resource: " + resourcePath);
		}
		return objectMapper.readValue(Files.readString(Path.of(resource.toURI())), type);
	}
}
