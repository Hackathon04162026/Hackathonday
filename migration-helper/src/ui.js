import {
  PLANNING_SEED_VISION,
  createPlan,
  getOnboardingProgress,
  getPlanSummary
} from "./planning/index.js";
import {
  buildRefinementSampleRequest,
  createRefinementStoryPackage,
  buildTestCaseGenerationRequest,
  generateTestCases
} from "./refinement/index.js";
import { answerOnboardingQuery, createOnboardingAgent } from "./onboarding/onboardingAgent.js";

export const DEFAULT_SCAN_FILTERS = {
  search: "",
  status: "",
  source: "",
  requestedBy: "",
  sort: "newest"
};

export const DEFAULT_REPORT_FILTERS = {
  search: "",
  type: "all"
};

export async function fetchJson(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`Request failed for ${url}: ${response.status}`);
  }
  return response.json();
}

export function createMockArchiveScan(payload) {
  const now = new Date().toISOString();
  return {
    id: `scan-archive-${cryptoRandomId()}`,
    status: "COMPLETED",
    sourceType: "ARCHIVE_UPLOAD",
    displayName: payload.displayName || payload.sourceFilename || "Uploaded archive",
    requestedBy: payload.requestedBy || "ui",
    sourceReference: payload.sourceFilename || "upload.zip",
    createdAt: now,
    startedAt: now,
    completedAt: now,
    updatedAt: now,
    lifecycle: ["QUEUED", "INGESTING", "ANALYZING", "AGGREGATING", "COMPLETED"],
    warnings: [
      {
        code: "ARCHIVE_METADATA_CAPTURED",
        severity: "INFO",
        message: `Archive metadata captured for ${payload.sourceFilename || "upload.zip"}.`
      }
    ]
  };
}

export function createMockPathScan(payload) {
  const now = new Date().toISOString();
  return {
    id: `scan-path-${cryptoRandomId()}`,
    status: "COMPLETED",
    sourceType: "LOCAL_PATH",
    displayName: payload.displayName || payload.path || "Local path scan",
    requestedBy: payload.requestedBy || "cli",
    sourceReference: payload.path || "C:/repos/demo",
    createdAt: now,
    startedAt: now,
    completedAt: now,
    updatedAt: now,
    lifecycle: ["QUEUED", "ANALYZING", "AGGREGATING", "COMPLETED"],
    warnings: [
      {
        code: "PATH_SCAN_PENDING_NORMALIZATION",
        severity: "INFO",
        message: "Local path scan accepted. Workspace normalization will be supplied by Worker 2."
      }
    ]
  };
}

export function createDetailFromSummary(scan) {
  const status = scan?.status || "QUEUED";
  const sourceType = scan?.sourceType || "";
  const normalizedStatus = normalizeStatus(status);
  const sourceReference =
    scan?.sourceReference
    || (sourceType === "ARCHIVE_UPLOAD"
      ? `archive://${scan?.id || "pending-upload"}`
      : scan?.displayName
        || scan?.id
        || "workspace");

  return {
    id: scan.id,
    status,
    sourceType,
    displayName: scan.displayName,
    requestedBy: scan.requestedBy,
    sourceReference,
    createdAt: scan.createdAt,
    startedAt: scan.startedAt || scan.createdAt,
    completedAt:
      normalizedStatus === "complete"
        ? scan.completedAt || scan.updatedAt || scan.createdAt
        : scan.completedAt || null,
    updatedAt: scan.updatedAt,
    lifecycle: Array.isArray(scan?.lifecycle) && scan.lifecycle.length > 0
      ? [...scan.lifecycle]
      : createLifecycleFromStatus(status, sourceType),
    warnings: scan.warnings || []
  };
}

