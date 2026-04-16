package com.hackathonday.migrationhelper.policy;

import java.util.Arrays;
import java.util.List;
import java.util.Optional;

public interface PolicyCatalog {

	Optional<ComponentPolicy> find(String ecosystem, String component);

	static PolicyCatalog of(ComponentPolicy... policies) {
		return new InMemoryPolicyCatalog(Arrays.asList(policies));
	}

	static PolicyCatalog empty() {
		return new InMemoryPolicyCatalog(List.of());
	}
}
