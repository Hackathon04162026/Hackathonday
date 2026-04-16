package com.hackathonday.migrationhelper.policy;

import com.hackathonday.migrationhelper.api.contract.RecommendationResponse;
import java.time.Clock;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import org.springframework.stereotype.Component;

@Component
public class RecommendationEngine {

	private final SupportStatusMapper statusMapper;
	private final Clock clock;

	public RecommendationEngine(SupportStatusMapper statusMapper) {
		this(statusMapper, Clock.systemUTC());
	}

	RecommendationEngine(SupportStatusMapper statusMapper, Clock clock) {
		this.statusMapper = statusMapper;
		this.clock = clock;
	}

	public RecommendationResponse recommendForKnownVersion(PolicyMatch match, String currentVersion) {
		SupportState state = statusMapper.classify(match.versionPolicy());
		String recommended = preferredUpgrade(match.componentPolicy(), match.versionPolicy());
		List<String> alternatives = alternativeUpgrades(match.componentPolicy(), match.versionPolicy(), recommended);
		if (Objects.equals(recommended, currentVersion) && alternatives.isEmpty() && state == SupportState.SUPPORTED) {
			return null;
		}
		return new RecommendationResponse(
				match.componentPolicy().ecosystem(),
				match.componentPolicy().component(),
				currentVersion,
				recommended,
				alternatives,
				rationaleForKnownVersion(match.versionPolicy(), state, recommended)
		);
	}

	public RecommendationResponse recommendForUnknownVersion(ComponentPolicy componentPolicy, String currentVersion) {
		String recommended = PolicyLookupService.highestSupportedVersion(componentPolicy, statusMapper);
		if (recommended == null) {
			return null;
		}
		List<String> alternatives = componentPolicy.versions().stream()
				.map(VersionPolicy::version)
				.filter(version -> !version.equals(recommended))
				.sorted((left, right) -> PolicyLookupService.compareVersions(right, left))
				.limit(2)
				.toList();
		return new RecommendationResponse(
				componentPolicy.ecosystem(),
				componentPolicy.component(),
				currentVersion,
				recommended,
				alternatives,
				"Version " + currentVersion + " is not mapped in the bundled support policy dataset. Prefer " + recommended
						+ " because it is the newest supported policy line."
		);
	}

	private String preferredUpgrade(ComponentPolicy componentPolicy, VersionPolicy currentPolicy) {
		if (currentPolicy.preferredUpgrade() != null && !currentPolicy.preferredUpgrade().isBlank()) {
			return currentPolicy.preferredUpgrade();
		}
		return componentPolicy.versions().stream()
				.filter(versionPolicy -> statusMapper.classify(versionPolicy) != SupportState.UNSUPPORTED)
				.map(VersionPolicy::version)
				.filter(version -> PolicyLookupService.compareVersions(version, currentPolicy.version()) >= 0)
				.max(PolicyLookupService::compareVersions)
				.orElse(currentPolicy.version());
	}

	private List<String> alternativeUpgrades(ComponentPolicy componentPolicy, VersionPolicy currentPolicy, String recommended) {
		LinkedHashSet<String> alternatives = new LinkedHashSet<>();
		List<String> configuredAlternatives = currentPolicy.alternativeUpgrades() == null
				? List.of()
				: currentPolicy.alternativeUpgrades();
		alternatives.addAll(configuredAlternatives);
		componentPolicy.versions().stream()
				.filter(versionPolicy -> statusMapper.classify(versionPolicy) != SupportState.UNSUPPORTED)
				.map(VersionPolicy::version)
				.sorted((left, right) -> PolicyLookupService.compareVersions(right, left))
				.filter(version -> !Objects.equals(version, recommended))
				.filter(version -> !Objects.equals(version, currentPolicy.version()))
				.limit(3)
				.forEach(alternatives::add);
		return alternatives.stream().limit(3).toList();
	}

	private String rationaleForKnownVersion(VersionPolicy versionPolicy, SupportState state, String recommended) {
		LocalDate supportEndDate = LocalDate.parse(versionPolicy.supportEndDate());
		return switch (state) {
			case SUPPORTED -> versionPolicy.version() + " is currently supported through " + supportEndDate
					+ ". Prefer " + recommended + " as the next target to stay on a supported line.";
			case EXPIRING_SOON -> versionPolicy.version() + " support ends on " + supportEndDate
					+ ". Prefer " + recommended + " before the support window closes.";
			case UNSUPPORTED -> versionPolicy.version() + " has been unsupported since " + supportEndDate
					+ ". Prefer " + recommended + " for an actively supported upgrade path.";
			case UNKNOWN_VERSION -> "Version " + versionPolicy.version()
					+ " is not mapped in the bundled support policy dataset.";
		};
	}
}
