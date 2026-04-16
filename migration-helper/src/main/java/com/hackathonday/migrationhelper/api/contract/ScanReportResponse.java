package com.hackathonday.migrationhelper.api.contract;

import java.time.Instant;
import java.util.List;

public record ScanReportResponse(
		String id,
		String applicationName,
		String status,
		Instant generatedAt,
		ReportMetadata metadata,
		WorkspaceSummary workspace,
		List<WarningResponse> warnings,
		List<DetectorFindingResponse> detectors,
		List<PolicyStatusResponse> policyStatuses,
		List<RecommendationResponse> recommendations
) {
}
