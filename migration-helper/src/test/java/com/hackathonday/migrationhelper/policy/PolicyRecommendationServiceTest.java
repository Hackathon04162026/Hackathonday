package com.hackathonday.migrationhelper.policy;

import static org.assertj.core.api.Assertions.assertThat;

import com.hackathonday.migrationhelper.api.contract.RecommendationResponse;
import org.junit.jupiter.api.Test;

class PolicyRecommendationServiceTest {

	@Test
	void recommendsPreferredNextVersionAndAlternativeUpgradeOptions() {
		PolicyCatalog catalog = PolicyCatalog.of(
				ComponentPolicy.of(
						"java",
						"spring-boot",
						new PolicyVersion("2.7.18", SupportStatus.UNSUPPORTED, false),
						new PolicyVersion("3.0.0", SupportStatus.EXPIRING_SOON, false),
						new PolicyVersion("3.1.0", SupportStatus.SUPPORTED, true),
						new PolicyVersion("3.2.0", SupportStatus.SUPPORTED, false)
				)
		);
		PolicyRecommendationService service = new PolicyRecommendationService(catalog);

		RecommendationResponse response = service.recommend("java", "spring-boot", "2.7.18").orElseThrow();

		assertThat(response.recommendedVersion()).isEqualTo("3.1.0");
		assertThat(response.alternativeVersions()).containsExactly("3.0.0", "3.2.0");
		assertThat(response.rationale())
				.contains("unsupported")
				.contains("preferred next version is 3.1.0")
				.contains("alternatives: 3.0.0, 3.2.0");
	}

	@Test
	void fallsBackToTheLatestSupportedVersionWhenCurrentVersionIsUnknown() {
		PolicyCatalog catalog = PolicyCatalog.of(
				ComponentPolicy.of(
						"nodejs",
						"express",
						new PolicyVersion("4.18.2", SupportStatus.SUPPORTED, false),
						new PolicyVersion("5.0.0", SupportStatus.EXPIRING_SOON, true)
				)
		);
		PolicyRecommendationService service = new PolicyRecommendationService(catalog);

		RecommendationResponse response = service.recommend("nodejs", "express", "3.0.0").orElseThrow();

		assertThat(response.recommendedVersion()).isEqualTo("5.0.0");
		assertThat(response.alternativeVersions()).containsExactly("4.18.2");
		assertThat(response.rationale())
				.contains("is not listed in policy data")
				.contains("preferred next version is 5.0.0");
	}

	@Test
	void returnsTheCurrentVersionWhenNoNewerSupportedVersionExists() {
		PolicyCatalog catalog = PolicyCatalog.of(
				ComponentPolicy.of(
						"python",
						"django",
						new PolicyVersion("4.2.0", SupportStatus.SUPPORTED, true),
						new PolicyVersion("5.0.0", SupportStatus.UNSUPPORTED, false)
				)
		);
		PolicyRecommendationService service = new PolicyRecommendationService(catalog);

		RecommendationResponse response = service.recommend("python", "django", "4.2.0").orElseThrow();

		assertThat(response.recommendedVersion()).isEqualTo("4.2.0");
		assertThat(response.alternativeVersions()).isEmpty();
		assertThat(response.rationale())
				.contains("no newer supported version is listed");
	}
}
