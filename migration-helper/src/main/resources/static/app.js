"use strict";

const state = {
  mode: new URLSearchParams(window.location.search).get("mode") === "live" ? "live" : "mock",
  scans: [],
  selectedScan: null,
  selectedReport: null,
  scanFilters: {
    search: "",
    status: "",
    source: "",
    requestedBy: "",
    sort: "newest"
  },
  reportFilters: {
    search: "",
    type: "all"
  }
};

const elements = {};

document.addEventListener("DOMContentLoaded", () => {
  cacheElements();
  bindEvents();
  updateModeIndicator();
  bootstrap().catch(handleUiError);
});

function cacheElements() {
  elements.notice = document.getElementById("app-notice");
  elements.modeIndicator = document.getElementById("mode-indicator");
  elements.scanListStatus = document.getElementById("scan-list-status");
  elements.scanResultsBody = document.getElementById("scan-results-body");
  elements.summaryCards = document.getElementById("summary-cards");
  elements.scanFilterForm = document.getElementById("scan-filter-form");
  elements.reportFilterForm = document.getElementById("report-filter-form");
  elements.archiveForm = document.getElementById("archive-scan-form");
  elements.pathForm = document.getElementById("path-scan-form");
  elements.drawer = document.getElementById("scan-detail-drawer");
  elements.detailId = document.getElementById("scan-detail-id");
  elements.detailName = document.getElementById("scan-detail-name");
  elements.detailStatus = document.getElementById("scan-detail-status");
  elements.detailRequestedBy = document.getElementById("scan-detail-requested-by");
  elements.reportSummary = document.getElementById("scan-detail-report-summary");
  elements.reportResultsEmpty = document.getElementById("report-results-empty");
  elements.reportResultsWrap = document.getElementById("report-results-table-wrap");
  elements.reportResultsBody = document.getElementById("report-results-body");
  elements.copyScanJson = document.getElementById("copy-scan-json");
  elements.copyReportJson = document.getElementById("copy-report-json");
  elements.downloadReportJson = document.getElementById("download-report-json");
}

function bindEvents() {
  document.getElementById("refresh-scans")?.addEventListener("click", () => {
    bootstrap().catch(handleUiError);
  });

  document.getElementById("archive-scan-submit")?.addEventListener("click", () => {
    submitArchiveScan().catch(handleUiError);
  });

  document.getElementById("path-scan-submit")?.addEventListener("click", () => {
    submitPathScan().catch(handleUiError);
  });

  document.getElementById("close-scan-detail")?.addEventListener("click", closeDrawer);
  document.getElementById("export-scans-json")?.addEventListener("click", () => exportJson("scan-list", state.scans));
  document.getElementById("export-report-json")?.addEventListener("click", () => exportJson("report", state.selectedReport));
  elements.copyScanJson?.addEventListener("click", () => copyJson("selected-scan", state.selectedScan));
  elements.copyReportJson?.addEventListener("click", () => copyJson("selected-report", state.selectedReport));

  elements.scanFilterForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    syncScanFilters();
    renderScanTable();
  });

  elements.scanFilterForm?.addEventListener("reset", () => {
    queueMicrotask(() => {
      state.scanFilters = { search: "", status: "", source: "", requestedBy: "", sort: "newest" };
      renderScanTable();
    });
  });

  elements.reportFilterForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    syncReportFilters();
    renderReportResults();
  });

  elements.reportFilterForm?.addEventListener("reset", () => {
    queueMicrotask(() => {
      state.reportFilters = { search: "", type: "all" };
      renderReportResults();
    });
  });
}

async function bootstrap() {
  setNotice("Loading scans and Worker 6 report data...", "info");
  await loadScans();

  if (!state.selectedScan && state.scans.length > 0) {
    await selectScan(state.scans[0].id);
  } else {
    renderSummaryCards();
    renderScanTable();
    renderReportResults();
  }

  setNotice(
    state.mode === "live"
      ? "Live API mode is active. The UI is calling the running Spring Boot endpoints."
      : "Mock mode is active. The UI is using the checked-in JSON payloads under /mock-data/.",
    "info"
  );
}

async function loadScans() {
  elements.scanListStatus.textContent = "Loading scans...";
  state.scans = state.mode === "live"
    ? await fetchJson("/api/scans")
    : await fetchJson("/mock-data/scan-list.json");
  renderSummaryCards();
  renderScanTable();
}

