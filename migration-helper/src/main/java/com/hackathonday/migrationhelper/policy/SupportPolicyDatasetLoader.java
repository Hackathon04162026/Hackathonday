package com.hackathonday.migrationhelper.policy;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.io.InputStream;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Component;

@Component
public class SupportPolicyDatasetLoader {

	private static final String DATASET_RESOURCE = "support-policies.json";
	private static final String REQUIRED_FIELD_CODE = "POLICY_REQUIRED_FIELD_MISSING";
	private static final String DATE_CODE = "POLICY_DATE_INVALID";
	private static final String WARNING_CODE = "POLICY_DATA_WARNING";

	private final ObjectMapper objectMapper;
	private SupportPolicyDataset dataset;
	private List<SupportPolicyValidationIssue> warnings = List.of();

	public SupportPolicyDatasetLoader(ObjectMapper objectMapper) {
		this.objectMapper = Objects.requireNonNull(objectMapper, "objectMapper");
		LoadedDataset loaded = loadDataset(new ClassPathResource(DATASET_RESOURCE));
		this.dataset = loaded.dataset();
		this.warnings = loaded.warnings();
	}

	public SupportPolicyDataset dataset() {
		return dataset;
	}

	public List<SupportPolicyValidationIssue> warnings() {
		return warnings;
	}

	public SupportPolicyDataset load(Resource resource) {
		LoadedDataset loaded = loadDataset(resource);
		this.dataset = loaded.dataset();
		this.warnings = loaded.warnings();
		return loaded.dataset();
	}

	public SupportPolicyCatalog load(InputStream inputStream) {
		try {
			CatalogDocument document = objectMapper.readValue(inputStream, CatalogDocument.class);
			List<SupportPolicyRule> rules = document == null || document.rules() == null ? List.of() : document.rules();
			return SupportPolicyCatalog.of(rules);
		} catch (IOException ex) {
			throw new SupportPolicyDatasetLoadException("Failed to load support policy catalog document.", ex);
		}
	}

	private LoadedDataset loadDataset(Resource resource) {
		try (InputStream inputStream = resource.getInputStream()) {
			SupportPolicyDataset loaded = objectMapper.readValue(inputStream, SupportPolicyDataset.class);
			SupportPolicyValidationReport report = validate(loaded);
			if (report.hasFailures()) {
				throw new SupportPolicyDatasetValidationException(report.failures());
			}
			return new LoadedDataset(loaded, report.warnings());
		} catch (IOException ex) {
			throw new SupportPolicyDatasetLoadException("Failed to load bundled support policy dataset from "
					+ resource.getDescription(), ex);
		}
	}

	private SupportPolicyValidationReport validate(SupportPolicyDataset loaded) {
		List<SupportPolicyValidationIssue> warnings = new ArrayList<>();
		List<SupportPolicyValidationIssue> failures = new ArrayList<>();

		if (loaded == null) {
			failures.add(issue(REQUIRED_FIELD_CODE, "$", "support policy dataset is missing"));
			return new SupportPolicyValidationReport(List.copyOf(warnings), List.copyOf(failures));
		}

		requireText(loaded.schemaVersion(), "$.schemaVersion", "schemaVersion", failures);
		requireText(loaded.generatedOn(), "$.generatedOn", "generatedOn", failures);
		validateDate(loaded.generatedOn(), "$.generatedOn", "generatedOn", failures);
		requireList(loaded.sources(), "$.sources", "sources", failures);
		requireList(loaded.policies(), "$.policies", "policies", failures);

		if (loaded.sources() == null || loaded.policies() == null) {
			return new SupportPolicyValidationReport(List.copyOf(warnings), List.copyOf(failures));
		}

		Set<String> sourceIds = new HashSet<>();
		for (int index = 0; index < loaded.sources().size(); index++) {
			validateSource(loaded.sources().get(index), "$.sources[" + index + "]", warnings, failures, sourceIds);
		}

		Set<String> policyKeys = new HashSet<>();
		for (int index = 0; index < loaded.policies().size(); index++) {
			validatePolicy(loaded.policies().get(index), "$.policies[" + index + "]", sourceIds, warnings, failures, policyKeys);
		}

		return new SupportPolicyValidationReport(List.copyOf(warnings), List.copyOf(failures));
	}

	private void validateSource(
			PolicySource source,
			String path,
			List<SupportPolicyValidationIssue> warnings,
			List<SupportPolicyValidationIssue> failures,
			Set<String> sourceIds
	) {
		if (source == null) {
			failures.add(issue(REQUIRED_FIELD_CODE, path, "source entry is missing"));
			return;
		}

		String id = requireText(source.id(), path + ".id", "id", failures);
		requireText(source.name(), path + ".name", "name", failures);
		requireText(source.url(), path + ".url", "url", failures);
		String retrievedOn = requireText(source.retrievedOn(), path + ".retrievedOn", "retrievedOn", failures);
		validateDate(retrievedOn, path + ".retrievedOn", "retrievedOn", failures);

		if (id != null && !sourceIds.add(id.toLowerCase())) {
			warnings.add(issue(WARNING_CODE, path, "duplicate source id " + id + " will reuse the first occurrence"));
		}
	}

