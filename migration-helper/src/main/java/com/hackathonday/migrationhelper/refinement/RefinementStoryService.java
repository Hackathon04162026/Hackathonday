package com.hackathonday.migrationhelper.refinement;

import com.hackathonday.migrationhelper.api.contract.RefinementStoryRequest;
import com.hackathonday.migrationhelper.api.contract.RefinementStoryResponse;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;

@Service
public class RefinementStoryService {

	private static final Pattern STORY_PATTERN = Pattern.compile(
			"(?is)^\\s*as\\s+a\\s+(.+?)\\s*,\\s*i\\s+want\\s+to\\s+(.+?)\\s+so\\s+that\\s+i\\s+can\\s+(.+?)\\s*\\.?\\s*$"
	);

	public RefinementStoryResponse refineStory(RefinementStoryRequest request) {
		String normalizedNotes = normalizeWhitespace(request.notes());
		Set<String> themes = detectThemes(normalizedNotes);
		String primaryTheme = selectPrimaryTheme(themes, normalizedNotes);

		String candidateSummary = normalizeWhitespace(request.candidateStorySummary());
		boolean candidateProvided = !candidateSummary.isBlank();
		String storySummary = buildStorySummary(primaryTheme, candidateSummary);
		String candidateProblemStatement = normalizeWhitespace(request.candidateProblemStatement());
		String problemTheme = inferTheme(candidateProblemStatement);
		String storyTheme = inferTheme(storySummary);
		String problemStatement = buildProblemStatement(primaryTheme, themes, candidateProblemStatement, problemTheme, storyTheme);
		boolean problemStoryMisalignment = hasProblemStoryMisalignment(problemTheme, storyTheme);
		List<String> acceptanceCriteria = buildAcceptanceCriteria(primaryTheme);
		List<String> dependencies = buildDependencies(request);
		List<String> references = buildReferences(request.references());
		String estimation = request.estimatePoints() == null
				? "Not estimated \u2014 requires team sizing"
				: request.estimatePoints() + " story points";

		List<String> gaps = new ArrayList<>();
		if (problemStoryMisalignment) {
			gaps.add(buildProblemStoryMisalignmentGap(problemTheme, storyTheme));
		}
		if (themes.size() > 1) {
			gaps.add("\u26A0\uFE0F Clarification needed: the notes mix " + joinThemes(themes) + " workstreams; keep the story focused on " + titleCase(primaryTheme) + ".");
		}
		addMissingGap(gaps, "parent epic link", isBlank(request.parentEpicLink()));
		addMissingGap(gaps, "labels", isBlankList(request.labels()));
		addMissingGap(gaps, "sprint", isBlank(request.sprint()));
		addMissingGap(gaps, "estimate", request.estimatePoints() == null);
		if (request.estimatePoints() != null && request.estimatePoints() > 5) {
			gaps.add("\u26A0\uFE0F DoR GAP: estimate is " + request.estimatePoints() + " points; split the work before sprint commitment.");
		}

		List<String> validation = buildDorValidation(request, storySummary, acceptanceCriteria, gaps, problemStoryMisalignment);
		List<String> normalizationNotes = buildNormalizationNotes(request, candidateProvided, primaryTheme, themes, gaps, problemTheme, storyTheme);

		return new RefinementStoryResponse(
				problemStatement,
				storySummary,
				acceptanceCriteria,
				dependencies,
				references,
				estimation,
				validation,
				gaps,
				normalizationNotes
		);
	}

	private String buildProblemStatement(String primaryTheme, Set<String> themes, String candidateProblemStatement, String problemTheme, String storyTheme) {
		List<String> sentences = new ArrayList<>();
		String themeLabel = titleCase(primaryTheme).toLowerCase(Locale.ROOT);
		sentences.add("The current refinement notes are unstructured and make it hard for the team to agree on a single, reviewable " + themeLabel + " story.");
		sentences.add("That increases the risk of scope drift, weak acceptance criteria, and avoidable rework before sprint commitment.");
		if (!isBlank(candidateProblemStatement)) {
			sentences.add("The provided problem statement says: \"" + candidateProblemStatement + "\".");
		}
		if (hasProblemStoryMisalignment(problemTheme, storyTheme)) {
			sentences.add("That problem statement points to " + titleCase(problemTheme) + " work, but the proposed story points to " + titleCase(storyTheme) + " work, so the refinement item needs clarification before it can be approved.");
		}
		if (themes.size() > 1) {
			sentences.add("The notes also mix " + joinThemes(themes) + " concerns, so the work needs a clearer boundary before the story can be approved.");
		} else {
			sentences.add("This work turns the discussion into a canonical story package so the team can review a focused proposal instead of raw conversation notes.");
		}
		return String.join(" ", sentences);
	}

