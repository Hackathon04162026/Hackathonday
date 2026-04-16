package com.hackathonday.migrationhelper.testcase;

import com.hackathonday.migrationhelper.api.contract.TestCaseGenerationRequest;
import com.hackathonday.migrationhelper.api.contract.TestCaseGenerationResponse;
import com.hackathonday.migrationhelper.api.contract.TestCaseGenerationResponse.Summary;
import com.hackathonday.migrationhelper.api.contract.TestCaseGenerationResponse.TestCaseResponse;
import com.hackathonday.migrationhelper.api.contract.TestCaseGenerationResponse.TestSuiteResponse;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;

@Service
public class TestCaseGeneratorService {

	public TestCaseGenerationResponse generate(TestCaseGenerationRequest request) {
		List<String> criteria = request.acceptanceCriteria().stream()
				.filter(value -> value != null && !value.isBlank())
				.map(this::normalizeWhitespace)
				.collect(Collectors.toList());

		if (criteria.isEmpty()) {
			throw new IllegalArgumentException("acceptance criteria must contain at least one non-blank item");
		}

		AtomicInteger sequence = new AtomicInteger(1);
		List<TestSuiteResponse> suites = new ArrayList<>();
		List<String> summaryGaps = new ArrayList<>();
		int positive = 0;
		int negative = 0;
		int edge = 0;
		int boundary = 0;
		int untestable = 0;

		for (int i = 0; i < criteria.size(); i++) {
			String criterion = criteria.get(i);
			boolean gherkin = isGherkinCriterion(criterion);
			boolean flaggedUntestable = isUntestable(criterion);
			String suiteName = deriveSuiteName(criterion, i + 1);
			String rewriteSuggestion = flaggedUntestable
					? "Rewrite it as: Given [context], when [action], then [observable result]."
					: null;

			List<TestCaseResponse> cases = new ArrayList<>();
			cases.add(buildPositiveCase(sequence, suiteName, criterion, request.storySummary(), gherkin));
			cases.add(buildNegativeCase(sequence, suiteName, criterion, request.storySummary(), gherkin));

			TestCaseResponse edgeCase = buildEdgeCase(sequence, suiteName, criterion, request.storySummary());
			if ("Boundary".equals(edgeCase.type())) {
				boundary++;
			} else {
				edge++;
			}
			cases.add(edgeCase);

			positive++;
			negative++;
			if (flaggedUntestable) {
				untestable++;
			}

			suites.add(new TestSuiteResponse(
					suiteName,
					criterion,
					flaggedUntestable,
					flaggedUntestable ? buildUntestableReason(criterion) : null,
					rewriteSuggestion,
					cases
			));
		}

		summaryGaps.addAll(buildCoverageGaps(request.storySummary(), criteria, untestable));
		int total = suites.stream().mapToInt(suite -> suite.testCases().size()).sum();
		Summary summary = new Summary(total, positive, negative, edge + boundary, boundary, untestable, List.copyOf(summaryGaps));
		return new TestCaseGenerationResponse(suites, summary);
	}

	private List<String> buildCoverageGaps(String storySummary, List<String> criteria, int untestable) {
		List<String> gaps = new ArrayList<>();
		String combined = normalizeWhitespace(storySummary + " " + String.join(" ", criteria)).toLowerCase(Locale.ROOT);

		if (!containsAny(combined, "permission", "access denied", "unauthoriz", "unauthorised", "unauthorized")) {
			gaps.add("Permission and access-denied scenarios are not explicitly covered.");
		}
		if (!containsAny(combined, "timeout", "network", "unavailable", "retry")) {
			gaps.add("Network failure and timeout scenarios are not explicitly covered.");
		}
		if (!containsAny(combined, "concurrent", "parallel", "simultaneous")) {
			gaps.add("Concurrent access scenarios are not explicitly covered.");
		}
		if (untestable > 0) {
			gaps.add("One or more acceptance criteria are untestable and should be rewritten before execution.");
		}

		return gaps;
	}

