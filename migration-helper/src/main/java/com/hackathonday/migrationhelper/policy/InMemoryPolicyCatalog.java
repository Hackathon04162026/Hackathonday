package com.hackathonday.migrationhelper.policy;

import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;

final class InMemoryPolicyCatalog implements PolicyCatalog {

	private final Map<PolicyKey, ComponentPolicy> policies;

	InMemoryPolicyCatalog(List<ComponentPolicy> policies) {
		Map<PolicyKey, ComponentPolicy> entries = new HashMap<>();
		for (ComponentPolicy policy : Objects.requireNonNull(policies, "policies")) {
			entries.put(new PolicyKey(policy.ecosystem(), policy.component()), policy);
		}
		this.policies = Map.copyOf(entries);
	}

	@Override
	public Optional<ComponentPolicy> find(String ecosystem, String component) {
		if (ecosystem == null || component == null) {
			return Optional.empty();
		}
		return Optional.ofNullable(policies.get(new PolicyKey(ecosystem, component)));
	}

	private record PolicyKey(String ecosystem, String component) {

		PolicyKey {
			ecosystem = normalize(ecosystem);
			component = normalize(component);
		}

		private static String normalize(String value) {
			return value == null ? null : value.toLowerCase(Locale.ROOT);
		}
	}
}
