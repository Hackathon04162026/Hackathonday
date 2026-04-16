package com.hackathonday.migrationhelper.report;

import com.hackathonday.migrationhelper.api.contract.ReportMetadata;
import com.hackathonday.migrationhelper.api.contract.ScanReportResponse;
import com.hackathonday.migrationhelper.api.contract.WarningResponse;
import com.hackathonday.migrationhelper.api.contract.WorkspaceSummary;
import com.hackathonday.migrationhelper.config.MigrationHelperProperties;
import com.hackathonday.migrationhelper.scan.ScanRecord;
import com.hackathonday.migrationhelper.scan.ScanWarning;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

@Component
public class ScanReportAssembler {

	private final List<ReportContributor> contributors;
	private final List<PolicyReportEvaluator> policyEvaluators;
	private final MigrationHelperProperties properties;

	public ScanReportAssembler(List<ReportContributor> contributors, MigrationHelperProperties properties) {
		this(contributors, List.of(new DetectorFindingPolicyEvaluator()), properties);
	}

	@Autowired
	public ScanReportAssembler(
			List<ReportContributor> contributors,
			List<PolicyReportEvaluator> policyEvaluators,
			MigrationHelperProperties properties
	) {
		this.contributors = contributors;
		this.policyEvaluators = policyEvaluators;
		this.properties = properties;
	}

	public ScanReportResponse assemble(ScanRecord scan) {
		List<WarningResponse> warnings = new ArrayList<>(scan.warnings().stream().map(this::toWarning).toList());
		List<com.hackathonday.migrationhelper.api.contract.DetectorFindingResponse> detectors = new ArrayList<>();
		List<com.hackathonday.migrationhelper.api.contract.PolicyStatusResponse> policyStatuses = new ArrayList<>();
		List<com.hackathonday.migrationhelper.api.contract.RecommendationResponse> recommendations = new ArrayList<>();

		for (ReportContributor contributor : contributors) {
			ReportContribution contribution = contributor.contribute(scan);
			warnings.addAll(contribution.warnings());
			detectors.addAll(contribution.detectors());
			policyStatuses.addAll(contribution.policyStatuses());
			recommendations.addAll(contribution.recommendations());
		}

		for (PolicyReportEvaluator policyEvaluator : policyEvaluators) {
			PolicyEvaluation evaluation = policyEvaluator.evaluate(scan, List.copyOf(detectors));
			policyStatuses.addAll(evaluation.policyStatuses());
			recommendations.addAll(evaluation.recommendations());
		}

		return new ScanReportResponse(
				scan.id(),
				properties.applicationName(),
				scan.status().name(),
				Instant.now(),
				new ReportMetadata(
						scan.sourceType().name(),
						scan.sourceReference(),
						scan.requestedBy(),
						scan.createdAt(),
						scan.startedAt(),
						scan.completedAt()
				),
				new WorkspaceSummary(
						scan.normalizedWorkspacePath(),
						scan.normalizationStatus()
				),
				List.copyOf(warnings),
				List.copyOf(detectors),
				List.copyOf(policyStatuses),
				List.copyOf(recommendations)
		);
	}

	private WarningResponse toWarning(ScanWarning warning) {
		return new WarningResponse(warning.code(), warning.severity(), warning.message());
	}
}
