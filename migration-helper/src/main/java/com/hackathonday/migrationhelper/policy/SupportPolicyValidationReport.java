package com.hackathonday.migrationhelper.policy;

import java.util.List;

record SupportPolicyValidationReport(
		List<SupportPolicyValidationIssue> warnings,
		List<SupportPolicyValidationIssue> failures
) {

	boolean hasFailures() {
		return !failures.isEmpty();
	}
}
