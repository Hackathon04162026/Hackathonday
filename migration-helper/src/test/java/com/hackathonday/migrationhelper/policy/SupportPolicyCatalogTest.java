package com.hackathonday.migrationhelper.policy;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.util.List;
import org.junit.jupiter.api.Test;

class SupportPolicyCatalogTest {

	@Test
	void prefersTheMostSpecificMatchingPolicyForVersionAndComponent() {
		SupportPolicyCatalog catalog = SupportPolicyCatalog.of(List.of(
				new SupportPolicyRule(
						"python",
						"django",
						"",
						"3.2.0",
						"4.0.0",
						"",
						SupportPolicyStatus.EXPIRING_SOON,
						"4.0.0",
						List.of("3.2.25", "3.1.14"),
						new PolicySourceMetadata("policy-core", "Bundled support policy", "2026.04", null)
				),
				new SupportPolicyRule(
						"python",
						"django",
						"3.2.18",
						"",
						"",
						"",
						SupportPolicyStatus.SUPPORTED,
						"4.0.0",
						List.of("3.2.25"),
						new PolicySourceMetadata("policy-hotfix", "Hotfix policy", "2026.04.1", null)
				),
				new SupportPolicyRule(
						"python",
						"*",
						"",
						"",
						"",
						"",
						SupportPolicyStatus.UNSUPPORTED,
						"4.0.0",
						List.of(),
						new PolicySourceMetadata("policy-fallback", "Fallback policy", "2026.04", null)
				)
		));

		PolicyLookupResult result = catalog.lookup(new PolicyLookupQuery("python", "django", "3.2.18"));

		assertEquals(SupportPolicyStatus.SUPPORTED, result.supportStatus());
		assertEquals("3.2.18", result.version());
		assertEquals("policy-hotfix", result.sourceMetadata().sourceId());
		assertEquals("Hotfix policy 2026.04.1", result.sourceMetadata().displayValue());
		assertEquals(List.of("3.2.25"), result.alternativeVersions());
	}

	@Test
	void fallsBackToUnknownVersionWhenNothingMatches() {
		SupportPolicyCatalog catalog = SupportPolicyCatalog.of(List.of(
				new SupportPolicyRule(
						"go",
						"github.com/acme/tool",
						"1.0.0",
						"",
						"",
						"",
						SupportPolicyStatus.SUPPORTED,
						"1.1.0",
						List.of(),
						new PolicySourceMetadata("go-policy", "Go policy", "1", null)
				)
		));

		PolicyLookupResult result = catalog.lookup(new PolicyLookupQuery("go", "github.com/acme/tool", "2.0.0"));

		assertEquals(SupportPolicyStatus.UNKNOWN_VERSION, result.supportStatus());
		assertTrue(result.sourceMetadata().displayValue().contains("Unknown policy source"));
		assertFalse(result.sourceMetadata().apiValue().isBlank());
	}

	@Test
	void loaderReadsDatasetAndBuildsCatalog() throws Exception {
		String json = """
				{
				  "rules": [
				    {
				      "ecosystem": "dotnet",
				      "component": "sdk",
				      "exactVersion": "8.0.201",
				      "supportStatus": "SUPPORTED",
				      "recommendedVersion": "8.0.302",
				      "alternativeVersions": ["8.0.302"],
				      "sourceMetadata": {
				        "sourceId": "dotnet-policy",
				        "sourceName": "Bundled .NET policy",
				        "sourceVersion": "2026.04",
				        "sourceUri": "https://example.test/policy/dotnet"
				      }
				    }
				  ]
				}
				""";

		SupportPolicyDatasetLoader loader = new SupportPolicyDatasetLoader(new ObjectMapper());
		SupportPolicyCatalog catalog = loader.load(new ByteArrayInputStream(json.getBytes(StandardCharsets.UTF_8)));

		PolicyLookupResult result = catalog.lookup(new PolicyLookupQuery("dotnet", "sdk", "8.0.201"));

		assertEquals(SupportPolicyStatus.SUPPORTED, result.supportStatus());
		assertEquals("dotnet-policy", result.sourceMetadata().sourceId());
		assertEquals("Bundled .NET policy 2026.04", result.sourceMetadata().displayValue());
		assertEquals("Bundled .NET policy 2026.04 (https://example.test/policy/dotnet)", result.sourceMetadata().apiValue());
	}
}
