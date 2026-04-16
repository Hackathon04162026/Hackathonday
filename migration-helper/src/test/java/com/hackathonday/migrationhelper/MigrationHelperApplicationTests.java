package com.hackathonday.migrationhelper;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class MigrationHelperApplicationTests {

	@Autowired
	private MockMvc mockMvc;

	@Test
	void contextLoads() {
	}

	@Test
	void createsArchiveScanAndReturnsCanonicalContract() throws Exception {
		mockMvc.perform(post("/api/scans")
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{
								  "uploadedArchiveToken": "upload-123",
								  "sourceFilename": "demo.zip",
								  "sizeBytes": 2048,
								  "displayName": "Demo Archive",
								  "requestedBy": "ui"
								}
								"""))
				.andExpect(status().isAccepted())
				.andExpect(header().string("Location", org.hamcrest.Matchers.matchesPattern("/api/scans/scan-.+")))
				.andExpect(jsonPath("$.status").value("COMPLETED"))
				.andExpect(jsonPath("$.sourceType").value("ARCHIVE_UPLOAD"))
				.andExpect(jsonPath("$.displayName").value("Demo Archive"))
				.andExpect(jsonPath("$.warnings[0].code").value("ARCHIVE_METADATA_CAPTURED"));
	}

	@Test
	void createsPathScanListsItAndReturnsReport() throws Exception {
		String response = mockMvc.perform(post("/api/scans/path")
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{
								  "path": "C:/repos/demo",
								  "displayName": "Local Demo"
								}
								"""))
				.andExpect(status().isAccepted())
				.andExpect(jsonPath("$.sourceType").value("LOCAL_PATH"))
				.andReturn()
				.getResponse()
				.getContentAsString();

		String id = response.replaceAll(".*\"id\":\"([^\"]+)\".*", "$1");

		mockMvc.perform(get("/api/scans"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$[0].id").value(id));

		mockMvc.perform(get("/api/scans/{id}/report", id))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.id").value(id))
				.andExpect(jsonPath("$.workspace.normalizationStatus").value("READY"))
				.andExpect(jsonPath("$.warnings[?(@.code=='PIPELINE_PLACEHOLDER')]").exists());
	}

	@Test
	void returnsNotFoundForUnknownScan() throws Exception {
		mockMvc.perform(get("/api/scans/{id}", "scan-missing"))
				.andExpect(status().isNotFound())
				.andExpect(jsonPath("$.error").value("scan_not_found"));
	}

}
