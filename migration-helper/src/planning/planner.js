import {
  DEFAULT_CREATED_AT,
  DEFAULT_EPIC_REVIEWED_AT,
  DEFAULT_FEATURE_REVIEWED_AT,
  DEFAULT_OUTCOMES,
  DEFAULT_TARGET_USERS,
  ONBOARDING_STATUS,
  PLANNING_ONBOARDING_CHECKLIST_TEMPLATE,
  PLANNING_REVIEW_GATES,
  PLANNING_STAGES,
  REVIEW_STAGES,
  REVIEW_STATUS
} from "./constants.js";

export class PlanningError extends Error {
  constructor(message, code, details = {}) {
    super(message);
    this.name = "PlanningError";
    this.code = code;
    this.details = details;
  }
}

export function normalizeVisionIntake(input) {
  const source = input ?? {};
  const vision = requireText(source.vision, "Vision is required", "MISSING_VISION");
  const programLead = requireText(
    source.programLead,
    "Program lead is required",
    "MISSING_PROGRAM_LEAD"
  );
  const productName = deriveProductName(source.productName, vision);
  const targetUsers = normalizeText(source.targetUsers, DEFAULT_TARGET_USERS);
  const desiredOutcomes = normalizeOutcomeList(source.desiredOutcomes);

  return {
    vision,
    programLead,
    productName,
    targetUsers,
    desiredOutcomes
  };
}

export function createPlan(input, options = {}) {
  const intake = normalizeVisionIntake(input);
  const planId = options.id || buildPlanId(intake);
  const createdAt = normalizeTimestamp(options.createdAt, DEFAULT_CREATED_AT);
  const updatedAt = normalizeTimestamp(options.updatedAt, createdAt);

  const plan = {
    id: planId,
    productName: intake.productName,
    vision: intake.vision,
    programLead: intake.programLead,
    targetUsers: intake.targetUsers,
    desiredOutcomes: intake.desiredOutcomes,
    currentStage: PLANNING_STAGES.EPIC_REVIEW,
    createdAt,
    updatedAt,
    epics: generateEpics(intake, planId),
    features: [],
    stories: [],
    reviewCheckpoints: createReviewCheckpoints(),
    onboardingChecklist: createOnboardingChecklist()
  };

  return syncOnboardingChecklist(plan);
}

export function approveReview(plan, stageValue, review = {}, options = {}) {
  const source = requirePlan(plan);
  const stage = normalizeReviewStage(stageValue);
  const reviewer = requireText(review.reviewer, "Reviewer is required", "MISSING_REVIEWER");
  const notes = normalizeText(review.notes, defaultApprovalNotes(stage));
  const reviewedAt = normalizeTimestamp(
    review.reviewedAt || options.reviewedAt,
    stage === REVIEW_STAGES.EPICS ? DEFAULT_EPIC_REVIEWED_AT : DEFAULT_FEATURE_REVIEWED_AT
  );

  if (stage === REVIEW_STAGES.EPICS) {
    if (source.currentStage !== PLANNING_STAGES.EPIC_REVIEW) {
      throw new PlanningError(
        "Epic review is not the active stage for this plan.",
        "PLAN_STAGE_GATED",
        {
          expectedStage: PLANNING_STAGES.EPIC_REVIEW,
          actualStage: source.currentStage,
          reviewStage: stage
        }
      );
    }

    const nextPlan = clonePlan(source);
    setReviewCheckpoint(nextPlan, REVIEW_STAGES.EPICS, {
      status: REVIEW_STATUS.APPROVED,
      reviewer,
      notes,
      reviewedAt
    });
    setReviewCheckpoint(nextPlan, REVIEW_STAGES.FEATURES, {
      status: REVIEW_STATUS.PENDING,
      reviewer: null,
      notes: "Feature review opens after epic approval.",
      reviewedAt: null
    });
    nextPlan.features = generateFeatures(nextPlan);
    nextPlan.currentStage = PLANNING_STAGES.FEATURE_REVIEW;
    nextPlan.updatedAt = reviewedAt;
    return syncOnboardingChecklist(nextPlan);
  }

  if (source.currentStage !== PLANNING_STAGES.FEATURE_REVIEW) {
    throw new PlanningError(
      "Feature review is not the active stage for this plan.",
      "PLAN_STAGE_GATED",
      {
        expectedStage: PLANNING_STAGES.FEATURE_REVIEW,
        actualStage: source.currentStage,
        reviewStage: stage
      }
    );
  }

  const nextPlan = clonePlan(source);
  setReviewCheckpoint(nextPlan, REVIEW_STAGES.FEATURES, {
    status: REVIEW_STATUS.APPROVED,
    reviewer,
    notes,
    reviewedAt
  });
  nextPlan.stories = generateStories(nextPlan);
  nextPlan.currentStage = PLANNING_STAGES.STORY_READY;
  nextPlan.updatedAt = reviewedAt;
  return syncOnboardingChecklist(nextPlan);
}

