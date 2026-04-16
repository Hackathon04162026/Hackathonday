import { describe, expect, it } from "vitest";
import {
  buildTestCaseGenerationRequest,
  createTestCaseGenerationResponse,
  generateTestCases,
  loadTestCaseFixture,
  normalizeTestCaseGenerationResponse
} from "./testCaseGenerator.js";

describe("test case generators", () => {
  it("generates sequential TC ids and the required coverage summary", () => {
    const result = generateTestCases(buildTestCaseGenerationRequest());

    expect(result.testSuites).toHaveLength(3);
    expect(result.suites).toHaveLength(3);
    expect(result.testSuites[0].testCases.map((item) => item.id)).toEqual(["TC-001", "TC-002", "TC-003"]);
    expect(result.testSuites[1].testCases.map((item) => item.id)).toEqual(["TC-004", "TC-005", "TC-006"]);
    expect(result.summary.totalTestCases).toBe(9);
    expect(result.summary.positive).toBe(3);
    expect(result.summary.negative).toBe(3);
    expect(result.summary.edgeCases + result.summary.boundaryCases).toBe(3);
    expect(result.summary.gapList).toEqual(result.summary.gaps);
    expect(result.summary.untestableCriteria).toBe(0);
  });

  it("maps Gherkin clauses directly into preconditions, steps, and expected results", () => {
    const result = generateTestCases({
      storySummary: "As a refinement facilitator, I want to normalize notes so that I can commit a sprint-ready story.",
      acceptanceCriteria: [
        "Given messy notes, When the generator runs, Then the story output preserves the canonical ordering."
      ],
      storyTitle: "Refinement flow",
      environment: "qa"
    });

    const positiveCase = result.testSuites[0].testCases[0];
    expect(positiveCase.preconditions).toEqual(["messy notes"]);
    expect(positiveCase.steps).toEqual(["the generator runs"]);
    expect(positiveCase.expectedResult).toContain("preserves the canonical ordering");
  });

  it("flags vague criteria as untestable while still generating best-effort cases", () => {
    const result = generateTestCases({
      storySummary: "As a tester, I want the system to work properly so that I can verify it quickly.",
      acceptanceCriteria: ["Should work properly and be fast."],
      storyTitle: "Vague story",
      environment: "local"
    });

    expect(result.testSuites[0].untestable).toBe(true);
    expect(result.testSuites[0].rewriteSuggestion).toContain("Rewrite");
    expect(result.summary.untestableCriteria).toBe(1);
    expect(result.summary.gaps[0]).toContain("UNTESTABLE");
  });

  it("uses boundary case numbering and boundary values when the criterion includes a numeric limit", () => {
    const result = generateTestCases({
      storySummary: "As a product owner, I want to cap the backlog export at 5 items so that I can control payload size.",
      acceptanceCriteria: ["Should export no more than 5 items."],
      storyTitle: "Export cap",
      environment: "staging"
    });

    expect(result.testSuites[0].testCases[2].type).toBe("Boundary");
    expect(result.testSuites[0].testCases[2].testData).toContain("4, 5, 6");
  });

  it("wraps the generated suites in a UI-friendly response shape", () => {
    const response = createTestCaseGenerationResponse(buildTestCaseGenerationRequest());
    const normalized = normalizeTestCaseGenerationResponse(response);

    expect(response.suites).toHaveLength(3);
    expect(normalized.testSuites).toHaveLength(3);
    expect(normalized.summary.positiveCount).toBe(3);
  });

  it("loads the checked-in test-case fixture through a fetch implementation", async () => {
    const response = await loadTestCaseFixture({
      fetchImpl: async () => ({
        ok: true,
        status: 200,
        json: async () => createTestCaseGenerationResponse(buildTestCaseGenerationRequest())
      })
    });

    expect(response.testSuites).toHaveLength(3);
    expect(response.summary.totalTestCases).toBe(9);
  });
});
