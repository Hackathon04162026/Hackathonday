package com.hackathonday.migrationhelper.report;

import com.hackathonday.migrationhelper.api.contract.DetectorFindingResponse;
import com.hackathonday.migrationhelper.api.contract.PolicyStatusResponse;
import com.hackathonday.migrationhelper.api.contract.RecommendationResponse;
import com.hackathonday.migrationhelper.scan.ScanRecord;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

@Component
@Order(Ordered.LOWEST_PRECEDENCE)
public class DetectorFindingPolicyEvaluator implements PolicyReportEvaluator {

	@Override
	public PolicyEvaluation evaluate(ScanRecord scan, List<DetectorFindingResponse> detectorFindings) {
		if (detectorFindings.isEmpty()) {
			return PolicyEvaluation.empty();
		}

		List<PolicyStatusResponse> policyStatuses = new ArrayList<>();
		List<RecommendationResponse> recommendations = new ArrayList<>();

		detectorFindings.stream()
				.sorted(Comparator
						.comparing(DetectorFindingResponse::ecosystem)
						.thenComparing(DetectorFindingResponse::component)
						.thenComparing(DetectorFindingResponse::detectedVersion))
				.forEach(finding -> {
					policyStatuses.add(toPolicyStatus(finding));
					RecommendationResponse recommendation = toRecommendation(scan, finding);
					if (recommendation != null) {
						recommendations.add(recommendation);
					}
				});

		return new PolicyEvaluation(List.copyOf(policyStatuses), List.copyOf(recommendations));
	}

	private PolicyStatusResponse toPolicyStatus(DetectorFindingResponse finding) {
		String supportStatus = determineSupportStatus(finding);
		String source = finding.indirect() ? "detector-indirect" : "detector-explicit";
		return new PolicyStatusResponse(
				finding.ecosystem(),
				finding.component(),
				finding.detectedVersion(),
				supportStatus,
				source
		);
	}

	private RecommendationResponse toRecommendation(ScanRecord scan, DetectorFindingResponse finding) {
		String supportStatus = determineSupportStatus(finding);
		if ("SUPPORTED".equals(supportStatus)) {
			return null;
		}

		String rationale = finding.indirect()
				? "Resolve the indirect version reference before policy approval."
				: "Capture an explicit version before policy approval.";
		String recommendedVersion = finding.detectedVersion();
		return new RecommendationResponse(
				finding.ecosystem(),
				finding.component(),
				finding.detectedVersion(),
				recommendedVersion,
				List.of(),
				"Scan " + scan.id() + ": " + rationale
		);
	}

	private String determineSupportStatus(DetectorFindingResponse finding) {
		String detectedVersion = finding.detectedVersion();
		if (detectedVersion == null || detectedVersion.isBlank() || "UNRESOLVED".equalsIgnoreCase(detectedVersion)) {
			return "UNKNOWN";
		}
		if (finding.indirect()) {
			return "REVIEW";
		}
		return "SUPPORTED";
	}
}