export function canApproveReview(plan, stageValue) {
  const source = requirePlan(plan);
  const stage = normalizeReviewStage(stageValue);

  if (stage === REVIEW_STAGES.EPICS) {
    return source.currentStage === PLANNING_STAGES.EPIC_REVIEW;
  }
  return source.currentStage === PLANNING_STAGES.FEATURE_REVIEW;
}

export function getPlanSummary(plan) {
  const source = requirePlan(plan);
  const onboarding = getOnboardingProgress(source);
  const reviewSummary = source.reviewCheckpoints.reduce(
    (accumulator, checkpoint) => {
      accumulator.total += 1;
      accumulator[checkpoint.status.toLowerCase()] += 1;
      return accumulator;
    },
    {
      total: 0,
      pending: 0,
      blocked: 0,
      approved: 0
    }
  );

  return {
    id: source.id,
    productName: source.productName,
    currentStage: source.currentStage,
    nextStage: nextStageFor(source.currentStage),
    counts: {
      epics: source.epics.length,
      features: source.features.length,
      stories: source.stories.length,
      backlogItems: source.epics.length + source.features.length + source.stories.length
    },
    reviewSummary,
    onboarding,
    stageSummary: {
      currentStage: source.currentStage,
      nextStage: nextStageFor(source.currentStage),
      activeReviewStage: activeReviewStageFor(source.currentStage),
      canApproveEpicReview: canApproveReview(source, REVIEW_STAGES.EPICS),
      canApproveFeatureReview: canApproveReview(source, REVIEW_STAGES.FEATURES)
    }
  };
}

export function createPlanSummaryRecord(plan) {
  const source = requirePlan(plan);
  const stage = source.currentStage || source.stage || inferStageFromCheckpoints(source.reviewCheckpoints);
  const reviewCheckpoints = cloneReviewCheckpoints(source.reviewCheckpoints);
  const onboardingChecklist = cloneOnboardingTasks(source.onboardingChecklist);
  const counts = normalizeBacklogCounts(source);

  return {
    id: source.id,
    displayName: source.displayName || source.productName || source.name || source.id || "Untitled plan",
    productName: source.productName || source.displayName || source.name || source.id || "Untitled plan",
    programLead: source.programLead || source.lead || source.owner || "TBD",
    targetUsers: arrayify(source.targetUsers),
    vision: source.vision || "",
    desiredOutcomes: arrayify(source.desiredOutcomes),
    stage,
    currentStage: stage,
    counts,
    updatedAt: source.updatedAt,
    reviewCheckpoints,
    reviewSummary: summarizeReviewCheckpoints(reviewCheckpoints),
    onboarding: summarizeOnboardingChecklist(onboardingChecklist),
    nextStage: nextStageFor(stage),
    stageSummary: {
      currentStage: stage,
      nextStage: nextStageFor(stage),
      activeReviewStage: activeReviewStageFor(stage),
      canApproveEpicReview: stage === PLANNING_STAGES.EPIC_REVIEW,
      canApproveFeatureReview: stage === PLANNING_STAGES.FEATURE_REVIEW
    }
  };
}