async function selectScan(id) {
  const scan = state.scans.find((entry) => entry.id === id);
  if (!scan) {
    return;
  }

  if (state.mode === "mock" && id !== "scan-local-001") {
    state.selectedScan = createDetailFromSummary(scan);
    state.selectedReport = createMockReportFromDetail(state.selectedScan);
  } else {
    state.selectedScan = state.mode === "live"
      ? await fetchJson(`/api/scans/${id}`)
      : await fetchJson("/mock-data/scan-detail.json");

    state.selectedReport = state.mode === "live"
      ? await fetchJson(`/api/scans/${id}/report`)
      : await fetchJson("/mock-data/scan-report.json");
  }

  renderSummaryCards();
  renderScanTable();
  renderDetail();
  renderReportResults();
  openDrawer();
  elements.scanListStatus.textContent = `Loaded ${scan.displayName}.`;
}

async function submitArchiveScan() {
  const payload = readFormValues(elements.archiveForm, ["uploadedArchiveToken", "sourceFilename", "sizeBytes", "displayName", "requestedBy"]);
  payload.sizeBytes = Number(payload.sizeBytes || 0);

  const response = state.mode === "live"
    ? await fetchJson("/api/scans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      })
    : createMockArchiveScan(payload);

  upsertScan(response);
  elements.archiveForm.reset();

  if (state.mode === "live") {
    await selectScan(response.id);
  } else {
    openDrawer();
  }

  setNotice(`Queued archive scan ${response.displayName}.`, "success");
}

async function submitPathScan() {
  const payload = readFormValues(elements.pathForm, ["path", "displayName", "requestedBy"]);

  const response = state.mode === "live"
    ? await fetchJson("/api/scans/path", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      })
    : createMockPathScan(payload);

  upsertScan(response);
  elements.pathForm.reset();

  if (state.mode === "live") {
    await selectScan(response.id);
  } else {
    openDrawer();
  }

  setNotice(`Queued path scan ${response.displayName}.`, "success");
}

function upsertScan(detailResponse) {
  const summary = {
    id: detailResponse.id,
    status: detailResponse.status,
    sourceType: detailResponse.sourceType,
    displayName: detailResponse.displayName,
    requestedBy: detailResponse.requestedBy,
    createdAt: detailResponse.createdAt,
    updatedAt: detailResponse.updatedAt,
    warnings: detailResponse.warnings || []
  };

  const existingIndex = state.scans.findIndex((scan) => scan.id === summary.id);
  if (existingIndex >= 0) {
    state.scans.splice(existingIndex, 1, summary);
  } else {
    state.scans.unshift(summary);
  }

  state.selectedScan = detailResponse;
  state.selectedReport = createMockReportFromDetail(detailResponse);
  renderSummaryCards();
  renderScanTable();
  renderDetail();
  renderReportResults();
}

function renderSummaryCards() {
  const totals = {
    totalScans: state.scans.length,
    pendingScans: state.scans.filter((scan) => !isComplete(scan.status)).length,
    completeScans: state.scans.filter((scan) => isComplete(scan.status)).length,
    reportReadyScans: state.scans.filter((scan) => isReportReady(scan.status)).length
  };

  for (const [key, value] of Object.entries(totals)) {
    const node = elements.summaryCards?.querySelector(`[data-summary-key="${key}"] [data-value]`);
    if (node) {
      node.textContent = String(value);
    }
  }
}

function renderScanTable() {
  const filtered = applyScanFilters(state.scans);
  elements.scanResultsBody.innerHTML = "";

  if (filtered.length === 0) {
    elements.scanResultsBody.innerHTML = '<tr id="scan-results-empty"><td colspan="6">No scans match the current filters.</td></tr>';
    return;
  }

  for (const scan of filtered) {
    const row = document.createElement("tr");
    if (state.selectedScan?.id === scan.id) {
      row.classList.add("row-selected");
    }

    row.innerHTML = `
      <td>
        <strong>${escapeHtml(scan.displayName || scan.id)}</strong>
        <span class="muted-line">${escapeHtml(scan.id)}</span>
      </td>
      <td>${escapeHtml(prettySource(scan.sourceType))}</td>
      <td>${escapeHtml(scan.requestedBy || "system")}</td>
      <td><span class="${badgeClassForStatus(scan.status)}">${escapeHtml(scan.status || "UNKNOWN")}</span></td>
      <td>${escapeHtml(formatDate(scan.updatedAt || scan.createdAt))}</td>
      <td><button type="button" class="secondary" data-scan-id="${escapeHtml(scan.id)}">Open</button></td>
    `;

    row.querySelector("button")?.addEventListener("click", () => {
      selectScan(scan.id).catch(handleUiError);
    });

    elements.scanResultsBody.appendChild(row);
  }
}

