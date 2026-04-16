package com.hackathonday.migrationhelper.onboarding;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.util.List;

@JsonIgnoreProperties(ignoreUnknown = true)
public record OnboardingDocumentCatalog(
		String schemaVersion,
		String generatedOn,
		List<OnboardingDocument> documents
) {
}
