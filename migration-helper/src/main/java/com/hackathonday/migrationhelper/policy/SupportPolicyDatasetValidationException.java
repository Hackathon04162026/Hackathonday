package com.hackathonday.migrationhelper.policy;

import java.util.List;
import java.util.stream.Collectors;

public class SupportPolicyDatasetValidationException extends RuntimeException {

	private final List<SupportPolicyValidationIssue> failures;

	public SupportPolicyDatasetValidationException(List<SupportPolicyValidationIssue> failures) {
		super(buildMessage(failures));
		this.failures = List.copyOf(failures);
	}

	public List<SupportPolicyValidationIssue> failures() {
		return failures;
	}

	private static String buildMessage(List<SupportPolicyValidationIssue> failures) {
		return "Invalid support-policy dataset: " + failures.stream()
				.map(SupportPolicyValidationIssue::format)
				.collect(Collectors.joining("; "));
	}
}
