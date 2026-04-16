package com.hackathonday.migrationhelper.policy;

import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.springframework.stereotype.Service;

@Service
public class PolicyLookupService {

	private static final Pattern DIGIT_GROUP = Pattern.compile("\\d+");

	private final SupportPolicyDatasetLoader datasetLoader;

	public PolicyLookupService(SupportPolicyDatasetLoader datasetLoader) {
		this.datasetLoader = datasetLoader;
	}

	public Optional<ComponentPolicy> findComponentPolicy(String ecosystem, String component) {
		if (isBlank(ecosystem) || isBlank(component)) {
			return Optional.empty();
		}
		return datasetLoader.dataset().policies().stream()
				.filter(policy -> normalized(policy.ecosystem()).equals(normalized(ecosystem)))
				.filter(policy -> normalized(policy.component()).equals(normalized(component)))
				.findFirst();
	}

	public Optional<PolicyMatch> findPolicy(String ecosystem, String component, String version) {
		if (isBlank(version)) {
			return Optional.empty();
		}
		return findComponentPolicy(ecosystem, component)
				.flatMap(policy -> policy.versions().stream()
						.filter(candidate -> versionMatches(version, candidate.version()))
						.max(Comparator.comparingInt(candidate -> numericTokens(candidate.version()).size()))
						.flatMap(candidate -> resolveSource(candidate.sourceId()).map(source -> new PolicyMatch(policy, candidate, source))));
	}

	public Optional<PolicySource> resolveSource(String sourceId) {
		return datasetLoader.dataset().sources().stream()
				.filter(source -> normalized(source.id()).equals(normalized(sourceId)))
				.findFirst();
	}

	static int compareVersions(String left, String right) {
		List<Integer> leftTokens = numericTokens(left);
		List<Integer> rightTokens = numericTokens(right);
		int limit = Math.max(leftTokens.size(), rightTokens.size());
		for (int i = 0; i < limit; i++) {
			int leftValue = i < leftTokens.size() ? leftTokens.get(i) : 0;
			int rightValue = i < rightTokens.size() ? rightTokens.get(i) : 0;
			if (leftValue != rightValue) {
				return Integer.compare(leftValue, rightValue);
			}
		}
		return left.compareTo(right);
	}

	static String highestSupportedVersion(ComponentPolicy componentPolicy, SupportStatusMapper statusMapper) {
		return componentPolicy.versions().stream()
				.filter(versionPolicy -> statusMapper.classify(versionPolicy) != SupportState.UNSUPPORTED)
				.max((left, right) -> compareVersions(left.version(), right.version()))
				.map(VersionPolicy::version)
				.orElse(null);
	}

	private static boolean versionMatches(String detectedVersion, String policyVersion) {
		List<Integer> detectedTokens = numericTokens(detectedVersion);
		List<Integer> policyTokens = numericTokens(policyVersion);
		if (detectedTokens.isEmpty() || policyTokens.isEmpty() || policyTokens.size() > detectedTokens.size()) {
			return false;
		}
		for (int i = 0; i < policyTokens.size(); i++) {
			if (!detectedTokens.get(i).equals(policyTokens.get(i))) {
				return false;
			}
		}
		return true;
	}

	private static List<Integer> numericTokens(String value) {
		Matcher matcher = DIGIT_GROUP.matcher(value == null ? "" : value);
		java.util.ArrayList<Integer> tokens = new java.util.ArrayList<>();
		while (matcher.find()) {
			tokens.add(Integer.parseInt(matcher.group()));
		}
		return List.copyOf(tokens);
	}

	private static String normalized(String value) {
		return value == null ? "" : value.trim().toLowerCase(Locale.ROOT);
	}

	private static boolean isBlank(String value) {
		return value == null || value.isBlank();
	}
}