export function createMockReportFromDetail(detail) {
  const normalizedStatus = normalizeStatus(detail?.status);
  const normalizedWorkspacePath =
    detail?.sourceType === "LOCAL_PATH"
      ? detail?.sourceReference || detail?.displayName || "workspace"
      : normalizedStatus === "complete"
        ? detail?.sourceReference || `archive://${detail?.id || "artifact"}`
        : "Awaiting archive extraction";

  return {
    id: detail.id,
    applicationName: "Migration Helper",
    status: detail.status,
    generatedAt: detail.updatedAt || detail.completedAt || detail.createdAt,
    metadata: {
      sourceType: detail.sourceType,
      sourceReference: detail.sourceReference,
      requestedBy: detail.requestedBy,
      createdAt: detail.createdAt,
      startedAt: detail.startedAt,
      completedAt: detail.completedAt
    },
    workspace: {
      normalizedWorkspacePath,
      normalizationStatus: describeNormalizationStatus(normalizedStatus)
    },
    warnings: detail.warnings || [],
    detectors: [],
    policyStatuses: [],
    recommendations: []
  };
}

export function createWorkspaceHubFallback() {
  return normalizeWorkspaceHub({
    planning: {
      vision: {
        programLead: "Program lead",
        statement: "Break the program lead vision into reviewed epics, features, and sprint-ready stories."
      },
      reviewStages: [
        { stage: "Vision intake", status: "Captured", owner: "Program lead", decision: "Ready for epic shaping" },
        { stage: "Epic review", status: "Approved", owner: "Product owner", decision: "Approved for feature creation" },
        { stage: "Feature review", status: "Approved", owner: "Delivery lead", decision: "Approved for story creation" },
        { stage: "Story readiness", status: "Ready", owner: "Agile team", decision: "Ready for sprint commitment" }
      ],
      epics: [
        { id: "EPIC-001", title: "Planning workflow", status: "Approved", summary: "Capture the vision and move it through review gates.", featureCount: 2, storyCount: 3 },
        { id: "EPIC-002", title: "Onboarding experience", status: "Approved", summary: "Surface the Confluence-grounded onboarding agent in the workspace.", featureCount: 1, storyCount: 2 }
      ],
      features: [
        { id: "FEAT-101", epicId: "EPIC-001", title: "Review gate orchestration", status: "Approved", summary: "Review epics before features and features before stories." },
        { id: "FEAT-102", epicId: "EPIC-001", title: "Story readiness checks", status: "Approved", summary: "Hold stories until the Definition of Ready is satisfied." },
        { id: "FEAT-201", epicId: "EPIC-002", title: "Confluence-grounded onboarding", status: "Approved", summary: "Answer new team member questions from the document library." }
      ],
      stories: [
        { id: "STORY-201", featureId: "FEAT-101", title: "Review epics before feature creation", status: "Ready for sprint", points: 3 },
        { id: "STORY-202", featureId: "FEAT-102", title: "Validate story readiness inputs", status: "Ready for sprint", points: 2 },
        { id: "STORY-203", featureId: "FEAT-201", title: "Guide first-week onboarding", status: "Ready for sprint", points: 3 }
      ]
    },
    refinement: {
      source: "Backlog refinement session",
      problemStatement: "The team is working from messy notes, so the backlog is hard to read, hard to size, and difficult to commit to in sprint planning.",
      storySummary: "As a refinement facilitator, I want to convert messy notes into a structured, sprint-ready story so that the team can review the work quickly and commit with confidence.",
      acceptanceCriteria: [
        "Given refinement notes, when the facilitator normalizes the content, then the output keeps the exact problem statement, story summary, acceptance criteria, dependencies, references, estimation, DoR validation, gaps, and normalization notes order.",
        "Should flag any misalignment between the problem statement and the proposed story before the story is presented for sprint commitment.",
        "Should preserve tool names, environments, and API references when they are mentioned in the notes."
      ],
      dependencies: [
        "Program lead vision or backlog notes",
        "Parent epic link",
        "Sprint target",
        "Label for the resulting story"
      ],
      references: ["Refinement notes from the backlog session", "Confluence refinement summary"],
      estimation: "3 points",
      definitionOfReadyValidation: [
        "Problem statement present and aligned with the story",
        "User story follows As a / I want / So that format",
        "Acceptance criteria are present and testable",
        "Dependencies discussed",
        "Estimation is 5 points or less",
        "Parent Epic Link identified",
        "Label added",
        "Sprint identified"
      ],
      gaps: ["None identified during refinement — verify before sprint commitment"],
      normalizationNotes: [
        "Reordered the output to match the story template exactly.",
        "Preserved technical specificity from the notes.",
        "Called out readiness gaps separately from the story body."
      ],
      parentEpicLink: "EPIC-001",
      labels: ["refinement", "ready"],
      sprint: "Sprint 12"
    },
    testCases: {
      summary: {
        totalTestCases: 6,
        positive: 2,
        negative: 2,
        edgeCases: 2,
        gaps: ["No performance/load scenarios were discussed during refinement."]
      },
      testSuites: [
        {
          name: "Refinement story normalization",
          acceptanceCriterion: "Given refinement notes, when the facilitator normalizes the content, then the output keeps the exact story structure.",
          testCases: [
            {
              id: "TC-001",
              priority: "High",
              type: "Positive",
              preconditions: ["A messy refinement session summary exists"],
              steps: ["Open the refinement panel", "Load the sample notes"],
              expectedResult: "The structured story uses the exact output order and preserves the original context.",
              testData: "Backlog notes with a problem statement, story summary, and acceptance criteria"
            },
            {
              id: "TC-002",
              priority: "High",
              type: "Negative",
              preconditions: ["A story with mismatched problem and summary text exists"],
              steps: ["Load the conflicting story example", "Review the output warnings"],
              expectedResult: "The UI surfaces an explicit clarification warning about the mismatch.",
              testData: "Problem X with a story summary about Y"
            },
            {
              id: "TC-003",
              priority: "Medium",
              type: "Edge Case",
              preconditions: ["The notes contain only partial context"],
              steps: ["Load sparse notes", "Inspect the generated readiness gaps"],
              expectedResult: "Missing items are called out as DoR gaps instead of being invented.",
              testData: "Notes with only dependencies and a sprint target"
            }
          ]
        },
        {
          name: "QE test case generation",
          acceptanceCriterion: "Given acceptance criteria, when the generator produces test cases, then each criterion has positive, negative, and edge coverage.",
          testCases: [
            {
              id: "TC-004",
              priority: "High",
              type: "Positive",
              preconditions: ["A story with clear acceptance criteria exists"],
              steps: ["Open the test case generator", "Load the sample criteria"],
              expectedResult: "At least one happy-path test case is generated for each criterion.",
              testData: "Three acceptance criteria from the refinement story"
            },
            {
              id: "TC-005",
              priority: "Medium",
              type: "Negative",
              preconditions: ["An untestable acceptance criterion exists"],
              steps: ["Load the vague criterion", "Review the generated output"],
              expectedResult: "The output flags the criterion as untestable and suggests a rewrite.",
              testData: "Criterion: should work properly"
            },
            {
              id: "TC-006",
              priority: "Low",
              type: "Edge Case",
              preconditions: ["Boundary values and empty inputs are mentioned"],
              steps: ["Generate cases from boundary criteria", "Inspect the numbering"],
              expectedResult: "Boundary and edge cases are present and the test IDs remain sequential.",
              testData: "Zero, max, and max+1 inputs"
            }
          ]
        }
      ]
    },
    onboarding: {
      agentName: "Confluence-grounded Onboarding Agent",
      firstInteraction: [
        "What is your role?",
        "Is this your first week, or have you been here a bit and have specific questions?"
      ],
      answers: [
        {
          role: "Developer",
          journeyType: "FIRST_WEEK",
          question: "How do I set up my dev environment?",
          answer: "Install the repo prerequisites, request the listed access, and follow the team onboarding notes before your first contribution.",
          citedDocuments: [
            { documentName: "Team onboarding guide", section: "Tools and access", owner: "Platform", channel: "#team-platform", updatedOn: "2026-04-10", outdated: false },
            { documentName: "Local development checklist", section: "Codebase and architecture", owner: "Engineering", channel: "#engineering", updatedOn: "2026-04-09", outdated: false }
          ],
          warnings: [],
          nextQuestions: ["Want me to walk you through the full setup steps?"],
          suggestedEscalation: "Ask the team lead if repo access is missing."
        },
        {
          role: "Tester",
          journeyType: "SPECIFIC_QUESTION",
          question: "What is our branching strategy?",
          answer: "Use the shared feature branch flow, keep pull requests small, and ask for review before merging.",
          citedDocuments: [
            { documentName: "Delivery playbook", section: "Pull request process", owner: "QA", channel: "#qe", updatedOn: "2026-03-27", outdated: false },
            { documentName: "Branching and release notes", section: "Source control", owner: "Engineering", channel: "#engineering", updatedOn: "2025-12-18", outdated: true }
          ],
          warnings: ["Branching and release notes may be outdated - verify with your team lead."],
          warnings: ["⚠️ Note: This document may be outdated — verify with your team lead."],
          nextQuestions: ["Want me to point you to the review checklist?"],
          suggestedEscalation: "Ask the scrum master if the team needs a release-specific branching exception."
        }
      ],
      fallback: "I couldn't find this in our documentation. You may want to ask your team lead or #team-platform."
    }
  });
}

