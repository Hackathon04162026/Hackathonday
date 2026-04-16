package com.hackathonday.migrationhelper.report;

import com.hackathonday.migrationhelper.api.contract.DetectorFindingResponse;
import com.hackathonday.migrationhelper.detection.DetectionEngine;
import com.hackathonday.migrationhelper.detection.DetectionEvidence;
import com.hackathonday.migrationhelper.detection.DetectionReport;
import com.hackathonday.migrationhelper.detection.DetectedTechnology;
import com.hackathonday.migrationhelper.detection.Detector;
import com.hackathonday.migrationhelper.scan.ScanRecord;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.InvalidPathException;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

@Component
@Order(Ordered.LOWEST_PRECEDENCE - 100)
public class DockerAndCiReportContributor implements ReportContributor {

	private static final Set<String> SUPPORTED_DETECTOR_IDS = Set.of("docker", "ci-runtime");
	private final DetectionEngine detectionEngine;

	public DockerAndCiReportContributor(List<Detector> detectors) {
		List<Detector> supported = detectors.stream()
				.filter(detector -> SUPPORTED_DETECTOR_IDS.contains(detector.id()))
				.toList();
		this.detectionEngine = new DetectionEngine(supported);
	}

	@Override
	public ReportContribution contribute(ScanRecord scan) {
		Path workspaceRoot = resolveWorkspaceRoot(scan.normalizedWorkspacePath());
		if (workspaceRoot == null || !Files.isDirectory(workspaceRoot)) {
			return ReportContribution.empty();
		}

		List<DetectorFindingResponse> findings = new ArrayList<>();
		try {
			for (DetectionReport report : detectionEngine.detect(workspaceRoot)) {
				for (DetectedTechnology technology : report.technologies()) {
					findings.add(toFinding(technology));
				}
			}
		} catch (IOException ex) {
			return ReportContribution.empty();
		}

		return findings.isEmpty() ? ReportContribution.empty()
				: new ReportContribution(List.of(), List.copyOf(findings), List.of(), List.of());
	}

	private DetectorFindingResponse toFinding(DetectedTechnology technology) {
		Map<String, Object> evidence = new LinkedHashMap<>();
		if (!technology.evidence().isEmpty()) {
			evidence.put("evidence", technology.evidence().stream().map(this::toEvidenceMap).toList());
			DetectionEvidence firstEvidence = technology.evidence().get(0);
			evidence.put("sourcePath", firstEvidence.sourcePath().toString().replace('\\', '/'));
			evidence.put("summary", firstEvidence.summary());
			evidence.put("weight", firstEvidence.weight());
			evidence.put("evidenceType", firstEvidence.type().name());
		}
		evidence.putAll(technology.attributes());

		String detectedVersion = technology.attributes().getOrDefault("detectedVersion", "UNRESOLVED");
		boolean indirect = Boolean.parseBoolean(technology.attributes().getOrDefault("indirect", "false"));
		return new DetectorFindingResponse(
				technology.family().name().toLowerCase(Locale.ROOT),
				technology.tool(),
				detectedVersion,
				technology.confidence().level().name(),
				indirect,
				evidence
		);
	}

	private Map<String, Object> toEvidenceMap(DetectionEvidence evidence) {
		Map<String, Object> mapped = new LinkedHashMap<>();
		mapped.put("type", evidence.type().name());
		mapped.put("sourcePath", evidence.sourcePath().toString().replace('\\', '/'));
		mapped.put("summary", evidence.summary());
		mapped.put("weight", evidence.weight());
		return mapped;
	}

	private Path resolveWorkspaceRoot(String workspacePath) {
		if (workspacePath == null || workspacePath.isBlank()) {
			return null;
		}

		try {
			return Paths.get(workspacePath);
		} catch (InvalidPathException ex) {
			return null;
		}
	}
}
