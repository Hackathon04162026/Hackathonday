package com.hackathonday.migrationhelper.report.go;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hackathonday.migrationhelper.api.contract.DetectorFindingResponse;
import com.hackathonday.migrationhelper.detection.GoDetector;
import com.hackathonday.migrationhelper.report.ReportContribution;
import com.hackathonday.migrationhelper.scan.ScanRecord;
import com.hackathonday.migrationhelper.scan.ScanSourceType;
import java.net.URISyntaxException;
import java.nio.file.Path;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;

class GoReportContributorTest {

	private final GoReportContributor contributor = new GoReportContributor(new GoDetector());
	private final ObjectMapper objectMapper = new ObjectMapper();

	@Test
	void contributesGoFindingsFromNestedWorkspaceFixtures() throws Exception {
		ScanRecord scan = new ScanRecord(
				"scan-go-fixture",
				ScanSourceType.LOCAL_PATH,
				"/tmp/scan-go-fixture",
				"Go fixture",
				"tester",
				Instant.parse("2026-04-16T12:00:00Z")
		);
		scan.complete(resolveFixture("/go-fixtures/multimodule/workspace/root"), "READY");

		ReportContribution contribution = contributor.contribute(scan);
		List<DetectorFindingResponse> actual = contribution.detectors();
		List<DetectorFindingResponse> expected = readExpectedFindings("/go-fixtures/multimodule/expected-detector-findings.json");

		assertThat(actual).containsExactlyElementsOf(expected);
		assertThat(contribution.warnings()).isEmpty();
	}

	private List<DetectorFindingResponse> readExpectedFindings(String resourcePath) throws Exception {
		return objectMapper.readValue(
				getClass().getResourceAsStream(resourcePath),
				new TypeReference<>() {
				}
		);
	}

	private String resolveFixture(String resourcePath) throws URISyntaxException {
		Path path = Path.of(getClass().getResource(resourcePath).toURI());
		return path.toString();
	}
}