	private void validatePolicy(
			ComponentPolicy policy,
			String path,
			Set<String> sourceIds,
			List<SupportPolicyValidationIssue> warnings,
			List<SupportPolicyValidationIssue> failures,
			Set<String> policyKeys
	) {
		if (policy == null) {
			failures.add(issue(REQUIRED_FIELD_CODE, path, "policy entry is missing"));
			return;
		}

		String ecosystem = requireText(policy.ecosystem(), path + ".ecosystem", "ecosystem", failures);
		String component = requireText(policy.component(), path + ".component", "component", failures);
		requireList(policy.versions(), path + ".versions", "versions", failures);

		String policyKey = key(ecosystem, component);
		if (policyKey != null && !policyKeys.add(policyKey)) {
			warnings.add(issue(WARNING_CODE, path, "duplicate policy entry for " + policyKey + " will reuse the first occurrence"));
		}

		if (policy.versions() == null) {
			return;
		}

		Set<String> knownVersions = new HashSet<>();
		for (VersionPolicy version : policy.versions()) {
			if (version != null && version.version() != null && !version.version().isBlank()) {
				knownVersions.add(version.version().trim().toLowerCase());
			}
		}

		Set<String> seenVersions = new HashSet<>();
		for (int index = 0; index < policy.versions().size(); index++) {
			validateVersion(
					policy.versions().get(index),
					path + ".versions[" + index + "]",
					knownVersions,
					sourceIds,
					warnings,
					failures,
					seenVersions
			);
		}
	}

	private void validateVersion(
			VersionPolicy version,
			String path,
			Set<String> knownVersions,
			Set<String> sourceIds,
			List<SupportPolicyValidationIssue> warnings,
			List<SupportPolicyValidationIssue> failures,
			Set<String> seenVersions
	) {
		if (version == null) {
			failures.add(issue(REQUIRED_FIELD_CODE, path, "version entry is missing"));
			return;
		}

		String versionValue = requireText(version.version(), path + ".version", "version", failures);
		String releaseDate = requireText(version.releaseDate(), path + ".releaseDate", "releaseDate", failures);
		String supportEndDate = requireText(version.supportEndDate(), path + ".supportEndDate", "supportEndDate", failures);
		String sourceId = requireText(version.sourceId(), path + ".sourceId", "sourceId", failures);

		if (versionValue != null && !seenVersions.add(versionValue.toLowerCase())) {
			warnings.add(issue(WARNING_CODE, path, "duplicate version entry for " + versionValue + " will reuse the first occurrence"));
		}

		if (version.preferredUpgrade() != null && !version.preferredUpgrade().isBlank()) {
			String preferred = version.preferredUpgrade().trim().toLowerCase();
			if (!knownVersions.contains(preferred)) {
				warnings.add(issue(WARNING_CODE, path, "preferredUpgrade " + version.preferredUpgrade()
						+ " is not listed as a version in the same policy"));
			}
		}

		if (version.alternativeUpgrades() != null) {
			for (int index = 0; index < version.alternativeUpgrades().size(); index++) {
				String alternative = version.alternativeUpgrades().get(index);
				if (alternative == null || alternative.isBlank()) {
					failures.add(issue(REQUIRED_FIELD_CODE, path + ".alternativeUpgrades[" + index + "]",
							"alternativeUpgrades entries must not be blank"));
				}
			}
		}

		LocalDate release = parseDateValue(releaseDate, path + ".releaseDate", failures, "releaseDate");
		LocalDate supportEnd = parseDateValue(supportEndDate, path + ".supportEndDate", failures, "supportEndDate");
		if (release != null && supportEnd != null && release.isAfter(supportEnd)) {
			warnings.add(issue(DATE_CODE, path, "releaseDate is after supportEndDate"));
		}

		if (sourceId != null && !sourceIds.contains(sourceId.trim().toLowerCase())) {
			failures.add(issue(REQUIRED_FIELD_CODE, path + ".sourceId", "unknown sourceId " + sourceId));
		}
	}

	private String requireText(String value, String path, String fieldName, List<SupportPolicyValidationIssue> failures) {
		if (value == null || value.isBlank()) {
			failures.add(issue(REQUIRED_FIELD_CODE, path, fieldName + " is required"));
			return null;
		}
		return value.trim();
	}

	private void requireList(List<?> values, String path, String fieldName, List<SupportPolicyValidationIssue> failures) {
		if (values == null || values.isEmpty()) {
			failures.add(issue(REQUIRED_FIELD_CODE, path, fieldName + " must contain at least one entry"));
		}
	}

	private void validateDate(String value, String path, String fieldName, List<SupportPolicyValidationIssue> failures) {
		if (value == null || value.isBlank()) {
			return;
		}
		parseDateValue(value, path, failures, fieldName);
	}

	private LocalDate parseDateValue(String value, String path, List<SupportPolicyValidationIssue> failures, String fieldName) {
		try {
			return LocalDate.parse(value);
		} catch (DateTimeParseException ex) {
			failures.add(issue(DATE_CODE, path, "invalid " + fieldName + " value: " + value));
			return null;
		}
	}

	private String key(String ecosystem, String component) {
		if (ecosystem == null || component == null) {
			return null;
		}
		return ecosystem.trim().toLowerCase() + ":" + component.trim().toLowerCase();
	}

	private SupportPolicyValidationIssue issue(String code, String path, String message) {
		return new SupportPolicyValidationIssue(code, path, message);
	}

	private record LoadedDataset(SupportPolicyDataset dataset, List<SupportPolicyValidationIssue> warnings) {
	}

	private record CatalogDocument(List<SupportPolicyRule> rules) {
	}
}
