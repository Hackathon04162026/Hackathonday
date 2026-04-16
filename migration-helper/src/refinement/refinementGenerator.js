import {
  compactList,
  dedupeStrings,
  extractKeywords,
  extractTrailingInteger,
  extractMeaningfulClause,
  findFirstMeaningfulLine,
  findFirstMeaningfulSentence,
  hasCanonicalStorySummary,
  joinAsSentence,
  lowerFirst,
  normalizeWhitespace,
  sentenceCase,
  splitLines,
  stripBulletPrefix
} from "./text.js";

const ROLE_HINTS = [
  ["product owner", "product owner"],
  ["scrum master", "scrum master"],
  ["tester", "QE engineer"],
  ["qe", "QE engineer"],
  ["quality engineering", "QE engineer"],
  ["developer", "developer"],
  ["engineer", "developer"],
  ["facilitator", "refinement facilitator"]
];

const THEME_PRIORITY = ["refinement", "planning", "qe", "onboarding"];
const DEPENDENCY_FALLBACK = "None identified during refinement - verify before sprint commitment";
const DOR_GAP_PREFIX = "\u26A0\uFE0F DoR GAP:";
const CLARIFICATION_PREFIX = "\u26A0\uFE0F Clarification needed:";
const CHECKED = "[x]";
const UNCHECKED = "[ ]";
export const DEFAULT_REFINEMENT_FIXTURE_URL = "/mock-data/refinement/story.json";

export function buildRefinementSampleRequest(overrides = {}) {
  return {
    notes: [
      "Problem: Refinement notes are scattered across chat threads and meeting summaries.",
      "Need: Convert the discussion into a sprint-ready backlog story.",
      "AC: Preserve the canonical section ordering.",
      "AC: Flag problem/story misalignment when the discussion and outcome diverge.",
      "Depends on: Parent epic confirmation from the program lead.",
      "References: Confluence page REF-101"
    ].join("\n"),
    candidateProblemStatement: "",
    candidateStorySummary: "",
    parentEpicLink: "EPIC-101",
    labels: ["refinement", "planning"],
    sprint: "Sprint 14",
    estimatePoints: 3,
    references: ["Confluence page REF-101"],
    teamContext: "refinement facilitator",
    ...overrides
  };
}

export function createRefinementStoryResponse(request = {}) {
  const story = createRefinementStoryPackage(request);
  return {
    stories: [story],
    story
  };
}

