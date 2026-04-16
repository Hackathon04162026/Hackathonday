package com.hackathonday.migrationhelper.policy;

import java.util.Objects;

public class SupportPolicyLookupService {

	private final SupportPolicyCatalog catalog;

	public SupportPolicyLookupService(SupportPolicyCatalog catalog) {
		this.catalog = Objects.requireNonNull(catalog, "catalog");
	}

	public PolicyLookupResult lookup(String ecosystem, String component, String version) {
		return catalog.lookup(new PolicyLookupQuery(ecosystem, component, version));
	}

	public PolicyLookupResult lookup(PolicyLookupQuery query) {
		return catalog.lookup(query);
	}
}
