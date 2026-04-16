package com.hackathonday.migrationhelper.policy;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

class PolicyLookupServiceTest {

	private final SupportPolicyDatasetLoader loader = new SupportPolicyDatasetLoader(new ObjectMapper());
	private final PolicyLookupService lookupService = new PolicyLookupService(loader);

	@Test
	void findsTheBestMatchingPolicyVersionAndResolvesSourceMetadata() {
		PolicyMatch match = lookupService.findPolicy("dotnet", "sdk", "8.0.201").orElseThrow();

		assertThat(match.versionPolicy().version()).isEqualTo("8.0");
		assertThat(match.versionPolicy().preferredUpgrade()).isEqualTo("10.0");
		assertThat(match.source().id()).isEqualTo("dotnet-support-policy");
		assertThat(match.source().name()).isEqualTo(".NET Support Policy");
		assertThat(match.source().url()).contains("dotnet.microsoft.com");
	}

	@Test
	void fallsBackToTheComponentPolicyWhenTheVersionIsUnknown() {
		assertThat(lookupService.findComponentPolicy("go", "go")).isPresent();
		assertThat(lookupService.findPolicy("go", "go", "1.26.0")).isEmpty();
	}
}
