package com.hackathonday.migrationhelper.report;

import com.hackathonday.migrationhelper.api.contract.DetectorFindingResponse;
import com.hackathonday.migrationhelper.policy.PolicyEvaluationService;
import com.hackathonday.migrationhelper.scan.ScanRecord;
import java.util.List;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

@Component
@Order(Ordered.LOWEST_PRECEDENCE)
public class DetectorFindingPolicyEvaluator implements PolicyReportEvaluator {

	private final PolicyEvaluationService policyEvaluationService;

	public DetectorFindingPolicyEvaluator(PolicyEvaluationService policyEvaluationService) {
		this.policyEvaluationService = policyEvaluationService;
	}

	@Override
	public PolicyEvaluation evaluate(ScanRecord scan, List<DetectorFindingResponse> detectorFindings) {
		if (detectorFindings.isEmpty()) {
			return PolicyEvaluation.empty();
		}
		return policyEvaluationService.evaluate(detectorFindings);
	}
}