export function normalizeWorkspaceHub(raw = {}) {
  return {
    planning: normalizePlanningHub(raw.planning),
    refinement: normalizeRefinementStory(raw.refinement),
    testCases: normalizeTestCaseBundle(raw.testCases),
    onboarding: normalizeOnboardingWorkspace(raw.onboarding)
  };
}

export function normalizePlanningHub(raw = {}) {
  const reviewStages = coerceArray(raw.reviewStages).map((stage, index) => ({
    stage: stage?.stage || stage?.name || `Stage ${index + 1}`,
    status: stage?.status || "Pending review",
    owner: stage?.owner || "Unassigned",
    decision: stage?.decision || stage?.notes || "Awaiting approval"
  }));
  const epics = coerceArray(raw.epics).map((epic, index) => ({
    id: epic?.id || `EPIC-${String(index + 1).padStart(3, "0")}`,
    title: epic?.title || "Untitled epic",
    status: epic?.status || "Draft",
    summary: epic?.summary || "",
    featureCount: typeof epic?.featureCount === "number" ? epic.featureCount : coerceArray(epic?.features).length,
    storyCount: typeof epic?.storyCount === "number" ? epic.storyCount : coerceArray(epic?.stories).length
  }));
  const features = coerceArray(raw.features).map((feature, index) => ({
    id: feature?.id || `FEAT-${String(index + 1).padStart(3, "0")}`,
    epicId: feature?.epicId || feature?.parentEpicId || "",
    title: feature?.title || "Untitled feature",
    status: feature?.status || "Draft",
    summary: feature?.summary || ""
  }));
  const stories = coerceArray(raw.stories).map((story, index) => ({
    id: story?.id || `STORY-${String(index + 1).padStart(3, "0")}`,
    featureId: story?.featureId || story?.parentFeatureId || "",
    title: story?.title || story?.summary || "Untitled story",
    status: story?.status || "Draft",
    points: story?.points ?? story?.estimation ?? ""
  }));

  return {
    vision: {
      programLead: raw?.vision?.programLead || "Program lead",
      statement: raw?.vision?.statement || "Vision awaiting intake",
      objective: raw?.vision?.objective || "Break the vision into epics, features, and stories."
    },
    reviewStages,
    epics,
    features,
    stories
  };
}