	private List<String> buildAcceptanceCriteria(String primaryTheme) {
		return switch (primaryTheme) {
			case "qe" -> List.of(
					"Given approved acceptance criteria, when the generator runs, then it returns a canonical test suite package with testSuites and summary fields in deterministic order.",
					"Should flag any acceptance criterion that is untestable and provide rewrite guidance instead of inventing behavior.",
					"Should number test cases sequentially across the entire response and include positive, negative, and edge or boundary coverage for every criterion."
			);
			case "onboarding" -> List.of(
					"Given a new team member asks a question, when the onboarding agent searches the documentation, then it returns a grounded answer with cited documents.",
					"Should flag outdated documentation and call out that the answer needs team verification when the source is stale.",
					"Should fall back to the documented escalation path when the answer cannot be found in the knowledge base."
			);
			case "planning" -> List.of(
					"Given a program lead vision, when the planning workflow runs, then it creates epics and review checkpoints before any feature decomposition begins.",
					"Should block downstream feature creation until the epic review is approved.",
					"Should block story creation until the feature review is approved."
			);
			default -> List.of(
					"Given messy refinement notes, when the facilitator submits them, then the response returns the canonical story package with problemStatement, storySummary, acceptanceCriteria, dependencies, references, estimation, definitionOfReadyValidation, gaps, and normalizationNotes in that order.",
					"Should flag a misalignment when the notes describe one workstream but the story summary focuses on another.",
					"Should add DoR gaps for missing parent epic link, labels, sprint, or estimate information.",
					"Should recommend splitting the work when the estimate is greater than 5 story points."
			);
		};
	}

	private List<String> buildDependencies(RefinementStoryRequest request) {
		boolean anyPrereqDiscussed = !isBlank(request.parentEpicLink())
				|| !isBlankList(request.labels())
				|| !isBlank(request.sprint())
				|| request.estimatePoints() != null
				|| !isBlankList(request.references())
				|| !isBlank(request.teamContext())
				|| !isBlank(request.candidateProblemStatement());

		if (!anyPrereqDiscussed) {
			return List.of("None identified during refinement \u2014 verify before sprint commitment");
		}

		List<String> dependencies = new ArrayList<>();
		dependencies.add(describeDependency("Parent epic link", request.parentEpicLink()));
		dependencies.add(describeDependency("Labels", joinValues(request.labels())));
		dependencies.add(describeDependency("Sprint", request.sprint()));
		dependencies.add(describeDependency("Estimate", request.estimatePoints() == null ? null : request.estimatePoints() + " points"));

		if (!isBlank(request.teamContext())) {
			dependencies.add("Team context: " + normalizeWhitespace(request.teamContext()));
		}

		return dependencies;
	}

	private List<String> buildReferences(List<String> references) {
		List<String> normalized = normalizeList(references);
		return normalized.isEmpty() ? List.of("None") : normalized;
	}

	private List<String> buildDorValidation(RefinementStoryRequest request, String storySummary, List<String> acceptanceCriteria, List<String> gaps, boolean problemStoryMisalignment) {
		return List.of(
				validationLine("Problem statement present and aligned with story", !hasClarificationGap(gaps) && !problemStoryMisalignment, "problem statement and story summary drift apart"),
				validationLine("User story follows \"As a / I want / So that\" format", matchesStoryPattern(storySummary), "story summary does not match the required format"),
				validationLine("Acceptance criteria are present and testable", !acceptanceCriteria.isEmpty(), "acceptance criteria are missing or empty"),
				validationLine("Dependencies discussed", !dependenciesNeedAttention(request), "dependencies were not discussed"),
				validationLine("Estimation <= 5 story points (if larger, recommend splitting)", request.estimatePoints() != null && request.estimatePoints() <= 5, request.estimatePoints() == null ? "estimate was not discussed" : "estimate exceeds 5 story points"),
				validationLine("Parent Epic Link identified", !isBlank(request.parentEpicLink()), "parent epic link was not provided"),
				validationLine("Label added", !isBlankList(request.labels()), "labels were not provided"),
				validationLine("Sprint identified", !isBlank(request.sprint()), "sprint was not identified")
		);
	}