	private TestCaseResponse buildPositiveCase(AtomicInteger sequence, String suiteName, String criterion, String storySummary, boolean gherkin) {
		String id = nextId(sequence);
		if (gherkin) {
			return new TestCaseResponse(
					id,
					"Happy path for " + suiteName,
					"High",
					"Positive",
					preconditionsFromGherkin(criterion),
					stepsFromGherkin(criterion),
					expectedFromGherkin(criterion, "The observable outcome described by the criterion is returned."),
					"Use a valid example that matches the story summary: " + storySummary
			);
		}

		return new TestCaseResponse(
				id,
				"Happy path for " + suiteName,
				"High",
				"Positive",
				List.of("The story context is available and required inputs are valid."),
				List.of("Submit the flow described by the acceptance criterion using valid data."),
				"The system produces the observable outcome described by the criterion.",
				"Valid input aligned to: " + criterion
		);
	}

	private TestCaseResponse buildNegativeCase(AtomicInteger sequence, String suiteName, String criterion, String storySummary, boolean gherkin) {
		String id = nextId(sequence);
		if (gherkin) {
			return new TestCaseResponse(
					id,
					"Reject invalid " + suiteName,
					"Medium",
					"Negative",
					preconditionsFromGherkin(criterion),
					List.of("Repeat the same flow with one required input removed or malformed."),
					"The system rejects the request, surfaces a validation message, and does not create the output.",
					"Invalid payload derived from: " + storySummary
			);
		}

		return new TestCaseResponse(
				id,
				"Reject invalid " + suiteName,
				"Medium",
				"Negative",
				List.of("The story context is available but one required input is missing or malformed."),
				List.of("Submit the flow with an invalid field, null value, or empty payload."),
				"The system rejects the request and surfaces a clear validation error.",
				"Invalid input derived from: " + criterion
		);
	}

	private TestCaseResponse buildEdgeCase(AtomicInteger sequence, String suiteName, String criterion, String storySummary) {
		String id = nextId(sequence);
		String lower = criterion.toLowerCase(Locale.ROOT);

		if (containsAny(lower, "timeout", "network", "unavailable")) {
			return new TestCaseResponse(
					id,
					"Timeout handling for " + suiteName,
					"Low",
					"Edge Case",
					List.of("The system depends on an external service."),
					List.of("Simulate a timeout or temporary outage while executing the flow."),
					"The system fails gracefully, retries if designed to do so, and reports the timeout clearly.",
					"Timeout scenario with a delayed dependency"
			);
		}

		if (containsAny(lower, "permission", "access denied", "unauthoriz", "unauthorised", "unauthorized")) {
			return new TestCaseResponse(
					id,
					"Permission check for " + suiteName,
					"Low",
					"Edge Case",
					List.of("The actor does not have the required permission."),
					List.of("Execute the flow with a user or service account that lacks access."),
					"The system denies the action and exposes the permission error without partial completion.",
					"Access denied user"
			);
		}

		if (containsBoundaryLanguage(lower)) {
			String boundaryValue = extractBoundaryValue(criterion);
			return new TestCaseResponse(
					id,
					"Boundary value for " + suiteName,
					"Low",
					"Boundary",
					List.of("A value at the stated limit is available."),
					List.of("Run the flow with the exact boundary value and with the next value above it."),
					"The system handles the boundary correctly and applies the expected limit behavior.",
					"Boundary values: " + boundaryValue + " and " + nextBoundaryValue(boundaryValue)
			);
		}

		if (containsAny(lower, "concurrent", "parallel", "simultaneous")) {
			return new TestCaseResponse(
					id,
					"Concurrent access for " + suiteName,
					"Low",
					"Edge Case",
					List.of("Two requests or actors are ready at the same time."),
					List.of("Execute the same scenario concurrently from two sessions."),
					"The system remains consistent and does not lose or duplicate data.",
					"Two simultaneous executions"
			);
		}

		return new TestCaseResponse(
				id,
				"Empty input handling for " + suiteName,
				"Low",
				"Edge Case",
				List.of("The request body is empty or contains optional null values."),
				List.of("Execute the flow with empty, null, or blank optional inputs."),
				"The system handles empty or null inputs without crashing and returns a clear response.",
				"Empty or null optional fields"
		);
	}

	private boolean isGherkinCriterion(String criterion) {
		String lower = criterion.toLowerCase(Locale.ROOT);
		return lower.contains("given") || lower.contains("when") || lower.contains("then");
	}