export function summarizePlanningHub(planning = {}) {
  return {
    reviewStages: coerceArray(planning.reviewStages).length,
    epics: coerceArray(planning.epics).length,
    features: coerceArray(planning.features).length,
    stories: coerceArray(planning.stories).length
  };
}

export function normalizeRefinementStory(raw = {}) {
  return {
    source: raw?.source || "Refinement session",
    problemStatement: raw?.problemStatement || "⚠️Clarification needed",
    storySummary:
      raw?.storySummary ||
      "As a specific role, I want to take a concrete action so that I can achieve an observable outcome.",
    acceptanceCriteria: coerceArray(raw.acceptanceCriteria),
    dependencies: coerceArray(raw.dependencies).length > 0 ? coerceArray(raw.dependencies) : ["None identified during refinement — verify before sprint commitment"],
    references: coerceArray(raw.references).length > 0 ? coerceArray(raw.references) : ["None"],
    estimation: raw?.estimation || "Not estimated — requires team sizing",
    definitionOfReadyValidation: coerceArray(raw.definitionOfReadyValidation),
    gaps: coerceArray(raw.gaps).length > 0 ? coerceArray(raw.gaps) : ["⚠️ DoR GAP: none identified during refinement"],
    normalizationNotes: coerceArray(raw.normalizationNotes),
    parentEpicLink: raw?.parentEpicLink || "",
    labels: coerceArray(raw.labels),
    sprint: raw?.sprint || ""
  };
}