	private List<String> buildNormalizationNotes(RefinementStoryRequest request, boolean candidateProvided, String primaryTheme, Set<String> themes, List<String> gaps, String problemTheme, String storyTheme) {
		List<String> notes = new ArrayList<>();
		notes.add("Collapsed whitespace and removed empty lines from the refinement notes.");
		notes.add("Primary theme detected: " + titleCase(primaryTheme) + ".");

		if (candidateProvided) {
			if (matchesStoryPattern(request.candidateStorySummary())) {
				notes.add("Preserved the provided story summary after normalizing spacing.");
			} else {
				notes.add("Rewrote the candidate story summary into the required As a / I want to / so that I can format.");
			}
		} else {
			notes.add("Generated a canonical story summary because no candidate summary was provided.");
		}

		if (request.estimatePoints() != null && request.estimatePoints() > 5) {
			notes.add("Estimate exceeds the preferred five-point ceiling; split guidance was added.");
		}

		if (themes.size() > 1) {
			notes.add("Detected overlapping themes: " + joinThemes(themes) + ".");
		}

		if (hasProblemStoryMisalignment(problemTheme, storyTheme)) {
			notes.add("Detected problem/story mismatch: problem statement is " + titleCase(problemTheme) + " while the story summary is " + titleCase(storyTheme) + ".");
		}

		if (!gaps.isEmpty()) {
			notes.add("Surface any unresolved gaps before sprint commitment.");
		}

		return notes;
	}

	private String buildStorySummary(String primaryTheme, String candidateSummary) {
		if (matchesStoryPattern(candidateSummary)) {
			return normalizeStorySummary(candidateSummary);
		}

		return switch (primaryTheme) {
			case "qe" -> "As a QE engineer, I want to turn acceptance criteria into comprehensive test cases so that I can execute coverage quickly.";
			case "onboarding" -> "As a new team member, I want to ask grounded onboarding questions against team documentation so that I can get set up quickly without tribal knowledge.";
			case "planning" -> "As a program lead, I want to break a vision into epics and features so that I can move the work through review gates before delivery.";
			default -> "As a refinement facilitator, I want to turn messy notes into sprint-ready user stories so that I can keep the backlog aligned and ready for sprint commitment.";
		};
	}

	private String normalizeStorySummary(String rawSummary) {
		Matcher matcher = STORY_PATTERN.matcher(normalizeWhitespace(rawSummary));
		if (!matcher.matches()) {
			return normalizeWhitespace(rawSummary);
		}

		String role = normalizeWhitespace(matcher.group(1));
		String action = normalizeWhitespace(matcher.group(2));
		String outcome = normalizeWhitespace(matcher.group(3));
		return "As a " + role + ", I want to " + action + " so that I can " + outcome + ".";
	}

	private boolean matchesStoryPattern(String candidateSummary) {
		if (isBlank(candidateSummary)) {
			return false;
		}
		return STORY_PATTERN.matcher(normalizeWhitespace(candidateSummary)).matches();
	}

	private Set<String> detectThemes(String notes) {
		Set<String> themes = new LinkedHashSet<>();
		String lower = notes.toLowerCase(Locale.ROOT);
		if (containsAny(lower, "test case", "test cases", "qe", "quality engineering", "acceptance criteria", "coverage")) {
			themes.add("qe");
		}
		if (containsAny(lower, "onboarding", "sharepoint", "confluence", "document", "new team member", "first week")) {
			themes.add("onboarding");
		}
		if (containsAny(lower, "vision", "epic", "features", "story", "backlog", "review gate", "approval")) {
			themes.add("planning");
		}
		if (containsAny(lower, "refinement", "refine", "facilitator", "sprint-ready", "user stories", "acceptance criteria")) {
			themes.add("refinement");
		}

		if (themes.isEmpty()) {
			themes.add("refinement");
		}
		return themes;
	}

