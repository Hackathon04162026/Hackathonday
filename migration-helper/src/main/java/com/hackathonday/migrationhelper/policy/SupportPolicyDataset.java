package com.hackathonday.migrationhelper.policy;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.util.List;

@JsonIgnoreProperties(ignoreUnknown = true)
public record SupportPolicyDataset(
		String schemaVersion,
		String generatedOn,
		List<PolicySource> sources,
		List<ComponentPolicy> policies
) {
}