	private boolean isUntestable(String criterion) {
		String lower = criterion.toLowerCase(Locale.ROOT);
		if (criterion.split("\\s+").length < 4) {
			return true;
		}
		return containsAny(lower, "properly", "works", "work properly", "good", "easy", "fast", "seamless", "robust", "friendly", "appropriate", "as needed", "etc");
	}

	private String buildUntestableReason(String criterion) {
		return "It does not define a measurable behavior, actor, or expected outcome: " + criterion;
	}

	private String deriveSuiteName(String criterion, int index) {
		String normalized = normalizeWhitespace(criterion)
				.replaceAll("(?i)\\b(given|when|then|and|but|should|must|shall)\\b", " ")
				.replaceAll("[^A-Za-z0-9 ]", " ");
		List<String> words = java.util.Arrays.stream(normalized.split("\\s+"))
				.filter(word -> !word.isBlank())
				.filter(word -> !isStopWord(word))
				.limit(6)
				.collect(Collectors.toList());
		String base = words.isEmpty() ? "Acceptance Criterion " + index : words.stream()
				.map(this::titleCase)
				.collect(Collectors.joining(" "));
		return base.trim();
	}

	private boolean isStopWord(String word) {
		String lower = word.toLowerCase(Locale.ROOT);
		return lower.equals("a") || lower.equals("an") || lower.equals("the") || lower.equals("to") || lower.equals("of")
				|| lower.equals("for") || lower.equals("in") || lower.equals("on") || lower.equals("with")
				|| lower.equals("and") || lower.equals("or") || lower.equals("by") || lower.equals("from");
	}

	private List<String> preconditionsFromGherkin(String criterion) {
		String given = clauseBetween(criterion, "given", "when");
		if (given.isBlank()) {
			return List.of("The scenario is ready for execution.");
		}
		return List.of(normalizeWhitespace(given));
	}

	private List<String> stepsFromGherkin(String criterion) {
		String when = clauseBetween(criterion, "when", "then");
		if (when.isBlank()) {
			return List.of("Execute the scenario described by the acceptance criterion.");
		}
		return List.of(normalizeWhitespace(when));
	}

	private String expectedFromGherkin(String criterion, String fallback) {
		String then = clauseBetween(criterion, "then", null);
		if (then.isBlank()) {
			return fallback;
		}
		return normalizeWhitespace(then);
	}

	private String clauseBetween(String criterion, String startKeyword, String endKeyword) {
		String lower = criterion.toLowerCase(Locale.ROOT);
		int start = lower.indexOf(startKeyword.toLowerCase(Locale.ROOT));
		if (start < 0) {
			return "";
		}
		start += startKeyword.length();
		int end = criterion.length();
		if (endKeyword != null) {
			int idx = lower.indexOf(endKeyword.toLowerCase(Locale.ROOT), start);
			if (idx >= 0) {
				end = idx;
			}
		}
		return criterion.substring(start, end).replaceAll("^[,:\\-]+\\s*", "").trim();
	}

	private boolean containsBoundaryLanguage(String lowerCriterion) {
		return containsAny(lowerCriterion, "boundary", "limit", "maximum", "minimum", "max", "min", "greater than", "less than", "at least", "at most", "exceeds", "over", "under")
				|| lowerCriterion.matches(".*\\b\\d+\\b.*");
	}

	private String extractBoundaryValue(String criterion) {
		Matcher matcher = Pattern.compile("(\\d+)").matcher(criterion);
		if (matcher.find()) {
			return matcher.group(1);
		}
		return "the stated limit";
	}

	private String nextBoundaryValue(String boundaryValue) {
		try {
			return String.valueOf(Integer.parseInt(boundaryValue) + 1);
		} catch (NumberFormatException exception) {
			return "the next value above the boundary";
		}
	}

	private String nextId(AtomicInteger sequence) {
		return String.format("TC-%03d", sequence.getAndIncrement());
	}

	private boolean containsAny(String text, String... keywords) {
		for (String keyword : keywords) {
			if (text.contains(keyword)) {
				return true;
			}
		}
		return false;
	}

	private String normalizeWhitespace(String value) {
		if (value == null) {
			return "";
		}
		return value.trim().replaceAll("\\s+", " ");
	}

	private String titleCase(String value) {
		if (value.isBlank()) {
			return value;
		}
		return Character.toUpperCase(value.charAt(0)) + value.substring(1).toLowerCase(Locale.ROOT);
	}
}
