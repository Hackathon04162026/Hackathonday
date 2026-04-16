import {
  compactList,
  dedupeStrings,
  extractKeywords,
  normalizeWhitespace,
  splitSentences,
  stripBulletPrefix
} from "./text.js";

const VAGUE_PATTERNS = [
  {
    pattern: /\bproperly\b/i,
    reason: "uses 'properly' without an observable result",
    suggestion: "Rewrite to specify the exact visible state, response, or persisted record."
  },
  {
    pattern: /\bwork(?:s)? properly\b/i,
    reason: "uses 'work properly' without defining success criteria",
    suggestion: "Rewrite to state the exact success condition and visible outcome."
  },
  {
    pattern: /\bcorrectly\b/i,
    reason: "uses 'correctly' without observable validation",
    suggestion: "Rewrite to describe the exact expected result or validation rule."
  },
  {
    pattern: /\bfast\b|\bquick\b/i,
    reason: "uses a speed adjective without a threshold",
    suggestion: "Add a measurable threshold such as a response time or processing limit."
  },
  {
    pattern: /\buser[- ]friendly\b|\bintuitive\b/i,
    reason: "uses a subjective experience term",
    suggestion: "Rewrite with concrete UI behavior, messaging, or workflow steps."
  },
  {
    pattern: /\beasy\b/i,
    reason: "uses 'easy' without a measurable outcome",
    suggestion: "Replace the subjective wording with an observable action and result."
  },
  {
    pattern: /\bas needed\b/i,
    reason: "is open-ended and does not define when or how often",
    suggestion: "Specify the exact trigger, limit, or condition that must be met."
  },
  {
    pattern: /\betc\./i,
    reason: "uses 'etc.' and leaves the scope open-ended",
    suggestion: "List the exact supported cases instead of abbreviating the requirement."
  }
];

export const DEFAULT_TEST_CASE_FIXTURE_URL = "/mock-data/test-cases/generated.json";

export function buildTestCaseGenerationRequest(overrides = {}) {
  return {
    storySummary:
      "As a refinement facilitator, I want to turn messy notes into a sprint-ready story so that I can commit work with clear acceptance criteria.",
    acceptanceCriteria: [
      "Given messy refinement notes, When the generator runs, Then the story output preserves the canonical section ordering.",
      "Should flag a problem/story mismatch when the discussed problem and the proposed work describe different topics.",
      "Should recommend splitting the work when the estimate is greater than 5 story points."
    ],
    storyTitle: "Refinement facilitation",
    environment: "local",
    ...overrides
  };
}

export function createTestCaseGenerationResponse(request = {}) {
  const response = generateTestCases(request);
  return {
    ...response,
    suites: response.testSuites
  };
}

export function generateTestCases(request = {}) {
  const storySummary = normalizeWhitespace(request.storySummary);
  const storyTitle = normalizeWhitespace(request.storyTitle) || deriveSuiteLabel(storySummary) || "Story";
  const environment = normalizeWhitespace(request.environment) || "default environment";
  const acceptanceCriteria = compactList(request.acceptanceCriteria);
  const testSuites = [];
  const gaps = [];
  let testCaseCounter = 1;
  let positiveCases = 0;
  let negativeCases = 0;
  let edgeCases = 0;
  let boundaryCases = 0;
  let untestableCriteria = 0;

  if (acceptanceCriteria.length === 0) {
    gaps.push("No acceptance criteria were provided, so no test suites could be generated.");
  }

  acceptanceCriteria.forEach((criterion, index) => {
    const parsed = parseAcceptanceCriterion(criterion);
    const untestableDetails = detectUntestableCriterion(criterion);
    if (untestableDetails) {
      untestableCriteria += 1;
      gaps.push(
        `\u26A0\uFE0F UNTESTABLE: ${parsed.normalized} - Reason: ${untestableDetails.reason} - Suggestion: ${untestableDetails.suggestion}`
      );
    }

    const suiteName = `Test Suite ${index + 1}: ${buildSuiteName(parsed, storyTitle)}`;
    const testCases = [
      buildPositiveCase({
        id: formatCaseId(testCaseCounter++),
        parsed,
        storySummary,
        environment,
        suiteIndex: index + 1
      }),
      buildNegativeCase({
        id: formatCaseId(testCaseCounter++),
        parsed,
        storySummary,
        environment,
        suiteIndex: index + 1
      }),
      buildBoundaryOrEdgeCase({
        id: formatCaseId(testCaseCounter++),
        parsed,
        storySummary,
        environment,
        suiteIndex: index + 1
      })
    ];

    positiveCases += 1;
    negativeCases += 1;
    if (testCases[2].type === "Boundary") {
      boundaryCases += 1;
    } else {
      edgeCases += 1;
    }

    testSuites.push({
      suiteName,
      acceptanceCriterion: parsed.normalized,
      untestable: Boolean(untestableDetails),
      untestableReason: untestableDetails ? untestableDetails.reason : "",
      rewriteSuggestion: untestableDetails ? untestableDetails.suggestion : "",
      testCases
    });
  });

  if (storySummary || acceptanceCriteria.length > 0) {
    gaps.push(...detectMissingScenarioCategories(acceptanceCriteria, storySummary));
  }

  return {
    testSuites,
    suites: testSuites,
    summary: {
      totalTestCases: positiveCases + negativeCases + edgeCases + boundaryCases,
      positive: positiveCases,
      positiveCases,
      positiveCount: positiveCases,
      negative: negativeCases,
      negativeCases,
      negativeCount: negativeCases,
      edgeCaseCount: edgeCases,
      edgeCases,
      boundary: boundaryCases,
      boundaryCases,
      boundaryCount: boundaryCases,
      untestableCriteria,
      gaps: dedupeStrings(gaps),
      gapList: dedupeStrings(gaps)
    }
  };
}

