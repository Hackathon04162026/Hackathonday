package com.hackathonday.migrationhelper.policy;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import org.springframework.stereotype.Component;

@Component
public class SupportPolicyDatasetValidator {

	private static final String REQUIRED_FIELD_CODE = "POLICY_REQUIRED_FIELD_MISSING";
	private static final String DATE_CODE = "POLICY_DATE_INVALID";
	private static final String VERSION_CODE = "POLICY_VERSION_INVALID";
	private static final String WARNING_CODE = "POLICY_VERSION_WARNING";

	public SupportPolicyValidationReport validate(SupportPolicyDataset dataset) {
		List<SupportPolicyValidationIssue> warnings = new ArrayList<>();
		List<SupportPolicyValidationIssue> failures = new ArrayList<>();

		if (dataset == null) {
			failures.add(issue(REQUIRED_FIELD_CODE, "$", "Support policy dataset is missing"));
			return new SupportPolicyValidationReport(List.copyOf(warnings), List.copyOf(failures));
		}

		requiredText(dataset.datasetVersion(), "$.datasetVersion", "datasetVersion", failures);
		requiredText(dataset.source(), "$.source", "source", failures);
		requiredDate(dataset.generatedOn(), "$.generatedOn", "generatedOn", failures);

		List<SupportPolicyEntry> policies = dataset.policies();
		if (policies == null || policies.isEmpty()) {
			failures.add(issue(REQUIRED_FIELD_CODE, "$.policies", "policies must contain at least one support policy entry"));
			return new SupportPolicyValidationReport(List.copyOf(warnings), List.copyOf(failures));
		}

		Set<String> policyKeys = new HashSet<>();
		for (int i = 0; i < policies.size(); i++) {
			SupportPolicyEntry policy = policies.get(i);
			String policyPath = "$.policies[" + i + "]";
			validatePolicy(policy, policyPath, warnings, failures, policyKeys);
		}

		return new SupportPolicyValidationReport(List.copyOf(warnings), List.copyOf(failures));
	}

	private void validatePolicy(
			SupportPolicyEntry policy,
			String policyPath,
			List<SupportPolicyValidationIssue> warnings,
			List<SupportPolicyValidationIssue> failures,
			Set<String> policyKeys
	) {
		if (policy == null) {
			failures.add(issue(REQUIRED_FIELD_CODE, policyPath, "policy entry is missing"));
			return;
		}

		String ecosystem = requiredText(policy.ecosystem(), policyPath + ".ecosystem", "ecosystem", failures);
		String component = requiredText(policy.component(), policyPath + ".component", "component", failures);
		requiredText(policy.source(), policyPath + ".source", "source", failures);

		List<SupportPolicyVersionEntry> versions = policy.versions();
		if (versions == null || versions.isEmpty()) {
			failures.add(issue(REQUIRED_FIELD_CODE, policyPath + ".versions", "versions must contain at least one version entry"));
			return;
		}

		if (ecosystem != null && component != null) {
			String policyKey = ecosystem + ":" + component;
			if (!policyKeys.add(policyKey)) {
				warnings.add(issue(WARNING_CODE, policyPath, "duplicate policy entry for " + policyKey));
			}
		}

		Set<String> seenVersions = new HashSet<>();
		for (int i = 0; i < versions.size(); i++) {
			SupportPolicyVersionEntry version = versions.get(i);
			validateVersion(version, policyPath + ".versions[" + i + "]", warnings, failures, seenVersions);
		}
	}

	private void validateVersion(
			SupportPolicyVersionEntry version,
			String versionPath,
			List<SupportPolicyValidationIssue> warnings,
			List<SupportPolicyValidationIssue> failures,
			Set<String> seenVersions
	) {
		if (version == null) {
			failures.add(issue(REQUIRED_FIELD_CODE, versionPath, "version entry is missing"));
			return;
		}

		String versionText = requiredText(version.version(), versionPath + ".version", "version", failures);
		requiredEnum(version.supportStatus(), versionPath + ".supportStatus", "supportStatus", failures);
		LocalDate releasedOn = requiredDate(version.releasedOn(), versionPath + ".releasedOn", "releasedOn", failures);
		LocalDate supportEndsOn = requiredDate(version.supportEndsOn(), versionPath + ".supportEndsOn", "supportEndsOn", failures);

		if (versionText != null && !seenVersions.add(versionText)) {
			warnings.add(issue(WARNING_CODE, versionPath, "duplicate version entry for " + versionText));
		}

		if (releasedOn != null && supportEndsOn != null && releasedOn.isAfter(supportEndsOn)) {
			failures.add(issue(DATE_CODE, versionPath, "releasedOn must be on or before supportEndsOn"));
		}

		if (version.supportStatus() != null
				&& supportEndsOn != null
				&& version.supportStatus() != SupportStatus.UNSUPPORTED
				&& version.supportStatus() != SupportStatus.UNKNOWN_VERSION
				&& supportEndsOn.isBefore(LocalDate.now())) {
			warnings.add(issue(WARNING_CODE, versionPath, "supportEndsOn is already in the past for " + versionText));
		}
	}

	private String requiredText(String value, String path, String fieldName, List<SupportPolicyValidationIssue> failures) {
		if (value == null || value.isBlank()) {
			failures.add(issue(REQUIRED_FIELD_CODE, path, fieldName + " is required"));
			return null;
		}
		return value.trim();
	}

	private LocalDate requiredDate(LocalDate value, String path, String fieldName, List<SupportPolicyValidationIssue> failures) {
		if (value == null) {
			failures.add(issue(REQUIRED_FIELD_CODE, path, fieldName + " is required"));
			return null;
		}
		return value;
	}

	private SupportStatus requiredEnum(SupportStatus value, String path, String fieldName, List<SupportPolicyValidationIssue> failures) {
		if (value == null) {
			failures.add(issue(REQUIRED_FIELD_CODE, path, fieldName + " is required"));
		}
		return value;
	}

	private SupportPolicyValidationIssue issue(String code, String path, String message) {
		return new SupportPolicyValidationIssue(code, path, message);
	}
}
