package com.hackathonday.migrationhelper.policy;

import java.util.List;

public record SupportPolicyDatasetLoadResult(
		SupportPolicyDataset dataset,
		List<SupportPolicyValidationIssue> warnings
) {
}
