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
import sampleProjectCatalog from "../../plugins/sample-project-analyzer/catalog/sample-projects.json";

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

const NAV_ITEMS = [
  { id: "home", label: "Home", kicker: "Project intake" },
  { id: "overview", label: "Overview", kicker: "Metrics and inventory" },
  { id: "analysis", label: "Analysis", kicker: "Findings and review" },
  { id: "documentation", label: "Documentation", kicker: "Confluence-ready notes" },
  { id: "roadmap", label: "Roadmap", kicker: "Phases and effort" },
  { id: "help", label: "Help", kicker: "What each section does" }
];

const PAGE_COPY = {
  home: ["Workspace entry", "Home", "Start with a sample folder or a local path scan, then use the checked-in scan data to open the workspace views."],
  overview: ["Current state", "Overview", "See the selected scan at a glance with summary metrics, lifecycle status, and export shortcuts."],
  analysis: ["Findings", "Analysis", "Review detector rows, policy statuses, recommendations, and warnings in a single filterable table."],
  documentation: ["Knowledge handoff", "Documentation", "Turn the selected report into Confluence-friendly sections and copyable summary payloads."],
  roadmap: ["Delivery plan", "Roadmap", "Translate the scan into migration phases, effort notes, and practical automation versus manual review."],
  help: ["Guide", "Help", "Learn what each tab, button, and export action does before you start exploring a scan."]
};

const WORKSPACE_STEPS = [
  ["1. Load a scan source", "Use a sample project folder or point the app at a local path. The checked-in mock data keeps the app self-contained."],
  ["2. Open the report", "Select a scan from the list to load the detail drawer and report rows that back every workspace view."],
  ["3. Switch the views", "Move between Overview, Analysis, Documentation, Roadmap, and Help to see the same scan from different angles."]
];

const HELP_SECTIONS = [
  ["Home", "Project intake and scan control", "This page starts the workflow. It contains the sample folder form, path scan form, the scan registry, and the report preview."],
  ["Overview", "Metrics and snapshot", "This page gives the executive summary: scan counts, selected scan status, lifecycle, and report readiness."],
  ["Analysis", "Findings and review", "This page shows the detailed detector rows, support policy entries, recommendations, and warnings."],
  ["Documentation", "Confluence-ready output", "This page groups the report into reusable documentation blocks that are easy to copy into a team wiki."],
  ["Roadmap", "Migration path", "This page turns the scan into phases and effort notes so the next steps are easier to plan."],
  ["Help", "Always available", "This page explains the workspace, the buttons, the exports, and the checked-in mock-data files that power the UI."]
];

const SAMPLE_PROJECTS = sampleProjectCatalog.roots.map((root) => ({
  id: root.id,
  label:
    root.technology === "Java"
      ? "Java / Oracle sample"
      : root.technology === "Angular"
        ? "Angular / MS SQL sample"
        : root.technology === "React"
          ? "React / Node sample"
          : root.technology === ".NET"
            ? ".NET / SQL Server sample"
            : root.technology === "Python"
              ? "Python / Django sample"
              : "Mixed enterprise sample",
  path: root.path,
  description: root.focus.join(", ")
}));

const SURFACE = {
  border: "1px solid rgba(25, 35, 52, 0.12)",
  borderRadius: "24px",
  background: "linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(249, 251, 255, 0.94))",
  boxShadow: "0 12px 30px rgba(15, 23, 42, 0.08)"
};