export function summarizeRefinementStory(refinement = {}) {
  return {
    acceptanceCriteria: coerceArray(refinement.acceptanceCriteria).length,
    dependencies: coerceArray(refinement.dependencies).length,
    references: coerceArray(refinement.references).length,
    gaps: coerceArray(refinement.gaps).length
  };
}

export function normalizeTestCaseBundle(raw = {}) {
  const testSuites = coerceArray(raw.testSuites).map((suite, index) => ({
    name: suite?.name || `Test suite ${index + 1}`,
    acceptanceCriterion: suite?.acceptanceCriterion || suite?.criterion || "",
    testCases: coerceArray(suite?.testCases).map((testCase, caseIndex) => ({
      id: testCase?.id || `TC-${String(index * 3 + caseIndex + 1).padStart(3, "0")}`,
      priority: testCase?.priority || "Medium",
      type: testCase?.type || "Positive",
      preconditions: coerceArray(testCase?.preconditions),
      steps: coerceArray(testCase?.steps),
      expectedResult: testCase?.expectedResult || "",
      testData: testCase?.testData || ""
    }))
  }));
  const summary = raw?.summary || {};

  return {
    summary: {
      totalTestCases: summary.totalTestCases ?? testSuites.reduce((count, suite) => count + suite.testCases.length, 0),
      positive: summary.positive ?? testSuites.flatMap((suite) => suite.testCases).filter((testCase) => testCase.type === "Positive").length,
      negative: summary.negative ?? testSuites.flatMap((suite) => suite.testCases).filter((testCase) => testCase.type === "Negative").length,
      edgeCases: summary.edgeCases ?? testSuites.flatMap((suite) => suite.testCases).filter((testCase) => ["Edge Case", "Boundary"].includes(testCase.type)).length,
      gaps: coerceArray(summary.gaps).length > 0 ? coerceArray(summary.gaps) : ["None"]
    },
    testSuites
  };
}

export function summarizeTestCaseBundle(bundle = {}) {
  return {
    totalTestCases: bundle?.summary?.totalTestCases ?? coerceArray(bundle?.testSuites).reduce((count, suite) => count + coerceArray(suite?.testCases).length, 0),
    positive: bundle?.summary?.positive ?? 0,
    negative: bundle?.summary?.negative ?? 0,
    edgeCases: bundle?.summary?.edgeCases ?? 0
  };
}

export function normalizeOnboardingWorkspace(raw = {}) {
  const answers = coerceArray(raw.answers).map((answer, index) => ({
    role: answer?.role || `Role ${index + 1}`,
    journeyType: answer?.journeyType || "FIRST_WEEK",
    question: answer?.question || "",
    answer: answer?.answer || "",
    citedDocuments: coerceArray(answer?.citedDocuments).map((document) => ({
      documentName: document?.documentName || document?.name || "Unknown document",
      section: document?.section || "",
      owner: document?.owner || "",
      channel: document?.channel || "",
      updatedOn: document?.updatedOn || "",
      outdated: Boolean(document?.outdated)
    })),
    warnings: coerceArray(answer?.warnings),
    nextQuestions: coerceArray(answer?.nextQuestions),
    suggestedEscalation: answer?.suggestedEscalation || ""
  }));

  return {
    agentName: raw?.agentName || "Confluence-grounded Onboarding Agent",
    firstInteraction: coerceArray(raw.firstInteraction).length > 0
      ? coerceArray(raw.firstInteraction)
      : ["What is your role?", "Is this your first week, or have you been here a bit and have specific questions?"],
    answers,
    fallback: raw?.fallback || "I couldn't find this in our documentation. You may want to ask your team lead or #team-platform."
  };
}