export function createPlanDetailRecord(plan) {
  const source = requirePlan(plan);
  const summary = createPlanSummaryRecord(source);

  return {
    ...summary,
    counts: {
      epics: summary.counts.epics ?? arrayify(source.epics).length,
      features: summary.counts.features ?? arrayify(source.features).length,
      stories: summary.counts.stories ?? arrayify(source.stories).length
    },
    epics: cloneBacklogItems(source.epics),
    features: cloneBacklogItems(source.features),
    stories: cloneBacklogItems(source.stories),
    onboardingChecklist: cloneOnboardingTasks(source.onboardingChecklist)
  };
}

export function createPlanCollectionRecord(plans, selectedPlanId = null) {
  const items = arrayify(plans).map((plan) => createPlanSummaryRecord(plan));

  return {
    plans: items,
    selectedPlanId: selectedPlanId || items[0]?.id || null
  };
}

export function getOnboardingProgress(plan) {
  const source = requirePlan(plan);
  const total = source.onboardingChecklist.length;
  const completed = source.onboardingChecklist.filter(
    (task) => task.status === ONBOARDING_STATUS.COMPLETE
  ).length;
  const ready = source.onboardingChecklist.filter(
    (task) => task.status === ONBOARDING_STATUS.READY
  ).length;
  const upcoming = source.onboardingChecklist.filter(
    (task) => task.status === ONBOARDING_STATUS.UPCOMING
  ).length;
  const nextReadyTask =
    source.onboardingChecklist.find((task) => task.status === ONBOARDING_STATUS.READY) || null;
  const nextTask = source.onboardingChecklist.find((task) => task.status !== ONBOARDING_STATUS.COMPLETE) || null;

  return {
    total,
    completed,
    ready,
    upcoming,
    completionPercent: total === 0 ? 0 : Math.round((completed / total) * 100),
    nextReadyTask,
    nextTask
  };
}

export function completeOnboardingTask(plan, taskId, options = {}) {
  const source = requirePlan(plan);
  const identifier = requireText(taskId, "Task id is required", "MISSING_TASK_ID");
  const completedAt = normalizeTimestamp(options.completedAt, source.updatedAt || DEFAULT_CREATED_AT);

  const nextPlan = clonePlan(source);
  const target = nextPlan.onboardingChecklist.find((task) => task.id === identifier);
  if (!target) {
    throw new PlanningError("Unknown onboarding task.", "UNKNOWN_TASK", { taskId: identifier });
  }

  target.status = ONBOARDING_STATUS.COMPLETE;
  target.completedAt = completedAt;
  nextPlan.updatedAt = completedAt;
  return syncOnboardingChecklist(nextPlan);
}

export function generateEpics(intake, planId = "plan") {
  const source = normalizeVisionIntake(intake);

  return [
    createBacklogItem({
      id: `${planId}-E1`,
      kind: "EPIC",
      title: "Vision alignment and success framing",
      summary: `Translate the program lead vision into outcomes, assumptions, and measurable success signals for ${source.productName}.`,
      owner: source.programLead,
      status: "DRAFT",
      tags: ["vision", "requirements"],
      acceptanceCriteria: [
        "Document the core problem, target users, and value proposition",
        "Capture at least three measurable outcomes tied to the vision",
        "List open questions that require lead review"
      ]
    }),
    createBacklogItem({
      id: `${planId}-E2`,
      kind: "EPIC",
      title: "Refinement facilitation and story readiness",
      summary:
        `Define the facilitation flow that turns messy refinement notes into structured, sprint-ready stories with explicit review gates for ${source.targetUsers}.`,
      owner: "Delivery manager",
      status: "DRAFT",
      tags: ["agile", "refinement"],
      acceptanceCriteria: [
        "Map the end-to-end backlog flow from vision to sprint-ready stories",
        "Define how messy notes are transformed into structured user stories",
        "Identify the review checkpoints needed to keep refinement work moving"
      ]
    }),
    createBacklogItem({
      id: `${planId}-E3`,
      kind: "EPIC",
      title: "Quality and onboarding acceleration",
      summary:
        `Pair story generation with QE-ready test cases and a document-grounded onboarding guide so new contributors can execute confidently in ${source.productName}.`,
      owner: "Quality engineering lead",
      status: "DRAFT",
      tags: ["qe", "onboarding"],
      acceptanceCriteria: [
        "Generate test-ready coverage from approved acceptance criteria",
        "Describe the first-run onboarding journey for new contributors",
        "Connect onboarding materials back to desired outcomes"
      ]
    })
  ];
}