export async function loadTestCaseFixture({ fetchImpl = globalThis.fetch, url = DEFAULT_TEST_CASE_FIXTURE_URL } = {}) {
  if (typeof fetchImpl !== "function") {
    return createTestCaseGenerationResponse(buildTestCaseGenerationRequest());
  }

  const response = await fetchImpl(url);
  if (!response || !response.ok) {
    const status = response ? response.status : "unavailable";
    throw new Error(`Failed to load test case fixture from ${url}: ${status}`);
  }

  return normalizeTestCaseGenerationResponse(await response.json());
}

export function normalizeTestCaseGenerationResponse(response) {
  if (Array.isArray(response)) {
    return { testSuites: response, suites: response };
  }

  const suites = Array.isArray(response?.testSuites)
    ? response.testSuites
    : Array.isArray(response?.suites)
      ? response.suites
      : Array.isArray(response)
        ? response
        : [];

  return {
    ...response,
    testSuites: suites,
    suites
  };
}

export function parseAcceptanceCriterion(criterion) {
  const normalized = normalizeWhitespace(criterion);
  const gherkinClauses = extractGherkinClauses(normalized);
  const plainText = normalized.replace(/^should\s+/i, "").replace(/\.$/, "");

  return {
    normalized,
    gherkinClauses,
    plainText,
    boundaryHint: hasBoundaryHint(normalized)
  };
}

export function buildSuiteName(parsed, storyTitle) {
  const clauseLabel =
    parsed.gherkinClauses.then[0]
    || parsed.gherkinClauses.when[0]
    || parsed.gherkinClauses.given[0]
    || parsed.plainText
    || storyTitle;
  return shortenLabel(clauseLabel, 8);
}

export function buildPositiveCase({ id, parsed, storySummary, environment, suiteIndex }) {
  const clauses = parsed.gherkinClauses;
  return {
    id,
    name: `Happy path for suite ${suiteIndex}`,
    priority: "High",
    type: "Positive",
    preconditions: clauses.given.length > 0 ? clauses.given : [buildDefaultPrecondition(storySummary, environment)],
    steps: clauses.when.length > 0 ? clauses.when : [buildDefaultPositiveStep(parsed.plainText, environment)],
    expectedResult: clauses.then.length > 0 ? clauses.then.join("; ") : buildDefaultPositiveExpected(parsed.plainText),
    testData: buildPositiveTestData(parsed, environment)
  };
}

export function buildNegativeCase({ id, parsed, storySummary, environment, suiteIndex }) {
  const clauses = parsed.gherkinClauses;
  const invalidContext = buildNegativeContext(parsed, storySummary, environment);

  return {
    id,
    name: `Negative path for suite ${suiteIndex}`,
    priority: "High",
    type: "Negative",
    preconditions: clauses.given.length > 0 ? [...clauses.given, invalidContext] : [invalidContext],
    steps: clauses.when.length > 0
      ? [`Attempt the action with invalid input: ${buildInvalidInput(parsed)}`]
      : [buildNegativeStep(parsed, environment)],
    expectedResult: buildNegativeExpected(parsed),
    testData: buildNegativeTestData(parsed, environment)
  };
}