export function createRefinementStoryPackage(request = {}) {
  const rawNotes = String(request.notes ?? "");
  const notes = normalizeWhitespace(rawNotes);
  const candidateProblemStatement = normalizeWhitespace(request.candidateProblemStatement);
  const candidateStorySummary = normalizeWhitespace(request.candidateStorySummary);
  const themes = detectThemes(rawNotes, candidateProblemStatement, candidateStorySummary);
  const primaryTheme = selectPrimaryTheme(themes);
  const acceptanceCriteria = extractAcceptanceCriteria(
    compactList(request.candidateAcceptanceCriteria ?? request.acceptanceCriteria).length > 0
      ? compactList(request.candidateAcceptanceCriteria ?? request.acceptanceCriteria).join("\n")
      : rawNotes
  );
  const problemStatement =
    candidateProblemStatement || buildProblemStatement(request, rawNotes, acceptanceCriteria, primaryTheme);
  const storySummary = buildStorySummary(request, rawNotes, candidateStorySummary, problemStatement, primaryTheme);
  const references = buildReferences(request.references, rawNotes);
  const dependencies = buildDependencies(request.dependencies, rawNotes);
  const estimatePoints = buildEstimatePoints(request.estimatePoints, request.estimation, rawNotes);
  const estimation = estimatePoints == null ? "Not estimated - requires team sizing" : `${estimatePoints} story points`;
  const misalignment = detectMisalignment(problemStatement, storySummary);
  const labels = compactList(request.labels);
  const parentEpicLink = normalizeWhitespace(request.parentEpicLink);
  const sprint = normalizeWhitespace(request.sprint);
  const label = labels[0] || "";

  const gaps = dedupeStrings([
    !candidateProblemStatement ? `${DOR_GAP_PREFIX} problem statement was not explicitly provided in the refinement notes` : "",
    candidateStorySummary && !hasCanonicalStorySummary(candidateStorySummary)
      ? `${CLARIFICATION_PREFIX} story summary does not follow the required As a / I want / So that format`
      : "",
    !parentEpicLink ? `${DOR_GAP_PREFIX} Parent Epic Link missing` : "",
    labels.length === 0 ? `${DOR_GAP_PREFIX} Label missing` : "",
    !sprint ? `${DOR_GAP_PREFIX} Sprint missing` : "",
    estimatePoints == null ? `${DOR_GAP_PREFIX} Estimate missing` : "",
    estimatePoints != null && estimatePoints > 5 ? `${DOR_GAP_PREFIX} Estimate exceeds 5 story points; split the work before sprint commitment` : "",
    acceptanceCriteria.length === 0 ? `${DOR_GAP_PREFIX} Acceptance criteria missing` : "",
    dependencies[0] === DEPENDENCY_FALLBACK
      ? `${DOR_GAP_PREFIX} Dependencies need verification before sprint commitment`
      : "",
    misalignment.isMisaligned
      ? `${CLARIFICATION_PREFIX} problem statement and story summary appear misaligned`
      : "",
    themes.size > 1
      ? `${CLARIFICATION_PREFIX} the notes mix ${Array.from(themes).map(titleCase).join(", ")} workstreams`
      : ""
  ]);

  const definitionOfReadyValidation = [
    misalignment.isMisaligned
      ? `${UNCHECKED} Problem statement present and aligned with story`
      : `${CHECKED} Problem statement present and aligned with story`,
    hasCanonicalStorySummary(storySummary)
      ? `${CHECKED} User story follows "As a / I want / So that" format`
      : `${UNCHECKED} User story follows "As a / I want / So that" format`,
    acceptanceCriteria.length > 0
      ? `${CHECKED} Acceptance criteria are present and testable`
      : `${UNCHECKED} Acceptance criteria are present and testable`,
    dependencies[0] !== DEPENDENCY_FALLBACK
      ? `${CHECKED} Dependencies discussed`
      : `${UNCHECKED} Dependencies discussed`,
    estimatePoints != null && estimatePoints <= 5
      ? `${CHECKED} Estimation <= 5 story points (if larger, recommend splitting)`
      : `${UNCHECKED} Estimation <= 5 story points (if larger, recommend splitting)`,
    parentEpicLink
      ? `${CHECKED} Parent Epic Link identified`
      : `${UNCHECKED} Parent Epic Link identified`,
    labels.length > 0
      ? `${CHECKED} Label added`
      : `${UNCHECKED} Label added`,
    sprint
      ? `${CHECKED} Sprint identified`
      : `${UNCHECKED} Sprint identified`
  ];

  const normalizationNotes = dedupeStrings([
    "Collapsed whitespace and removed empty lines from the refinement notes.",
    `Primary theme detected: ${titleCase(primaryTheme)}.`,
    candidateStorySummary
      ? hasCanonicalStorySummary(candidateStorySummary)
        ? "Preserved the provided story summary after normalizing spacing."
        : "Preserved the provided candidate story summary and flagged the format gap for clarification."
      : "Generated a canonical story summary because no candidate summary was provided.",
    !candidateProblemStatement ? "Problem statement was synthesized from the refinement notes." : "",
    estimatePoints != null && estimatePoints > 5
      ? "Split guidance: estimate is above 5 story points, so the work should be divided before commitment."
      : "",
    misalignment.isMisaligned
      ? `Problem keywords: ${misalignment.problemKeywords.join(", ") || "none"}`
      : "",
    misalignment.isMisaligned
      ? `Story keywords: ${misalignment.storyKeywords.join(", ") || "none"}`
      : "",
    themes.size > 1
      ? `Detected overlapping themes: ${Array.from(themes).map(titleCase).join(", ")}.`
      : "",
    "Surface any unresolved gaps before sprint commitment."
  ]);

  return {
    problemStatement,
    storySummary,
    acceptanceCriteria,
    dependencies,
    references: references.length > 0 ? references : ["None"],
    estimation,
    definitionOfReadyValidation,
    gaps,
    normalizationNotes,
    parentEpicLink,
    labels,
    label,
    sprint
  };
}

