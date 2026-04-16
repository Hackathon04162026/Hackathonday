package com.hackathonday.migrationhelper.planning;

import com.hackathonday.migrationhelper.api.PlanNotFoundException;
import com.hackathonday.migrationhelper.api.PlanReviewConflictException;
import com.hackathonday.migrationhelper.api.contract.ApproveReviewRequest;
import com.hackathonday.migrationhelper.api.contract.BacklogItemResponse;
import com.hackathonday.migrationhelper.api.contract.CreatePlanRequest;
import com.hackathonday.migrationhelper.api.contract.OnboardingTaskResponse;
import com.hackathonday.migrationhelper.api.contract.PlanDetailResponse;
import com.hackathonday.migrationhelper.api.contract.PlanSummaryResponse;
import com.hackathonday.migrationhelper.api.contract.ReviewCheckpointResponse;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Service;

@Service
public class PlanService {

	private final ConcurrentHashMap<String, PlanRecord> plans = new ConcurrentHashMap<>();

	public PlanDetailResponse createPlan(CreatePlanRequest request) {
		if (request == null) {
			throw new IllegalArgumentException("Create plan request is required");
		}

		Instant now = Instant.now();
		String id = "plan-" + UUID.randomUUID().toString().substring(0, 8);
		String vision = requireText(request.vision(), "Vision is required");
		String programLead = requireText(request.programLead(), "Program lead is required");
		String productName = defaultProductName(request.productName(), vision);
		List<String> outcomes = sanitizeOutcomes(request.desiredOutcomes());
		String targetUsers = blankToDefault(request.targetUsers(), "Delivery managers, architects, and implementation teams");

		PlanRecord plan = new PlanRecord(
				id,
				productName,
				vision,
				programLead,
				now,
				outcomes,
				targetUsers
		);

		plan.epics().addAll(generateEpics(plan));
		plan.reviewCheckpoints().add(new ReviewCheckpoint(
				ReviewStage.EPICS,
				ReviewStatus.PENDING,
				null,
				"Review the epics before feature decomposition begins.",
				null
		));
		plan.reviewCheckpoints().add(new ReviewCheckpoint(
				ReviewStage.FEATURES,
				ReviewStatus.BLOCKED,
				null,
				"Feature review opens after epic approval.",
				null
		));
		plan.onboardingTasks().addAll(generateOnboardingTasks(plan));
		syncOnboardingProgress(plan);
		plans.put(id, plan);
		return toDetail(plan);
	}

	public List<PlanSummaryResponse> listPlans() {
		return plans.values().stream()
				.sorted(Comparator.comparing(PlanRecord::createdAt, Comparator.reverseOrder())
						.thenComparing(PlanRecord::id))
				.map(this::toSummary)
				.toList();
	}

	public PlanDetailResponse getPlan(String id) {
		return toDetail(getRequired(id));
	}

	public PlanDetailResponse approveReview(String id, String stageValue, ApproveReviewRequest request) {
		if (request == null) {
			throw new IllegalArgumentException("Approval request is required");
		}

		PlanRecord plan = getRequired(id);
		ReviewStage stage = ReviewStage.from(stageValue);
		String reviewer = requireText(request.reviewer(), "Reviewer is required");

		if (stage == ReviewStage.EPICS) {
			approveEpics(plan, reviewer, request);
			return toDetail(plan);
		}

		approveFeatures(plan, reviewer, request);
		return toDetail(plan);
	}

	private void approveEpics(PlanRecord plan, String reviewer, ApproveReviewRequest request) {
		if (plan.currentStage() != PlanStage.EPIC_REVIEW) {
			throw new PlanReviewConflictException("Epic review is not the active stage for " + plan.id());
		}

		ReviewCheckpoint epicReview = checkpointFor(plan, ReviewStage.EPICS);
		epicReview.approve(reviewer, normalizedNotes(request.notes(), "Epics approved for feature breakdown."));
		plan.features().clear();
		plan.features().addAll(generateFeatures(plan));

		ReviewCheckpoint featureReview = checkpointFor(plan, ReviewStage.FEATURES);
		featureReview.open("Review the drafted features before story breakdown begins.");
		plan.setCurrentStage(PlanStage.FEATURE_REVIEW);
		syncOnboardingProgress(plan);
	}

