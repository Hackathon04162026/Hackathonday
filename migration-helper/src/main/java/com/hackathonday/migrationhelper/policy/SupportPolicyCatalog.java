package com.hackathonday.migrationhelper.policy;

import java.util.Comparator;
import java.util.List;
import java.util.Objects;
import java.util.Optional;

public final class SupportPolicyCatalog {

	private final List<SupportPolicyRule> rules;

	private SupportPolicyCatalog(List<SupportPolicyRule> rules) {
		this.rules = List.copyOf(rules);
	}

	public static SupportPolicyCatalog of(List<SupportPolicyRule> rules) {
		return new SupportPolicyCatalog(Objects.requireNonNull(rules, "rules"));
	}

	public Optional<SupportPolicyRule> findBestRule(PolicyLookupQuery query) {
		return rules.stream()
				.filter(rule -> rule.matches(query))
				.max(Comparator
						.comparingInt(SupportPolicyRule::specificityScore)
						.thenComparing(rule -> safe(rule.component()))
						.thenComparing(rule -> safe(rule.ecosystem()))
						.thenComparing(rule -> safe(rule.sourceMetadata().sourceId())));
	}

	public PolicyLookupResult lookup(PolicyLookupQuery query) {
		return findBestRule(query)
				.map(rule -> new PolicyLookupResult(
						query.ecosystem(),
						query.component(),
						query.version(),
						rule.supportStatus(),
						rule.recommendedVersion(),
						rule.alternativeVersions(),
						rule.sourceMetadata()
				))
				.orElseGet(() -> PolicyLookupResult.unknown(query));
	}

	public List<SupportPolicyRule> rules() {
		return rules;
	}

	private String safe(String value) {
		return Objects.toString(value, "");
	}
}