export async function loadRefinementStoryFixture({ fetchImpl = globalThis.fetch, url = DEFAULT_REFINEMENT_FIXTURE_URL } = {}) {
  if (typeof fetchImpl !== "function") {
    return createRefinementStoryResponse(buildRefinementSampleRequest());
  }

  const response = await fetchImpl(url);
  if (!response || !response.ok) {
    const status = response ? response.status : "unavailable";
    throw new Error(`Failed to load refinement story fixture from ${url}: ${status}`);
  }

  return normalizeRefinementStoryResponse(await response.json());
}

export function normalizeRefinementStoryResponse(response) {
  if (Array.isArray(response)) {
    return { stories: response };
  }

  if (response && typeof response === "object" && Array.isArray(response.stories)) {
    return { ...response, stories: response.stories };
  }

  if (response && typeof response === "object" && response.story && typeof response.story === "object") {
    return { ...response, stories: [response.story] };
  }

  return { ...response, stories: [response] };
}

export function buildDependencies(providedDependencies, notes) {
  const discovered = splitLines(notes)
    .map(stripBulletPrefix)
    .filter((line) => /\b(depends on|blocked by|requires|needs|waiting on)\b/i.test(line))
    .map((line) => line.replace(/^(depends on|blocked by|requires|needs|waiting on)\s*:\s*/i, "").trim())
    .filter(Boolean);

  const result = dedupeStrings([...(providedDependencies || []), ...discovered]);
  return result.length > 0 ? result : [DEPENDENCY_FALLBACK];
}

export function buildReferences(providedReferences, notes) {
  const discovered = splitLines(notes)
    .map(stripBulletPrefix)
    .filter((line) => /\b(reference|references|link|doc|document|confluence|jira)\b/i.test(line))
    .map((line) => line.replace(/^(reference|references|link|doc|document|confluence|jira)\s*:\s*/i, "").trim())
    .filter(Boolean);

  return dedupeStrings([...(providedReferences || []), ...discovered]);
}

export function buildEstimatePoints(explicitEstimate, estimation, notes) {
  if (Number.isFinite(explicitEstimate)) {
    return Number(explicitEstimate);
  }

  const parsedFromEstimation = extractTrailingInteger(estimation);
  if (Number.isFinite(parsedFromEstimation)) {
    return parsedFromEstimation;
  }

  const parsedFromNotes = extractTrailingInteger(notes);
  return Number.isFinite(parsedFromNotes) ? parsedFromNotes : null;
}

export function buildProblemStatement(request, notes, acceptanceCriteria, primaryTheme) {
  const topic = (findFirstMeaningfulLine(notes) || findFirstMeaningfulSentence(notes) || "the refinement notes").replace(/[.?!]+$/, "");
  const focus = normalizeWhitespace(request.teamContext) || "the delivery team";
  const themeLabel = lowerFirst(titleCase(primaryTheme));

  return joinAsSentence([
    sentenceCase(`The current ${themeLabel} discussion describes ${lowerFirst(topic)}.`),
    `This matters because ${focus} needs a consistent, sprint-ready backlog artifact before work can be committed.`,
    "The purpose of this work is to turn the discussion into a clear refinement package.",
    acceptanceCriteria.length > 0
      ? `The discussion already identifies ${acceptanceCriteria.length} ordered acceptance criteri${acceptanceCriteria.length === 1 ? "on" : "a"}.`
      : "The discussion still needs to be shaped into testable acceptance criteria."
  ]);
}

export function buildStorySummary(request, notes, candidateStorySummary, problemStatement, primaryTheme) {
  if (candidateStorySummary) {
    return normalizeWhitespace(candidateStorySummary);
  }

  if (primaryTheme === "qe") {
    return "As a QE engineer, I want to turn acceptance criteria into comprehensive test cases so that I can execute coverage quickly.";
  }
  if (primaryTheme === "onboarding") {
    return "As a new team member, I want to ask grounded onboarding questions against team documentation so that I can get set up quickly without tribal knowledge.";
  }
  if (primaryTheme === "planning") {
    return "As a program lead, I want to break a vision into reviewed epics and features so that I can move the work through gated approvals before delivery.";
  }

  const role = inferRole(request.teamContext, notes, problemStatement);
  const action = inferAction(notes, problemStatement);
  const outcome = inferOutcome(notes, problemStatement);
  return `As a ${role}, I want to ${lowerFirst(action)} so that I can ${outcome}.`;
}

