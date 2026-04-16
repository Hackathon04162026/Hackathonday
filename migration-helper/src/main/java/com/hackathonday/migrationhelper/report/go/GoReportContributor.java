package com.hackathonday.migrationhelper.report.go;

import com.hackathonday.migrationhelper.api.contract.DetectorFindingResponse;
import com.hackathonday.migrationhelper.detection.DetectionEvidence;
import com.hackathonday.migrationhelper.detection.DetectionReport;
import com.hackathonday.migrationhelper.detection.DetectedTechnology;
import com.hackathonday.migrationhelper.detection.GoDetector;
import com.hackathonday.migrationhelper.report.ReportContribution;
import com.hackathonday.migrationhelper.report.ReportContributor;
import com.hackathonday.migrationhelper.scan.ScanRecord;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 50)
public class GoReportContributor implements ReportContributor {

	private final GoDetector detector;

	public GoReportContributor(GoDetector detector) {
		this.detector = detector;
	}

	@Override
	public ReportContribution contribute(ScanRecord scan) {
		Path workspaceRoot = resolveWorkspaceRoot(scan.normalizedWorkspacePath());
		if (workspaceRoot == null) {
			return ReportContribution.empty();
		}

		try {
			DetectionReport report = detector.detect(workspaceRoot);
			List<DetectorFindingResponse> detectors = new ArrayList<>();
			for (DetectedTechnology technology : report.technologies()) {
				detectors.add(toFinding(technology));
			}
			return detectors.isEmpty() ? ReportContribution.empty()
					: new ReportContribution(List.of(), List.copyOf(detectors), List.of(), List.of());
		} catch (IOException ex) {
			return ReportContribution.empty();
		}
	}

	private DetectorFindingResponse toFinding(DetectedTechnology technology) {
		Map<String, Object> evidence = new LinkedHashMap<>();
		for (Map.Entry<String, String> entry : technology.attributes().entrySet()) {
			evidence.put(entry.getKey(), entry.getValue());
		}
		if (!technology.evidence().isEmpty()) {
			DetectionEvidence primary = technology.evidence().get(0);
			evidence.put("sourcePath", primary.sourcePath().toString().replace('\\', '/'));
			evidence.put("evidenceType", primary.type().name());
			evidence.put("summary", primary.summary());
			evidence.put("weight", primary.weight());
		}

		String component = technology.attributes().getOrDefault("component", technology.tool());
		String detectedVersion = technology.attributes().getOrDefault("detectedVersion", "UNRESOLVED");
		boolean indirect = Boolean.parseBoolean(technology.attributes().getOrDefault("indirect", "false"));
		return new DetectorFindingResponse(
				"go",
				component,
				detectedVersion,
				technology.confidence().level().name(),
				indirect,
				evidence
		);
	}

	private Path resolveWorkspaceRoot(String normalizedWorkspacePath) {
		if (normalizedWorkspacePath == null || normalizedWorkspacePath.isBlank()) {
			return null;
		}

		try {
			Path workspaceRoot = Paths.get(normalizedWorkspacePath);
			return Files.isDirectory(workspaceRoot) ? workspaceRoot : null;
		} catch (RuntimeException ex) {
			return null;
		}
	}
}