export function buildBoundaryOrEdgeCase({ id, parsed, storySummary, environment, suiteIndex }) {
  const clauses = parsed.gherkinClauses;
  const boundary = buildBoundaryScenario(parsed, storySummary, environment);
  const useBoundary = parsed.boundaryHint;

  return {
    id,
    name: `${useBoundary ? "Boundary" : "Edge"} path for suite ${suiteIndex}`,
    priority: "Medium",
    type: useBoundary ? "Boundary" : "Edge Case",
    preconditions: clauses.given.length > 0 ? clauses.given : [buildDefaultPrecondition(storySummary, environment)],
    steps: [useBoundary ? boundary.step : buildEdgeStep(parsed, environment)],
    expectedResult: useBoundary ? boundary.expectedResult : buildEdgeExpected(parsed),
    testData: useBoundary ? boundary.testData : buildEdgeTestData(parsed, environment)
  };
}

export function detectUntestableCriterion(criterion) {
  for (const entry of VAGUE_PATTERNS) {
    if (entry.pattern.test(criterion)) {
      return {
        reason: entry.reason,
        suggestion: entry.suggestion
      };
    }
  }

  const keywords = extractKeywords(criterion);
  if (keywords.length < 3) {
    return {
      reason: "does not define enough observable behavior to produce stable tests",
      suggestion: "Rewrite the criterion with a concrete actor, action, and observable expected result."
    };
  }

  return null;
}

export function extractGherkinClauses(text) {
  const clauses = { given: [], when: [], then: [] };
  let current = null;
  const segments = splitSentences(text.length > 0 ? text : "");

  for (const segment of segments.length > 0 ? segments : [text]) {
    const matches = segment.matchAll(/\b(Given|When|Then|And|But)\s+([^;,.]+)/gi);
    let foundAny = false;

    for (const match of matches) {
      foundAny = true;
      const clause = match[1].toLowerCase();
      const body = stripBulletPrefix(normalizeWhitespace(match[2]));
      if (clause === "given") {
        clauses.given.push(body);
        current = "given";
      } else if (clause === "when") {
        clauses.when.push(body);
        current = "when";
      } else if (clause === "then") {
        clauses.then.push(body);
        current = "then";
      } else if ((clause === "and" || clause === "but") && current) {
        clauses[current].push(body);
      }
    }

    if (!foundAny && /^(given|when|then|and|but)\b/i.test(segment)) {
      const clauseMatch = segment.match(/^(Given|When|Then|And|But)\s+(.*)$/i);
      if (clauseMatch) {
        const clause = clauseMatch[1].toLowerCase();
        const body = stripBulletPrefix(normalizeWhitespace(clauseMatch[2]));
        if (clause === "given") {
          clauses.given.push(body);
          current = "given";
        } else if (clause === "when") {
          clauses.when.push(body);
          current = "when";
        } else if (clause === "then") {
          clauses.then.push(body);
          current = "then";
        } else if ((clause === "and" || clause === "but") && current) {
          clauses[current].push(body);
        }
      }
    }
  }

  return clauses;
}

export function detectMissingScenarioCategories(acceptanceCriteria, storySummary) {
  const combined = [storySummary, ...acceptanceCriteria].join(" ").toLowerCase();
  const gaps = [];

  if (!/\b(empty|null|blank|missing)\b/.test(combined)) {
    gaps.push("Coverage gap: empty/null input scenarios are not explicitly described.");
  }
  if (!/\b(permission|access|unauthorized|forbidden|role)\b/.test(combined)) {
    gaps.push("Coverage gap: permission or access-denied behavior is not explicitly described.");
  }
  if (!/\b(timeout|network|offline|retry|latency)\b/.test(combined)) {
    gaps.push("Coverage gap: network failure and timeout behavior is not explicitly described.");
  }
  if (!/\b(format|json|csv|xml|date|number|string|invalid)\b/.test(combined)) {
    gaps.push("Coverage gap: invalid data format behavior is not explicitly described.");
  }

  return gaps;
}

