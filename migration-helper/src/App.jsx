import { useEffect, useMemo, useState } from "react";
import {
  DEFAULT_REPORT_FILTERS,
  DEFAULT_SCAN_FILTERS,
  applyReportFilters,
  applyScanFilters,
  badgeClassForStatus,
  buildDownloadHref,
  calculateSummary,
  copyJson,
  createDetailFromSummary,
  createMockArchiveScan,
  createMockPathScan,
  createMockReportFromDetail,
  downloadJson,
  fetchJson,
  flattenReport,
  formatDate,
  prettySource
} from "./ui";

const EMPTY_ARCHIVE_FORM = {
  uploadedArchiveToken: "",
  sourceFilename: "",
  sizeBytes: "",
  displayName: "",
  requestedBy: ""
};

const EMPTY_PATH_FORM = {
  path: "",
  displayName: "",
  requestedBy: ""
};

export default function App() {
  const [scans, setScans] = useState([]);
  const [selectedScan, setSelectedScan] = useState(null);
  const [selectedReport, setSelectedReport] = useState(null);
  const [scanFilters, setScanFilters] = useState(DEFAULT_SCAN_FILTERS);
  const [reportFilters, setReportFilters] = useState(DEFAULT_REPORT_FILTERS);
  const [notice, setNotice] = useState({ tone: "info", message: "Loading scans and report data..." });
  const [scanListStatus, setScanListStatus] = useState("Loading scans...");
  const [archiveForm, setArchiveForm] = useState(EMPTY_ARCHIVE_FORM);
  const [pathForm, setPathForm] = useState(EMPTY_PATH_FORM);

  useEffect(() => {
    void bootstrap();
  }, []);

  const summary = useMemo(() => calculateSummary(scans), [scans]);
  const filteredScans = useMemo(() => applyScanFilters(scans, scanFilters), [scans, scanFilters]);
  const filteredReportRows = useMemo(
    () => applyReportFilters(flattenReport(selectedReport), reportFilters),
    [selectedReport, reportFilters]
  );
  const reportDownloadHref = useMemo(() => buildDownloadHref(selectedReport), [selectedReport]);

  useEffect(() => {
    return () => {
      if (reportDownloadHref) {
        URL.revokeObjectURL(reportDownloadHref);
      }
    };
  }, [reportDownloadHref]);

  async function bootstrap() {
    try {
      const loadedScans = await loadScans();
      if (loadedScans.length > 0) {
        await selectScan(loadedScans[0].id, loadedScans);
      }
      setNotice({
        tone: "info",
        message: "Static mode is active. The React app is using the checked-in JSON payloads under /mock-data/."
      });
    } catch (error) {
      handleUiError(error);
    }
  }

  async function loadScans() {
    setScanListStatus("Loading scans...");
    const loadedScans = await fetchJson("./mock-data/scan-list.json");
    setScans(loadedScans);
    setScanListStatus(`Loaded ${loadedScans.length} scan${loadedScans.length === 1 ? "" : "s"}.`);
    return loadedScans;
  }

  async function selectScan(id, availableScans = scans) {
    const scan = availableScans.find((entry) => entry.id === id);
    if (!scan) {
      return;
    }

    let detail;
    let report;
    if (id !== "scan-local-001") {
      detail = createDetailFromSummary(scan);
      report = createMockReportFromDetail(detail);
    } else {
      detail = await fetchJson("./mock-data/scan-detail.json");
      report = await fetchJson("./mock-data/scan-report.json");
    }

    setSelectedScan(detail);
    setSelectedReport(report);
    setScanListStatus(`Loaded ${scan.displayName}.`);
  }

  async function submitArchiveScan(event) {
    event.preventDefault();
    try {
      const payload = { ...archiveForm, sizeBytes: Number(archiveForm.sizeBytes || 0) };
      const response = createMockArchiveScan(payload);
      upsertScan(response);
      setArchiveForm(EMPTY_ARCHIVE_FORM);
      setNotice({ tone: "success", message: `Queued archive scan ${response.displayName}.` });
    } catch (error) {
      handleUiError(error);
    }
  }

  async function submitPathScan(event) {
    event.preventDefault();
    try {
      const response = createMockPathScan(pathForm);
      upsertScan(response);
      setPathForm(EMPTY_PATH_FORM);
      setNotice({ tone: "success", message: `Queued path scan ${response.displayName}.` });
    } catch (error) {
      handleUiError(error);
    }
  }

  function upsertScan(detailResponse) {
    const summaryRecord = {
      id: detailResponse.id,
      status: detailResponse.status,
      sourceType: detailResponse.sourceType,
      displayName: detailResponse.displayName,
      requestedBy: detailResponse.requestedBy,
      createdAt: detailResponse.createdAt,
      updatedAt: detailResponse.updatedAt,
      warnings: detailResponse.warnings || []
    };
    setScans((current) => {
      const existingIndex = current.findIndex((scan) => scan.id === summaryRecord.id);
      if (existingIndex === -1) {
        return [summaryRecord, ...current];
      }
      const next = [...current];
      next.splice(existingIndex, 1, summaryRecord);
      return next;
    });
    setSelectedScan(detailResponse);
    setSelectedReport(createMockReportFromDetail(detailResponse));
    setScanListStatus(`Loaded ${detailResponse.displayName}.`);
  }

  function handleUiError(error) {
    console.error(error);
    setNotice({ tone: "danger", message: error?.message || "The UI hit an unexpected error." });
  }

  async function handleCopy(label, payload) {
    if (!payload) {
      setNotice({ tone: "warning", message: `Nothing is available to copy for ${label}.` });
      return;
    }
    try {
      await copyJson(payload);
      setNotice({ tone: "success", message: `Copied ${label} to the clipboard.` });
    } catch (error) {
      handleUiError(error);
    }
  }

  function handleExport(label, payload) {
    if (!payload) {
      setNotice({ tone: "warning", message: `Nothing is available to export for ${label}.` });
      return;
    }
    downloadJson(label, payload);
    setNotice({ tone: "success", message: `Exported ${label}.json.` });
  }

  const lifecycle = Array.isArray(selectedScan?.lifecycle) ? selectedScan.lifecycle.join(" -> ") : "No lifecycle data";

  return (
    <>
      <a href="#main-content">Skip to content</a>
      <div className="app-shell">
        <header id="app-header">
          <div>
            <p id="app-eyebrow">React UI shell</p>
            <h1 id="app-title">Migration Helper</h1>
            <p id="app-subtitle">Upload an archive or scan a local path, then review results and export report JSON.</p>
            <div id="app-mode-bar">
              <span className="pill info">Static demo mode</span>
              <span id="mode-explainer">This build is self-contained and powered by checked-in mock data.</span>
            </div>
          </div>
          <section id="api-reference">
            <h2>Included flows</h2>
            <ul>
              <li><code>Archive upload form</code></li>
              <li><code>Path scan form</code></li>
              <li><code>Scan list and filters</code></li>
              <li><code>Report drawer and JSON export</code></li>
            </ul>
          </section>
        </header>

        <main id="main-content">
          <section id="app-notice" className={`notice notice-${notice.tone}`} aria-live="polite">{notice.message}</section>

          <section id="scan-launcher">
            <h2>Start a scan</h2>
            <div id="launch-grid">
              <section id="archive-scan-section">
                <h3>Upload archive</h3>
                <form id="archive-scan-form" onSubmit={(event) => void submitArchiveScan(event)}>
                  <Field label="Archive file"><input type="file" accept=".zip,.tar,.gz,.tgz" /></Field>
                  <Field label="Upload token"><input value={archiveForm.uploadedArchiveToken} onChange={(event) => setArchiveForm({ ...archiveForm, uploadedArchiveToken: event.target.value })} placeholder="upload-123" /></Field>
                  <Field label="Source filename"><input value={archiveForm.sourceFilename} onChange={(event) => setArchiveForm({ ...archiveForm, sourceFilename: event.target.value })} placeholder="demo.zip" /></Field>
                  <Field label="Size in bytes"><input type="number" min="0" value={archiveForm.sizeBytes} onChange={(event) => setArchiveForm({ ...archiveForm, sizeBytes: event.target.value })} placeholder="2048" /></Field>
                  <Field label="Display name"><input value={archiveForm.displayName} onChange={(event) => setArchiveForm({ ...archiveForm, displayName: event.target.value })} placeholder="Demo Archive" /></Field>
                  <Field label="Requested by"><input value={archiveForm.requestedBy} onChange={(event) => setArchiveForm({ ...archiveForm, requestedBy: event.target.value })} placeholder="ui" /></Field>
                  <div className="actions-row">
                    <button type="submit">Queue archive scan</button>
                    <button type="button" onClick={() => setArchiveForm(EMPTY_ARCHIVE_FORM)}>Clear</button>
                  </div>
                </form>
              </section>

              <section id="path-scan-section">
                <h3>Scan path</h3>
                <form id="path-scan-form" onSubmit={(event) => void submitPathScan(event)}>
                  <Field label="Path"><input value={pathForm.path} onChange={(event) => setPathForm({ ...pathForm, path: event.target.value })} placeholder="C:/repos/demo" /></Field>
                  <Field label="Display name"><input value={pathForm.displayName} onChange={(event) => setPathForm({ ...pathForm, displayName: event.target.value })} placeholder="Local Demo" /></Field>
                  <Field label="Requested by"><input value={pathForm.requestedBy} onChange={(event) => setPathForm({ ...pathForm, requestedBy: event.target.value })} placeholder="cli" /></Field>
                  <div className="actions-row">
                    <button type="submit">Queue path scan</button>
                    <button type="button" onClick={() => setPathForm(EMPTY_PATH_FORM)}>Clear</button>
                  </div>
                </form>
              </section>
            </div>
          </section>

          <section id="scan-dashboard">
            <h2>Scan dashboard</h2>
            <section id="summary-region">
              <h3>Summary cards</h3>
              <div id="summary-cards">
                <SummaryCard label="Total scans" value={summary.totalScans} />
                <SummaryCard label="Pending" value={summary.pendingScans} />
                <SummaryCard label="Complete" value={summary.completeScans} />
                <SummaryCard label="Report ready" value={summary.reportReadyScans} />
              </div>
            </section>

            <section id="scan-list-region">
              <div id="scan-list-header">
                <h3>Scan list</h3>
                <div id="scan-list-actions">
                  <button type="button" onClick={() => void bootstrap()}>Refresh scans</button>
                  <button type="button" onClick={() => handleExport("scan-list", scans)}>Export JSON</button>
                </div>
              </div>
              <section id="scan-filters">
                <h4>Filter controls</h4>
                <form id="scan-filter-form">
                  <Field label="Search"><input type="search" value={scanFilters.search} onChange={(event) => setScanFilters({ ...scanFilters, search: event.target.value })} placeholder="Search scans, paths, or reports" /></Field>
                  <Field label="Status"><select value={scanFilters.status} onChange={(event) => setScanFilters({ ...scanFilters, status: event.target.value })}><option value="">Any status</option><option value="pending">Pending</option><option value="running">Running</option><option value="complete">Complete</option><option value="failed">Failed</option></select></Field>
                  <Field label="Source"><select value={scanFilters.source} onChange={(event) => setScanFilters({ ...scanFilters, source: event.target.value })}><option value="">Any source</option><option value="archive">Archive upload</option><option value="path">Path scan</option></select></Field>
                  <Field label="Requested by"><input value={scanFilters.requestedBy} onChange={(event) => setScanFilters({ ...scanFilters, requestedBy: event.target.value })} placeholder="ui" /></Field>
                  <Field label="Sort"><select value={scanFilters.sort} onChange={(event) => setScanFilters({ ...scanFilters, sort: event.target.value })}><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="name">Name</option><option value="status">Status</option></select></Field>
                  <div className="actions-row"><button type="button" onClick={() => setScanFilters(DEFAULT_SCAN_FILTERS)}>Reset filters</button></div>
                </form>
              </section>

              <div id="scan-list-status" role="status" aria-live="polite">{scanListStatus}</div>
              <div className="table-wrap">
                <table id="scan-results-table">
                  <thead><tr><th>Scan</th><th>Source</th><th>Requested by</th><th>Status</th><th>Updated</th><th>Actions</th></tr></thead>
                  <tbody>
                    {filteredScans.length === 0 ? (
                      <tr><td colSpan="6">No scans match the current filters.</td></tr>
                    ) : (
                      filteredScans.map((scan) => (
                        <tr key={scan.id} className={selectedScan?.id === scan.id ? "row-selected" : ""}>
                          <td><strong>{scan.displayName || scan.id}</strong><span className="muted-line">{scan.id}</span></td>
                          <td>{prettySource(scan.sourceType)}</td>
                          <td>{scan.requestedBy || "system"}</td>
                          <td><span className={badgeClassForStatus(scan.status)}>{scan.status || "UNKNOWN"}</span></td>
                          <td>{formatDate(scan.updatedAt || scan.createdAt)}</td>
                          <td><button type="button" className="secondary" onClick={() => void selectScan(scan.id)}>Open</button></td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section id="report-results-region">
              <div id="report-results-header">
                <h3>Filterable results</h3>
                <button type="button" className="secondary" onClick={() => handleExport("report", selectedReport)}>Export selected report</button>
              </div>
              <form id="report-filter-form">
                <Field label="Search results"><input type="search" value={reportFilters.search} onChange={(event) => setReportFilters({ ...reportFilters, search: event.target.value })} placeholder="Search ecosystems, components, versions, or warnings" /></Field>
                <Field label="Result type"><select value={reportFilters.type} onChange={(event) => setReportFilters({ ...reportFilters, type: event.target.value })}><option value="all">All results</option><option value="detector">Detectors</option><option value="policy">Policy statuses</option><option value="recommendation">Recommendations</option><option value="warning">Warnings</option></select></Field>
                <div className="actions-row"><button type="button" onClick={() => setReportFilters(DEFAULT_REPORT_FILTERS)}>Reset</button></div>
              </form>
              {filteredReportRows.length === 0 ? (
                <div id="report-results-empty" className="empty-state"><div><h2>No report selected</h2><p>Select a scan to inspect detector findings, support policy data, warnings, and recommendations.</p></div></div>
              ) : (
                <div className="table-wrap">
                  <table id="report-results-table">
                    <thead><tr><th>Type</th><th>Ecosystem</th><th>Component</th><th>Version or Status</th><th>Notes</th></tr></thead>
                    <tbody>
                      {filteredReportRows.map((row, index) => (
                        <tr key={`${row.type}-${row.component}-${index}`}>
                          <td><span className={`result-type ${row.type}`}>{row.type}</span></td>
                          <td>{row.ecosystem}</td>
                          <td>{row.component}</td>
                          <td>{row.version}</td>
                          <td>{row.notes}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </section>
        </main>
      </div>

      <aside id="scan-detail-drawer" hidden={!selectedScan}>
        <header>
          <div><p id="scan-detail-kicker">Selected scan</p><h2 id="scan-detail-title">Scan details</h2></div>
          <button type="button" onClick={() => { setSelectedScan(null); setSelectedReport(null); }}>Close</button>
        </header>
        <section id="scan-detail-summary">
          <h3>Overview</h3>
          <dl id="scan-detail-metadata">
            <MetadataItem label="ID" value={selectedScan?.id} />
            <MetadataItem label="Name" value={selectedScan?.displayName} />
            <MetadataItem label="Status" value={selectedScan?.status} />
            <MetadataItem label="Requested by" value={selectedScan?.requestedBy} />
          </dl>
        </section>
        <section id="scan-detail-report">
          <h3>Report</h3>
          <div className="stack">
            <div className="pill primary">{selectedReport?.applicationName || "Migration Helper"} report</div>
            <div className="card"><div className="card-body stack">
              <div><strong>Workspace:</strong> {selectedReport?.workspace?.normalizedWorkspacePath || "n/a"}</div>
              <div><strong>Normalization:</strong> {selectedReport?.workspace?.normalizationStatus || "n/a"}</div>
              <div><strong>Generated:</strong> {formatDate(selectedReport?.generatedAt)}</div>
              <div><strong>Detectors:</strong> {selectedReport?.detectors?.length || 0}</div>
              <div><strong>Policies:</strong> {selectedReport?.policyStatuses?.length || 0}</div>
              <div><strong>Recommendations:</strong> {selectedReport?.recommendations?.length || 0}</div>
            </div></div>
            <div className="card"><div className="card-body"><strong>Lifecycle</strong><div className="muted-line">{lifecycle}</div></div></div>
            <div className="card"><div className="card-body"><strong>Warnings</strong><ul>{(selectedScan?.warnings || []).length === 0 ? <li>No warnings reported.</li> : (selectedScan?.warnings || []).map((warning) => <li key={`${warning.code}-${warning.message}`}><strong>{warning.code}</strong>: {warning.message}</li>)}</ul></div></div>
          </div>
        </section>
        <section id="scan-detail-json">
          <h3>JSON export</h3>
          <p>Use the actions below to export the selected scan or its report once data is available.</p>
          <div id="scan-detail-json-actions">
            <button type="button" onClick={() => void handleCopy("selected-scan", selectedScan)}>Copy scan JSON</button>
            <button type="button" onClick={() => void handleCopy("selected-report", selectedReport)}>Copy report JSON</button>
            <a id="download-report-json" href={reportDownloadHref || "#"} download={`${selectedReport?.id || "scan-report"}.json`} aria-disabled={!reportDownloadHref}>Download report JSON</a>
          </div>
        </section>
      </aside>
    </>
  );
}

function Field({ label, children }) {
  return <div><label><span>{label}</span>{children}</label></div>;
}

function SummaryCard({ label, value }) {
  return <article><h4>{label}</h4><p data-value>{value}</p></article>;
}

function MetadataItem({ label, value }) {
  return <div><dt>{label}</dt><dd>{value || "-"}</dd></div>;
}
