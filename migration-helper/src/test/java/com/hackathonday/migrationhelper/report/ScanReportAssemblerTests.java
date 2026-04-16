package com.hackathonday.migrationhelper.report;

import static org.assertj.core.api.Assertions.assertThat;

import com.hackathonday.migrationhelper.api.contract.DetectorFindingResponse;
import com.hackathonday.migrationhelper.api.contract.PolicyStatusResponse;
import com.hackathonday.migrationhelper.api.contract.RecommendationResponse;
import com.hackathonday.migrationhelper.api.contract.WarningResponse;
import com.hackathonday.migrationhelper.config.MigrationHelperProperties;
import com.hackathonday.migrationhelper.scan.ScanRecord;
import com.hackathonday.migrationhelper.scan.ScanSourceType;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class ScanReportAssemblerTests {

	private final MigrationHelperProperties properties = new MigrationHelperProperties(
			"Migration Helper",
			"tester",
			new MigrationHelperProperties.Scan(25, false)
	);

	@Test
	void assemblesReportFromContributorsAndEvaluatesPoliciesFromAggregatedDetectors() {
		ScanRecord scan = new ScanRecord(
				"scan-assembler",
				ScanSourceType.LOCAL_PATH,
				"/workspace/input",
				"Assembler fixture",
				"tester",
				Instant.parse("2026-04-16T12:00:00Z")
		);
		scan.complete("/workspace/normalized", "READY");

		ReportContributor firstContributor = ignoredScan -> new ReportContribution(
				List.of(new WarningResponse("FIRST", "INFO", "first warning")),
				List.of(new DetectorFindingResponse(
						"docker",
						"eclipse-temurin",
						"21-jre",
						"HIGH",
						false,
						Map.of("file", "Dockerfile", "line", 1)
				)),
				List.of(),
				List.of()
		);
		ReportContributor secondContributor = ignoredScan -> new ReportContribution(
				List.of(),
				List.of(new DetectorFindingResponse(
						"docker",
						"${BUILD_IMAGE}",
						"UNRESOLVED",
						"LOW",
						true,
						Map.of("file", "Dockerfile", "line", 2)
				)),
				List.of(),
				List.of()
		);

		ScanReportAssembler assembler = new ScanReportAssembler(
				List.of(firstContributor, secondContributor),
				List.of((scanRecord, detectorFindings) -> new PolicyEvaluation(
						detectorFindings.stream()
								.map(finding -> new PolicyStatusResponse(
										finding.ecosystem(),
										finding.component(),
										finding.detectedVersion(),
										finding.indirect() ? "UNKNOWN" : "SUPPORTED",
										"test-adapter"
								))
								.toList(),
						detectorFindings.stream()
								.filter(DetectorFindingResponse::indirect)
								.map(finding -> new RecommendationResponse(
										finding.ecosystem(),
										finding.component(),
										finding.detectedVersion(),
										finding.detectedVersion(),
										List.of(),
										"test adapter recommendation"
								))
								.toList()
				)),
				properties
		);

		var report = assembler.assemble(scan);

		assertThat(report.warnings()).extracting(WarningResponse::code).containsExactly("FIRST");
		assertThat(report.detectors()).hasSize(2);
		assertThat(report.policyStatuses()).extracting("supportStatus").containsExactly("SUPPORTED", "UNKNOWN");
		assertThat(report.recommendations())
				.hasSize(1)
				.first()
				.satisfies(recommendation -> {
					assertThat(recommendation.ecosystem()).isEqualTo("docker");
					assertThat(recommendation.component()).isEqualTo("${BUILD_IMAGE}");
					assertThat(recommendation.currentVersion()).isEqualTo("UNRESOLVED");
				});
	}
}