export function formatCaseId(counter) {
  return `TC-${String(counter).padStart(3, "0")}`;
}

function buildDefaultPrecondition(storySummary, environment) {
  return `${environment} is available for the scenario: ${shortenLabel(storySummary, 10)}`;
}

function buildDefaultPositiveStep(criterion, environment) {
  return `Run the happy-path flow in the ${environment} environment for: ${shortenLabel(criterion, 10)}`;
}

function buildDefaultPositiveExpected(criterion) {
  return `The observable outcome matches: ${normalizeWhitespace(criterion)}`;
}

function buildPositiveTestData(parsed, environment) {
  const numericHint = firstNumber(parsed.normalized);
  if (numericHint != null) {
    return `Use the valid boundary value ${numericHint} in the ${environment} environment.`;
  }
  return `Use valid data for the ${environment} environment.`;
}

function buildNegativeContext(parsed, storySummary, environment) {
  const lower = `${parsed.normalized} ${storySummary}`.toLowerCase();
  if (/\b(permission|access|unauthorized|forbidden|role)\b/.test(lower)) {
    return "The user has no permission for this action.";
  }
  if (/\b(timeout|network|offline|retry|latency)\b/.test(lower)) {
    return "The network is unavailable or times out.";
  }
  if (/\b(format|json|csv|xml|date|number|string|invalid)\b/.test(lower)) {
    return "The input data is malformed or the wrong format.";
  }
  if (/\bempty|null|blank|missing\b/.test(lower)) {
    return "The required value is missing or blank.";
  }
  return `The ${environment} environment starts from the same state as the happy path.`;
}

function buildInvalidInput(parsed) {
  const lower = parsed.normalized.toLowerCase();
  if (/\bempty|null|blank|missing\b/.test(lower)) {
    return "an empty or null payload";
  }
  if (/\bformat|json|csv|xml|date|number|string\b/.test(lower)) {
    return "an invalidly formatted payload";
  }
  if (/\bpermission|access|unauthorized|forbidden|role\b/.test(lower)) {
    return "a request from an unauthorized role";
  }
  if (/\btimeout|network|offline|retry|latency\b/.test(lower)) {
    return "a network timeout during submission";
  }
  return "a malformed or out-of-scope input";
}

function buildNegativeStep(parsed, environment) {
  return `Attempt the flow in ${environment} with ${buildInvalidInput(parsed)}.`;
}

function buildNegativeExpected(parsed) {
  const lower = parsed.normalized.toLowerCase();
  if (/\bpermission|access|unauthorized|forbidden|role\b/.test(lower)) {
    return "The system denies access and surfaces a clear authorization message without applying changes.";
  }
  if (/\btimeout|network|offline|retry|latency\b/.test(lower)) {
    return "The system reports the timeout or connectivity problem and does not commit partial changes.";
  }
  if (/\bformat|json|csv|xml|date|number|string\b/.test(lower)) {
    return "The system rejects the malformed input and surfaces a clear validation message.";
  }
  if (/\bempty|null|blank|missing\b/.test(lower)) {
    return "The system blocks submission and highlights the missing required fields.";
  }
  return "The system rejects the invalid input and leaves the stored state unchanged.";
}

function buildNegativeTestData(parsed, environment) {
  const lower = parsed.normalized.toLowerCase();
  if (/\bpermission|access|unauthorized|forbidden|role\b/.test(lower)) {
    return `Unauthorized role in ${environment}`;
  }
  if (/\btimeout|network|offline|retry|latency\b/.test(lower)) {
    return `Simulated network timeout in ${environment}`;
  }
  if (/\bformat|json|csv|xml|date|number|string\b/.test(lower)) {
    return `Malformed payload in ${environment}`;
  }
  if (/\bempty|null|blank|missing\b/.test(lower)) {
    return `Empty payload in ${environment}`;
  }
  return `Invalid payload in ${environment}`;
}

