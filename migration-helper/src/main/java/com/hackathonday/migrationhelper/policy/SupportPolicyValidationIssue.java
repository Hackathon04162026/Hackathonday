package com.hackathonday.migrationhelper.policy;

public record SupportPolicyValidationIssue(
		String code,
		String path,
		String message
) {

	public String format() {
		return code + " at " + path + ": " + message;
	}
}