function renderDetail() {
  if (!state.selectedScan) {
    closeDrawer();
    return;
  }

  elements.detailId.textContent = state.selectedScan.id || "-";
  elements.detailName.textContent = state.selectedScan.displayName || "-";
  elements.detailStatus.textContent = state.selectedScan.status || "-";
  elements.detailRequestedBy.textContent = state.selectedScan.requestedBy || "-";

  const lifecycle = Array.isArray(state.selectedScan.lifecycle) ? state.selectedScan.lifecycle.join(" -> ") : "No lifecycle data";
  const warningItems = (state.selectedScan.warnings || [])
    .map((warning) => `<li><strong>${escapeHtml(warning.code)}</strong>: ${escapeHtml(warning.message)}</li>`)
    .join("");

  const report = state.selectedReport;
  elements.reportSummary.innerHTML = report ? `
    <div class="stack">
      <div class="pill primary">${escapeHtml(report.applicationName || "Migration Helper")} report</div>
      <div class="card">
        <div class="card-body stack">
          <div><strong>Workspace:</strong> ${escapeHtml(report.workspace?.normalizedWorkspacePath || "n/a")}</div>
          <div><strong>Normalization:</strong> ${escapeHtml(report.workspace?.normalizationStatus || "n/a")}</div>
          <div><strong>Generated:</strong> ${escapeHtml(formatDate(report.generatedAt))}</div>
          <div><strong>Detectors:</strong> ${String((report.detectors || []).length)}</div>
          <div><strong>Policies:</strong> ${String((report.policyStatuses || []).length)}</div>
          <div><strong>Recommendations:</strong> ${String((report.recommendations || []).length)}</div>
        </div>
      </div>
      <div class="card">
        <div class="card-body">
          <strong>Lifecycle</strong>
          <div class="muted-line">${escapeHtml(lifecycle)}</div>
        </div>
      </div>
      <div class="card">
        <div class="card-body">
          <strong>Warnings</strong>
          <ul>${warningItems || "<li>No warnings reported.</li>"}</ul>
        </div>
      </div>
    </div>
  ` : "<p id=\"scan-detail-report-placeholder\">Select a scan to load the normalized report.</p>";

  syncDownloadLink();
}