export function summarizeOnboardingWorkspace(onboarding = {}) {
  return {
    answers: coerceArray(onboarding.answers).length,
    firstInteraction: coerceArray(onboarding.firstInteraction).length,
    fallback: onboarding.fallback || ""
  };
}

export function flattenReport(report) {
  if (!report) {
    return [];
  }

  return [
    ...(report.detectors || []).map((item) => ({
      type: "detector",
      ecosystem: item.ecosystem || "unknown",
      component: item.component || "unknown",
      version: item.detectedVersion || "unknown",
      notes: `${item.confidence || "UNKNOWN"} confidence${item.indirect ? ", indirect" : ""}`
    })),
    ...(report.policyStatuses || []).map((item) => ({
      type: "policy",
      ecosystem: item.ecosystem || "unknown",
      component: item.component || "unknown",
      version: item.supportStatus || item.version || "unknown",
      notes: `${item.version || "unknown"} via ${item.source || "policy source"}`
    })),
    ...(report.recommendations || []).map((item) => ({
      type: "recommendation",
      ecosystem: item.ecosystem || "unknown",
      component: item.component || "unknown",
      version: item.recommendedVersion || "unknown",
      notes: item.rationale || "No rationale provided"
    })),
    ...(report.warnings || []).map((item) => ({
      type: "warning",
      ecosystem: "workspace",
      component: item.code || "warning",
      version: item.severity || "INFO",
      notes: item.message || "No warning message provided"
    }))
  ];
}

export function applyScanFilters(scans, filters) {
  const search = filters.search.toLowerCase();

  return scans
    .filter((scan) => {
      const matchesSearch = !search || [scan.id, scan.displayName, scan.requestedBy, scan.sourceType, scan.status]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(search);

      const matchesStatus = !filters.status || normalizeStatus(scan.status) === filters.status;
      const matchesSource = !filters.source || normalizeSource(scan.sourceType) === filters.source;
      const matchesRequestedBy = !filters.requestedBy
        || String(scan.requestedBy || "").toLowerCase().includes(filters.requestedBy.toLowerCase());

      return matchesSearch && matchesStatus && matchesSource && matchesRequestedBy;
    })
    .sort((left, right) => compareScans(left, right, filters.sort));
}

export function applyReportFilters(rows, filters) {
  const search = filters.search.toLowerCase();

  return rows.filter((row) => {
    const matchesType = filters.type === "all" || row.type === filters.type;
    const matchesSearch = !search || [row.type, row.ecosystem, row.component, row.version, row.notes]
      .join(" ")
      .toLowerCase()
      .includes(search);
    return matchesType && matchesSearch;
  });
}

export function calculateSummary(scans) {
  return {
    totalScans: scans.length,
    pendingScans: scans.filter((scan) => !isComplete(scan.status)).length,
    completeScans: scans.filter((scan) => isComplete(scan.status)).length,
    reportReadyScans: scans.filter((scan) => isReportReady(scan.status)).length
  };
}

export function compareScans(left, right, sort = "newest") {
  if (sort === "oldest") {
    return dateValue(left.createdAt) - dateValue(right.createdAt);
  }
  if (sort === "name") {
    return String(left.displayName || left.id).localeCompare(String(right.displayName || right.id));
  }
  if (sort === "status") {
    return String(left.status || "").localeCompare(String(right.status || ""));
  }
  return dateValue(right.updatedAt || right.createdAt) - dateValue(left.updatedAt || left.createdAt);
}

export function normalizeStatus(status) {
  const value = String(status || "").toLowerCase();
  if (value.includes("complete") || value.includes("ready")) {
    return "complete";
  }
  if (value.includes("fail") || value.includes("error")) {
    return "failed";
  }
  if (value.includes("analyz") || value.includes("aggregat") || value.includes("running")) {
    return "running";
  }
  return "pending";
}