export function generateFeatures(plan) {
  const source = requirePlan(plan);

  return [
    createBacklogItem({
      id: `${source.id}-F1`,
      kind: "FEATURE",
      title: "Vision intake workspace",
      summary:
        "Capture vision, program lead context, desired outcomes, and user segments in a structured planning intake.",
      owner: "Product manager",
      status: "READY_FOR_REVIEW",
      tags: ["requirements", "intake"],
      acceptanceCriteria: [
        "Program lead can submit a concise vision statement",
        "Desired outcomes can be edited as separate items",
        "Target user context is visible in the generated plan"
      ]
    }),
    createBacklogItem({
      id: `${source.id}-F2`,
      kind: "FEATURE",
      title: "Refinement facilitator",
      summary:
        "Convert messy backlog refinement notes into structured, sprint-ready user stories with DoR validation.",
      owner: "Agile facilitator",
      status: "READY_FOR_REVIEW",
      tags: ["refinement", "stories"],
      acceptanceCriteria: [
        "Problem statements stay aligned with story summaries",
        "Acceptance criteria mix Gherkin and checklist items",
        "DoR gaps are called out without inventing requirements"
      ]
    }),
    createBacklogItem({
      id: `${source.id}-F3`,
      kind: "FEATURE",
      title: "Test case generator",
      summary:
        "Generate QE-ready positive, negative, and edge test cases directly from approved acceptance criteria.",
      owner: "QE lead",
      status: "READY_FOR_REVIEW",
      tags: ["qe", "testing"],
      acceptanceCriteria: [
        "Each acceptance criterion produces at least one positive, one negative, and one edge test",
        "Gherkin criteria map cleanly into preconditions, steps, and expected results",
        "Untestable criteria are flagged with rewrite guidance"
      ]
    }),
    createBacklogItem({
      id: `${source.id}-F4`,
      kind: "FEATURE",
      title: "Confluence-grounded onboarding agent",
      summary:
        "Ground onboarding answers in team documentation so new team members can find trusted setup and process guidance quickly.",
      owner: "Enablement lead",
      status: "READY_FOR_REVIEW",
      tags: ["onboarding", "knowledge"],
      acceptanceCriteria: [
        "Answers cite the source document name for each onboarding topic",
        "Missing documentation is called out instead of invented",
        "Guidance adapts to the user role and onboarding stage"
      ]
    })
  ];
}