	private String selectPrimaryTheme(Set<String> themes, String notes) {
		List<String> precedence = List.of("refinement", "planning", "qe", "onboarding");
		for (String theme : precedence) {
			if (themes.contains(theme)) {
				return theme;
			}
		}
		return detectThemes(notes).iterator().next();
	}

	private void addMissingGap(List<String> gaps, String label, boolean missing) {
		if (missing) {
			gaps.add("\u26A0\uFE0F DoR GAP: " + label + " was not provided");
		}
	}

	private boolean hasClarificationGap(List<String> gaps) {
		return gaps.stream().anyMatch(value -> value.startsWith("\u26A0\uFE0F Clarification needed"));
	}

	private boolean hasProblemStoryMisalignment(String problemTheme, String storyTheme) {
		return !isBlank(problemTheme) && !isBlank(storyTheme) && !problemTheme.equals(storyTheme);
	}

	private String buildProblemStoryMisalignmentGap(String problemTheme, String storyTheme) {
		return "\u26A0\uFE0F Clarification needed: the provided problem statement points to " + titleCase(problemTheme)
				+ " work, but the proposed story summary points to " + titleCase(storyTheme) + " work.";
	}

	private boolean dependenciesNeedAttention(RefinementStoryRequest request) {
		return isBlank(request.parentEpicLink()) || isBlankList(request.labels()) || isBlank(request.sprint()) || request.estimatePoints() == null;
	}

	private String validationLine(String label, boolean passed, String gapReason) {
		if (passed) {
			return "\u2705 " + label;
		}
		return "\u26A0\uFE0F DoR GAP: " + gapReason;
	}

	private String describeDependency(String label, String value) {
		if (isBlank(value)) {
			return label + " must be identified";
		}
		return label + ": " + normalizeWhitespace(value);
	}

	private List<String> normalizeList(List<String> values) {
		if (values == null) {
			return List.of();
		}
		return values.stream()
				.filter(value -> value != null && !value.isBlank())
				.map(this::normalizeWhitespace)
				.collect(Collectors.toList());
	}

	private String joinValues(List<String> values) {
		List<String> normalized = normalizeList(values);
		return normalized.isEmpty() ? null : String.join(", ", normalized);
	}

	private String joinThemes(Set<String> themes) {
		return themes.stream()
				.map(this::titleCase)
				.collect(Collectors.joining(", "));
	}

	private String normalizeWhitespace(String value) {
		if (value == null) {
			return "";
		}
		return value.trim().replaceAll("\\s+", " ");
	}

	private boolean containsAny(String text, String... keywords) {
		for (String keyword : keywords) {
			if (text.contains(keyword.toLowerCase(Locale.ROOT))) {
				return true;
			}
		}
		return false;
	}

	private boolean isBlank(String value) {
		return value == null || value.isBlank();
	}

	private boolean isBlankList(List<String> values) {
		return values == null || values.stream().noneMatch(value -> value != null && !value.isBlank());
	}

	private String titleCase(String value) {
		if (isBlank(value)) {
			return "";
		}
		String[] parts = normalizeWhitespace(value).split("\\s+");
		return java.util.Arrays.stream(parts)
				.filter(part -> !part.isBlank())
				.map(part -> Character.toUpperCase(part.charAt(0)) + part.substring(1).toLowerCase(Locale.ROOT))
				.collect(Collectors.joining(" "));
	}

	private String inferTheme(String text) {
		if (isBlank(text)) {
			return null;
		}
		String lower = text.toLowerCase(Locale.ROOT);
		if (containsAny(lower, "test case", "test cases", "qe", "quality engineering", "acceptance criteria", "coverage")) {
			return "qe";
		}
		if (containsAny(lower, "onboarding", "sharepoint", "confluence", "document", "new team member", "first week")) {
			return "onboarding";
		}
		if (containsAny(lower, "vision", "epic", "feature", "features", "story", "backlog", "review gate", "approval")) {
			return "planning";
		}
		if (containsAny(lower, "refinement", "refine", "facilitator", "sprint-ready", "user stories", "acceptance criteria")) {
			return "refinement";
		}
		return null;
	}
}
