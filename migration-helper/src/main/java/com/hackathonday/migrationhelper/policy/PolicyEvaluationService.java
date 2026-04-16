package com.hackathonday.migrationhelper.policy;

import com.hackathonday.migrationhelper.api.contract.DetectorFindingResponse;
import com.hackathonday.migrationhelper.api.contract.PolicyStatusResponse;
import com.hackathonday.migrationhelper.api.contract.RecommendationResponse;
import com.hackathonday.migrationhelper.report.PolicyEvaluation;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import org.springframework.stereotype.Service;

@Service
public class PolicyEvaluationService {

	private final PolicyLookupService lookupService;
	private final SupportStatusMapper statusMapper;
	private final RecommendationEngine recommendationEngine;

	public PolicyEvaluationService(
			PolicyLookupService lookupService,
			SupportStatusMapper statusMapper,
			RecommendationEngine recommendationEngine
	) {
		this.lookupService = lookupService;
		this.statusMapper = statusMapper;
		this.recommendationEngine = recommendationEngine;
	}

	public PolicyEvaluation evaluate(List<DetectorFindingResponse> findings) {
		List<PolicyStatusResponse> statuses = new ArrayList<>();
		List<RecommendationResponse> recommendations = new ArrayList<>();

		for (DetectorFindingResponse finding : findings) {
			if (isBlank(finding.ecosystem()) || isBlank(finding.component())) {
				continue;
			}

			Optional<ComponentPolicy> componentPolicy = lookupService.findComponentPolicy(finding.ecosystem(), finding.component());
			if (componentPolicy.isEmpty()) {
				continue;
			}

			if (isUnknownVersion(finding.detectedVersion())) {
				statuses.add(new PolicyStatusResponse(
						finding.ecosystem(),
						finding.component(),
						finding.detectedVersion(),
						SupportState.UNKNOWN_VERSION.apiValue(),
						defaultSource(componentPolicy.get())
				));
				RecommendationResponse recommendation = recommendationEngine.recommendForUnknownVersion(
						componentPolicy.get(),
						finding.detectedVersion()
				);
				if (recommendation != null) {
					recommendations.add(recommendation);
				}
				continue;
			}

			Optional<PolicyMatch> policyMatch = lookupService.findPolicy(
					finding.ecosystem(),
					finding.component(),
					finding.detectedVersion()
			);
			if (policyMatch.isPresent()) {
				SupportState state = statusMapper.classify(policyMatch.get().versionPolicy());
				statuses.add(new PolicyStatusResponse(
						finding.ecosystem(),
						finding.component(),
						finding.detectedVersion(),
						state.apiValue(),
						sourceLabel(policyMatch.get().source())
				));
				RecommendationResponse recommendation = recommendationEngine.recommendForKnownVersion(
						policyMatch.get(),
						finding.detectedVersion()
				);
				if (recommendation != null) {
					recommendations.add(recommendation);
				}
				continue;
			}

			statuses.add(new PolicyStatusResponse(
					finding.ecosystem(),
					finding.component(),
					finding.detectedVersion(),
					SupportState.UNKNOWN_VERSION.apiValue(),
					defaultSource(componentPolicy.get())
			));
			RecommendationResponse recommendation = recommendationEngine.recommendForUnknownVersion(
					componentPolicy.get(),
					finding.detectedVersion()
			);
			if (recommendation != null) {
				recommendations.add(recommendation);
			}
		}

		return new PolicyEvaluation(List.copyOf(statuses), List.copyOf(recommendations));
	}

	private String defaultSource(ComponentPolicy componentPolicy) {
		return componentPolicy.versions().stream()
				.map(VersionPolicy::sourceId)
				.map(lookupService::resolveSource)
				.flatMap(Optional::stream)
				.map(this::sourceLabel)
				.findFirst()
				.orElse("bundled-support-policy");
	}

	private String sourceLabel(PolicySource source) {
		return source.name();
	}

	private boolean isUnknownVersion(String version) {
		String normalized = version == null ? "" : version.trim().toLowerCase(Locale.ROOT);
		return normalized.isBlank() || normalized.equals("unresolved") || normalized.equals("unknown");
	}

	private boolean isBlank(String value) {
		return value == null || value.isBlank();
	}
}