export function generateStories(plan) {
  const source = requirePlan(plan);

  return [
    createBacklogItem({
      id: `${source.id}-S1`,
      kind: "STORY",
      title:
        "As a program lead, I can submit a vision and desired outcomes so the system can draft epics for review.",
      summary: "Supports the initial planning intake and requirements framing.",
      owner: source.programLead,
      status: "READY",
      tags: ["story", "vision"],
      acceptanceCriteria: [
        "Vision capture validates required fields",
        "Desired outcomes persist as separate list items",
        "Generated epics appear immediately after submission"
      ]
    }),
    createBacklogItem({
      id: `${source.id}-S2`,
      kind: "STORY",
      title:
        "As an agile facilitator, I can convert refinement notes into sprint-ready stories so the team starts implementation with aligned scope and testable criteria.",
      summary: "Captures the refinement facilitation capability requested by the team.",
      owner: "Agile facilitator",
      status: "READY",
      tags: ["story", "refinement"],
      acceptanceCriteria: [
        "Story output includes problem statement, story summary, dependencies, references, and estimation",
        "Misalignment between notes and proposed work is explicitly flagged",
        "DoR gaps are surfaced when inputs are incomplete"
      ]
    }),
    createBacklogItem({
      id: `${source.id}-S3`,
      kind: "STORY",
      title:
        "As a QE engineer, I can generate comprehensive test cases from acceptance criteria so the team can execute coverage quickly after refinement.",
      summary: "Captures the requested test case generator capability.",
      owner: "QE engineer",
      status: "READY",
      tags: ["story", "qe"],
      acceptanceCriteria: [
        "Test cases are numbered sequentially across the generated output",
        "Positive, negative, and edge scenarios are all represented",
        "Untestable acceptance criteria are called out with suggestions"
      ]
    }),
    createBacklogItem({
      id: `${source.id}-S4`,
      kind: "STORY",
      title:
        "As a new team member, I can ask onboarding questions against team documentation so I can get oriented without relying on tribal knowledge.",
      summary: "Captures the grounded onboarding agent capability.",
      owner: "New team member",
      status: "READY",
      tags: ["story", "onboarding"],
      acceptanceCriteria: [
        "Answers cite the documentation source when information is found",
        "Missing answers recommend a likely person or channel instead of guessing",
        "Potentially outdated documentation is flagged for verification"
      ]
    })
  ];
}

export function createReviewCheckpoints() {
  return PLANNING_REVIEW_GATES.map((gate, index) =>
    createReviewCheckpoint({
      stage: gate.stage,
      label: gate.label,
      status: index === 0 ? REVIEW_STATUS.PENDING : REVIEW_STATUS.BLOCKED,
      reviewer: null,
      notes:
        index === 0
          ? "Review the epics before feature decomposition begins."
          : "Feature review opens after epic approval.",
      reviewedAt: null
    })
  );
}

export function createOnboardingChecklist() {
  return PLANNING_ONBOARDING_CHECKLIST_TEMPLATE.map((task) =>
    createOnboardingTask({
      id: task.id,
      title: task.title,
      detail: task.detail,
      owner: task.owner,
      unlockStage: task.unlockStage,
      status: stageRank(PLANNING_STAGES.EPIC_REVIEW) >= stageRank(task.unlockStage)
        ? ONBOARDING_STATUS.READY
        : ONBOARDING_STATUS.UPCOMING,
      completedAt: null
    })
  );
}

export function syncOnboardingChecklist(plan) {
  const source = requirePlan(plan);
  const nextPlan = clonePlan(source);

  nextPlan.onboardingChecklist = nextPlan.onboardingChecklist.map((task) => {
    if (task.status === ONBOARDING_STATUS.COMPLETE) {
      return { ...task };
    }

    return {
      ...task,
      status:
        stageRank(nextPlan.currentStage) >= stageRank(task.unlockStage)
          ? ONBOARDING_STATUS.READY
          : ONBOARDING_STATUS.UPCOMING
    };
  });

  return nextPlan;
}

export function normalizeReviewStage(value) {
  const text = String(value || "").trim().toLowerCase();
  if (text === "epics" || text === "epic") {
    return REVIEW_STAGES.EPICS;
  }
  if (text === "features" || text === "feature") {
    return REVIEW_STAGES.FEATURES;
  }
  throw new PlanningError("Unknown review stage.", "UNKNOWN_REVIEW_STAGE", { value });
}

function requirePlan(plan) {
  if (!plan || typeof plan !== "object") {
    throw new PlanningError("Plan is required.", "MISSING_PLAN");
  }
  return plan;
}

