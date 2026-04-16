package com.hackathonday.migrationhelper.policy;

import com.hackathonday.migrationhelper.api.contract.PolicyStatusResponse;
import com.hackathonday.migrationhelper.api.contract.RecommendationResponse;
import java.util.List;

public record PolicyEvaluation(
		List<PolicyStatusResponse> policyStatuses,
		List<RecommendationResponse> recommendations
) {
}
