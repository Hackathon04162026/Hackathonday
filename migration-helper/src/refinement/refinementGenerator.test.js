import { describe, expect, it } from "vitest";
import {
  buildRefinementSampleRequest,
  createRefinementStoryPackage,
  createRefinementStoryResponse,
  detectMisalignment,
  extractAcceptanceCriteria,
  loadRefinementStoryFixture,
  normalizeRefinementStoryResponse
} from "./refinementGenerator.js";

describe("refinement generators", () => {
  it("builds a canonical story package in the required field order", () => {
    const result = createRefinementStoryPackage(buildRefinementSampleRequest());

    expect(Object.keys(result)).toEqual([
      "problemStatement",
      "storySummary",
      "acceptanceCriteria",
      "dependencies",
      "references",
      "estimation",
      "definitionOfReadyValidation",
      "gaps",
      "normalizationNotes",
      "parentEpicLink",
      "labels",
      "label",
      "sprint"
    ]);
    expect(result.storySummary).toMatch(/^As a .+, I want to .+ so that I can .+\.$/);
    expect(result.acceptanceCriteria[0]).toContain("canonical section ordering");
    expect(result.definitionOfReadyValidation[5]).toContain("Parent Epic Link identified");
    expect(result.parentEpicLink).toBe("EPIC-101");
    expect(result.label).toBe("refinement");
  });

  it("detects misalignment and preserves split guidance when the estimate is too high", () => {
    const result = createRefinementStoryPackage({
      notes: "Problem: We need to reduce rework. AC: preserve ordering.",
      candidateProblemStatement: "The team needs to reduce rework.",
      candidateStorySummary: "As a product owner, I want to onboard a new hire so that I can improve access setup.",
      parentEpicLink: "",
      labels: [],
      sprint: "",
      estimatePoints: 8,
      references: []
    });

    expect(result.gaps.join(" ")).toContain("misaligned");
    expect(result.gaps.join(" ")).toContain("split the work");
    expect(result.gaps.join(" ")).toContain("Parent Epic Link missing");
    expect(result.gaps.join(" ")).toContain("Estimate exceeds 5 story points; split the work before sprint commitment");
    expect(result.definitionOfReadyValidation).toContain("[ ] Parent Epic Link identified");
    expect(result.definitionOfReadyValidation).toContain("[ ] Estimation <= 5 story points (if larger, recommend splitting)");
    expect(result.normalizationNotes.join(" ")).toContain("Split guidance");
  });

  it("keeps acceptance criteria in source order when extracted from notes", () => {
    const criteria = extractAcceptanceCriteria([
      "AC: First item",
      "- AC: Second item",
      "Should keep the third item",
      "This line should not move the order"
    ].join("\n"));

    expect(criteria).toEqual([
      "First item",
      "Second item",
      "Should keep the third item",
      "This line should not move the order"
    ]);
  });

  it("does not invent acceptance criteria or rewrite a noncanonical candidate story summary", () => {
    const result = createRefinementStoryPackage({
      notes: "Problem: Refinement notes are still unclear.",
      candidateStorySummary: "Help the team align on scope.",
      parentEpicLink: "",
      labels: [],
      sprint: "",
      references: []
    });

    expect(result.acceptanceCriteria).toEqual([]);
    expect(result.storySummary).toBe("Help the team align on scope.");
    expect(result.gaps.join(" ")).toContain("Acceptance criteria missing");
    expect(result.gaps.join(" ")).toContain("story summary does not follow the required");
    expect(result.definitionOfReadyValidation).toContain("[ ] User story follows \"As a / I want / So that\" format");
  });

  it("flags misalignment based on keyword overlap", () => {
    const result = detectMisalignment(
      "Need to reduce rework in refinement.",
      "As a tester, I want to generate reports so that I can verify coverage."
    );

    expect(result.isMisaligned).toBe(true);
    expect(result.problemKeywords.length).toBeGreaterThan(0);
    expect(result.storyKeywords.length).toBeGreaterThan(0);
  });

  it("wraps the package in a UI-friendly response shape", () => {
    const response = createRefinementStoryResponse(buildRefinementSampleRequest());
    const normalized = normalizeRefinementStoryResponse(response);

    expect(response.stories).toHaveLength(1);
    expect(normalized.stories[0].storySummary).toContain("As a refinement facilitator");
  });

  it("loads a refinement story fixture from a fetch implementation", async () => {
    const response = await loadRefinementStoryFixture({
      fetchImpl: async () => ({
        ok: true,
        status: 200,
        json: async () => createRefinementStoryResponse(buildRefinementSampleRequest())
      })
    });

    expect(response.stories).toHaveLength(1);
    expect(response.stories[0].parentEpicLink).toBe("EPIC-101");
  });
});