function renderReportResults() {
  const rows = flattenReport(state.selectedReport);
  const filtered = applyReportFilters(rows);

  elements.reportResultsBody.innerHTML = "";
  elements.reportResultsWrap.hidden = filtered.length === 0;
  elements.reportResultsEmpty.hidden = filtered.length > 0;

  if (filtered.length === 0) {
    return;
  }

  for (const row of filtered) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><span class="result-type ${escapeHtml(row.type)}">${escapeHtml(row.type)}</span></td>
      <td>${escapeHtml(row.ecosystem)}</td>
      <td>${escapeHtml(row.component)}</td>
      <td>${escapeHtml(row.version)}</td>
      <td>${escapeHtml(row.notes)}</td>
    `;
    elements.reportResultsBody.appendChild(tr);
  }
}

function flattenReport(report) {
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

function applyScanFilters(scans) {
  syncScanFilters();
  const search = state.scanFilters.search.toLowerCase();

  return scans
    .filter((scan) => {
      const matchesSearch = !search || [scan.id, scan.displayName, scan.requestedBy, scan.sourceType, scan.status]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(search);

      const matchesStatus = !state.scanFilters.status || normalizeStatus(scan.status) === state.scanFilters.status;
      const matchesSource = !state.scanFilters.source || normalizeSource(scan.sourceType) === state.scanFilters.source;
      const matchesRequestedBy = !state.scanFilters.requestedBy
        || String(scan.requestedBy || "").toLowerCase().includes(state.scanFilters.requestedBy.toLowerCase());

      return matchesSearch && matchesStatus && matchesSource && matchesRequestedBy;
    })
    .sort(compareScans);
}

function applyReportFilters(rows) {
  syncReportFilters();
  const search = state.reportFilters.search.toLowerCase();

  return rows.filter((row) => {
    const matchesType = state.reportFilters.type === "all" || row.type === state.reportFilters.type;
    const matchesSearch = !search || [row.type, row.ecosystem, row.component, row.version, row.notes]
      .join(" ")
      .toLowerCase()
      .includes(search);
    return matchesType && matchesSearch;
  });
}

function syncScanFilters() {
  const formData = new FormData(elements.scanFilterForm);
  state.scanFilters = {
    search: String(formData.get("search") || ""),
    status: String(formData.get("status") || ""),
    source: String(formData.get("source") || ""),
    requestedBy: String(formData.get("requestedBy") || ""),
    sort: String(formData.get("sort") || "newest")
  };
}

function syncReportFilters() {
  const formData = new FormData(elements.reportFilterForm);
  state.reportFilters = {
    search: String(formData.get("search") || ""),
    type: String(formData.get("type") || "all")
  };
}

function compareScans(left, right) {
  if (state.scanFilters.sort === "oldest") {
    return dateValue(left.createdAt) - dateValue(right.createdAt);
  }

  if (state.scanFilters.sort === "name") {
    return String(left.displayName || left.id).localeCompare(String(right.displayName || right.id));
  }

  if (state.scanFilters.sort === "status") {
    return String(left.status || "").localeCompare(String(right.status || ""));
  }

  return dateValue(right.updatedAt || right.createdAt) - dateValue(left.updatedAt || left.createdAt);
}

function openDrawer() {
  elements.drawer.hidden = false;
  elements.drawer.dataset.state = "open";
}

function closeDrawer() {
  elements.drawer.hidden = true;
  elements.drawer.dataset.state = "closed";
}

function updateModeIndicator() {
  elements.modeIndicator.textContent = state.mode === "live" ? "Live API mode" : "Mock mode";
  elements.modeIndicator.className = state.mode === "live" ? "pill success" : "pill info";
}

function exportJson(label, payload) {
  if (!payload) {
    setNotice(`Nothing is available to export for ${label}.`, "warning");
    return;
  }

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${label}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
  setNotice(`Exported ${label}.json.`, "success");
}

async function copyJson(label, payload) {
  if (!payload) {
    setNotice(`Nothing is available to copy for ${label}.`, "warning");
    return;
  }

  if (!navigator.clipboard?.writeText) {
    setNotice(`Clipboard copy is not available in this browser for ${label}.`, "warning");
    return;
  }

  await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
  setNotice(`Copied ${label} to the clipboard.`, "success");
}

function syncDownloadLink() {
  if (!state.selectedReport) {
    elements.downloadReportJson.href = "#";
    elements.downloadReportJson.setAttribute("aria-disabled", "true");
    return;
  }

  const blob = new Blob([JSON.stringify(state.selectedReport, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  elements.downloadReportJson.href = url;
  elements.downloadReportJson.download = `${state.selectedReport.id || "scan-report"}.json`;
  elements.downloadReportJson.setAttribute("aria-disabled", "false");
}

function setNotice(message, tone) {
  elements.notice.textContent = message;
  elements.notice.className = `notice ${tone ? `notice-${tone}` : ""}`.trim();
}

function handleUiError(error) {
  console.error(error);
  setNotice(error?.message || "The UI hit an unexpected error.", "danger");
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`Request failed for ${url}: ${response.status}`);
  }
  return response.json();
}

function readFormValues(form, fields) {
  const formData = new FormData(form);
  const result = {};

  for (const field of fields) {
    const value = formData.get(field);
    if (value !== null && String(value).trim() !== "") {
      result[field] = String(value).trim();
    }
  }

  return result;
}

function createMockArchiveScan(payload) {
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

function createMockPathScan(payload) {
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

function createDetailFromSummary(scan) {
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

function createMockReportFromDetail(detail) {
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

function prettySource(sourceType) {
  if (sourceType === "ARCHIVE_UPLOAD") {
    return "Archive upload";
  }
  if (sourceType === "LOCAL_PATH") {
    return "Path scan";
  }
  return sourceType || "Unknown";
}

function normalizeStatus(status) {
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

function normalizeSource(sourceType) {
  if (sourceType === "ARCHIVE_UPLOAD") {
    return "archive";
  }
  if (sourceType === "LOCAL_PATH") {
    return "path";
  }
  return "";
}

function isComplete(status) {
  return normalizeStatus(status) === "complete";
}

function isReportReady(status) {
  return ["complete", "running"].includes(normalizeStatus(status));
}

function badgeClassForStatus(status) {
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

function formatDate(value) {
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

function dateValue(value) {
  const parsed = new Date(value || 0).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

function cryptoRandomId() {
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID().slice(0, 8);
  }
  return Math.random().toString(16).slice(2, 10);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
