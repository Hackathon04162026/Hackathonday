package com.hackathonday.migrationhelper.policy;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.time.LocalDate;
import java.util.List;

@JsonIgnoreProperties(ignoreUnknown = true)
public record SupportPolicyDataset(
		String datasetVersion,
		String source,
		LocalDate generatedOn,
		List<SupportPolicyEntry> policies
) {
}