const STYLES = {
  shell: { width: "min(1320px, calc(100vw - 32px))", margin: "0 auto", display: "grid", gap: "18px" },
  header: { display: "grid", gridTemplateColumns: "minmax(0, 1.4fr) minmax(280px, 0.8fr)", gap: "18px", padding: "24px", ...SURFACE },
  brand: { display: "grid", gap: "12px" },
  eyebrow: { margin: 0, fontSize: "0.72rem", fontWeight: 800, letterSpacing: "0.24em", textTransform: "uppercase", color: "var(--primary-strong)" },
  title: { margin: 0, fontSize: "clamp(2rem, 4vw, 3.4rem)", lineHeight: 1.02, letterSpacing: "-0.03em" },
  subtitle: { margin: 0, maxWidth: "72ch", color: "var(--muted)", lineHeight: 1.6 },
  chipRow: { display: "flex", flexWrap: "wrap", gap: "10px" },
  navBar: { display: "grid", gridTemplateColumns: "repeat(6, minmax(0, 1fr))", gap: "12px", padding: "14px", ...SURFACE },
  navButton: (active) => ({
    minHeight: "72px",
    padding: "14px 16px",
    display: "grid",
    gap: "4px",
    textAlign: "left",
    borderRadius: "18px",
    border: active ? "1px solid rgba(31, 94, 255, 0.18)" : "1px solid transparent",
    background: active ? "linear-gradient(180deg, rgba(31, 94, 255, 0.12), rgba(31, 94, 255, 0.06))" : "linear-gradient(180deg, rgba(255,255,255,0.92), rgba(246,249,255,0.94))",
    color: "var(--text)"
  }),
  navKicker: { fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.14em", color: "var(--subtle)" },
  navLabel: { fontSize: "0.96rem", fontWeight: 800 },
  banner: { display: "grid", gridTemplateColumns: "minmax(0, 1.2fr) minmax(320px, 0.8fr)", gap: "18px", padding: "22px 24px", ...SURFACE },
  bannerTitle: { margin: "0 0 10px", fontSize: "clamp(1.5rem, 2.6vw, 2.4rem)", lineHeight: 1.1 },
  bannerText: { margin: 0, color: "var(--muted)", lineHeight: 1.65 },
  bannerAside: { display: "grid", gap: "12px", padding: "18px", borderRadius: "20px", background: "linear-gradient(180deg, rgba(31, 94, 255, 0.10), rgba(31, 94, 255, 0.06))", border: "1px solid rgba(31, 94, 255, 0.12)" },
  main: { display: "grid", gap: "18px" },
  pageStack: { display: "grid", gap: "18px" },
  twoCol: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "18px" },
  threeCol: { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "16px" },
  fourCol: { display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "16px" },
  card: { padding: "18px", ...SURFACE },
  cardHeader: { display: "flex", flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between", gap: "12px", marginBottom: "14px" },
  cardEyebrow: { margin: "0 0 6px", fontSize: "0.72rem", fontWeight: 800, letterSpacing: "0.22em", textTransform: "uppercase", color: "var(--primary-strong)" },
  cardTitle: { margin: 0, fontSize: "1.2rem", lineHeight: 1.15 },
  cardText: { margin: "8px 0 0", color: "var(--muted)", lineHeight: 1.55 },
  sectionGap: { display: "grid", gap: "14px" },
  formGrid: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "14px" },
  actionsRow: { display: "flex", flexWrap: "wrap", gap: "10px", alignItems: "center" },
  helperList: { margin: 0, paddingLeft: "18px", color: "var(--muted)", lineHeight: 1.7 },
  tableWrap: { overflow: "auto", border: "1px solid var(--line)", borderRadius: "18px", background: "rgba(255, 255, 255, 0.85)" },
  table: { width: "100%", borderCollapse: "separate", borderSpacing: 0 },
  drawer: { position: "fixed", top: 0, right: 0, zIndex: 40, width: "min(100vw, 480px)", height: "100vh", padding: "18px", borderLeft: "1px solid rgba(255, 255, 255, 0.55)", background: "linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(245, 248, 252, 0.96))", boxShadow: "0 18px 48px rgba(17, 24, 39, 0.12)", overflow: "auto" },
  metricCard: { padding: "18px", borderRadius: "20px", border: "1px solid rgba(25, 35, 52, 0.08)", background: "linear-gradient(180deg, #ffffff, #f9fbff)" },
  metricValue: { margin: "8px 0 0", fontSize: "clamp(1.6rem, 2.8vw, 2.6rem)", fontWeight: 800, letterSpacing: "-0.04em" },
  metricLabel: { margin: 0, color: "var(--muted)", fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.18em", fontWeight: 800 },
  empty: { minHeight: "180px", display: "grid", placeItems: "center", textAlign: "center" },
  pillRow: { display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "center" }
};

export default function App() {
  const [activePage, setActivePage] = useState("home");
  const [scans, setScans] = useState([]);
  const [selectedScan, setSelectedScan] = useState(null);
  const [selectedReport, setSelectedReport] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
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
  const reportRows = useMemo(() => flattenReport(selectedReport), [selectedReport]);
  const filteredReportRows = useMemo(() => applyReportFilters(reportRows, reportFilters), [reportRows, reportFilters]);
  const reportDownloadHref = useMemo(() => buildDownloadHref(selectedReport), [selectedReport]);
  const docsSections = useMemo(() => buildDocumentationSections(selectedScan, selectedReport), [selectedScan, selectedReport]);
  const roadmapSections = useMemo(() => buildRoadmapSections(selectedScan, selectedReport), [selectedScan, selectedReport]);
  const analysisHighlights = useMemo(() => buildAnalysisHighlights(selectedScan, selectedReport), [selectedScan, selectedReport]);

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
      setNotice({
        tone: "info",
        message: "Static mode is active. The React app is using the checked-in JSON payloads under /mock-data/ and the sample-project folders in the repo."
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

  async function selectScan(id, availableScans = scans, options = {}) {
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
    setDrawerOpen(Boolean(options.openDrawer));
  }

  async function submitArchiveScan(event) {
    event.preventDefault();
    try {
      const payload = {
        path: archiveForm.sourceFilename,
        displayName: archiveForm.displayName,
        requestedBy: archiveForm.requestedBy
      };
      const response = createMockPathScan(payload);
      upsertScan(response);
      setArchiveForm(EMPTY_ARCHIVE_FORM);
      setNotice({ tone: "success", message: `Loaded sample folder ${response.displayName}.` });
      setActivePage("overview");
      setDrawerOpen(false);
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
      setActivePage("overview");
      setDrawerOpen(false);
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
    setDrawerOpen(false);
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

  const currentPage = PAGE_COPY[activePage] || PAGE_COPY.home;
  const lifecycle = Array.isArray(selectedScan?.lifecycle) ? selectedScan.lifecycle.join(" -> ") : "No lifecycle data";
  const selectedScanWarnings = Array.isArray(selectedScan?.warnings) ? selectedScan.warnings : [];
  const reportCount = {
    detectors: selectedReport?.detectors?.length || 0,
    policies: selectedReport?.policyStatuses?.length || 0,
    recommendations: selectedReport?.recommendations?.length || 0,
    warnings: selectedReport?.warnings?.length || 0
  };

  function applySampleProject(sample) {
    setPathForm((current) => ({
      ...current,
      path: sample.path,
      displayName: sample.label,
      requestedBy: current.requestedBy || "demo"
    }));
    setNotice({ tone: "info", message: `${sample.label} is ready in the path scan form.` });
  }

  return (
    <>
      <a href="#main-content">Skip to content</a>
      <div style={STYLES.shell}>
        <header id="app-header" style={STYLES.header}>
          <div style={STYLES.brand}>
            <div className="pill primary">LM</div>
            <div>
              <p style={STYLES.eyebrow}>Migration planning workspace</p>
              <h1 style={STYLES.title}>Migration Helper</h1>
            </div>
            <p style={STYLES.subtitle}>A clean workspace for sample-project folders and path scans, report review, exports, and the checked-in mock-data flow already in the repo.</p>
            <div style={STYLES.chipRow}>
              <span className="pill info">Static demo mode</span>
              <span className="pill primary">{selectedScan ? `Selected: ${selectedScan.displayName}` : "No scan selected"}</span>
              <span className="pill">{selectedScan ? formatSelectedSource(selectedScan.sourceType) : "Checked-in mock data"}</span>
            </div>
          </div>
          <section id="api-reference" style={STYLES.brand}>
            <p style={STYLES.eyebrow}>Workspace snapshot</p>
            <h2 style={{ margin: 0 }}>Included flows</h2>
            <p style={STYLES.subtitle}>Sample folder loading, path scan, scan registry, selected report, documentation, roadmap, and help all live in one workspace.</p>
            <div style={STYLES.threeCol}>
              <MetricCard label="Total scans" value={summary.totalScans} />
              <MetricCard label="Complete" value={summary.completeScans} />
              <MetricCard label="Report ready" value={summary.reportReadyScans} />
            </div>
          </section>
        </header>

        <nav aria-label="Workspace sections" style={STYLES.navBar}>
          {NAV_ITEMS.map((item) => (
            <button key={item.id} type="button" onClick={() => setActivePage(item.id)} style={STYLES.navButton(activePage === item.id)} aria-current={activePage === item.id ? "page" : undefined}>
              <span style={STYLES.navKicker}>{item.kicker}</span>
              <span style={STYLES.navLabel}>{item.label}</span>
            </button>
          ))}
        </nav>

        <section style={STYLES.banner}>
          <div>
            <p style={STYLES.eyebrow}>{currentPage[0]}</p>
            <h2 style={STYLES.bannerTitle}>{currentPage[1]}</h2>
            <p style={STYLES.bannerText}>{currentPage[2]}</p>
          </div>
          <div style={STYLES.bannerAside}>
            <div style={STYLES.pillRow}>
              <span className="pill primary">{selectedScan ? selectedScan.displayName : "Awaiting a scan"}</span>
              <span className="pill info">{selectedScan ? selectedScan.status : "Static mode"}</span>
              <span className="pill">{selectedScan ? formatSelectedSource(selectedScan.sourceType) : "Mock data"}</span>
            </div>
            <p style={STYLES.bannerText}>Use the top tabs to move between summary, analysis, documentation, roadmap, and help.</p>
            <div className="actions-row">
              <button type="button" className="secondary" onClick={() => setDrawerOpen((current) => !current)} disabled={!selectedScan}>
                {drawerOpen ? "Hide selected scan" : "Open selected scan"}
              </button>
              <span className="muted-line">{selectedScan ? formatDate(selectedScan.updatedAt || selectedScan.createdAt) : "Mock data"}</span>
            </div>
          </div>
        </section>

        <main id="main-content" style={STYLES.main}>
          <section id="app-notice" className={`notice notice-${notice.tone}`} aria-live="polite">{notice.message}</section>

          {activePage === "home" && (
            <>
              <section id="scan-launcher">
            <h2>Start with a sample folder</h2>
            <div id="launch-grid">
              <section id="archive-scan-section">
                <h3>Sample project folder</h3>
                <form id="archive-scan-form" onSubmit={(event) => void submitArchiveScan(event)}>
                  <Field label="Folder path"><input value={archiveForm.sourceFilename} onChange={(event) => setArchiveForm({ ...archiveForm, sourceFilename: event.target.value })} placeholder="sample-projects/java-spring-oracle-legacy" /></Field>
                  <Field label="Display name"><input value={archiveForm.displayName} onChange={(event) => setArchiveForm({ ...archiveForm, displayName: event.target.value })} placeholder="Sample Folder" /></Field>
                  <Field label="Requested by"><input value={archiveForm.requestedBy} onChange={(event) => setArchiveForm({ ...archiveForm, requestedBy: event.target.value })} placeholder="ui" /></Field>
                  <div className="actions-row">
                    <button type="submit">Load sample folder</button>
                    <button type="button" onClick={() => setArchiveForm(EMPTY_ARCHIVE_FORM)}>Clear</button>
                  </div>
                </form>
              </section>

              <section id="path-scan-section">
                <h3>Local repository path</h3>
                <form id="path-scan-form" onSubmit={(event) => void submitPathScan(event)}>
                  <Field label="Folder or repo path"><input value={pathForm.path} onChange={(event) => setPathForm({ ...pathForm, path: event.target.value })} placeholder="D:/Project/Hackathonday/sample-projects/mixed-enterprise-workspace" /></Field>
                  <Field label="Display name"><input value={pathForm.displayName} onChange={(event) => setPathForm({ ...pathForm, displayName: event.target.value })} placeholder="Local Demo" /></Field>
                  <Field label="Requested by"><input value={pathForm.requestedBy} onChange={(event) => setPathForm({ ...pathForm, requestedBy: event.target.value })} placeholder="cli" /></Field>
                  <div className="sample-project-strip">
                    <span>Sample projects</span>
                    <div className="sample-project-list">
                      {SAMPLE_PROJECTS.map((sample) => (
                        <button key={sample.path} type="button" className="secondary sample-project-button" onClick={() => applySampleProject(sample)}>
                          {sample.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="actions-row">
                    <button type="submit">Load local path</button>
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
                  <Field label="Source"><select value={scanFilters.source} onChange={(event) => setScanFilters({ ...scanFilters, source: event.target.value })}><option value="">Any source</option><option value="folder">Sample folder</option><option value="path">Local path</option></select></Field>
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
                          <td>{formatSelectedSource(scan.sourceType)}</td>
                          <td>{scan.requestedBy || "system"}</td>
                          <td><span className={badgeClassForStatus(scan.status)}>{scan.status || "UNKNOWN"}</span></td>
                          <td>{formatDate(scan.updatedAt || scan.createdAt)}</td>
                          <td>
                            <div className="table-action-group">
                              <button type="button" className="secondary" onClick={() => void selectScan(scan.id)}>
                                Use
                              </button>
                              <button type="button" className="secondary" onClick={() => void selectScan(scan.id, scans, { openDrawer: true })}>
                                Details
                              </button>
                            </div>
                          </td>
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
            </>
          )}

          {activePage === "overview" && (
            <section className="card">
              <div className="card-body stack">
                <div className="pill primary">{selectedScan?.displayName || "No scan selected"}</div>
                <div id="summary-cards">
                  <SummaryCard label="Total scans" value={summary.totalScans} />
                  <SummaryCard label="Pending" value={summary.pendingScans} />
                  <SummaryCard label="Complete" value={summary.completeScans} />
                  <SummaryCard label="Report ready" value={summary.reportReadyScans} />
                </div>
                <div className="table-wrap">
                  <table>
                    <tbody>
                      <tr><td><strong>Workspace</strong></td><td>{selectedReport?.workspace?.normalizedWorkspacePath || "n/a"}</td></tr>
                      <tr><td><strong>Normalization</strong></td><td>{selectedReport?.workspace?.normalizationStatus || "n/a"}</td></tr>
                      <tr><td><strong>Lifecycle</strong></td><td>{lifecycle}</td></tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          )}

          {activePage === "analysis" && (
            <section className="card">
              <div className="card-body stack">
                <div className="pill-row" style={STYLES.pillRow}>
                  <span className="pill info">Detectors: {analysisHighlights.detectors}</span>
                  <span className="pill info">Policies: {analysisHighlights.policies}</span>
                  <span className="pill info">Recommendations: {analysisHighlights.recommendations}</span>
                  <span className="pill info">Warnings: {analysisHighlights.warnings}</span>
                </div>
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>Type</th><th>Ecosystem</th><th>Component</th><th>Version or Status</th><th>Notes</th></tr></thead>
                    <tbody>
                      {filteredReportRows.length === 0 ? <tr><td colSpan="5">No report selected</td></tr> : filteredReportRows.map((row, index) => (
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
              </div>
            </section>
          )}

          {activePage === "documentation" && (
            <section className="card">
              <div className="card-body stack">
                {docsSections.map((section) => (
                  <div key={section.title} className="card" style={{ padding: 16 }}>
                    <p className="muted-line">{section.kicker}</p>
                    <h3 style={{ marginTop: 0 }}>{section.title}</h3>
                    <p>{section.description}</p>
                    <ul>
                      {section.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}
                    </ul>
                    <button type="button" className="secondary" onClick={() => handleCopy(section.title, section.payload)}>Copy section JSON</button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {activePage === "roadmap" && (
            <section className="card">
              <div className="card-body stack">
                <div id="summary-cards">
                  {roadmapSections.map((section) => (
                    <article key={section.title}>
                      <h4>{section.phase}</h4>
                      <h3>{section.title}</h3>
                      <p>{section.description}</p>
                    </article>
                  ))}
                </div>
                <div className="table-wrap">
                  <table>
                    <tbody>
                      <tr><td><strong>Automatic review</strong></td><td>Detector, policy, and recommendation rows</td></tr>
                      <tr><td><strong>Manual checkpoint</strong></td><td>Warnings and unknown support entries</td></tr>
                      <tr><td><strong>Lifecycle</strong></td><td>{lifecycle}</td></tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          )}

          {activePage === "help" && (
            <section className="card">
              <div className="card-body stack">
                <div id="summary-cards">
                  {HELP_SECTIONS.map(([title, kicker, text]) => (
                    <article key={title}>
                      <h4>{kicker}</h4>
                      <h3>{title}</h3>
                      <p>{text}</p>
                    </article>
                  ))}
                </div>
                <div className="table-wrap">
                  <table>
                    <tbody>
                      <tr><td><strong>Load sample folder</strong></td><td>Adds a new sample-project folder scan to the list.</td></tr>
                      <tr><td><strong>Load local path</strong></td><td>Adds a new path-based scan to the list.</td></tr>
                      <tr><td><strong>Use</strong></td><td>Loads the selected scan into the workspace views.</td></tr>
                      <tr><td><strong>Details</strong></td><td>Opens the selected scan drawer for a closer look.</td></tr>
                      <tr><td><strong>Export JSON</strong></td><td>Downloads the current scan list or report rows as JSON.</td></tr>
                      <tr><td><strong>Copy JSON</strong></td><td>Sends the selected payload to the clipboard.</td></tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          )}
        </main>
      </div>

      <aside id="scan-detail-drawer" hidden={!selectedScan || !drawerOpen}>
        <header>
          <div><p id="scan-detail-kicker">Selected scan</p><h2 id="scan-detail-title">Scan details</h2></div>
          <button type="button" onClick={() => setDrawerOpen(false)}>Close</button>
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

function MetricCard({ label, value }) {
  return (
    <article style={STYLES.metricCard}>
      <p style={STYLES.metricLabel}>{label}</p>
      <p style={STYLES.metricValue}>{value}</p>
    </article>
  );
}

function MetadataItem({ label, value }) {
  return <div><dt>{label}</dt><dd>{value || "-"}</dd></div>;
}

function formatSelectedSource(sourceType) {
  if (typeof sourceType !== "string" || sourceType.length === 0) {
    return "Checked-in mock data";
  }
  const normalized = sourceType.toLowerCase();
  if (normalized.includes("archive")) {
    return "Sample folder";
  }
  if (normalized.includes("path")) {
    return "Local folder";
  }
  return prettySource(sourceType);
}

function buildDocumentationSections(scan, report) {
  if (!report) {
    return [{
      title: "No report selected",
      kicker: "Documentation",
      description: "Select a scan first to unlock the documentation blocks.",
      bullets: ["The selected report will populate these sections.", "Use the scan list on Home to choose another record."],
      tags: ["Waiting", "Mock data"],
      payload: { message: "No report selected" }
    }];
  }

  const detectors = report.detectors || [];
  const policies = report.policyStatuses || [];
  const recommendations = report.recommendations || [];
  const warnings = report.warnings || [];

  return [
    {
      title: "Workspace snapshot",
      kicker: "Summary",
      description: "Capture the selected scan, selected workspace, and overall report state.",
      tags: [scan?.displayName || "Unknown scan", report.status || "UNKNOWN"],
      bullets: [
        `Workspace path: ${report.workspace?.normalizedWorkspacePath || "n/a"}`,
        `Normalization status: ${report.workspace?.normalizationStatus || "n/a"}`,
        `Generated at: ${formatDate(report.generatedAt)}`
      ],
      payload: { id: report.id, applicationName: report.applicationName, status: report.status, workspace: report.workspace, metadata: report.metadata }
    },
    {
      title: "Detected technologies",
      kicker: "Inventory",
      description: "List the ecosystems, components, and versions discovered by the scan.",
      tags: [`${detectors.length} detectors`, "Inventory"],
      bullets: detectors.length === 0 ? ["No detector rows were supplied in the selected report."] : detectors.slice(0, 5).map((entry) => `${entry.ecosystem}: ${entry.component} ${entry.detectedVersion} (${entry.confidence || "UNKNOWN"})`),
      payload: detectors
    },
    {
      title: "Support policy",
      kicker: "Readiness",
      description: "Summarize support, policy, and status information for each component.",
      tags: [`${policies.length} checks`, "Policy"],
      bullets: policies.length === 0 ? ["No policy rows were supplied in the selected report."] : policies.slice(0, 5).map((entry) => `${entry.ecosystem}: ${entry.component} ${entry.supportStatus || entry.version}`),
      payload: policies
    },
    {
      title: "Recommendations and warnings",
      kicker: "Next steps",
      description: "Highlight what the scan recommends and which items need manual review.",
      tags: [`${recommendations.length} recommendations`, `${warnings.length} warnings`],
      bullets: [
        ...(recommendations.length === 0 ? ["No recommendations were supplied in the selected report."] : recommendations.slice(0, 4).map((entry) => `${entry.ecosystem}: ${entry.component} -> ${entry.recommendedVersion}`)),
        ...(warnings.length === 0 ? [] : warnings.slice(0, 3).map((entry) => `${entry.code}: ${entry.message}`))
      ],
      payload: { recommendations, warnings }
    }
  ];
}

function buildRoadmapSections(scan, report) {
  const detectors = report?.detectors?.length || 0;
  const policies = report?.policyStatuses?.length || 0;
  const recommendations = report?.recommendations?.length || 0;
  const warnings = report?.warnings?.length || 0;
  const lifecycle = Array.isArray(scan?.lifecycle) && scan.lifecycle.length > 0 ? scan.lifecycle : ["QUEUED", "ANALYZING", "COMPLETED"];

  return [
    { phase: "Phase 1", title: "Inventory", description: `Capture ${detectors} detector rows and normalize the workspace before any upgrade plan is finalized.` },
    { phase: "Phase 2", title: "Policy review", description: `Review ${policies} support-policy entries and keep the ${warnings} warnings visible for manual follow-up.` },
    { phase: "Phase 3", title: "Modernization plan", description: `Use ${recommendations} recommendations to shape the target path, export notes, and documentation output.` },
    { phase: "Phase 4", title: "Release readiness", description: `Work through the lifecycle steps (${lifecycle.join(" -> ")}) before the workspace is treated as final.` }
  ];
}

function buildAnalysisHighlights(scan, report) {
  return {
    detectors: report?.detectors?.length || 0,
    policies: report?.policyStatuses?.length || 0,
    recommendations: report?.recommendations?.length || 0,
    warnings: Array.isArray(scan?.warnings) ? scan.warnings.length : 0
  };
}

function countActiveFilters(scanFilters, reportFilters) {
  return [
    scanFilters.search,
    scanFilters.status,
    scanFilters.source,
    scanFilters.requestedBy,
    scanFilters.sort !== "newest" ? scanFilters.sort : "",
    reportFilters.search,
    reportFilters.type !== "all" ? reportFilters.type : ""
  ].filter(Boolean).length;
}
