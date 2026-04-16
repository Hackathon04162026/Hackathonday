package com.hackathonday.migrationhelper.policy;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.util.List;

@JsonIgnoreProperties(ignoreUnknown = true)
public record SupportPolicyEntry(
		String ecosystem,
		String component,
		String source,
		List<SupportPolicyVersionEntry> versions
) {
}
