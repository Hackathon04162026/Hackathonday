package com.hackathonday.migrationhelper.policy;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.DefaultResourceLoader;

class SupportPolicyDatasetLoaderTest {

	@TempDir
	Path tempDir;

	private final SupportPolicyDatasetLoader loader = new SupportPolicyDatasetLoader(
			new DefaultResourceLoader(),
			new ObjectMapper().findAndRegisterModules(),
			new SupportPolicyDatasetValidator()
	);

	@Test
	void loadsBundledSupportPolicyDatasetFromClasspath() {
		SupportPolicyDatasetLoadResult result = loader.loadBundledDataset();

		assertEquals(2, result.dataset().policies().size());
		assertTrue(result.warnings().isEmpty());
	}

	@Test
	void failsWhenRequiredPolicyFieldsAreMissing() throws Exception {
		Path datasetFile = tempDir.resolve("support-policy-missing-source.json");
		Files.writeString(
				datasetFile,
				"""
				{
				  "datasetVersion": "2026.04",
				  "generatedOn": "2026-04-16",
				  "policies": [
				    {
				      "ecosystem": "nodejs",
				      "component": "node",
				      "source": "https://example.invalid",
				      "versions": [
				        {
				          "version": "22.x",
				          "supportStatus": "supported",
				          "releasedOn": "2024-04-24",
				          "supportEndsOn": "2027-04-30"
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
				() -> loader.load(new FileSystemResource(datasetFile))
		);

		assertTrue(exception.getMessage().contains("$.source"));
	}

	@Test
	void warnsWhenVersionDatesAreOutOfOrderButStillLoads() throws Exception {
		Path datasetFile = tempDir.resolve("support-policy-warning.json");
		Files.writeString(
				datasetFile,
				"""
				{
				  "datasetVersion": "2026.04",
				  "source": "classpath:policy/support-policy.json",
				  "generatedOn": "2026-04-16",
				  "policies": [
				    {
				      "ecosystem": "nodejs",
				      "component": "node",
				      "source": "https://example.invalid",
				      "versions": [
				        {
				          "version": "99.x",
				          "supportStatus": "supported",
				          "releasedOn": "2027-04-30",
				          "supportEndsOn": "2026-04-30"
				        }
				      ]
				    }
				  ]
				}
				""",
				StandardCharsets.UTF_8
		);

		SupportPolicyDatasetLoadResult result = loader.load(new FileSystemResource(datasetFile));

		assertFalse(result.warnings().isEmpty());
		assertTrue(result.warnings().get(0).message().contains("releasedOn must be on or before supportEndsOn"));
	}

	@Test
	void failsWhenAVersionDateCannotBeParsed() throws Exception {
		Path datasetFile = tempDir.resolve("support-policy-bad-date.json");
		Files.writeString(
				datasetFile,
				"""
				{
				  "datasetVersion": "2026.04",
				  "source": "classpath:policy/support-policy.json",
				  "generatedOn": "2026-04-16",
				  "policies": [
				    {
				      "ecosystem": "python",
				      "component": "python",
				      "source": "https://example.invalid",
				      "versions": [
				        {
				          "version": "3.13",
				          "supportStatus": "supported",
				          "releasedOn": "not-a-date",
				          "supportEndsOn": "2029-10-01"
				        }
				      ]
				    }
				  ]
				}
				""",
				StandardCharsets.UTF_8
		);

		SupportPolicyDatasetLoadException exception = assertThrows(
				SupportPolicyDatasetLoadException.class,
				() -> loader.load(new FileSystemResource(datasetFile))
		);

		assertTrue(exception.getMessage().contains("Unable to read support-policy dataset"));
	}
}
