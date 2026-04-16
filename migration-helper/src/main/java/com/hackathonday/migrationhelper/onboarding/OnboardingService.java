package com.hackathonday.migrationhelper.onboarding;

import com.hackathonday.migrationhelper.api.contract.OnboardingCitationResponse;
import com.hackathonday.migrationhelper.api.contract.OnboardingJourneyType;
import com.hackathonday.migrationhelper.api.contract.OnboardingQueryRequest;
import com.hackathonday.migrationhelper.api.contract.OnboardingQueryResponse;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Optional;
import org.springframework.stereotype.Service;

@Service
public class OnboardingService {

	private static final String AGENT_NAME = "Confluence-grounded Onboarding Agent";
	private static final String OUTDATED_WARNING = "Note: This document may be outdated - verify with your team lead.";

	private final OnboardingDocumentRepository documentRepository;

	public OnboardingService(OnboardingDocumentRepository documentRepository) {
		this.documentRepository = Objects.requireNonNull(documentRepository, "documentRepository");
	}

	public OnboardingQueryResponse answer(OnboardingQueryRequest request) {
		String role = normalize(request == null ? null : request.role());
		OnboardingJourneyType journeyType = request == null ? null : request.journeyType();
		String question = normalize(request == null ? null : request.question());

		if (role == null || journeyType == null) {
			return promptForBasics(role, journeyType);
		}

		if (journeyType == OnboardingJourneyType.FIRST_WEEK) {
			return answerFirstWeek(role);
		}

		if (question == null) {
			return new OnboardingQueryResponse(
					AGENT_NAME,
					buildPromptText(role, journeyType),
					List.of(),
					List.of(),
					List.of("What specific question do you have?"),
					null
			);
		}

		return answerSpecificQuestion(role, question);
	}

	private OnboardingQueryResponse promptForBasics(String role, OnboardingJourneyType journeyType) {
		List<String> nextQuestions = new ArrayList<>();
		if (role == null) {
			nextQuestions.add("What is your role?");
		}
		if (journeyType == null) {
			nextQuestions.add("Is this your first week, or do you have a specific question?");
		}
		return new OnboardingQueryResponse(
				AGENT_NAME,
				buildPromptText(role, journeyType),
				List.of(),
				List.of(),
				nextQuestions,
				null
		);
	}

	private OnboardingQueryResponse answerFirstWeek(String role) {
		List<OnboardingDocument> documents = documentRepository.findFirstWeekDocuments(role);
		if (documents.isEmpty()) {
			return fallback(role);
		}

		List<OnboardingCitationResponse> citations = new ArrayList<>();
		List<String> warnings = new ArrayList<>();
		StringBuilder answer = new StringBuilder();
		answer.append("For a ").append(describeRole(role)).append(" in the first week, use these docs in order:\n");

		for (int index = 0; index < documents.size(); index++) {
			OnboardingDocument document = documents.get(index);
			citations.add(citation(document));
			if (document.stale()) {
				warnings.add(OUTDATED_WARNING);
			}
			answer.append(index + 1)
					.append(". ")
					.append(document.section())
					.append(": ")
					.append(document.summary())
					.append(" (")
					.append(document.documentName())
					.append(")\n");
		}

		answer.append("Want me to go deeper on any step?");
		return new OnboardingQueryResponse(
				AGENT_NAME,
				answer.toString().trim(),
				citations,
				List.copyOf(warnings),
				List.of(),
				null
		);
	}

	private OnboardingQueryResponse answerSpecificQuestion(String role, String question) {
		Optional<OnboardingDocument> bestMatch = documentRepository.findBestMatch(role, question);
		if (bestMatch.isEmpty()) {
			return fallback(role);
		}

		OnboardingDocument document = bestMatch.get();
		List<String> warnings = new ArrayList<>();
		if (document.stale()) {
			warnings.add(OUTDATED_WARNING);
		}

		String answer = "For a " + describeRole(role) + ", " + document.summary()
				+ " (from " + document.documentName() + "). Want me to go deeper?";

		return new OnboardingQueryResponse(
				AGENT_NAME,
				answer,
				List.of(citation(document)),
				List.copyOf(warnings),
				List.of(),
				null
		);
	}

	private OnboardingQueryResponse fallback(String role) {
		String escalation = escalationForRole(role);
		String answer = "I couldn't find this in our documentation. You may want to ask " + escalation + ".";
		return new OnboardingQueryResponse(
				AGENT_NAME,
				answer,
				List.of(),
				List.of(),
				List.of(),
				escalation
		);
	}

	private OnboardingCitationResponse citation(OnboardingDocument document) {
		return new OnboardingCitationResponse(
				document.documentName(),
				document.section(),
				document.owner(),
				document.channel(),
				document.updatedOn(),
				document.stale()
		);
	}

	private String buildPromptText(String role, OnboardingJourneyType journeyType) {
		if (role == null && journeyType == null) {
			return "I need your role and whether this is your first week or you have a specific question.";
		}
		if (role == null) {
			return "I need your role.";
		}
		if (journeyType == null) {
			return "I need to know whether this is your first week or a specific question.";
		}
		return "I can help with onboarding guidance for " + describeRole(role) + ".";
	}

	private String describeRole(String role) {
		if (role == null || role.isBlank()) {
			return "new joiner";
		}
		return role.trim();
	}

	private String escalationForRole(String role) {
		String normalized = role == null ? "" : role.trim().toLowerCase(Locale.ROOT);
		return switch (normalized) {
			case "developer" -> "your team lead or #engineering-help";
			case "tester", "qa", "quality engineer" -> "your QE lead or #qa-help";
			case "scrum master" -> "your delivery lead or #delivery-ops";
			case "product owner" -> "the program lead or #product";
			default -> "your team lead or #onboarding-help";
		};
	}

	private String normalize(String value) {
		if (value == null || value.isBlank()) {
			return null;
		}
		return value.trim();
	}
}