function buildEdgeStep(parsed, environment) {
  const lower = parsed.normalized.toLowerCase();
  if (/\bpermission|access|unauthorized|forbidden|role\b/.test(lower)) {
    return `Verify the lowest-privilege role in ${environment} and confirm access is denied appropriately.`;
  }
  if (/\btimeout|network|offline|retry|latency\b/.test(lower)) {
    return `Simulate a short network interruption in ${environment} and retry the action.`;
  }
  if (/\bformat|json|csv|xml|date|number|string\b/.test(lower)) {
    return `Send a boundary-format payload in ${environment} to verify validation handling.`;
  }
  if (/\bempty|null|blank|missing\b/.test(lower)) {
    return `Submit the action with the required field omitted in ${environment}.`;
  }
  return `Repeat the action twice in ${environment} to check duplicate or repeated execution behavior.`;
}

function buildEdgeExpected(parsed) {
  const lower = parsed.normalized.toLowerCase();
  if (/\bpermission|access|unauthorized|forbidden|role\b/.test(lower)) {
    return "The system denies access for the lowest-privilege role and leaves data unchanged.";
  }
  if (/\btimeout|network|offline|retry|latency\b/.test(lower)) {
    return "The system handles the interruption gracefully and either retries or surfaces a recoverable error.";
  }
  if (/\bformat|json|csv|xml|date|number|string\b/.test(lower)) {
    return "The system rejects the boundary-format input and surfaces a clear validation message.";
  }
  if (/\bempty|null|blank|missing\b/.test(lower)) {
    return "The system blocks submission and highlights the missing required field.";
  }
  return "The system keeps behavior stable under repeated execution and avoids duplicate side effects.";
}

function buildEdgeTestData(parsed, environment) {
  const lower = parsed.normalized.toLowerCase();
  if (/\bpermission|access|unauthorized|forbidden|role\b/.test(lower)) {
    return `Lowest-privilege role in ${environment}`;
  }
  if (/\btimeout|network|offline|retry|latency\b/.test(lower)) {
    return `Transient network interruption in ${environment}`;
  }
  if (/\bformat|json|csv|xml|date|number|string\b/.test(lower)) {
    return `Boundary-format payload in ${environment}`;
  }
  if (/\bempty|null|blank|missing\b/.test(lower)) {
    return `Missing required field in ${environment}`;
  }
  return `Repeated action sequence in ${environment}`;
}

function hasBoundaryHint(value) {
  return /\b(max(?:imum)?|min(?:imum)?|limit|threshold|at least|at most|no more than|up to|count|size|length|\d+)\b/i.test(value);
}

function buildBoundaryScenario(parsed, storySummary, environment) {
  const numeric = firstNumber(parsed.normalized);
  const lower = `${parsed.normalized} ${storySummary}`.toLowerCase();
  if (numeric != null) {
    const below = numeric - 1;
    const above = numeric + 1;
    return {
      step: `Verify the boundary values ${below}, ${numeric}, and ${above} in ${environment}.`,
      expectedResult: `The system accepts the boundary value ${numeric} and handles ${below} and ${above} according to the defined limit.`,
      testData: `Boundary values ${below}, ${numeric}, ${above}`
    };
  }
  if (/\bpermission|access|unauthorized|forbidden|role\b/.test(lower)) {
    return {
      step: `Verify the lowest-privilege role in ${environment} and confirm access is denied appropriately.`,
      expectedResult: "The system denies access for the lowest-privilege role and leaves data unchanged.",
      testData: "Lowest-privilege role"
    };
  }
  if (/\btimeout|network|offline|retry|latency\b/.test(lower)) {
    return {
      step: `Simulate a short network interruption in ${environment} and retry the action.`,
      expectedResult: "The system handles the interruption gracefully and either retries or surfaces a recoverable error.",
      testData: "Transient network interruption"
    };
  }
  return {
    step: `Repeat the action twice in ${environment} to check duplicate or repeated execution behavior.`,
    expectedResult: "The system keeps behavior stable under repeated execution and avoids duplicate side effects.",
    testData: "Repeated action sequence"
  };
}

function firstNumber(value) {
  const match = normalizeWhitespace(value).match(/\b(\d+)\b/);
  return match ? Number.parseInt(match[1], 10) : null;
}

function shortenLabel(value, maxWords) {
  const words = normalizeWhitespace(value).split(/\s+/).filter(Boolean);
  return words.slice(0, maxWords).join(" ");
}

function deriveSuiteLabel(storySummary) {
  const words = normalizeWhitespace(storySummary).split(/\s+/).filter(Boolean);
  return words.length > 0 ? words.slice(0, 6).join(" ") : "Acceptance Criterion";
}
