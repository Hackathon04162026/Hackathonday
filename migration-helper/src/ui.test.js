import { describe, expect, it } from "vitest";
import {
  DEFAULT_REPORT_FILTERS,
  DEFAULT_SCAN_FILTERS,
  applyReportFilters,
  applyScanFilters,
  calculateSummary,
  createDetailFromSummary,
  createMockArchiveScan,
  createPlanningWorkspaceDefaults,
  createWorkspaceHubFallback,
  buildPlanningWorkspaceOutputs,
  flattenReport,
  normalizeStatus,
  normalizeWorkspaceHub,
  prettySource,
  summarizePlanningWorkspace,
  summarizeOnboardingWorkspace,
  summarizePlanningHub,
  summarizeRefinementStory,
  summarizeTestCaseBundle
} from "./ui";

describe("ui helpers", () => {
  it("normalizes status values for filtering", () => {
    expect(normalizeStatus("COMPLETED")).toBe("complete");
    expect(normalizeStatus("ANALYZING")).toBe("running");
    expect(normalizeStatus("FAILED")).toBe("failed");
  });

  it("filters scans by text and source", () => {
    const scans = [
      { id: "1", displayName: "Archive Demo", requestedBy: "sam", sourceType: "ARCHIVE_UPLOAD", status: "COMPLETED" },
      { id: "2", displayName: "Path Demo", requestedBy: "alex", sourceType: "LOCAL_PATH", status: "ANALYZING" }
    ];

    const filtered = applyScanFilters(scans, {
      ...DEFAULT_SCAN_FILTERS,
      search: "path",
      source: "path"
    });

    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe("2");
  });

  it("matches archive scans when the archive source filter is used", () => {
    const scans = [
      { id: "archive", displayName: "Archive Demo", requestedBy: "sam", sourceType: "ARCHIVE_UPLOAD", status: "ANALYZING" },
      { id: "path", displayName: "Path Demo", requestedBy: "alex", sourceType: "LOCAL_PATH", status: "COMPLETED" }
    ];

    const filtered = applyScanFilters(scans, {
      ...DEFAULT_SCAN_FILTERS,
      source: "archive"
    });

    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe("archive");
  });

  it("flattens and filters report rows", () => {
    const rows = flattenReport({
      detectors: [{ ecosystem: "python", component: "fastapi", detectedVersion: "0.110.0", confidence: "HIGH" }],
      warnings: [{ code: "WARN", severity: "LOW", message: "Heads up" }]
    });

    const filtered = applyReportFilters(rows, {
      ...DEFAULT_REPORT_FILTERS,
      type: "warning"
    });

    expect(rows).toHaveLength(2);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].component).toBe("WARN");
  });

  it("calculates summary totals", () => {
    const summary = calculateSummary([
      { status: "COMPLETED" },
      { status: "ANALYZING" },
      { status: "FAILED" }
    ]);

    expect(summary.totalScans).toBe(3);
    expect(summary.completeScans).toBe(1);
    expect(summary.reportReadyScans).toBe(2);
  });

  it("pretty prints source labels", () => {
    expect(prettySource("ARCHIVE_UPLOAD")).toBe("Archive upload");
    expect(prettySource("LOCAL_PATH")).toBe("Path scan");
  });

  it("creates archive scans with archive metadata", () => {
    const result = createMockArchiveScan({
      sourceFilename: "legacy-service.zip",
      displayName: "Legacy Service Archive",
      requestedBy: "sam"
    });

    expect(result.sourceType).toBe("ARCHIVE_UPLOAD");
    expect(result.sourceReference).toBe("legacy-service.zip");
    expect(result.lifecycle).toContain("INGESTING");
  });

  it("preserves summary status and source metadata when building detail records", () => {
    const detail = createDetailFromSummary({
      id: "scan-archive-002",
      status: "ANALYZING",
      sourceType: "ARCHIVE_UPLOAD",
      displayName: "Legacy Service Archive",
      requestedBy: "sam",
      sourceReference: "legacy-service.zip",
      createdAt: "2026-04-16T18:01:45Z",
      updatedAt: "2026-04-16T18:02:10Z"
    });

    expect(detail.status).toBe("ANALYZING");
    expect(detail.sourceReference).toBe("legacy-service.zip");
    expect(detail.completedAt).toBeNull();
    expect(detail.lifecycle).toEqual(["QUEUED", "INGESTING", "ANALYZING"]);
  });

  it("normalizes the planning hub fallback into stable counts", () => {
    const hub = createWorkspaceHubFallback();
    const planning = summarizePlanningHub(hub.planning);

    expect(planning.reviewStages).toBe(4);
    expect(planning.epics).toBe(2);
    expect(planning.features).toBe(3);
    expect(planning.stories).toBe(3);
  });

  it("normalizes refinement, test case, and onboarding workspace bundles", () => {
    const hub = normalizeWorkspaceHub({
      refinement: {
        problemStatement: "Problem",
        storySummary: "As a tester, I want to verify the output so that I can commit safely.",
        acceptanceCriteria: "Given a note, When it is normalized, Then the story stays aligned.",
        references: null,
        dependencies: null
      },
      testCases: {
        testSuites: [
          {
            name: "Suite A",
            testCases: [
              { priority: "High", type: "Positive", steps: ["Open"], expectedResult: "Works", testData: "A" }
            ]
          }
        ]
      },
      onboarding: {
        answers: [
          {
            role: "Developer",
            journeyType: "FIRST_WEEK",
            citedDocuments: [{ documentName: "Guide", section: "Setup" }]
          }
        ]
      }
    });

    expect(summarizeRefinementStory(hub.refinement)).toEqual({
      acceptanceCriteria: 1,
      dependencies: 1,
      references: 1,
      gaps: 1
    });
    expect(summarizeTestCaseBundle(hub.testCases)).toEqual({
      totalTestCases: 1,
      positive: 1,
      negative: 0,
      edgeCases: 0
    });
    expect(summarizeOnboardingWorkspace(hub.onboarding)).toEqual({
      answers: 1,
      firstInteraction: 2,
      fallback: "I couldn't find this in our documentation. You may want to ask your team lead or #team-platform."
    });
    expect(hub.onboarding.answers[0].citedDocuments[0].documentName).toBe("Guide");
  });

  it("creates planning defaults and derived outputs for the new hub", () => {
    const defaults = createPlanningWorkspaceDefaults();
    const summary = summarizePlanningWorkspace(defaults.plan);
    const outputs = buildPlanningWorkspaceOutputs({
      refinementRequest: defaults.refinementRequest,
      testCaseRequest: defaults.testCaseRequest,
      onboardingRequest: defaults.onboardingRequest
    });

    expect(summary.currentStage).toBe("EPIC_REVIEW");
    expect(summary.counts.epics).toBe(3);
    expect(outputs.refinement.acceptanceCriteria.length).toBeGreaterThan(0);
    expect(outputs.testCases.summary.totalTestCases).toBeGreaterThan(0);
    expect(outputs.onboarding.agentName).toBe("Confluence-grounded Onboarding Agent");
  });
});