	private void approveFeatures(PlanRecord plan, String reviewer, ApproveReviewRequest request) {
		if (plan.currentStage() != PlanStage.FEATURE_REVIEW) {
			throw new PlanReviewConflictException("Feature review is not the active stage for " + plan.id());
		}

		ReviewCheckpoint featureReview = checkpointFor(plan, ReviewStage.FEATURES);
		featureReview.approve(reviewer, normalizedNotes(request.notes(), "Features approved for story creation."));
		plan.stories().clear();
		plan.stories().addAll(generateStories(plan));
		plan.setCurrentStage(PlanStage.STORY_READY);
		syncOnboardingProgress(plan);
	}

	private ReviewCheckpoint checkpointFor(PlanRecord plan, ReviewStage stage) {
		return plan.reviewCheckpoints().stream()
				.filter(checkpoint -> checkpoint.stage() == stage)
				.findFirst()
				.orElseThrow(() -> new PlanReviewConflictException("Review stage " + stage.name() + " is not configured for " + plan.id()));
	}

	private List<BacklogItem> generateEpics(PlanRecord plan) {
		String productName = plan.productName();
		String targetUsers = plan.targetUsers();
		List<String> outcomes = plan.desiredOutcomes();

		List<BacklogItem> epics = new ArrayList<>();
		epics.add(new BacklogItem(
				epicId(plan, 1),
				"Vision alignment and success framing",
				"Translate the program lead vision into outcomes, assumptions, and measurable success signals for " + productName + ".",
				plan.programLead(),
				"DRAFT",
				List.of("vision", "requirements"),
				criteria(
						"Document the core problem, target users, and value proposition",
						"Capture at least three measurable outcomes tied to the vision",
						"List open questions that require lead review"
				)
		));
		epics.add(new BacklogItem(
				epicId(plan, 2),
				"Refinement facilitation and story readiness",
				"Define the facilitation flow that turns messy refinement notes into sprint-ready stories with explicit review gates for " + targetUsers + ".",
				"Delivery manager",
				"DRAFT",
				List.of("agile", "refinement"),
				criteria(
						"Map the end-to-end backlog flow from vision to sprint-ready stories",
						"Define how messy notes are transformed into structured user stories",
						"Identify the review checkpoints needed to keep refinement work moving"
				)
		));
		epics.add(new BacklogItem(
				epicId(plan, 3),
				"Quality and onboarding acceleration",
				"Pair story generation with QE-ready test cases and a document-grounded onboarding guide so new contributors can execute confidently in " + productName + ".",
				"Quality engineering lead",
				"DRAFT",
				List.of("qe", "onboarding"),
				criteria(
						"Generate test-ready coverage from approved acceptance criteria",
						"Describe the first-run onboarding journey for new contributors",
						"Connect onboarding materials back to desired outcomes: " + String.join(", ", outcomes)
				)
		));
		return epics;
	}

	private List<BacklogItem> generateFeatures(PlanRecord plan) {
		List<BacklogItem> features = new ArrayList<>();
		features.add(new BacklogItem(
				featureId(plan, 1),
				"Vision intake workspace",
				"Capture vision, program lead context, desired outcomes, and user segments in a structured planning intake.",
				"Product manager",
				"READY_FOR_REVIEW",
				List.of("requirements", "intake"),
				criteria(
						"Program lead can submit a concise vision statement",
						"Desired outcomes can be edited as separate items",
						"Target user context is visible in the generated plan"
				)
		));
		features.add(new BacklogItem(
				featureId(plan, 2),
				"Refinement facilitator",
				"Convert messy backlog refinement notes into structured, sprint-ready user stories with DoR validation.",
				"Agile facilitator",
				"READY_FOR_REVIEW",
				List.of("refinement", "stories"),
				criteria(
						"Problem statements stay aligned with story summaries",
						"Acceptance criteria mix Gherkin and checklist items",
						"DoR gaps are called out without inventing requirements"
				)
		));
		features.add(new BacklogItem(
				featureId(plan, 3),
				"Test case generator",
				"Generate QE-ready positive, negative, and edge test cases directly from approved acceptance criteria.",
				"QE lead",
				"READY_FOR_REVIEW",
				List.of("qe", "testing"),
				criteria(
						"Each acceptance criterion produces at least one positive, one negative, and one edge test",
						"Gherkin criteria map cleanly into preconditions, steps, and expected results",
						"Untestable criteria are flagged with rewrite guidance"
				)
		));
		features.add(new BacklogItem(
				featureId(plan, 4),
				"SharePoint-grounded onboarding agent",
				"Ground onboarding answers in team documentation so new team members can find trusted setup and process guidance quickly.",
				"Enablement lead",
				"READY_FOR_REVIEW",
				List.of("onboarding", "knowledge"),
				criteria(
						"Answers cite the source document name for each onboarding topic",
						"Missing documentation is called out instead of invented",
						"Guidance adapts to the user role and onboarding stage"
				)
		));
		return features;
	}

