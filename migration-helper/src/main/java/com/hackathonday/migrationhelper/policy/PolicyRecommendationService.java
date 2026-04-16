package com.hackathonday.migrationhelper.policy;

import com.hackathonday.migrationhelper.api.contract.RecommendationResponse;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.stream.Collectors;

public final class PolicyRecommendationService {

	private final PolicyCatalog catalog;

	public PolicyRecommendationService(PolicyCatalog catalog) {
		this.catalog = Objects.requireNonNull(catalog, "catalog");
	}

	public Optional<RecommendationResponse> recommend(String ecosystem, String component, String currentVersion) {
		return catalog.find(ecosystem, component).map(policy -> recommend(policy, currentVersion));
	}

	public RecommendationResponse recommend(ComponentPolicy policy, String currentVersion) {
		Objects.requireNonNull(policy, "policy");
		currentVersion = requireText(currentVersion, "currentVersion");

		List<PolicyVersion> orderedVersions = orderVersions(policy.versions());
		Optional<PolicyVersion> current = orderedVersions.stream()
				.filter(version -> version.version().equals(currentVersion))
				.findFirst();

		List<PolicyVersion> newerSupportedVersions = orderedVersions.stream()
				.filter(version -> compareVersions(version.version(), currentVersion) > 0)
				.filter(version -> version.supportStatus() == SupportStatus.SUPPORTED
						|| version.supportStatus() == SupportStatus.EXPIRING_SOON)
				.collect(Collectors.toCollection(ArrayList::new));

		RecommendationSelection selection = selectPreferredVersion(newerSupportedVersions, orderedVersions, currentVersion);
		List<String> alternatives = newerSupportedVersions.stream()
				.map(PolicyVersion::version)
				.filter(version -> !version.equals(selection.preferred().version()))
				.toList();

		String rationale = buildRationale(policy, currentVersion, current, selection, alternatives);
		return new RecommendationResponse(
				policy.ecosystem(),
				policy.component(),
				currentVersion,
				selection.preferred().version(),
				alternatives,
				rationale
		);
	}

	private RecommendationSelection selectPreferredVersion(List<PolicyVersion> newerSupportedVersions,
			List<PolicyVersion> orderedVersions, String currentVersion) {
		if (!newerSupportedVersions.isEmpty()) {
			PolicyVersion preferred = newerSupportedVersions.stream()
					.filter(PolicyVersion::preferredNextVersion)
					.findFirst()
					.orElse(newerSupportedVersions.get(0));
			return new RecommendationSelection(preferred, false);
		}

		PolicyVersion latestSupported = orderedVersions.stream()
				.filter(version -> version.supportStatus() == SupportStatus.SUPPORTED
						|| version.supportStatus() == SupportStatus.EXPIRING_SOON)
				.max((left, right) -> compareVersions(left.version(), right.version()))
				.orElse(new PolicyVersion(currentVersion, SupportStatus.UNKNOWN_VERSION, true));
		return new RecommendationSelection(latestSupported, true);
	}

	private String buildRationale(ComponentPolicy policy, String currentVersion, Optional<PolicyVersion> current,
			RecommendationSelection selection, List<String> alternatives) {
		StringBuilder rationale = new StringBuilder();
		rationale.append(policy.ecosystem())
				.append(" ")
				.append(policy.component())
				.append(" ")
				.append(currentVersion)
				.append(" ");

		if (current.isEmpty()) {
			rationale.append("is not listed in policy data");
		} else {
			rationale.append("is ")
					.append(current.get().supportStatus().apiValue())
					.append(" in policy data");
		}

		if (selection.fallbackToLatestSupported()) {
			rationale.append("; latest supported version is ")
					.append(selection.preferred().version());
		} else if (selection.preferred().version().equals(currentVersion)) {
			rationale.append("; no newer supported version is listed");
		} else {
			rationale.append("; preferred next version is ")
					.append(selection.preferred().version());
		}

		if (!alternatives.isEmpty()) {
			rationale.append("; alternatives: ")
					.append(String.join(", ", alternatives));
		}

		return rationale.toString();
	}

	private List<PolicyVersion> orderVersions(List<PolicyVersion> versions) {
		return versions.stream()
				.sorted((left, right) -> compareVersions(left.version(), right.version()))
				.toList();
	}

	private int compareVersions(String left, String right) {
		List<String> leftParts = splitVersion(left);
		List<String> rightParts = splitVersion(right);
		int size = Math.max(leftParts.size(), rightParts.size());
		for (int index = 0; index < size; index++) {
			String leftPart = index < leftParts.size() ? leftParts.get(index) : "0";
			String rightPart = index < rightParts.size() ? rightParts.get(index) : "0";
			int comparison = compareVersionPart(leftPart, rightPart);
			if (comparison != 0) {
				return comparison;
			}
		}
		return 0;
	}

	private List<String> splitVersion(String version) {
		String normalized = version.startsWith("v") ? version.substring(1) : version;
		return List.of(normalized.split("[._-]"));
	}

	private int compareVersionPart(String left, String right) {
		boolean leftNumeric = left.chars().allMatch(Character::isDigit);
		boolean rightNumeric = right.chars().allMatch(Character::isDigit);
		if (leftNumeric && rightNumeric) {
			return Integer.compare(Integer.parseInt(left), Integer.parseInt(right));
		}
		if (leftNumeric) {
			return 1;
		}
		if (rightNumeric) {
			return -1;
		}
		return left.compareToIgnoreCase(right);
	}

	private String requireText(String value, String field) {
		if (value == null || value.isBlank()) {
			throw new IllegalArgumentException(field + " must not be blank");
		}
		return value;
	}

	private record RecommendationSelection(PolicyVersion preferred, boolean fallbackToLatestSupported) {

		RecommendationSelection {
			Objects.requireNonNull(preferred, "preferred");
		}
	}
}
