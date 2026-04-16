package com.hackathonday.migrationhelper.onboarding;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.hackathonday.migrationhelper.api.contract.OnboardingJourneyType;
import java.io.IOException;
import java.io.InputStream;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

@Component
public class OnboardingDocumentRepository {

	private static final String DATASET_RESOURCE = "onboarding-documents.json";

	private final List<OnboardingDocument> documents;

	public OnboardingDocumentRepository(ObjectMapper objectMapper) {
		Objects.requireNonNull(objectMapper, "objectMapper");
		this.documents = loadDocuments(objectMapper);
	}

	public List<OnboardingDocument> documents() {
		return documents;
	}

	public List<OnboardingDocument> findFirstWeekDocuments(String role) {
		return documents.stream()
				.filter(document -> supportsJourney(document, OnboardingJourneyType.FIRST_WEEK))
				.filter(document -> matchesRole(document, role))
				.sorted(Comparator
						.comparingInt(OnboardingDocument::topicOrder)
						.thenComparing(OnboardingDocument::documentName))
				.toList();
	}

	public Optional<OnboardingDocument> findBestMatch(String role, String question) {
		Set<String> tokens = tokenize(question);
		return documents.stream()
				.filter(document -> supportsJourney(document, OnboardingJourneyType.SPECIFIC_QUESTION)
						|| supportsJourney(document, OnboardingJourneyType.FIRST_WEEK))
				.map(document -> new ScoredDocument(document, score(document, role, tokens)))
				.filter(scoredDocument -> scoredDocument.score() > 0)
				.max(Comparator
						.comparingInt(ScoredDocument::score)
						.thenComparingInt(scoredDocument -> -scoredDocument.document().topicOrder()))
				.map(ScoredDocument::document);
	}

	private List<OnboardingDocument> loadDocuments(ObjectMapper objectMapper) {
		try (InputStream inputStream = new ClassPathResource(DATASET_RESOURCE).getInputStream()) {
			OnboardingDocumentCatalog catalog = objectMapper.readValue(inputStream, OnboardingDocumentCatalog.class);
			if (catalog == null || catalog.documents() == null) {
				return List.of();
			}
			return List.copyOf(catalog.documents());
		} catch (IOException ex) {
			throw new IllegalStateException("Failed to load onboarding document fixture from " + DATASET_RESOURCE, ex);
		}
	}

	private boolean supportsJourney(OnboardingDocument document, OnboardingJourneyType journeyType) {
		return document.journeyTypes() != null && document.journeyTypes().contains(journeyType);
	}

	private boolean matchesRole(OnboardingDocument document, String role) {
		if (document.roleFocus() == null || document.roleFocus().isBlank() || "*".equals(document.roleFocus())) {
			return true;
		}
		if (role == null || role.isBlank()) {
			return false;
		}
		return document.roleFocus().equalsIgnoreCase(role.trim());
	}

	private int score(OnboardingDocument document, String role, Set<String> tokens) {
		int score = 0;
		boolean exactRoleMatch = matchesExactRole(document, role);
		if (document.keywords() != null) {
			for (String keyword : document.keywords()) {
				if (keyword != null && tokens.contains(keyword.toLowerCase(Locale.ROOT))) {
					score += 15;
				}
			}
		}
		if (document.section() != null && tokens.contains(document.section().toLowerCase(Locale.ROOT))) {
			score += 10;
		}
		if (document.summary() != null) {
			for (String token : tokens) {
				if (document.summary().toLowerCase(Locale.ROOT).contains(token)) {
					score += 1;
				}
			}
		}
		if (score > 0 && exactRoleMatch) {
			score += 20;
		}
		return score;
	}

	private Set<String> tokenize(String question) {
		if (question == null || question.isBlank()) {
			return Set.of();
		}
		Set<String> tokens = new HashSet<>();
		for (String rawToken : question.toLowerCase(Locale.ROOT).split("[^a-z0-9]+")) {
			if (!rawToken.isBlank()) {
				tokens.add(rawToken);
			}
		}
		return tokens;
	}

	private boolean matchesExactRole(OnboardingDocument document, String role) {
		if (document.roleFocus() == null || document.roleFocus().isBlank() || "*".equals(document.roleFocus())) {
			return false;
		}
		if (role == null || role.isBlank()) {
			return false;
		}
		return document.roleFocus().equalsIgnoreCase(role.trim());
	}

	private record ScoredDocument(OnboardingDocument document, int score) {
	}
}
