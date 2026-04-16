package com.hackathonday.migrationhelper.policy;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import java.io.IOException;
import java.io.InputStream;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

@Component
public class SupportPolicyDatasetLoader {

	private static final String DATASET_RESOURCE = "support-policies.json";

	private final ObjectMapper objectMapper;
	private SupportPolicyDataset dataset;

	public SupportPolicyDatasetLoader(ObjectMapper objectMapper) {
		this.objectMapper = objectMapper;
	}

	@PostConstruct
	void loadDataset() {
		try (InputStream inputStream = new ClassPathResource(DATASET_RESOURCE).getInputStream()) {
			SupportPolicyDataset loaded = objectMapper.readValue(inputStream, SupportPolicyDataset.class);
			validate(loaded);
			this.dataset = loaded;
		} catch (IOException ex) {
			throw new IllegalStateException("Failed to load bundled support policy dataset.", ex);
		}
	}

	public SupportPolicyDataset dataset() {
		return dataset;
	}

	private void validate(SupportPolicyDataset loaded) {
		requireText(loaded.schemaVersion(), "schemaVersion");
		requireText(loaded.generatedOn(), "generatedOn");
		parseDate(loaded.generatedOn(), "generatedOn");
		requireNonEmpty(loaded.sources(), "sources");
		requireNonEmpty(loaded.policies(), "policies");

		Set<String> sourceIds = new HashSet<>();
		for (PolicySource source : loaded.sources()) {
			requireText(source.id(), "sources.id");
			requireText(source.name(), "sources.name");
			requireText(source.url(), "sources.url");
			requireText(source.retrievedOn(), "sources.retrievedOn");
			parseDate(source.retrievedOn(), "sources.retrievedOn");
			if (!sourceIds.add(source.id())) {
				throw new IllegalStateException("Duplicate support policy source id: " + source.id());
			}
		}

		Set<String> componentKeys = new HashSet<>();
		for (ComponentPolicy policy : loaded.policies()) {
			requireText(policy.ecosystem(), "policies.ecosystem");
			requireText(policy.component(), "policies.component");
			requireNonEmpty(policy.versions(), "policies.versions");
			String componentKey = key(policy.ecosystem(), policy.component());
			if (!componentKeys.add(componentKey)) {
				throw new IllegalStateException("Duplicate component policy: " + componentKey);
			}

			Set<String> versions = new HashSet<>();
			for (VersionPolicy versionPolicy : policy.versions()) {
				requireText(versionPolicy.version(), "policies.versions.version");
				requireText(versionPolicy.releaseDate(), "policies.versions.releaseDate");
				requireText(versionPolicy.supportEndDate(), "policies.versions.supportEndDate");
				requireText(versionPolicy.sourceId(), "policies.versions.sourceId");
				parseDate(versionPolicy.releaseDate(), "policies.versions.releaseDate");
				parseDate(versionPolicy.supportEndDate(), "policies.versions.supportEndDate");
				if (!versions.add(versionPolicy.version())) {
					throw new IllegalStateException("Duplicate version policy: " + componentKey + ":" + versionPolicy.version());
				}
				if (!sourceIds.contains(versionPolicy.sourceId())) {
					throw new IllegalStateException("Unknown source id for " + componentKey + ":" + versionPolicy.version());
				}
				List<String> alternatives = versionPolicy.alternativeUpgrades() == null
						? List.of()
						: versionPolicy.alternativeUpgrades();
				for (String alternative : alternatives) {
					requireText(alternative, "policies.versions.alternativeUpgrades");
				}
			}
		}
	}

	private void requireText(String value, String field) {
		if (value == null || value.isBlank()) {
			throw new IllegalStateException("Missing required support policy field: " + field);
		}
	}

	private void requireNonEmpty(List<?> values, String field) {
		if (values == null || values.isEmpty()) {
			throw new IllegalStateException("Missing required support policy list: " + field);
		}
	}

	private void parseDate(String value, String field) {
		try {
			LocalDate.parse(value);
		} catch (DateTimeParseException ex) {
			throw new IllegalStateException("Invalid support policy date for " + field + ": " + value, ex);
		}
	}

	private String key(String ecosystem, String component) {
		return Objects.toString(ecosystem, "").trim().toLowerCase() + ":" + Objects.toString(component, "").trim().toLowerCase();
	}
}