function requireText(value, message, code) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new PlanningError(message, code);
  }
  return value.trim();
}

function normalizeText(value, fallback) {
  if (typeof value !== "string") {
    return fallback;
  }
  const trimmed = value.trim();
  return trimmed.length === 0 ? fallback : trimmed;
}

function normalizeOutcomeList(value) {
  const source = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/[\n,]/g)
      : [];

  const cleaned = source
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean)
    .slice(0, 5);

  return cleaned.length > 0 ? cleaned : DEFAULT_OUTCOMES.slice();
}

function deriveProductName(productName, vision) {
  const explicit = normalizeText(productName, "");
  if (explicit) {
    return explicit;
  }

  const words = vision
    .replace(/[^A-Za-z0-9\s-]/g, " ")
    .split(/\s+/)
    .map((word) => word.trim())
    .filter(Boolean)
    .filter((word) => !["a", "an", "the", "to", "for", "of", "and"].includes(word.toLowerCase()))
    .slice(0, 2);

  const base = words.length > 0 ? words.map(titleCase).join(" ") : "Planning";
  return `${base} Planning`;
}

function titleCase(value) {
  return value
    .split(/(-|\s+)/)
    .map((part) => (/-|\s+/.test(part) ? part : part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()))
    .join("");
}

function buildPlanId(intake) {
  return `plan-${stableHash([intake.productName, intake.vision, intake.programLead].join("|"))}`;
}

function stableHash(value) {
  let hash = 2166136261;
  const text = String(value ?? "");
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36).padStart(8, "0").slice(0, 8);
}

function normalizeTimestamp(value, fallback) {
  if (typeof value !== "string" || value.trim().length === 0) {
    return fallback;
  }
  return value.trim();
}

function nextStageFor(stage) {
  if (stage === PLANNING_STAGES.EPIC_REVIEW) {
    return PLANNING_STAGES.FEATURE_REVIEW;
  }
  if (stage === PLANNING_STAGES.FEATURE_REVIEW) {
    return PLANNING_STAGES.STORY_READY;
  }
  return null;
}

function activeReviewStageFor(stage) {
  if (stage === PLANNING_STAGES.EPIC_REVIEW) {
    return REVIEW_STAGES.EPICS;
  }
  if (stage === PLANNING_STAGES.FEATURE_REVIEW) {
    return REVIEW_STAGES.FEATURES;
  }
  return null;
}

function stageRank(stage) {
  if (stage === PLANNING_STAGES.EPIC_REVIEW) {
    return 0;
  }
  if (stage === PLANNING_STAGES.FEATURE_REVIEW) {
    return 1;
  }
  if (stage === PLANNING_STAGES.STORY_READY) {
    return 2;
  }
  return -1;
}

function createBacklogItem(item) {
  return {
    id: item.id,
    kind: item.kind,
    title: item.title,
    summary: item.summary,
    owner: item.owner,
    status: item.status,
    tags: arrayify(item.tags),
    acceptanceCriteria: arrayify(item.acceptanceCriteria)
  };
}

function cloneBacklogItems(items) {
  return arrayify(items).map((item) => createBacklogItem(item));
}

function normalizeBacklogCounts(source) {
  const counts = source.counts || source.backlogCounts || {};
  return {
    epics: counts.epics ?? arrayify(source.epics).length,
    features: counts.features ?? arrayify(source.features).length,
    stories: counts.stories ?? arrayify(source.stories).length
  };
}

function summarizeReviewCheckpoints(checkpoints) {
  return arrayify(checkpoints).reduce(
    (accumulator, checkpoint) => {
      const status = String(checkpoint.status || checkpoint.state || "pending").toLowerCase();
      accumulator.total += 1;
      if (status.includes("approved") || status === "approved") {
        accumulator.approved += 1;
      } else if (status.includes("block") || status === "blocked") {
        accumulator.blocked += 1;
      } else {
        accumulator.pending += 1;
      }
      return accumulator;
    },
    { total: 0, pending: 0, blocked: 0, approved: 0 }
  );
}

