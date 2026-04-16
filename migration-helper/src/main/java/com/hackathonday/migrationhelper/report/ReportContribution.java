package com.hackathonday.migrationhelper.report;

import com.hackathonday.migrationhelper.api.contract.DetectorFindingResponse;
import com.hackathonday.migrationhelper.api.contract.PolicyStatusResponse;
import com.hackathonday.migrationhelper.api.contract.RecommendationResponse;
import com.hackathonday.migrationhelper.api.contract.WarningResponse;
import java.util.List;

public record ReportContribution(
		List<WarningResponse> warnings,
		List<DetectorFindingResponse> detectors,
		List<PolicyStatusResponse> policyStatuses,
		List<RecommendationResponse> recommendations
) {

	public static ReportContribution empty() {
		return new ReportContribution(List.of(), List.of(), List.of(), List.of());
	}
}