export function normalizeSource(sourceType) {
  if (sourceType === "ARCHIVE_UPLOAD") {
    return "archive";
  }
  if (sourceType === "LOCAL_PATH") {
    return "path";
  }
  return "";
}

export function isComplete(status) {
  return normalizeStatus(status) === "complete";
}

export function isReportReady(status) {
  return ["complete", "running"].includes(normalizeStatus(status));
}

export function badgeClassForStatus(status) {
  const normalized = normalizeStatus(status);
  if (normalized === "complete") {
    return "badge success";
  }
  if (normalized === "failed") {
    return "badge danger";
  }
  if (normalized === "running") {
    return "badge warning";
  }
  return "badge info";
}

export function prettySource(sourceType) {
  if (sourceType === "ARCHIVE_UPLOAD") {
    return "Archive upload";
  }
  if (sourceType === "LOCAL_PATH") {
    return "Path scan";
  }
  return sourceType || "Unknown";
}

export function formatDate(value) {
  if (!value) {
    return "n/a";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}

export function downloadJson(label, payload) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${label}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export async function copyJson(payload) {
  if (!navigator.clipboard?.writeText) {
    throw new Error("Clipboard copy is not available in this browser.");
  }
  await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
}

export function buildDownloadHref(payload) {
  if (!payload) {
    return null;
  }
  return URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }));
}

export function createPlanningWorkspaceDefaults() {
  return {
    plan: createPlan(PLANNING_SEED_VISION),
    refinementRequest: buildRefinementSampleRequest(),
    testCaseRequest: buildTestCaseGenerationRequest(),
    onboardingRequest: {
      role: "Developer",
      journeyType: "FIRST_WEEK",
      question: ""
    }
  };
}

export function summarizePlanningWorkspace(plan) {
  const summary = getPlanSummary(plan);
  return {
    id: summary.id,
    currentStage: summary.currentStage,
    nextStage: summary.nextStage,
    counts: summary.counts,
    reviewSummary: summary.reviewSummary,
    onboarding: summary.onboarding,
    stageSummary: summary.stageSummary,
    checklist: getOnboardingProgress(plan)
  };
}

export function buildPlanningWorkspaceOutputs({
  refinementRequest,
  testCaseRequest,
  onboardingRequest
} = {}) {
  const refinement = createRefinementStoryPackage(
    refinementRequest || buildRefinementSampleRequest()
  );
  const testCases = generateTestCases(testCaseRequest || buildTestCaseGenerationRequest());
  const onboardingAgent = createOnboardingAgent();
  const onboarding = onboardingAgent.answer(
    onboardingRequest || {
      role: "Developer",
      journeyType: "FIRST_WEEK",
      question: ""
    }
  );

  return {
    refinement,
    testCases,
    onboarding,
    onboardingAgentName: onboarding.agentName || createOnboardingAgent().agentName,
    firstInteraction: answerOnboardingQuery({
      role: "",
      journeyType: "",
      question: ""
    }).firstInteraction
  };
}

function dateValue(value) {
  const parsed = new Date(value || 0).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

function createLifecycleFromStatus(status, sourceType) {
  const normalizedStatus = normalizeStatus(status);
  const queued = sourceType === "ARCHIVE_UPLOAD"
    ? ["QUEUED", "INGESTING", "ANALYZING"]
    : ["QUEUED", "ANALYZING"];

  if (normalizedStatus === "complete") {
    return [...queued, "AGGREGATING", "COMPLETED"];
  }
  if (normalizedStatus === "failed") {
    return [...queued, "FAILED"];
  }
  return queued;
}

function describeNormalizationStatus(normalizedStatus) {
  if (normalizedStatus === "complete") {
    return "READY";
  }
  if (normalizedStatus === "running") {
    return "IN_PROGRESS";
  }
  if (normalizedStatus === "failed") {
    return "FAILED";
  }
  return "QUEUED";
}

function cryptoRandomId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID().slice(0, 8);
  }
  return Math.random().toString(16).slice(2, 10);
}

function coerceArray(value) {
  return Array.isArray(value) ? value : value ? [value] : [];
}