	private List<BacklogItem> generateStories(PlanRecord plan) {
		List<BacklogItem> stories = new ArrayList<>();
		stories.add(new BacklogItem(
				storyId(plan, 1),
				"As a program lead, I can submit a vision and desired outcomes so the system can draft epics for review.",
				"Supports the initial planning intake and requirements framing.",
				plan.programLead(),
				"READY",
				List.of("story", "vision"),
				criteria(
						"Vision capture validates required fields",
						"Desired outcomes persist as separate list items",
						"Generated epics appear immediately after submission"
				)
		));
		stories.add(new BacklogItem(
				storyId(plan, 2),
				"As an agile facilitator, I can convert refinement notes into sprint-ready stories so the team starts implementation with aligned scope and testable criteria.",
				"Captures the refinement facilitation capability requested by the team.",
				"Agile facilitator",
				"READY",
				List.of("story", "refinement"),
				criteria(
						"Story output includes problem statement, story summary, dependencies, references, and estimation",
						"Misalignment between notes and proposed work is explicitly flagged",
						"DoR gaps are surfaced when inputs are incomplete"
				)
		));
		stories.add(new BacklogItem(
				storyId(plan, 3),
				"As a QE engineer, I can generate comprehensive test cases from acceptance criteria so the team can execute coverage quickly after refinement.",
				"Captures the requested test case generator capability.",
				"QE engineer",
				"READY",
				List.of("story", "qe"),
				criteria(
						"Test cases are numbered sequentially across the generated output",
						"Positive, negative, and edge scenarios are all represented",
						"Untestable acceptance criteria are called out with suggestions"
				)
		));
		stories.add(new BacklogItem(
				storyId(plan, 4),
				"As a new team member, I can ask onboarding questions against team documentation so I can get oriented without relying on tribal knowledge.",
				"Captures the requested grounded onboarding agent capability.",
				"New team member",
				"READY",
				List.of("story", "onboarding"),
				criteria(
						"Answers cite the documentation source when information is found",
						"Missing answers recommend a likely person or channel instead of guessing",
						"Potentially outdated documentation is flagged for verification"
				)
		));
		return stories;
	}

	private List<OnboardingTask> generateOnboardingTasks(PlanRecord plan) {
		return List.of(
				new OnboardingTask(
						"Read the product vision",
						"Review the program lead vision and desired outcomes before joining backlog conversations.",
						"New team member",
						"READY"
				),
				new OnboardingTask(
						"Understand the review gates",
						"Learn how epic review and feature review approvals control downstream backlog generation.",
						"Agile facilitator",
						"READY"
				),
				new OnboardingTask(
						"Join the first delivery ceremony",
						"Use the approved stories as the starting point for sprint planning or implementation kickoff.",
						"Engineering lead",
						plan.currentStage() == PlanStage.STORY_READY ? "READY" : "UPCOMING"
				)
		);
	}

	private PlanRecord getRequired(String id) {
		PlanRecord plan = plans.get(id);
		if (plan == null) {
			throw new PlanNotFoundException(id);
		}
		return plan;
	}

