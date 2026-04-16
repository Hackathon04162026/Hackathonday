package com.hackathonday.migrationhelper.report;

import com.hackathonday.migrationhelper.api.contract.PolicyStatusResponse;
import com.hackathonday.migrationhelper.api.contract.RecommendationResponse;
import java.util.List;

public record PolicyEvaluation(
		List<PolicyStatusResponse> policyStatuses,
		List<RecommendationResponse> recommendations
) {

	public PolicyEvaluation {
		policyStatuses = List.copyOf(policyStatuses);
		recommendations = List.copyOf(recommendations);
	}

	public static PolicyEvaluation empty() {
		return new PolicyEvaluation(List.of(), List.of());
	}
}
