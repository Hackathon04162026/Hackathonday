package com.hackathonday.migrationhelper.policy;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.core.io.FileSystemResource;

class SupportPolicyDatasetLoaderTest {

	@TempDir
	Path tempDir;

	@Test
	void loadsBundledDatasetFromClasspath() {
		SupportPolicyDatasetLoader loader = new SupportPolicyDatasetLoader(new ObjectMapper());

		assertThat(loader.dataset()).isNotNull();
		assertThat(loader.dataset().policies()).isNotEmpty();
		assertThat(loader.warnings()).isEmpty();
	}

	@Test
	void warnsWhenVersionDatesAreOutOfOrderButStillLoads() throws Exception {
		SupportPolicyDatasetLoader loader = new SupportPolicyDatasetLoader(new ObjectMapper());
		Path resourceFile = tempDir.resolve("support-policies-warning.json");
		Files.writeString(
				resourceFile,
				"""
				{
				  "schemaVersion": "1",
				  "generatedOn": "2026-04-16",
				  "sources": [
				    {
				      "id": "node-release-schedule",
				      "name": "Node.js Release Schedule",
				      "url": "https://nodejs.org/en/about/previous-releases",
				      "retrievedOn": "2026-04-16"
				    }
				  ],
				  "policies": [
				    {
				      "ecosystem": "node",
				      "component": "node",
				      "versions": [
				        {
				          "version": "20",
				          "releaseDate": "2026-04-30",
				          "supportEndDate": "2026-04-16",
				          "preferredUpgrade": "22",
				          "alternativeUpgrades": [],
				          "sourceId": "node-release-schedule"
				        }
				      ]
				    }
				  ]
				}
				""",
				StandardCharsets.UTF_8
		);

		loader.load(new FileSystemResource(resourceFile));

		assertThat(loader.warnings()).anySatisfy(issue ->
				assertThat(issue.message()).contains("releaseDate is after supportEndDate"));
	}

	@Test
	void failsWhenRequiredVersionFieldIsMissing() throws Exception {
		SupportPolicyDatasetLoader loader = new SupportPolicyDatasetLoader(new ObjectMapper());
		Path resourceFile = tempDir.resolve("support-policies-invalid.json");
		Files.writeString(
				resourceFile,
				"""
				{
				  "schemaVersion": "1",
				  "generatedOn": "2026-04-16",
				  "sources": [
				    {
				      "id": "node-release-schedule",
				      "name": "Node.js Release Schedule",
				      "url": "https://nodejs.org/en/about/previous-releases",
				      "retrievedOn": "2026-04-16"
				    }
				  ],
				  "policies": [
				    {
				      "ecosystem": "node",
				      "component": "node",
				      "versions": [
				        {
				          "version": "20",
				          "releaseDate": "2023-04-18",
				          "supportEndDate": "2026-04-30",
				          "preferredUpgrade": "22",
				          "alternativeUpgrades": [],
				          "sourceId": ""
				        }
				      ]
				    }
				  ]
				}
				""",
				StandardCharsets.UTF_8
		);

		SupportPolicyDatasetValidationException exception = assertThrows(
				SupportPolicyDatasetValidationException.class,
				() -> loader.load(new FileSystemResource(resourceFile))
		);

		assertThat(exception.getMessage()).contains("$.policies[0].versions[0].sourceId");
	}
}
