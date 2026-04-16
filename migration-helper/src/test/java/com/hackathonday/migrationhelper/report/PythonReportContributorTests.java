package com.hackathonday.migrationhelper.report;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.hackathonday.migrationhelper.api.contract.DetectorFindingResponse;
import com.hackathonday.migrationhelper.scan.ScanRecord;
import com.hackathonday.migrationhelper.scan.ScanSourceType;
import java.io.IOException;
import java.net.URISyntaxException;
import java.net.URL;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class PythonReportContributorTests {

	@TempDir
	Path tempDir;

	private final PythonReportContributor contributor = new PythonReportContributor();

	@Test
	void detectsPythonRuntimeAndDependencyVersionsFromCommonManifests() throws Exception {
		Path workspaceRoot = copyFixture("python-fixtures/workspace/root", tempDir.resolve("workspace/root"));
		ScanRecord scan = new ScanRecord(
				"scan-python",
				ScanSourceType.LOCAL_PATH,
				workspaceRoot.toString(),
				"Python Fixture",
				"tester",
				Instant.EPOCH
		);
		scan.complete(workspaceRoot.toString(), "READY");

		ReportContribution contribution = contributor.contribute(scan);
		List<String> actual = contribution.detectors().stream().map(this::formatFinding).toList();
		List<String> expected = readExpected("python-fixtures/expected/python-detector-findings.txt");

		assertEquals(expected, actual);
	}

	private List<String> readExpected(String resourcePath) throws IOException, URISyntaxException {
		URL resource = getClass().getClassLoader().getResource(resourcePath);
		if (resource == null) {
			throw new IllegalStateException("Missing test resource: " + resourcePath);
		}
		return Files.readAllLines(Path.of(resource.toURI()));
	}

	private Path copyFixture(String resourcePath, Path targetRoot) throws IOException, URISyntaxException {
		URL resource = getClass().getClassLoader().getResource(resourcePath);
		if (resource == null) {
			throw new IllegalStateException("Missing test resource: " + resourcePath);
		}

		Path sourceRoot = Path.of(resource.toURI());
		try (var paths = Files.walk(sourceRoot)) {
			paths.sorted(Comparator.naturalOrder()).forEach(source -> {
				Path destination = targetRoot.resolve(sourceRoot.relativize(source).toString());
				try {
					if (Files.isDirectory(source)) {
						Files.createDirectories(destination);
					} else {
						Files.createDirectories(destination.getParent());
						Files.copy(source, destination);
					}
				} catch (IOException ex) {
					throw new RuntimeException(ex);
				}
			});
		}
		return targetRoot;
	}

	private String formatFinding(DetectorFindingResponse finding) {
		return String.join(
				"|",
				String.valueOf(finding.evidence().get("relativePath")) + ":" + finding.evidence().get("lineNumber"),
				finding.component(),
				finding.detectedVersion(),
				String.valueOf(finding.indirect()),
				finding.confidence()
		);
	}
}