function createReviewCheckpoint(checkpoint) {
  return {
    stage: checkpoint.stage,
    label: checkpoint.label,
    status: checkpoint.status,
    reviewer: checkpoint.reviewer,
    notes: checkpoint.notes,
    reviewedAt: checkpoint.reviewedAt
  };
}

function cloneReviewCheckpoints(checkpoints) {
  return arrayify(checkpoints).map((checkpoint) => createReviewCheckpoint(checkpoint));
}

function createOnboardingTask(task) {
  return {
    id: task.id,
    title: task.title,
    detail: task.detail,
    owner: task.owner,
    unlockStage: task.unlockStage,
    status: task.status,
    completedAt: task.completedAt
  };
}

function cloneOnboardingTasks(tasks) {
  return arrayify(tasks).map((task) => createOnboardingTask(task));
}

function summarizeOnboardingChecklist(tasks) {
  const items = arrayify(tasks);
  const completed = items.filter((task) => String(task.status || "").toUpperCase() === ONBOARDING_STATUS.COMPLETE).length;
  const ready = items.filter((task) => String(task.status || "").toUpperCase() === ONBOARDING_STATUS.READY).length;
  const upcoming = items.filter((task) => String(task.status || "").toUpperCase() === ONBOARDING_STATUS.UPCOMING).length;

  return {
    total: items.length,
    completed,
    ready,
    upcoming,
    completionPercent: items.length === 0 ? 0 : Math.round((completed / items.length) * 100),
    nextReadyTask: items.find((task) => String(task.status || "").toUpperCase() === ONBOARDING_STATUS.READY) || null,
    nextTask: items.find((task) => String(task.status || "").toUpperCase() !== ONBOARDING_STATUS.COMPLETE) || null
  };
}

function inferStageFromCheckpoints(checkpoints) {
  const statuses = arrayify(checkpoints);
  const epicStatus = statuses.find((item) => normalizeReviewStage(item.stage) === REVIEW_STAGES.EPICS)?.status;
  const featureStatus = statuses.find((item) => normalizeReviewStage(item.stage) === REVIEW_STAGES.FEATURES)?.status;
  if (String(featureStatus || "").toLowerCase().includes("approved")) {
    return PLANNING_STAGES.STORY_READY;
  }
  if (String(epicStatus || "").toLowerCase().includes("approved")) {
    return PLANNING_STAGES.FEATURE_REVIEW;
  }
  return PLANNING_STAGES.EPIC_REVIEW;
}

function setReviewCheckpoint(plan, stage, updates) {
  const checkpoint = plan.reviewCheckpoints.find((entry) => entry.stage === stage);
  if (!checkpoint) {
    throw new PlanningError("Review checkpoint is missing.", "MISSING_CHECKPOINT", {
      reviewStage: stage
    });
  }

  Object.assign(checkpoint, updates);
}

function clonePlan(plan) {
  return {
    ...plan,
    desiredOutcomes: arrayify(plan.desiredOutcomes),
    epics: arrayify(plan.epics).map((item) => createBacklogItem(item)),
    features: arrayify(plan.features).map((item) => createBacklogItem(item)),
    stories: arrayify(plan.stories).map((item) => createBacklogItem(item)),
    reviewCheckpoints: arrayify(plan.reviewCheckpoints).map((checkpoint) => createReviewCheckpoint(checkpoint)),
    onboardingChecklist: arrayify(plan.onboardingChecklist).map((task) => createOnboardingTask(task))
  };
}

function arrayify(value) {
  if (Array.isArray(value)) {
    return value;
  }
  if (value === null || value === undefined) {
    return [];
  }
  return [value];
}

function defaultApprovalNotes(stage) {
  return stage === REVIEW_STAGES.EPICS
    ? "Epics approved for feature breakdown."
    : "Features approved for story creation.";
}