	private PlanSummaryResponse toSummary(PlanRecord plan) {
		return new PlanSummaryResponse(
				plan.id(),
				plan.productName(),
				plan.programLead(),
				plan.currentStage().name(),
				plan.epics().size(),
				plan.features().size(),
				plan.stories().size(),
				plan.createdAt(),
				plan.updatedAt()
		);
	}

	private PlanDetailResponse toDetail(PlanRecord plan) {
		return new PlanDetailResponse(
				plan.id(),
				plan.productName(),
				plan.vision(),
				plan.programLead(),
				plan.currentStage().name(),
				plan.createdAt(),
				plan.updatedAt(),
				plan.desiredOutcomes(),
				plan.targetUsers(),
				plan.epics().stream().map(this::toBacklogResponse).toList(),
				plan.features().stream().map(this::toBacklogResponse).toList(),
				plan.stories().stream().map(this::toBacklogResponse).toList(),
				plan.reviewCheckpoints().stream().map(this::toReviewResponse).toList(),
				plan.onboardingTasks().stream().map(this::toOnboardingResponse).toList()
		);
	}

	private void syncOnboardingProgress(PlanRecord plan) {
		if (plan.onboardingTasks().isEmpty()) {
			return;
		}
		OnboardingTask kickoffTask = plan.onboardingTasks().get(plan.onboardingTasks().size() - 1);
		kickoffTask.setStatus(plan.currentStage() == PlanStage.STORY_READY ? "READY" : "UPCOMING");
	}

	private BacklogItemResponse toBacklogResponse(BacklogItem item) {
		return new BacklogItemResponse(
				item.id(),
				item.title(),
				item.summary(),
				item.owner(),
				item.status(),
				List.copyOf(item.tags()),
				List.copyOf(item.acceptanceCriteria())
		);
	}

	private ReviewCheckpointResponse toReviewResponse(ReviewCheckpoint checkpoint) {
		return new ReviewCheckpointResponse(
				checkpoint.stage().name(),
				checkpoint.status().name(),
				checkpoint.reviewer(),
				checkpoint.notes(),
				checkpoint.reviewedAt()
		);
	}

	private OnboardingTaskResponse toOnboardingResponse(OnboardingTask task) {
		return new OnboardingTaskResponse(task.title(), task.detail(), task.owner(), task.status());
	}

	private String blankToDefault(String value, String fallback) {
		if (value == null || value.isBlank()) {
			return fallback;
		}
		return value.trim();
	}

	private String defaultProductName(String productName, String vision) {
		if (productName != null && !productName.isBlank()) {
			return productName.trim();
		}
		String normalized = vision.trim().split("\\s+")[0];
		return Character.toUpperCase(normalized.charAt(0)) + normalized.substring(1) + " Planning";
	}

	private List<String> sanitizeOutcomes(List<String> desiredOutcomes) {
		if (desiredOutcomes == null || desiredOutcomes.isEmpty()) {
			return defaultOutcomes();
		}

		List<String> cleaned = new ArrayList<>();
		for (String value : desiredOutcomes) {
			if (value != null && !value.isBlank()) {
				cleaned.add(value.trim());
			}
			if (cleaned.size() == 5) {
				break;
			}
		}

		return cleaned.isEmpty() ? defaultOutcomes() : List.copyOf(cleaned);
	}

	private String normalizedNotes(String notes, String fallback) {
		if (notes == null || notes.isBlank()) {
			return fallback;
		}
		return notes.trim();
	}

	private String requireText(String value, String message) {
		if (value == null || value.isBlank()) {
			throw new IllegalArgumentException(message);
		}
		return value.trim();
	}

	private List<String> defaultOutcomes() {
		return List.of(
				"Reduce ambiguity between intake and delivery",
				"Introduce approval checkpoints before decomposition",
				"Help new contributors ramp into the backlog quickly"
		);
	}

	private List<String> criteria(String... values) {
		return List.of(values);
	}

	private String epicId(PlanRecord plan, int index) {
		return plan.id() + "-E" + index;
	}

	private String featureId(PlanRecord plan, int index) {
		return plan.id() + "-F" + index;
	}

	private String storyId(PlanRecord plan, int index) {
		return plan.id() + "-S" + index;
	}
}
