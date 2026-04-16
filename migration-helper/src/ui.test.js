import { describe, expect, it } from "vitest";
import {
  DEFAULT_REPORT_FILTERS,
  DEFAULT_SCAN_FILTERS,
  applyReportFilters,
  applyScanFilters,
  calculateSummary,
  createDetailFromSummary,
  flattenReport,
  normalizeStatus,
  prettySource
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

  it("preserves sourceReference when rebuilding detail from a path scan summary", () => {
    const detail = createDetailFromSummary({
      id: "scan-path-1",
      status: "COMPLETED",
      sourceType: "LOCAL_PATH",
      displayName: "Demo label",
      requestedBy: "cli",
      sourceReference: "C:/repos/demo",
      createdAt: "2026-04-16T19:00:00Z",
      updatedAt: "2026-04-16T19:01:00Z"
    });

    expect(detail.sourceReference).toBe("C:/repos/demo");
  });
});
