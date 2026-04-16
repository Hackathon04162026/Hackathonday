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
    lifecycle: ["QUEUED", "ANALYZING", "AGGREGATING", "COMPLETED"],
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
  return {
    id: scan.id,
    status: scan.status,
    sourceType: scan.sourceType,
    displayName: scan.displayName,
    requestedBy: scan.requestedBy,
    sourceReference: scan.displayName,
    createdAt: scan.createdAt,
    startedAt: scan.createdAt,
    completedAt: scan.updatedAt,
    updatedAt: scan.updatedAt,
    lifecycle: ["QUEUED", "ANALYZING", "AGGREGATING", "COMPLETED"],
    warnings: scan.warnings || []
  };
}

export function createMockReportFromDetail(detail) {
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
      normalizedWorkspacePath: detail.sourceReference,
      normalizationStatus: "READY"
    },
    warnings: detail.warnings || [],
    detectors: [],
    policyStatuses: [],
    recommendations: []
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

function dateValue(value) {
  const parsed = new Date(value || 0).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

function cryptoRandomId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID().slice(0, 8);
  }
  return Math.random().toString(16).slice(2, 10);
}