export function inferRole(teamContext, notes, problemStatement) {
  const sources = [teamContext, notes, problemStatement].map(normalizeWhitespace).filter(Boolean);
  for (const source of sources) {
    const lower = source.toLowerCase();
    for (const [needle, role] of ROLE_HINTS) {
      if (lower.includes(needle)) {
        return role;
      }
    }
  }

  return "refinement facilitator";
}

export function inferAction(notes, problemStatement) {
  const prioritized = splitLines(notes)
    .map(stripBulletPrefix)
    .filter((line) => /^(need|goal|action|want)\s*:/i.test(line))
    .map((line) => extractMeaningfulClause(line));
  const candidates = [...prioritized, notes, problemStatement].map(findFirstMeaningfulLine).filter(Boolean);
  for (const candidate of candidates) {
    const cleaned = candidate
      .replace(/^as a\s+.+?,\s*i want to\s+/i, "")
      .replace(/^(need|goal|action|want)\s*:\s*/i, "")
      .replace(/^i want to\s+/i, "")
      .replace(/\.$/, "");
    if (cleaned && cleaned.length > 8) {
      return cleaned;
    }
  }

  return "convert the refinement notes into a sprint-ready backlog story";
}

export function inferOutcome(notes, problemStatement) {
  const prioritized = splitLines(notes)
    .map(stripBulletPrefix)
    .filter((line) => /^(outcome|purpose|why|value)\s*:/i.test(line))
    .map((line) => extractMeaningfulClause(line));
  const sources = prioritized.map(normalizeWhitespace).filter(Boolean);
  for (const source of sources) {
    const cleaned = source
      .replace(/^because\s+/i, "")
      .replace(/^so that i can\s+/i, "")
      .replace(/^the purpose of this work is to\s+/i, "")
      .replace(/\.$/, "");
    if (cleaned && cleaned.length > 8) {
      return cleaned;
    }
  }

  return "keep the backlog aligned and ready for sprint commitment";
}

export function extractAcceptanceCriteria(notes) {
  const lines = splitLines(notes);
  const extracted = [];

  for (const line of lines) {
    const cleaned = stripBulletPrefix(line);
    if (/^(ac|acceptance criteria|acceptance criterion)\s*:/i.test(cleaned)) {
      extracted.push(cleaned.replace(/^(ac|acceptance criteria|acceptance criterion)\s*:\s*/i, "").trim());
      continue;
    }

    if (/^(given|when|then|and|but)\b/i.test(cleaned) || /^should\b/i.test(cleaned)) {
      extracted.push(cleaned);
      continue;
    }

    if (/\b(must|should|needs to|need to|ensures|allow|prevent|block)\b/i.test(cleaned)) {
      extracted.push(cleaned);
    }
  }

  return dedupeStrings(extracted);
}

export function detectMisalignment(problemStatement, storySummary) {
  const problemKeywords = extractKeywords(problemStatement);
  const storyKeywords = extractKeywords(storySummary);
  const overlap = problemKeywords.filter((keyword) => storyKeywords.includes(keyword));
  return {
    isMisaligned: problemKeywords.length > 0 && storyKeywords.length > 0 && overlap.length === 0,
    overlap,
    problemKeywords,
    storyKeywords
  };
}

function detectThemes(...values) {
  const combined = normalizeWhitespace(values.join(" ")).toLowerCase();
  const themes = new Set();

  if (containsAny(combined, ["test case", "test cases", "qe", "quality engineering", "coverage"])) {
    themes.add("qe");
  }
  if (containsAny(combined, ["onboarding", "sharepoint", "document", "new team member", "first week"])) {
    themes.add("onboarding");
  }
  if (containsAny(combined, ["vision", "epic", "feature", "features", "backlog", "review gate", "approval"])) {
    themes.add("planning");
  }
  if (containsAny(combined, ["refinement", "refine", "facilitator", "sprint-ready", "user stories", "acceptance criteria"])) {
    themes.add("refinement");
  }

  if (themes.size === 0) {
    themes.add("refinement");
  }

  return themes;
}

function selectPrimaryTheme(themes) {
  for (const theme of THEME_PRIORITY) {
    if (themes.has(theme)) {
      return theme;
    }
  }
  return "refinement";
}

function titleCase(value) {
  return normalizeWhitespace(value)
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function containsAny(value, needles) {
  return needles.some((needle) => value.includes(needle));
}
