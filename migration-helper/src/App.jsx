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
import {
  PLANNING_SEED_VISION,
  PLANNING_STAGES,
  PlanningError,
  REVIEW_STAGES,
  approveReview,
  completeOnboardingTask,
  createPlan,
  getPlanSummary
} from "./planning";
import {
  buildRefinementSampleRequest,
  buildTestCaseGenerationRequest,
  createRefinementStoryPackage,
  generateTestCases
} from "./refinement";
import {
  DEFAULT_ONBOARDING_AGENT_NAME,
  ONBOARDING_JOURNEY_TYPES,
  answerOnboardingQuery,
  loadOnboardingDocuments
} from "./onboarding/onboardingAgent";
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

const EMPTY_VISION_FORM = {
  productName: "",
  programLead: "",
  targetUsers: "",
  vision: "",
  desiredOutcomes: ""
};

const EMPTY_REVIEW_FORM = {
  reviewer: "",
  notes: ""
};

const EMPTY_REFINEMENT_FORM = {
  notes: "",
  candidateProblemStatement: "",
  candidateStorySummary: "",
  parentEpicLink: "",
  labels: "",
  sprint: "",
  estimatePoints: "",
  references: "",
  teamContext: ""
};

const EMPTY_TEST_CASE_FORM = {
  storySummary: "",
  acceptanceCriteria: "",
  storyTitle: "",
  environment: "mock"
};

const EMPTY_ONBOARDING_FORM = {
  role: "",
  journeyType: "",
  question: ""
};

const NAV_ITEMS = [
  { id: "home", label: "Home", kicker: "Project intake" },
  { id: "overview", label: "Overview", kicker: "Metrics and inventory" },
  { id: "analysis", label: "Analysis", kicker: "Findings and review" },
  { id: "documentation", label: "Documentation", kicker: "Confluence-ready notes" },
  { id: "roadmap", label: "Roadmap", kicker: "Phases and effort" },
  { id: "planning", label: "Planning hub", kicker: "Vision to story" },
  { id: "help", label: "Help", kicker: "What each section does" }
];

const PAGE_COPY = {
  home: ["Folder-first scan", "Home", "Choose a sample folder from the dropdown or enter a local path, run quick analysis, review the short report, and then prepare target versions for deeper analysis."],
  overview: ["Current state", "Overview", "See the selected scan at a glance with summary metrics, lifecycle status, and export shortcuts."],
  analysis: ["Findings", "Analysis", "Review detector rows, policy statuses, recommendations, and warnings in a single filterable table."],
  documentation: ["Knowledge handoff", "Documentation", "Turn the selected report into Confluence-friendly sections and copyable summary payloads."],
  roadmap: ["Delivery plan", "Roadmap", "Translate the scan into migration phases, effort notes, and practical automation versus manual review."],
  planning: ["Agile delivery hub", "Planning hub", "Use the new planning, refinement, QE, and onboarding surfaces without leaving the workspace."],
  help: ["Guide", "Help", "Learn what each tab, button, and export action does before you start exploring a scan."]
};

const HELP_SECTIONS = [
  ["Home", "Project intake and scan control", "This page starts the workflow. It contains the sample-folder dropdown, the folder path field, the quick analysis progress bar, the short report, and the target-version section."],
  ["Overview", "Metrics and snapshot", "This page gives the executive summary: scan counts, selected scan status, lifecycle, and report readiness."],
  ["Analysis", "Findings and review", "This page shows the detailed detector rows, support policy entries, recommendations, and warnings."],
  ["Documentation", "Confluence-ready output", "This page groups the report into reusable documentation blocks that are easy to copy into a team wiki."],
  ["Roadmap", "Migration path", "This page turns the scan into phases and effort notes so the next steps are easier to plan."],
  ["Help", "Always available", "This page explains the workspace, the buttons, and the exports that support the modernization flow."]
];

const SAMPLE_PROJECTS = sampleProjectCatalog.roots.map((root) => ({
  ...root,
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

const QUICK_SCAN_STEPS = [
  [12, "Reading folder"],
  [28, "Detecting technology stack"],
  [48, "Mapping databases"],
  [68, "Finding libraries"],
  [84, "Preparing report"],
  [100, "Quick analysis complete"]
];

const QUICK_TARGET_OPTIONS = {
  Java: ["Java 17", "Java 21", "Java 25"],
  Angular: ["Angular 17", "Angular 18", "Angular 20"],
  React: ["React 18", "React 19"],
  ".NET": [".NET 8", ".NET 9"],
  Python: ["Python 3.11", "Python 3.12"],
  Mixed: ["Modernize by stack", "Modernize by domain", "Modernize incrementally"]
};

const GUARDRAIL_OPTIONS = {
  licensingPolicy: ["Approved OSS only", "License review required", "Commercial licensing restricted"],
  dataSensitivity: ["Standard internal data", "PII present", "Sensitive regulated data"],
  changeControl: ["Standard delivery approval", "Strict CAB approval", "Multi-team signoff required"],
  databaseFlexibility: ["Database changes allowed", "Schema changes limited", "No database engine change"],
  compatibilityRequirement: ["Modernize freely", "Backward compatibility required", "Legacy API contract must stay"]
};

const GUARDRAIL_IMPACTS = {
  licensingPolicy: "Shapes whether dependency swaps stay within approved license families.",
  dataSensitivity: "Raises or lowers the amount of manual security and export review.",
  changeControl: "Controls how much governance the modernization plan must include.",
  databaseFlexibility: "Determines how much persistence refactoring the plan can suggest.",
  compatibilityRequirement: "Controls how aggressively interfaces and consumers may change."
};

const DEFAULT_GUARDRAILS = {
  licensingPolicy: "Approved OSS only",
  dataSensitivity: "PII present",
  changeControl: "Strict CAB approval",
  databaseFlexibility: "Schema changes limited",
  compatibilityRequirement: "Backward compatibility required"
};

function titleCase(value) {
  return String(value || "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function buildGuardrailSummary(guardrailState) {
  return Object.entries(GUARDRAIL_OPTIONS).map(([key, options]) => ({
    id: key,
    label: titleCase(key),
    value: guardrailState?.[key] || DEFAULT_GUARDRAILS[key] || options[0],
    impact: GUARDRAIL_IMPACTS[key] || "Applies project-specific delivery constraints."
  }));
}

function buildGuardrailDefaults() {
  return { ...DEFAULT_GUARDRAILS };
}

function groupTargetRows(rows) {
  const buckets = new Map();
  rows.forEach((row) => {
    if (!buckets.has(row.group)) {
      buckets.set(row.group, []);
    }
    buckets.get(row.group).push(row);
  });
  return ["Technology", "Database", "Library"]
    .map((group) => ({ group, items: buckets.get(group) || [] }))
    .filter((entry) => entry.items.length > 0);
}

function normalizePathForMatch(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[\\]+/g, "/")
    .replace(/\/+/g, "/")
    .replace(/\/$/, "");
}

function isOutOfSupportVersion(value) {
  const normalized = String(value || "").toLowerCase().trim();
  if (!normalized) {
    return false;
  }
  return [
    /\bout of support\b/,
    /\blegacy\b/,
    /\bjava 8\b/,
    /\b2\.(?:0|1)\.[0-9]+(?:\.release)?\b/,
    /\bangular (?:8|9|10)\b|\b(?:8|9|10)\b/,
    /\breact 16\b/,
    /\bcore (?:3\.1|5(?:\.0)?)\b/,
    /\bpython 3\.(?:8|9)\b/,
    /\bdjango (?:2\.2|3\.2)\b/,
    /\bpostgres\b.*\b(?:12|13)\b/,
    /\bsql server\b.*\b(?:2017|2019)\b/,
    /\brxjs\b.*\b(?:5|6)(?:\.x)?\b/,
    /\bentity framework core\b.*\b(?:3\.x|5\.x|4\.)\b/,
    /\bexpress\b.*\b4\./,
    /\breact-scripts\b.*\b3\./,
    /\bpytest\b.*\blegacy\b/
  ].some((pattern) => pattern.test(normalized));
}

function buildSupportStatus(label, current) {
  const labelWithVersion = `${label || ""} ${current || ""}`.trim();
  if (isOutOfSupportVersion(labelWithVersion)) {
    return "Out of support";
  }
  return "Supported with review";
}

function isAnalysisRowOutOfSupport(row) {
  if (!row) {
    return false;
  }
  if (row.type === "recommendation" || row.type === "warning") {
    return false;
  }
  return isOutOfSupportVersion(`${row.component} ${row.version}`) || isOutOfSupportVersion(row.notes);
}

function buildSampleConversionPackage(report, targetSelections, guardrailSummary, deepAnalysisReady) {
  const targets = Object.entries(targetSelections)
    .map(([id, value]) => {
      const target = report.targets.find((item) => item.id === id);
      return target ? { id, label: target.label, selected: value, current: target.current } : null;
    })
    .filter(Boolean);

  return {
    applicationName: "Modernize Application Accelerator",
    sampleId: report.sampleId,
    sampleLabel: report.sampleLabel,
    folderPath: report.folderPath,
    deepAnalysisReady,
    targets,
    guardrails: guardrailSummary,
    nextSteps: report.nextSteps,
    summary: report.summary,
    generatedAt: new Date().toISOString()
  };
}

function buildTargetGroupsForSample(sample) {
  const profile = buildSampleProfile(sample);
  const rows = [
    ...profile.technologies.map((item) => ({ group: "Technology", target: item.defaultTarget || item.target || item.current, ...item })),
    ...profile.databases.map((item) => ({ group: "Database", target: item.defaultTarget || item.target || item.current, ...item })),
    ...profile.libraries.map((item) => ({ group: "Library", target: item.defaultTarget || item.target || item.current, ...item }))
  ];
  return groupTargetRows(rows);
}

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
  navBar: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "12px", padding: "14px", ...SURFACE },
  navButton: (active) => ({
    minHeight: "64px",
    padding: "12px 14px",
    display: "grid",
    alignContent: "center",
    gap: "3px",
    textAlign: "left",
    borderRadius: "16px",
    border: active ? "1px solid rgba(31, 94, 255, 0.18)" : "1px solid transparent",
    background: active ? "linear-gradient(180deg, rgba(31, 94, 255, 0.12), rgba(31, 94, 255, 0.06))" : "linear-gradient(180deg, rgba(255,255,255,0.92), rgba(246,249,255,0.94))",
    color: "var(--text)",
    opacity: 1
  }),
  navKicker: { fontSize: "0.66rem", textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--subtle)" },
  navLabel: { fontSize: "0.9rem", fontWeight: 800, lineHeight: 1.15 },
  banner: { display: "grid", gridTemplateColumns: "minmax(0, 1.2fr) minmax(320px, 0.8fr)", gap: "18px", padding: "22px 24px", ...SURFACE },
  bannerTitle: { margin: "0 0 10px", fontSize: "clamp(1.5rem, 2.6vw, 2.4rem)", lineHeight: 1.1 },
  bannerText: { margin: 0, color: "var(--muted)", lineHeight: 1.65 },
  bannerAside: { display: "grid", gap: "12px", padding: "18px", borderRadius: "20px", background: "linear-gradient(180deg, rgba(31, 94, 255, 0.10), rgba(31, 94, 255, 0.06))", border: "1px solid rgba(31, 94, 255, 0.12)" },
  main: { display: "grid", gap: "18px" },
  pageStack: { display: "grid", gap: "18px" },
  twoCol: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "18px" },
  threeCol: { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "16px" },
  fourCol: { display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "16px" },
  workspaceGrid: { display: "grid", gap: "16px" },
  planningHero: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "16px" },
  planningGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "16px" },
  planningStack: { display: "grid", gap: "12px" },
  planningMiniGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: "12px" },
  planningCallout: { padding: "16px", borderRadius: "18px", border: "1px solid rgba(31, 94, 255, 0.14)", background: "linear-gradient(180deg, rgba(31, 94, 255, 0.08), rgba(255,255,255,0.92))" },
  planningSurface: { padding: "16px", borderRadius: "18px", border: "1px solid rgba(25, 35, 52, 0.08)", background: "linear-gradient(180deg, #ffffff, #f8fbff)" },
  planningList: { margin: 0, paddingLeft: "18px", display: "grid", gap: "8px", color: "var(--muted)", lineHeight: 1.55 },
  planningTable: { width: "100%", borderCollapse: "separate", borderSpacing: 0 },
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
  const [notice, setNotice] = useState(null);
  const [scanListStatus, setScanListStatus] = useState("Loading scans...");
  const [archiveForm, setArchiveForm] = useState(EMPTY_ARCHIVE_FORM);
  const [pathForm, setPathForm] = useState(EMPTY_PATH_FORM);
  const [sampleChoice, setSampleChoice] = useState("");
  const [quickLoading, setQuickLoading] = useState(false);
  const [quickProgress, setQuickProgress] = useState(0);
  const [quickStage, setQuickStage] = useState("Ready to scan a folder.");
  const [quickReport, setQuickReport] = useState(null);
  const [targetSelections, setTargetSelections] = useState({});
  const [guardrails, setGuardrails] = useState(DEFAULT_GUARDRAILS);
  const [deepAnalysisReady, setDeepAnalysisReady] = useState(false);
  const [approvalChoice, setApprovalChoice] = useState("no");
  const [samplePreview, setSamplePreview] = useState(null);
  const [workspaceHub, setWorkspaceHub] = useState(() => createPlanningWorkspaceFallback());
  const [workspaceHubStatus, setWorkspaceHubStatus] = useState("Loading planning workspace...");
  const [visionForm, setVisionForm] = useState(EMPTY_VISION_FORM);
  const [reviewForm, setReviewForm] = useState(EMPTY_REVIEW_FORM);
  const [refinementForm, setRefinementForm] = useState(EMPTY_REFINEMENT_FORM);
  const [testCaseForm, setTestCaseForm] = useState(EMPTY_TEST_CASE_FORM);
  const [onboardingForm, setOnboardingForm] = useState(EMPTY_ONBOARDING_FORM);
  const planningMode = useMemo(() => new URLSearchParams(window.location.search).get("mode") === "live" ? "live" : "mock", []);

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
  const guardrailSummary = useMemo(() => buildGuardrailSummary(guardrails), [guardrails]);
  const selectedPlan = useMemo(
    () => workspaceHub.plans.find((plan) => plan.id === workspaceHub.selectedPlanId) || workspaceHub.plans[0] || null,
    [workspaceHub]
  );
  const selectedPlanSummary = useMemo(
    () => (selectedPlan ? getPlanSummary(selectedPlan) : null),
    [selectedPlan]
  );
  const planningSummary = useMemo(
    () => summarizePlanCollection(workspaceHub.plans),
    [workspaceHub.plans]
  );
  const refinementSummary = useMemo(
    () => summarizeRefinementPreview(workspaceHub.refinement),
    [workspaceHub.refinement]
  );
  const testCaseSummary = useMemo(
    () => summarizeTestCasePreview(workspaceHub.testCases),
    [workspaceHub.testCases]
  );
  const onboardingSummary = useMemo(
    () => summarizeOnboardingPreview(workspaceHub.onboarding),
    [workspaceHub.onboarding]
  );

  useEffect(() => {
    return () => {
      if (reportDownloadHref) {
        URL.revokeObjectURL(reportDownloadHref);
      }
    };
  }, [reportDownloadHref]);

  async function bootstrap() {
    try {
      await loadScans();
      try {
        await loadWorkspaceHub();
      } catch (workspaceError) {
        console.warn(workspaceError);
        setWorkspaceHubStatus("Using built-in planning workspace fallback.");
      }
      setNotice({
        tone: "info",
        message: "Static mode is active. The React app is using the checked-in JSON payloads under /mock-data/ for scans, quick analysis, planning, refinement, QE, and onboarding."
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

  async function loadWorkspaceHub() {
    setWorkspaceHubStatus(planningMode === "live" ? "Connecting to planning APIs and loading generated previews..." : "Loading planning fixtures...");

    const hub = planningMode === "live"
      ? await loadLivePlanningWorkspace()
      : await loadMockPlanningWorkspace();

    setWorkspaceHub(hub);
    const initialPlan = hub.plans.find((plan) => plan.id === hub.selectedPlanId) || hub.plans[0] || null;
    setVisionForm({
      ...EMPTY_VISION_FORM,
      targetUsers: initialPlan?.targetUsers || PLANNING_SEED_VISION.targetUsers
    });
    syncWorkspaceForms(hub, setReviewForm, setRefinementForm, setTestCaseForm, setOnboardingForm);
    setWorkspaceHubStatus(planningMode === "live" ? "Planning APIs connected. Refinement, QE, and onboarding stay on generated previews until you submit live requests." : "Planning fixtures loaded.");
    return hub;
  }

  function selectWorkspacePlan(planId) {
    const nextHub = { ...workspaceHub, selectedPlanId: planId };
    setWorkspaceHub(nextHub);
    syncWorkspaceForms(nextHub, setReviewForm, setRefinementForm, setTestCaseForm, setOnboardingForm);
  }

  async function submitVisionPlan(event) {
    event.preventDefault();

    try {
      const desiredOutcomes = splitMultiline(visionForm.desiredOutcomes);
      const input = {
        productName: visionForm.productName,
        programLead: visionForm.programLead,
        targetUsers: visionForm.targetUsers,
        vision: visionForm.vision,
        desiredOutcomes
      };

      const nextPlan = planningMode === "live"
        ? await fetchJson("/api/plans", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input)
        })
        : createPlan(input, { createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });

      const plans = [nextPlan, ...workspaceHub.plans.filter((plan) => plan.id !== nextPlan.id)];
      const nextHub = { ...workspaceHub, plans, selectedPlanId: nextPlan.id };
      setWorkspaceHub(nextHub);
      syncWorkspaceForms(nextHub, setReviewForm, setRefinementForm, setTestCaseForm, setOnboardingForm);
      setVisionForm(EMPTY_VISION_FORM);
      setWorkspaceHubStatus(`Created ${nextPlan.productName}.`);
      setNotice({ tone: "success", message: `Created planning workflow for ${nextPlan.productName}.` });
      setActivePage("planning");
    } catch (error) {
      handleWorkspaceError(error, "Unable to create the plan.");
    }
  }

  async function submitPlanReviewApproval(stage) {
    if (!selectedPlan) {
      setWorkspaceHubStatus("Select a plan before approving a review stage.");
      return;
    }

    try {
      const payload = {
        reviewer: reviewForm.reviewer,
        notes: reviewForm.notes
      };
      const updatedPlan = planningMode === "live"
        ? await fetchJson(`/api/plans/${encodeURIComponent(selectedPlan.id)}/reviews/${encodeURIComponent(stage.toLowerCase())}/approve`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        })
        : approveReview(selectedPlan, stage, payload, { reviewedAt: new Date().toISOString() });

      const plans = workspaceHub.plans.map((plan) => (plan.id === updatedPlan.id ? updatedPlan : plan));
      const nextHub = { ...workspaceHub, plans, selectedPlanId: updatedPlan.id };
      setWorkspaceHub(nextHub);
      syncWorkspaceForms(nextHub, setReviewForm, setRefinementForm, setTestCaseForm, setOnboardingForm);
      setWorkspaceHubStatus(`${prettyReviewStage(stage)} approved for ${updatedPlan.productName}.`);
      setNotice({ tone: "success", message: `${prettyReviewStage(stage)} approved for ${updatedPlan.productName}.` });
    } catch (error) {
      handleWorkspaceError(error, `Unable to approve ${prettyReviewStage(stage)}.`);
    }
  }

  function togglePlanningOnboardingTask(taskId) {
    if (!selectedPlan) {
      return;
    }

    try {
      const updatedPlan = completeOnboardingTask(selectedPlan, taskId, {
        completedAt: new Date().toISOString()
      });
      setWorkspaceHub({
        ...workspaceHub,
        plans: workspaceHub.plans.map((plan) => (plan.id === updatedPlan.id ? updatedPlan : plan))
      });
      setWorkspaceHubStatus("Updated onboarding checklist progress.");
    } catch (error) {
      handleWorkspaceError(error, "Unable to update the onboarding checklist.");
    }
  }

  async function submitRefinementStory(event) {
    event.preventDefault();

    try {
      const payload = {
        notes: refinementForm.notes,
        candidateProblemStatement: refinementForm.candidateProblemStatement,
        candidateStorySummary: refinementForm.candidateStorySummary,
        parentEpicLink: refinementForm.parentEpicLink,
        labels: splitCommaValues(refinementForm.labels),
        sprint: refinementForm.sprint,
        estimatePoints: refinementForm.estimatePoints && Number.isFinite(Number.parseInt(refinementForm.estimatePoints, 10))
          ? Number.parseInt(refinementForm.estimatePoints, 10)
          : null,
        references: splitMultiline(refinementForm.references),
        teamContext: refinementForm.teamContext
      };

      const refinement = planningMode === "live"
        ? await fetchJson("/api/refinement/stories", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        })
        : createRefinementStoryPackage(payload);

      setWorkspaceHub((current) => ({ ...current, refinement }));
      setTestCaseForm((current) => ({
        ...current,
        storySummary: refinement.storySummary,
        acceptanceCriteria: refinement.acceptanceCriteria.join("\n"),
        storyTitle: selectedPlan?.productName || current.storyTitle
      }));
      setWorkspaceHubStatus("Refinement story package generated.");
    } catch (error) {
      handleWorkspaceError(error, "Unable to generate the refinement story.");
    }
  }

  async function submitGeneratedTestCases(event) {
    event.preventDefault();

    try {
      const payload = {
        storySummary: testCaseForm.storySummary,
        acceptanceCriteria: splitMultiline(testCaseForm.acceptanceCriteria),
        storyTitle: testCaseForm.storyTitle || selectedPlan?.productName,
        environment: testCaseForm.environment
      };
      const testCases = planningMode === "live"
        ? await fetchJson("/api/test-cases", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        })
        : generateTestCases(payload);

      setWorkspaceHub((current) => ({ ...current, testCases }));
      setWorkspaceHubStatus("QE test cases generated.");
    } catch (error) {
      handleWorkspaceError(error, "Unable to generate test cases.");
    }
  }

  async function submitOnboardingQuestion(event) {
    event.preventDefault();

    try {
      const payload = {
        role: onboardingForm.role,
        journeyType: onboardingForm.journeyType,
        question: onboardingForm.question
      };
      const onboarding = planningMode === "live"
        ? await fetchJson("/api/onboarding/query", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        })
        : answerOnboardingQuery(payload, workspaceHub.onboardingDocuments);

      setWorkspaceHub((current) => ({ ...current, onboarding }));
      setWorkspaceHubStatus("Onboarding guidance updated.");
    } catch (error) {
      handleWorkspaceError(error, "Unable to answer the onboarding question.");
    }
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
        sourceFilename: archiveForm.sourceFilename,
        displayName: archiveForm.displayName,
        requestedBy: archiveForm.requestedBy
      };
      const response = createMockArchiveScan(payload);
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

  function handleWorkspaceError(error, fallbackMessage) {
    console.error(error);
    const message = error instanceof PlanningError
      ? error.message
      : error?.message || fallbackMessage;
    setWorkspaceHubStatus(message);
    setNotice({ tone: "danger", message });
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

  const selectedSample = useMemo(
    () => SAMPLE_PROJECTS.find((sample) => sample.id === sampleChoice) || null,
    [sampleChoice]
  );
  const activeSample = useMemo(
    () => resolveSampleForPath(pathForm.path, selectedSample) || selectedSample,
    [pathForm.path, selectedSample]
  );
  const quickRows = quickReport?.rows || [];
  const quickStats = quickReport
    ? {
        technologies: quickReport.technologies.length,
        databases: quickReport.databases.length,
        libraries: quickReport.libraries.length,
        risks: quickReport.risks.length
      }
    : null;
  const reportDownloadLabel = quickReport ? `complete-report-${quickReport.sampleId}` : "complete-report";
  const targetGroups = useMemo(
    () => quickReport ? groupTargetRows(quickReport.targets || []) : buildTargetGroupsForSample(activeSample),
    [activeSample, quickReport]
  );

  function resetQuickFlow() {
    setQuickLoading(false);
    setQuickProgress(0);
    setQuickStage("Ready to scan a project folder.");
    setQuickReport(null);
    setTargetSelections({});
    setGuardrails(buildGuardrailDefaults());
    setDeepAnalysisReady(false);
    setApprovalChoice("no");
    setSamplePreview(null);
  }

  async function startQuickAnalysis(event) {
    event?.preventDefault?.();
    const folderPath = String(pathForm.path || "").trim();
    if (!folderPath) {
      setNotice({ tone: "warning", message: "Enter a folder path first." });
      return;
    }

    setQuickLoading(true);
    setQuickProgress(0);
    setQuickStage("Reading folder");
    setDeepAnalysisReady(false);
    setQuickReport(null);
    setTargetSelections({});
    const defaultGuardrails = buildGuardrailDefaults();
    setGuardrails(defaultGuardrails);
    setApprovalChoice("no");
    setSamplePreview(null);
    setActivePage("home");

    for (const [progress, stage] of QUICK_SCAN_STEPS) {
      await delay(240);
      setQuickProgress(progress);
      setQuickStage(stage);
    }

    let report;
    try {
      const response = await fetch("/api/quick-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: folderPath })
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "Quick analysis failed.");
      }
      report = payload;
    } catch (error) {
      setQuickLoading(false);
      setNotice({ tone: "danger", message: error?.message || "Quick analysis failed." });
      return;
    }

    const resolvedSample = resolveSampleForPath(folderPath, selectedSample);
    setSampleChoice(resolvedSample?.id || "");
    const defaults = Object.fromEntries(report.targets.map((item) => [item.id, item.defaultTarget]));
    const scanWarnings = report.risks.map((risk, index) => ({
      code: `RISK_${index + 1}`,
      severity: "INFO",
      message: risk
    }));
    const primaryTechnology = report.primaryTechnology || resolvedSample?.technology || "Workspace";
    const detectorRows = report.technologies.map((item) => ({
      ecosystem: primaryTechnology,
      component: item.label,
      detectedVersion: item.current,
      confidence: "HIGH"
    }));
    const policyRows = [...report.technologies, ...report.databases, ...report.libraries].map((item) => ({
      ecosystem: primaryTechnology,
      component: item.label,
      supportStatus: buildSupportStatus(item.label, item.current),
      version: item.current,
      source: "quick-analysis"
    }));
    const recommendationRows = report.nextSteps.map((step, index) => ({
      ecosystem: primaryTechnology,
      component: `Step ${index + 1}`,
      recommendedVersion: index === 0 ? report.targets[0]?.defaultTarget || "Target version" : "Review",
      rationale: step
    }));
    const selectedScanDetail = {
      id: report.id,
      status: "COMPLETED",
      sourceType: "LOCAL_PATH",
      displayName: report.sampleLabel,
      requestedBy: "demo",
      sourceReference: report.folderPath,
      createdAt: report.generatedAt,
      startedAt: report.generatedAt,
      completedAt: report.generatedAt,
      updatedAt: report.generatedAt,
      lifecycle: ["QUEUED", "ANALYZING", "AGGREGATING", "COMPLETED"],
      warnings: scanWarnings
    };
    const selectedReportDetail = {
      id: report.id,
      applicationName: "Modernize Application Accelerator",
      status: "READY",
      generatedAt: report.generatedAt,
      metadata: {
        sourceType: "LOCAL_PATH",
        sourceReference: report.folderPath,
        requestedBy: "demo"
      },
      workspace: {
        normalizedWorkspacePath: report.folderPath,
        normalizationStatus: "READY"
      },
      warnings: scanWarnings,
      detectors: detectorRows,
      policyStatuses: policyRows,
      recommendations: recommendationRows,
      guardrails: buildGuardrailSummary(defaultGuardrails)
    };
    setQuickReport(report);
    setTargetSelections(defaults);
    setSelectedScan(selectedScanDetail);
    setSelectedReport(selectedReportDetail);
    setQuickLoading(false);
    setNotice({ tone: "success", message: `${report.sampleLabel} scanned from the provided folder path. Review the short report, download the report, and choose target versions.` });
  }

  function updateTargetSelection(itemId, value) {
    setTargetSelections((current) => ({ ...current, [itemId]: value }));
  }

  function handleSampleFolderChange(event) {
    const nextId = event.target.value;
    const sample = SAMPLE_PROJECTS.find((entry) => entry.id === nextId) || null;
    resetQuickFlow();
    setSampleChoice(nextId);
    setPathForm((current) => ({ ...current, path: sample?.path || "" }));
    if (sample) {
      setNotice({ tone: "info", message: `${sample.label} loaded into the folder path field.` });
    }
  }

  function downloadCompleteReport() {
    if (!quickReport) {
      setNotice({ tone: "warning", message: "Run quick analysis before downloading the complete report." });
      return;
    }

    const payload = buildCompleteReport(quickReport, targetSelections, deepAnalysisReady, guardrailSummary, samplePreview);
    downloadJson(reportDownloadLabel, payload);
    setNotice({ tone: "success", message: "Complete report downloaded." });
  }

  function openDeepAnalysis() {
    if (!quickReport) {
      setNotice({ tone: "warning", message: "Run quick analysis first." });
      return;
    }
    setDeepAnalysisReady(true);
    setActivePage("overview");
    setNotice({ tone: "success", message: "Deeper analysis menus are now unlocked." });
  }

  function updateGuardrail(key, value) {
    setGuardrails((current) => ({ ...current, [key]: value }));
  }

  function finalizeSampleConversion() {
    if (!quickReport || approvalChoice !== "yes") {
      setNotice({ tone: "warning", message: "Choose Yes in the finalization section before generating the sample conversion preview." });
      return;
    }
    const packagePayload = buildSampleConversionPackage(quickReport, targetSelections, guardrailSummary, deepAnalysisReady);
    downloadJson(`sample-conversion-${quickReport.sampleId}`, packagePayload);

    setSamplePreview({
      title: `${quickReport.sampleLabel} modernization preview`,
      folder: `generated-samples/${quickReport.sampleId}`,
      summary: "A sample conversion preview is ready based on the selected targets and current enterprise guardrails.",
      lines: [
        ...packagePayload.targets.map((entry) => `${entry.label}: ${entry.selected}`),
        ...packagePayload.guardrails.map((entry) => `${entry.label}: ${entry.value}`)
      ]
    });
    setNotice({ tone: "success", message: "Sample conversion preview prepared from the selected targets and guardrails." });
  }

  return (
    <>
      <div style={STYLES.shell}>
        <header id="app-header" style={STYLES.header}>
          <div style={STYLES.brand}>
            <div className="pill primary">MM</div>
            <div>
              <p style={STYLES.eyebrow}>Modernize Minds</p>
              <h1 style={STYLES.title}>Modernize Application Accelerator</h1>
            </div>
            <p style={STYLES.subtitle}>A cleaner workspace for quick stack discovery, sample-project folders and path scans, short modernization reporting, and the new planning hub for refinement, QE, and onboarding.</p>
            <div style={STYLES.chipRow}>
              <span className="pill info">Static demo mode</span>
              <span className="pill info">{workspaceHubStatus}</span>
              <span className="pill primary">{selectedScan ? `Selected: ${selectedScan.displayName}` : "No scan selected"}</span>
              <span className="pill">{selectedScan ? formatSelectedSource(selectedScan.sourceType) : "Sample project folder"}</span>
            </div>
          </div>
          <section id="api-reference" style={STYLES.brand}>
            <p style={STYLES.eyebrow}>Workspace snapshot</p>
            <h2 style={{ margin: 0 }}>Included flows</h2>
            <p style={STYLES.subtitle}>Sample-folder loading, manual path scans, quick analysis, scan registry, selected reports, documentation, roadmap, the planning hub, and help all live in one workspace.</p>
            <div style={STYLES.threeCol}>
              <MetricCard label="Total scans" value={summary.totalScans} />
              <MetricCard label="Complete" value={summary.completeScans} />
              <MetricCard label="Report ready" value={summary.reportReadyScans} />
            </div>
          </section>
        </header>

        <nav aria-label="Workspace sections" style={STYLES.navBar}>
          {NAV_ITEMS.map((item) => (
            (() => {
              const locked = !deepAnalysisReady && !["home", "help", "planning"].includes(item.id);
              return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActivePage(item.id)}
              disabled={locked}
              style={{ ...STYLES.navButton(activePage === item.id), cursor: locked ? "not-allowed" : "pointer", opacity: locked ? 0.55 : 1 }}
              aria-current={activePage === item.id ? "page" : undefined}
            >
              <span style={STYLES.navKicker}>{item.kicker}</span>
              <span style={STYLES.navLabel}>{item.label}</span>
            </button>
              );
            })()
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
              <span className="pill info">{selectedScan ? selectedScan.status : "Ready to scan"}</span>
              <span className="pill">{selectedScan ? formatSelectedSource(selectedScan.sourceType) : "Folder-first workflow"}</span>
            </div>
            <p style={STYLES.bannerText}>Use the top tabs to move between summary, analysis, documentation, roadmap, and help.</p>
            <div className="actions-row">
              <button type="button" className="secondary" onClick={() => setDrawerOpen((current) => !current)} disabled={!selectedScan}>
                {drawerOpen ? "Hide selected scan" : "Open selected scan"}
              </button>
              <button type="button" className="secondary" onClick={() => setActivePage("planning")}>
                Open planning hub
              </button>
              <span className="muted-line">{selectedScan ? formatDate(selectedScan.updatedAt || selectedScan.createdAt) : "No scan loaded yet"}</span>
            </div>
          </div>
        </section>

        <main id="main-content" style={STYLES.main}>
          {notice?.message ? (
            <section id="app-notice" className={`notice notice-${notice.tone || "info"}`} aria-live="polite">{notice.message}</section>
          ) : null}

          {activePage === "home" && (
            <div className="stack">
              <section className="card">
                <div className="card-body stack">
                  <div style={STYLES.twoCol}>
                    <div className="stack">
                      <div>
                        <p style={STYLES.cardEyebrow}>Folder-first scan</p>
                        <h2 style={{ marginTop: 0 }}>Start with one folder path or sample project</h2>
                        <p className="muted-line">Choose a sample folder from the dropdown or type a local folder path, then run quick analysis to surface the stack inventory from that project location.</p>
                      </div>
                        <Field label="Sample folder location">
                          <select value={sampleChoice} onChange={handleSampleFolderChange}>
                            <option value="">Select a sample folder</option>
                            {SAMPLE_PROJECTS.map((sample) => (
                              <option key={sample.id} value={sample.id}>
                                {sample.label}
                              </option>
                            ))}
                          </select>
                        </Field>
                        <Field label="Folder path">
                          <input
                            value={pathForm.path}
                            onChange={(event) => {
                              const nextPath = event.target.value;
                              resetQuickFlow();
                              setPathForm({ ...pathForm, path: nextPath });
                              const matchingSample = resolveSampleForPath(nextPath, selectedSample);
                              setSampleChoice(matchingSample?.id || "");
                            }}
                            placeholder="Enter local project folder path"
                          />
                        </Field>
                      <div className="actions-row">
                        <button type="button" onClick={(event) => void startQuickAnalysis(event)} disabled={quickLoading}>
                          {quickLoading ? `${quickProgress}% scanning` : "Quick analysis"}
                        </button>
                      </div>
                      <p className="muted-line">Choose a sample folder or paste a project folder path and quick analysis will scan that location directly on your machine.</p>
                    </div>
                    <div className="stack">
                      <div className="card" style={{ padding: 18 }}>
                        <p style={STYLES.cardEyebrow}>Quick analysis progress</p>
                        <h3 style={{ marginTop: 0 }}>{quickStage}</h3>
                        <div style={{ height: 12, borderRadius: 999, background: "rgba(15, 23, 42, 0.08)", overflow: "hidden" }}>
                          <div style={{ width: `${quickProgress}%`, height: "100%", borderRadius: 999, background: "linear-gradient(90deg, #ff7a45, #ffb46f)", transition: "width 220ms ease" }} />
                        </div>
                        <p className="muted-line" style={{ marginBottom: 0 }}>The progress bar stays visible while the folder is scanned and the short report is prepared.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
              <section id="scan-filters">
                <h4>Filter controls</h4>
                <form id="scan-filter-form">
                  <Field label="Search"><input type="search" value={scanFilters.search} onChange={(event) => setScanFilters({ ...scanFilters, search: event.target.value })} placeholder="Search scans, paths, or reports" /></Field>
                  <Field label="Status"><select value={scanFilters.status} onChange={(event) => setScanFilters({ ...scanFilters, status: event.target.value })}><option value="">Any status</option><option value="pending">Pending</option><option value="running">Running</option><option value="complete">Complete</option><option value="failed">Failed</option></select></Field>
                  <Field label="Source"><select value={scanFilters.source} onChange={(event) => setScanFilters({ ...scanFilters, source: event.target.value })}><option value="">Any source</option><option value="archive">Sample folder</option><option value="path">Local path</option></select></Field>
                  <Field label="Requested by"><input value={scanFilters.requestedBy} onChange={(event) => setScanFilters({ ...scanFilters, requestedBy: event.target.value })} placeholder="ui" /></Field>
                  <Field label="Sort"><select value={scanFilters.sort} onChange={(event) => setScanFilters({ ...scanFilters, sort: event.target.value })}><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="name">Name</option><option value="status">Status</option></select></Field>
                  <div className="actions-row"><button type="button" onClick={() => setScanFilters(DEFAULT_SCAN_FILTERS)}>Reset filters</button></div>
                </form>
              </section>

              {quickReport ? (
                <>
                  <section className="card">
                    <div className="card-body stack">
                      <div style={STYLES.cardHeader}>
                        <div>
                          <p style={STYLES.cardEyebrow}>Quick analysis report</p>
                          <h2 style={{ marginTop: 0 }}>{quickReport.sampleLabel}</h2>
                          <p className="muted-line">{quickReport.summary}</p>
                        </div>
                        <button type="button" className="secondary" onClick={downloadCompleteReport}>
                          Download complete report
                        </button>
                      </div>
                      <div style={STYLES.threeCol}>
                        <MetricCard label="Technologies" value={quickStats.technologies} />
                        <MetricCard label="Databases" value={quickStats.databases} />
                        <MetricCard label="Libraries" value={quickStats.libraries} />
                      </div>
                      <div className="card" style={{ padding: 16 }}>
                        <p style={STYLES.cardEyebrow}>Detected stack</p>
                        <div className="table-wrap">
                          <table>
                            <thead>
                              <tr>
                                <th>Category</th>
                                <th>Item</th>
                                <th>Current version</th>
                                <th>Target hint</th>
                              </tr>
                            </thead>
                            <tbody>
                              {quickRows.map((row) => (
                                <tr key={`${row.group}-${row.label}`}>
                                  <td>{row.group}</td>
                                  <td><strong>{row.label}</strong></td>
                                  <td>{row.current}</td>
                                  <td>{row.target}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                      <div style={STYLES.twoCol}>
                        <div className="card" style={{ padding: 16 }}>
                          <p style={STYLES.cardEyebrow}>Risks</p>
                          <ul style={{ marginTop: 0, paddingLeft: 18 }}>
                            {quickReport.risks.map((risk) => <li key={risk}>{risk}</li>)}
                          </ul>
                        </div>
                        <div className="card" style={{ padding: 16 }}>
                          <p style={STYLES.cardEyebrow}>Next steps</p>
                          <ul style={{ marginTop: 0, paddingLeft: 18 }}>
                            {quickReport.nextSteps.map((step) => <li key={step}>{step}</li>)}
                          </ul>
                        </div>
                      </div>
                    </div>
                  </section>

                  <section className="card">
                    <div className="card-body stack">
                      <div style={STYLES.cardHeader}>
                        <div>
                          <p style={STYLES.cardEyebrow}>Target versions</p>
                          <h2 style={{ marginTop: 0 }}>Prepare the target stack before deeper analysis</h2>
                          <p className="muted-line">These selections shape the deeper analysis menus and the final modernization recommendation for the loaded project only.</p>
                        </div>
                      </div>
                      <div style={STYLES.threeCol}>
                        {targetGroups.map((group) => (
                          <div className="card" key={group.group} style={{ padding: 16 }}>
                            <p style={STYLES.cardEyebrow}>{group.group} targets</p>
                            <div className="stack">
                              {group.items.map((item) => (
                                <div key={item.id} className="card" style={{ padding: 14 }}>
                                  <h3 style={{ marginTop: 0 }}>{item.label}</h3>
                                  <p className="muted-line">Current: {item.current}</p>
                                  <Field label="Target version">
                                    <select
                                      value={targetSelections[item.id] || item.defaultTarget}
                                      onChange={(event) => updateTargetSelection(item.id, event.target.value)}
                                    >
                                      {item.options.map((option) => <option key={option} value={option}>{option}</option>)}
                                    </select>
                                  </Field>
                                  <p className="muted-line">{item.note}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="card" style={{ padding: 16 }}>
                        <div style={STYLES.cardHeader}>
                          <div>
                            <p style={STYLES.cardEyebrow}>Enterprise guardrails</p>
                            <h2 style={{ marginTop: 0 }}>Set the delivery constraints</h2>
                            <p className="muted-line">These guardrails shape the estimate, what can be accelerated with Codex, and what should remain under manual control.</p>
                          </div>
                        </div>
                        <div style={STYLES.twoCol}>
                          {Object.entries(GUARDRAIL_OPTIONS).map(([key, options]) => (
                            <div className="card" key={key} style={{ padding: 14 }}>
                              <Field label={titleCase(key)}>
                                <select value={guardrails[key]} onChange={(event) => updateGuardrail(key, event.target.value)}>
                                  {options.map((option) => <option key={`${key}-${option}`} value={option}>{option}</option>)}
                                </select>
                              </Field>
                              <p className="muted-line">{GUARDRAIL_IMPACTS[key]}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="card" style={{ padding: 16 }}>
                        <div style={STYLES.cardHeader}>
                          <div>
                            <p style={STYLES.cardEyebrow}>Finalize the plan</p>
                            <h2 style={{ marginTop: 0 }}>Approve sample conversion generation</h2>
                            <p className="muted-line">Confirm the current target choices before creating the sample conversion preview.</p>
                          </div>
                        </div>
                        <div className="decision-grid">
                          <label className="decision-pill">
                            <input type="radio" name="sample-approval" checked={approvalChoice === "yes"} onChange={() => setApprovalChoice("yes")} />
                            <span>Yes, prepare the sample conversion</span>
                          </label>
                          <label className="decision-pill">
                            <input type="radio" name="sample-approval" checked={approvalChoice === "no"} onChange={() => setApprovalChoice("no")} />
                            <span>No, keep only the report for now</span>
                          </label>
                        </div>
                        <div className="actions-row">
                          <button type="button" onClick={() => void openDeepAnalysis()} className="secondary" disabled={!quickReport}>
                            Proceed to deeper analysis
                          </button>
                          <button type="button" onClick={finalizeSampleConversion} disabled={approvalChoice !== "yes"}>
                            Create sample conversion preview
                          </button>
                        </div>
                        {samplePreview && (
                          <div className="card" style={{ padding: 16 }}>
                            <p style={STYLES.cardEyebrow}>Generated preview</p>
                            <h3 style={{ marginTop: 0 }}>{samplePreview.title}</h3>
                            <p className="muted-line">{samplePreview.summary}</p>
                            <div className="table-wrap">
                              <table>
                                <tbody>
                                  <tr>
                                    <td><strong>Destination folder</strong></td>
                                    <td>{samplePreview.folder}</td>
                                  </tr>
                                  {samplePreview.lines.map((line) => (
                                    <tr key={line}>
                                      <td colSpan="2">{line}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </section>
                </>
              ) : (
                <section className="card">
                  <div className="card-body stack">
                    <p style={STYLES.cardEyebrow}>Quick report</p>
                    <h2 style={{ marginTop: 0 }}>Run quick analysis to reveal the report</h2>
                    <p className="muted-line">The report will show technologies, databases, libraries, and versions from the selected folder.</p>
                  </div>
                </section>
              )}
            </div>
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
                <div className="card" style={{ padding: 16 }}>
                  <p style={STYLES.cardEyebrow}>Applied guardrails</p>
                  <div style={STYLES.twoCol}>
                    {(selectedReport?.guardrails || guardrailSummary).map((item) => (
                      <div className="card" key={item.id} style={{ padding: 14 }}>
                        <h3 style={{ marginTop: 0 }}>{item.label}</h3>
                        <p className="muted-line">{item.value}</p>
                      </div>
                    ))}
                  </div>
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
                  <span className="pill info">Guardrails: {analysisHighlights.guardrails}</span>
                </div>
                <div className="card" style={{ padding: 16 }}>
                  <p style={STYLES.cardEyebrow}>Guardrail impact</p>
                  <div className="stack">
                    {(selectedReport?.guardrails || guardrailSummary).map((item) => (
                      <div key={item.id}>
                        <strong>{item.label}:</strong> {item.value}
                        <div className="muted-line">{item.impact}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>Type</th><th>Ecosystem</th><th>Component</th><th>Version or Status</th><th>Notes</th></tr></thead>
                    <tbody>
                      {filteredReportRows.length === 0 ? <tr><td colSpan="5">No report selected</td></tr> : filteredReportRows.map((row, index) => {
                        const unsupported = isAnalysisRowOutOfSupport(row);
                        return (
                          <tr key={`${row.type}-${row.component}-${index}`} className={unsupported ? "analysis-row-danger" : undefined}>
                            <td><span className={`result-type ${row.type}`}>{row.type}</span></td>
                            <td>{row.ecosystem}</td>
                            <td>{row.component}</td>
                            <td>
                              <span className={unsupported ? "version-chip is-unsupported" : "version-chip"}>
                                {row.version}
                              </span>
                            </td>
                            <td>{row.notes}</td>
                          </tr>
                        );
                      })}
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

          {activePage === "planning" && (
            <PlanningHubPanel
              mode={planningMode}
              plans={workspaceHub.plans}
              selectedPlan={selectedPlan}
              selectedPlanSummary={selectedPlanSummary}
              refinement={workspaceHub.refinement}
              testCases={workspaceHub.testCases}
              onboarding={workspaceHub.onboarding}
              planningSummary={planningSummary}
              refinementSummary={refinementSummary}
              testCaseSummary={testCaseSummary}
              onboardingSummary={onboardingSummary}
              visionForm={visionForm}
              reviewForm={reviewForm}
              refinementForm={refinementForm}
              testCaseForm={testCaseForm}
              onboardingForm={onboardingForm}
              setVisionForm={setVisionForm}
              setReviewForm={setReviewForm}
              setRefinementForm={setRefinementForm}
              setTestCaseForm={setTestCaseForm}
              setOnboardingForm={setOnboardingForm}
              status={workspaceHubStatus}
              onSelectPlan={selectWorkspacePlan}
              onCreatePlan={(event) => void submitVisionPlan(event)}
              onApproveEpicReview={() => void submitPlanReviewApproval(REVIEW_STAGES.EPICS)}
              onApproveFeatureReview={() => void submitPlanReviewApproval(REVIEW_STAGES.FEATURES)}
              onToggleOnboardingTask={togglePlanningOnboardingTask}
              onGenerateRefinement={(event) => void submitRefinementStory(event)}
              onGenerateTestCases={(event) => void submitGeneratedTestCases(event)}
              onAskOnboarding={(event) => void submitOnboardingQuestion(event)}
              onCopy={handleCopy}
              onExport={handleExport}
              onRefresh={() => loadWorkspaceHub().catch((error) => {
                console.warn(error);
                setWorkspaceHubStatus("Using built-in planning workspace fallback.");
              })}
            />
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
                      <tr><td><strong>Sample folder location</strong></td><td>Loads one of the bundled demo folders into the folder path field for a quick test.</td></tr>
                      <tr><td><strong>Manual path</strong></td><td>Lets you paste a local folder path directly before scanning.</td></tr>
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
            <div className="pill primary">{selectedReport?.applicationName || "Modernize Application Accelerator"} report</div>
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

function PlanningHubPanel({
  mode,
  plans,
  selectedPlan,
  selectedPlanSummary,
  refinement,
  testCases,
  onboarding,
  planningSummary,
  refinementSummary,
  testCaseSummary,
  onboardingSummary,
  visionForm,
  reviewForm,
  refinementForm,
  testCaseForm,
  onboardingForm,
  setVisionForm,
  setReviewForm,
  setRefinementForm,
  setTestCaseForm,
  setOnboardingForm,
  status,
  onSelectPlan,
  onCreatePlan,
  onApproveEpicReview,
  onApproveFeatureReview,
  onToggleOnboardingTask,
  onGenerateRefinement,
  onGenerateTestCases,
  onAskOnboarding,
  onCopy,
  onExport,
  onRefresh
}) {
  const [selectedSuiteIndex, setSelectedSuiteIndex] = useState(0);
  const onboardingFirstInteraction = onboarding?.firstInteraction?.length > 0
    ? onboarding.firstInteraction
    : [
      "What is your role?",
      "Is this your first week, or do you have a specific question?"
    ];

  useEffect(() => {
    setSelectedSuiteIndex(0);
  }, [testCases]);

  const selectedSuite = testCases?.testSuites?.[selectedSuiteIndex] || testCases?.testSuites?.[0] || null;

  return (
    <section className="card" id="planning-hub">
      <div className="card-body stack">
        <div style={STYLES.planningHero}>
          <div className="stack">
            <p className="muted-line">Agile delivery workspace</p>
            <h2 style={{ margin: 0 }}>Planning, refinement, QE, and onboarding live here</h2>
            <p style={{ margin: 0, color: "var(--muted)", lineHeight: 1.65 }}>
              The planning hub now runs the end-to-end flow: vision intake, epic review, feature review, sprint-ready story generation, QE coverage generation, and document-grounded onboarding support.
            </p>
            <div className="actions-row">
              <span className="pill info">{mode === "live" ? "Live submit mode" : "Mock fixture mode"}</span>
              <span className="pill primary">{status}</span>
            </div>
            <div className="actions-row">
              <button type="button" onClick={() => void onRefresh()}>Refresh planning workspace</button>
              <button type="button" className="secondary" onClick={() => void onCopy("planning-workspace", { plans, refinement, testCases, onboarding })}>Copy workspace JSON</button>
              <button type="button" className="secondary" onClick={() => void onExport("planning-workspace", { plans, refinement, testCases, onboarding })}>Export workspace JSON</button>
            </div>
          </div>
          <div className="stack">
            <div style={STYLES.planningCallout}>
              <p className="muted-line">Workspace summary</p>
              <div style={STYLES.planningMiniGrid}>
                <SummaryCard label="Plans" value={planningSummary.totalPlans} />
                <SummaryCard label="Epic review" value={planningSummary.epicReviewPlans} />
                <SummaryCard label="Feature review" value={planningSummary.featureReviewPlans} />
                <SummaryCard label="Story ready" value={planningSummary.storyReadyPlans} />
              </div>
            </div>
            <div className="table-wrap">
              <table style={STYLES.planningTable}>
                <tbody>
                  <tr><td><strong>Refinement criteria</strong></td><td>{refinementSummary.acceptanceCriteria}</td></tr>
                  <tr><td><strong>QE suites</strong></td><td>{testCases.testSuites?.length || 0} suites, {testCaseSummary.totalTestCases} cases</td></tr>
                  <tr><td><strong>Onboarding citations</strong></td><td>{onboardingSummary.citedDocuments} cited documents</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div style={STYLES.planningGrid}>
          <article className="card" style={STYLES.planningSurface}>
            <div className="card-body stack">
              <div style={STYLES.cardHeader}>
                <div>
                  <p className="muted-line">1. Vision intake</p>
                  <h3 style={{ margin: 0 }}>Create a new planning workflow</h3>
                </div>
              </div>
              <form onSubmit={onCreatePlan}>
                <div style={STYLES.formGrid}>
                  <Field label="Product name">
                    <input value={visionForm.productName} onChange={(event) => setVisionForm({ ...visionForm, productName: event.target.value })} placeholder="Migration Helper Planning" />
                  </Field>
                  <Field label="Program lead">
                    <input value={visionForm.programLead} onChange={(event) => setVisionForm({ ...visionForm, programLead: event.target.value })} placeholder="Program Lead" required />
                  </Field>
                  <Field label="Target users">
                    <input value={visionForm.targetUsers} onChange={(event) => setVisionForm({ ...visionForm, targetUsers: event.target.value })} placeholder="Program leads, agile facilitators, QE engineers" />
                  </Field>
                  <Field label="Desired outcomes">
                    <textarea value={visionForm.desiredOutcomes} onChange={(event) => setVisionForm({ ...visionForm, desiredOutcomes: event.target.value })} rows={4} placeholder="One outcome per line" />
                  </Field>
                </div>
                <Field label="Vision statement">
                  <textarea value={visionForm.vision} onChange={(event) => setVisionForm({ ...visionForm, vision: event.target.value })} rows={5} placeholder="Describe the program lead vision that should be broken into reviewed epics, features, and stories." required />
                </Field>
                <div className="actions-row">
                  <button type="submit">Create plan</button>
                  <button type="button" className="secondary" onClick={() => setVisionForm(EMPTY_VISION_FORM)}>Clear</button>
                </div>
              </form>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Plan</th><th>Stage</th><th>Counts</th><th>Actions</th></tr></thead>
                  <tbody>
                    {plans.length > 0 ? plans.map((plan) => {
                      const summary = getPlanSummary(plan);
                      return (
                        <tr key={plan.id} className={selectedPlan?.id === plan.id ? "row-selected" : ""}>
                          <td><strong>{plan.productName}</strong><span className="muted-line">{plan.id}</span></td>
                          <td><span className={`pill ${planningStageTone(plan.currentStage)}`}>{prettyPlanStage(plan.currentStage)}</span></td>
                          <td>{summary.counts.epics} epics / {summary.counts.features} features / {summary.counts.stories} stories</td>
                          <td><button type="button" className="secondary" onClick={() => onSelectPlan(plan.id)}>Open</button></td>
                        </tr>
                      );
                    }) : <tr><td colSpan="4">No plans are loaded yet.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </article>

          <article className="card" style={STYLES.planningSurface}>
            <div className="card-body stack">
              <div style={STYLES.cardHeader}>
                <div>
                  <p className="muted-line">2. Review gates and backlog</p>
                  <h3 style={{ margin: 0 }}>{selectedPlan ? selectedPlan.productName : "Select a plan"}</h3>
                </div>
                <span className={`pill ${planningStageTone(selectedPlan?.currentStage)}`}>{selectedPlan ? prettyPlanStage(selectedPlan.currentStage) : "No selection"}</span>
              </div>
              {selectedPlan ? (
                <>
                  <p style={{ margin: 0, color: "var(--muted)", lineHeight: 1.6 }}>{selectedPlan.vision}</p>
                  <div style={STYLES.planningMiniGrid}>
                    <SummaryCard label="Epics" value={selectedPlanSummary?.counts.epics || 0} />
                    <SummaryCard label="Features" value={selectedPlanSummary?.counts.features || 0} />
                    <SummaryCard label="Stories" value={selectedPlanSummary?.counts.stories || 0} />
                    <SummaryCard label="Onboarding ready" value={selectedPlanSummary?.onboarding.ready || 0} />
                  </div>
                  <div style={STYLES.planningCallout}>
                    <strong>Desired outcomes</strong>
                    <ul style={STYLES.planningList}>
                      {selectedPlan.desiredOutcomes.map((item) => <li key={item}>{item}</li>)}
                    </ul>
                  </div>
                  <div style={STYLES.formGrid}>
                    <Field label="Reviewer">
                      <input value={reviewForm.reviewer} onChange={(event) => setReviewForm({ ...reviewForm, reviewer: event.target.value })} placeholder="Reviewer name" />
                    </Field>
                    <Field label="Review notes">
                      <textarea value={reviewForm.notes} onChange={(event) => setReviewForm({ ...reviewForm, notes: event.target.value })} rows={3} placeholder="Optional approval notes" />
                    </Field>
                  </div>
                  <div className="actions-row">
                    <button type="button" onClick={onApproveEpicReview} disabled={!selectedPlanSummary?.stageSummary.canApproveEpicReview}>Approve epic review</button>
                    <button type="button" onClick={onApproveFeatureReview} disabled={!selectedPlanSummary?.stageSummary.canApproveFeatureReview}>Approve feature review</button>
                  </div>
                  <div className="table-wrap">
                    <table>
                      <thead><tr><th>Review stage</th><th>Status</th><th>Reviewer</th><th>Notes</th></tr></thead>
                      <tbody>
                        {selectedPlan.reviewCheckpoints.map((checkpoint) => (
                          <tr key={checkpoint.stage}>
                            <td>{prettyReviewStage(checkpoint.stage)}</td>
                            <td>{checkpoint.status}</td>
                            <td>{checkpoint.reviewer || "Unassigned"}</td>
                            <td>{checkpoint.notes || "No notes"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="table-wrap">
                    <table>
                      <thead><tr><th>Epics</th><th>Owner</th><th>Status</th></tr></thead>
                      <tbody>
                        {selectedPlan.epics.map((item) => (
                          <tr key={item.id}>
                            <td><strong>{item.title}</strong><span className="muted-line">{item.summary}</span></td>
                            <td>{item.owner}</td>
                            <td>{item.status}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="table-wrap">
                    <table>
                      <thead><tr><th>Features</th><th>Owner</th><th>Status</th></tr></thead>
                      <tbody>
                        {selectedPlan.features.length > 0 ? selectedPlan.features.map((item) => (
                          <tr key={item.id}>
                            <td><strong>{item.title}</strong><span className="muted-line">{item.summary}</span></td>
                            <td>{item.owner}</td>
                            <td>{item.status}</td>
                          </tr>
                        )) : <tr><td colSpan="3">Features unlock after epic review approval.</td></tr>}
                      </tbody>
                    </table>
                  </div>
                  <div className="table-wrap">
                    <table>
                      <thead><tr><th>Stories</th><th>Owner</th><th>Status</th></tr></thead>
                      <tbody>
                        {selectedPlan.stories.length > 0 ? selectedPlan.stories.map((item) => (
                          <tr key={item.id}>
                            <td><strong>{item.title}</strong><span className="muted-line">{item.summary}</span></td>
                            <td>{item.owner}</td>
                            <td>{item.status}</td>
                          </tr>
                        )) : <tr><td colSpan="3">Stories unlock after feature review approval.</td></tr>}
                      </tbody>
                    </table>
                  </div>
                  <div style={STYLES.planningCallout}>
                    <strong>Onboarding checklist progression</strong>
                    <ul style={STYLES.planningList}>
                      {selectedPlan.onboardingChecklist.map((task) => (
                        <li key={task.id}>
                          <strong>{task.title}</strong> - {task.status}. {task.detail}
                          {task.status !== "COMPLETE" && (
                            <button type="button" className="secondary" style={{ marginLeft: 10 }} onClick={() => onToggleOnboardingTask(task.id)} disabled={task.status !== "READY"}>
                              Mark complete
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                </>
              ) : (
                <div style={STYLES.empty}><div><h3>No plan selected</h3><p>Choose a plan from the list or create a new one to start the workflow.</p></div></div>
              )}
            </div>
          </article>

          <article className="card" style={STYLES.planningSurface}>
            <div className="card-body stack">
              <div style={STYLES.cardHeader}>
                <div>
                  <p className="muted-line">3. Refinement facilitation</p>
                  <h3 style={{ margin: 0 }}>Turn messy notes into a sprint-ready story</h3>
                </div>
                <span className="pill info">{refinement.estimation}</span>
              </div>
              <form onSubmit={onGenerateRefinement}>
                <Field label="Refinement notes">
                  <textarea value={refinementForm.notes} onChange={(event) => setRefinementForm({ ...refinementForm, notes: event.target.value })} rows={6} placeholder="Paste messy notes, discussion summaries, or verbal descriptions from backlog refinement." />
                </Field>
                <div style={STYLES.formGrid}>
                  <Field label="Candidate problem statement">
                    <textarea value={refinementForm.candidateProblemStatement} onChange={(event) => setRefinementForm({ ...refinementForm, candidateProblemStatement: event.target.value })} rows={3} placeholder="Optional problem statement to preserve or validate." />
                  </Field>
                  <Field label="Candidate story summary">
                    <textarea value={refinementForm.candidateStorySummary} onChange={(event) => setRefinementForm({ ...refinementForm, candidateStorySummary: event.target.value })} rows={3} placeholder="Optional As a / I want / so that I can summary." />
                  </Field>
                  <Field label="Parent epic link">
                    <input value={refinementForm.parentEpicLink} onChange={(event) => setRefinementForm({ ...refinementForm, parentEpicLink: event.target.value })} placeholder="plan-xxx-E1" />
                  </Field>
                  <Field label="Labels">
                    <input value={refinementForm.labels} onChange={(event) => setRefinementForm({ ...refinementForm, labels: event.target.value })} placeholder="refinement, ready" />
                  </Field>
                  <Field label="Sprint">
                    <input value={refinementForm.sprint} onChange={(event) => setRefinementForm({ ...refinementForm, sprint: event.target.value })} placeholder="Sprint 14" />
                  </Field>
                  <Field label="Estimate points">
                    <input type="number" min="0" value={refinementForm.estimatePoints} onChange={(event) => setRefinementForm({ ...refinementForm, estimatePoints: event.target.value })} placeholder="3" />
                  </Field>
                  <Field label="References">
                    <textarea value={refinementForm.references} onChange={(event) => setRefinementForm({ ...refinementForm, references: event.target.value })} rows={3} placeholder="One reference per line" />
                  </Field>
                  <Field label="Team context">
                    <textarea value={refinementForm.teamContext} onChange={(event) => setRefinementForm({ ...refinementForm, teamContext: event.target.value })} rows={3} placeholder="Agile facilitator, QE lead, program lead..." />
                  </Field>
                </div>
                <div className="actions-row">
                  <button type="submit">Generate story package</button>
                  <button type="button" className="secondary" onClick={() => setRefinementForm(EMPTY_REFINEMENT_FORM)}>Clear</button>
                  <button type="button" className="secondary" onClick={() => void onCopy("refinement-story", refinement)}>Copy result</button>
                </div>
              </form>
              <div style={STYLES.planningCallout}>
                <strong>Problem Statement</strong>
                <p style={{ margin: "8px 0 0", color: "var(--muted)", lineHeight: 1.6 }}>{refinement.problemStatement}</p>
              </div>
              <div style={STYLES.planningCallout}>
                <strong>Story Summary</strong>
                <p style={{ margin: "8px 0 0", lineHeight: 1.6 }}>{refinement.storySummary}</p>
              </div>
              <div style={STYLES.planningMiniGrid}>
                <SummaryCard label="Acceptance criteria" value={refinementSummary.acceptanceCriteria} />
                <SummaryCard label="Dependencies" value={refinementSummary.dependencies} />
                <SummaryCard label="References" value={refinementSummary.references} />
                <SummaryCard label="Gaps" value={refinementSummary.gaps} />
              </div>
              <WorkspaceList title="Acceptance Criteria" items={refinement.acceptanceCriteria || []} />
              <WorkspaceList title="Dependencies" items={refinement.dependencies || []} />
              <WorkspaceList title="References" items={refinement.references || []} />
              <WorkspaceList title="Definition Of Ready Validation" items={refinement.definitionOfReadyValidation || []} />
              <WorkspaceList title="Gaps" items={refinement.gaps || []} />
              <WorkspaceList title="Normalization Notes" items={refinement.normalizationNotes || []} />
            </div>
          </article>

          <article className="card" style={STYLES.planningSurface}>
            <div className="card-body stack">
              <div style={STYLES.cardHeader}>
                <div>
                  <p className="muted-line">4. Test case generator</p>
                  <h3 style={{ margin: 0 }}>Acceptance criteria to execution-ready suites</h3>
                </div>
                <span className="pill info">{testCaseSummary.totalTestCases} cases</span>
              </div>
              <form onSubmit={onGenerateTestCases}>
                <div style={STYLES.formGrid}>
                  <Field label="Story title">
                    <input value={testCaseForm.storyTitle} onChange={(event) => setTestCaseForm({ ...testCaseForm, storyTitle: event.target.value })} placeholder="Refinement facilitation" />
                  </Field>
                  <Field label="Environment">
                    <input value={testCaseForm.environment} onChange={(event) => setTestCaseForm({ ...testCaseForm, environment: event.target.value })} placeholder="mock" />
                  </Field>
                </div>
                <Field label="Story summary">
                  <textarea value={testCaseForm.storySummary} onChange={(event) => setTestCaseForm({ ...testCaseForm, storySummary: event.target.value })} rows={3} placeholder="As a ..., I want to ..., so that I can ..." />
                </Field>
                <Field label="Acceptance criteria">
                  <textarea value={testCaseForm.acceptanceCriteria} onChange={(event) => setTestCaseForm({ ...testCaseForm, acceptanceCriteria: event.target.value })} rows={6} placeholder="One acceptance criterion per line" />
                </Field>
                <div className="actions-row">
                  <button type="submit">Generate test cases</button>
                  <button type="button" className="secondary" onClick={() => setTestCaseForm(EMPTY_TEST_CASE_FORM)}>Clear</button>
                  <button type="button" className="secondary" onClick={() => void onCopy("test-cases", testCases)}>Copy bundle</button>
                </div>
              </form>
              <div style={STYLES.planningMiniGrid}>
                <SummaryCard label="Positive" value={testCaseSummary.positiveCases} />
                <SummaryCard label="Negative" value={testCaseSummary.negativeCases} />
                <SummaryCard label="Edge cases" value={testCaseSummary.edgeCases} />
                <SummaryCard label="Untestable" value={testCases.summary?.untestableCriteria || 0} />
              </div>
              <div className="actions-row">
                {(testCases.testSuites || []).map((suite, index) => (
                  <button key={suite.suiteName} type="button" className="secondary" onClick={() => setSelectedSuiteIndex(index)}>
                    {suite.suiteName}
                  </button>
                ))}
              </div>
              {selectedSuite ? (
                <>
                  <div style={STYLES.planningCallout}>
                    <strong>{selectedSuite.suiteName}</strong>
                    <p style={{ margin: "8px 0 0", lineHeight: 1.6 }}>{selectedSuite.acceptanceCriterion}</p>
                    {selectedSuite.untestable && (
                      <p style={{ margin: "8px 0 0", color: "var(--danger)" }}>
                        {"\u26A0\uFE0F UNTESTABLE:"} {selectedSuite.untestableReason} Suggestion: {selectedSuite.rewriteSuggestion}
                      </p>
                    )}
                  </div>
                  <div className="table-wrap">
                    <table>
                      <thead><tr><th>Test case</th><th>Priority</th><th>Type</th><th>Expected result</th></tr></thead>
                      <tbody>
                        {selectedSuite.testCases?.length > 0 ? selectedSuite.testCases.map((testCase) => (
                          <tr key={testCase.id}>
                            <td><strong>{testCase.id}</strong><span className="muted-line">{testCase.testData}</span></td>
                            <td>{testCase.priority}</td>
                            <td>{testCase.type}</td>
                            <td>{testCase.expectedResult}</td>
                          </tr>
                        )) : <tr><td colSpan="4">No test cases loaded.</td></tr>}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : null}
              <div className="planning-list">
                <strong>Coverage gaps</strong>
                <ul style={STYLES.planningList}>
                  {(testCases.summary?.gaps || []).map((gap) => <li key={gap}>{gap}</li>)}
                </ul>
              </div>
            </div>
          </article>

          <article className="card" style={STYLES.planningSurface}>
            <div className="card-body stack">
              <div style={STYLES.cardHeader}>
                <div>
                  <p className="muted-line">5. Confluence-grounded onboarding agent</p>
                  <h3 style={{ margin: 0 }}>{onboarding.agentName || DEFAULT_ONBOARDING_AGENT_NAME}</h3>
                </div>
                <span className="pill info">{onboardingSummary.citedDocuments} cited docs</span>
              </div>
              <form onSubmit={onAskOnboarding}>
                <div style={STYLES.formGrid}>
                  <Field label="Role">
                    <input value={onboardingForm.role} onChange={(event) => setOnboardingForm({ ...onboardingForm, role: event.target.value })} placeholder="Developer" />
                  </Field>
                  <Field label="Journey">
                    <select value={onboardingForm.journeyType} onChange={(event) => setOnboardingForm({ ...onboardingForm, journeyType: event.target.value })}>
                      <option value="">Select a journey</option>
                      <option value={ONBOARDING_JOURNEY_TYPES.FIRST_WEEK}>First week</option>
                      <option value={ONBOARDING_JOURNEY_TYPES.SPECIFIC_QUESTION}>Specific question</option>
                    </select>
                  </Field>
                </div>
                <Field label="Question">
                  <textarea value={onboardingForm.question} onChange={(event) => setOnboardingForm({ ...onboardingForm, question: event.target.value })} rows={3} placeholder="How do I set up my dev environment?" />
                </Field>
                <div className="actions-row">
                  <button type="submit">Ask onboarding agent</button>
                  <button type="button" className="secondary" onClick={() => setOnboardingForm(EMPTY_ONBOARDING_FORM)}>Clear</button>
                  <button type="button" className="secondary" onClick={() => void onCopy("onboarding-response", onboarding)}>Copy answer</button>
                </div>
              </form>
              <div style={STYLES.planningCallout}>
                <strong>First interaction</strong>
                <ul style={STYLES.planningList}>
                  {onboardingFirstInteraction.map((item) => <li key={item}>{item}</li>)}
                </ul>
              </div>
              <div style={STYLES.planningCallout}>
                <strong>Answer</strong>
                <p style={{ margin: "8px 0", lineHeight: 1.6 }}>{onboarding.answer || "Ask a question to get started."}</p>
              </div>
              <WorkspaceList
                title="Cited Documents"
                items={(onboarding.citedDocuments || []).map((doc) => `${doc.documentName}${doc.section ? ` - ${doc.section}` : ""}${doc.outdated ? " (outdated)" : ""}`)}
              />
              <WorkspaceList title="Warnings" items={onboarding.warnings || []} />
              <WorkspaceList title="Next Questions" items={onboarding.nextQuestions || []} />
              <div className="table-wrap">
                <table>
                  <tbody>
                    <tr><td><strong>Suggested escalation</strong></td><td>{onboarding.suggestedEscalation || "None"}</td></tr>
                    <tr><td><strong>Fallback rule</strong></td><td>I couldn't find this in our documentation. You may want to ask the most likely team lead or support channel.</td></tr>
                  </tbody>
                </table>
              </div>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}

function WorkspaceList({ title, items }) {
  return (
    <div>
      <strong>{title}</strong>
      <ul style={STYLES.planningList}>
        {(items || []).length > 0 ? items.map((item) => <li key={item}>{item}</li>) : <li>None</li>}
      </ul>
    </div>
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
    return "Preloaded sample data";
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
      tags: ["Waiting", "Sample data"],
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
  const guardrails = report?.guardrails?.length || 0;
  const lifecycle = Array.isArray(scan?.lifecycle) && scan.lifecycle.length > 0 ? scan.lifecycle : ["QUEUED", "ANALYZING", "COMPLETED"];

  return [
    { phase: "Phase 1", title: "Inventory", description: `Capture ${detectors} detector rows and normalize the workspace before any upgrade plan is finalized.` },
    { phase: "Phase 2", title: "Policy review", description: `Review ${policies} support-policy entries, ${guardrails} guardrail settings, and keep the ${warnings} warnings visible for manual follow-up.` },
    { phase: "Phase 3", title: "Modernization plan", description: `Use ${recommendations} recommendations to shape the target path, export notes, and documentation output.` },
    { phase: "Phase 4", title: "Release readiness", description: `Work through the lifecycle steps (${lifecycle.join(" -> ")}) before the workspace is treated as final.` }
  ];
}

function buildAnalysisHighlights(scan, report) {
  return {
    detectors: report?.detectors?.length || 0,
    policies: report?.policyStatuses?.length || 0,
    recommendations: report?.recommendations?.length || 0,
    warnings: Array.isArray(scan?.warnings) ? scan.warnings.length : 0,
    guardrails: report?.guardrails?.length || 0
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

function delay(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function resolveSampleForPath(path, selectedSample) {
  const normalized = normalizePathForMatch(path);
  const fromCatalog = SAMPLE_PROJECTS.find((sample) => {
    const samplePath = normalizePathForMatch(sample.path);
    return normalized.includes(sample.id.toLowerCase()) || normalized.includes(samplePath);
  });
  if (fromCatalog) {
    return fromCatalog;
  }
  if (normalized.includes("angular")) return SAMPLE_PROJECTS.find((sample) => sample.id === "angular-mssql-legacy") || selectedSample;
  if (normalized.includes("react")) return SAMPLE_PROJECTS.find((sample) => sample.id === "react-node-postgres-legacy") || selectedSample;
  if (normalized.includes("dotnet") || normalized.includes(".net")) return SAMPLE_PROJECTS.find((sample) => sample.id === "dotnet-sqlserver-legacy") || selectedSample;
  if (normalized.includes("python")) return SAMPLE_PROJECTS.find((sample) => sample.id === "python-django-postgres-legacy") || selectedSample;
  if (normalized.includes("mixed")) return SAMPLE_PROJECTS.find((sample) => sample.id === "mixed-enterprise-workspace") || selectedSample;
  if (normalized.includes("java")) return SAMPLE_PROJECTS.find((sample) => sample.id === "java-spring-oracle-legacy") || selectedSample;
  return selectedSample || SAMPLE_PROJECTS[0] || null;
}

function buildQuickReport(sample, folderPath) {
  const profile = buildSampleProfile(sample);
  const targets = [
    ...profile.technologies.map((item) => ({ group: "Technology", ...item })),
    ...profile.databases.map((item) => ({ group: "Database", ...item })),
    ...profile.libraries.map((item) => ({ group: "Library", ...item }))
  ].map((item) => ({
    ...item,
    id: `${sample.id}-${slugify(item.label)}`,
    options: item.options || QUICK_TARGET_OPTIONS[sample.technology] || [item.defaultTarget],
    defaultTarget: item.defaultTarget || item.target || item.current
  }));

  const rows = [
    ...profile.technologies.map((item) => ({ group: "Technology", target: item.defaultTarget || item.target || item.current, ...item })),
    ...profile.databases.map((item) => ({ group: "Database", target: item.defaultTarget || item.target || item.current, ...item })),
    ...profile.libraries.map((item) => ({ group: "Library", target: item.defaultTarget || item.target || item.current, ...item }))
  ];

  return {
    id: `quick-${sample.id}`,
    sampleId: sample.id,
    sampleLabel: sample.label,
    folderPath,
    summary: profile.summary,
    technologies: profile.technologies,
    databases: profile.databases,
    libraries: profile.libraries,
    risks: profile.risks,
    nextSteps: profile.nextSteps,
    targets,
    rows,
    generatedAt: new Date().toISOString()
  };
}

function buildCompleteReport(report, targetSelections, deepAnalysisReady, guardrails, samplePreview) {
  return {
    ...report,
    deepAnalysisReady,
    chosenTargets: Object.fromEntries(
      report.targets.map((item) => [item.id, targetSelections[item.id] || item.defaultTarget])
    ),
    guardrails,
    samplePreview,
    generatedAt: new Date().toISOString()
  };
}

function buildSampleProfile(sample) {
  switch (sample?.technology) {
    case "Java":
      return {
        summary: "Java 8 / Spring Boot 2.1 / Oracle with PL/SQL artifacts and upgrade blockers that need a staged path.",
        technologies: [
          { label: "Java", current: "Java 8", defaultTarget: "Java 21", options: QUICK_TARGET_OPTIONS.Java, note: "Main runtime and toolchain" },
          { label: "Spring Boot", current: "2.1.18.RELEASE", defaultTarget: "3.3.x", options: ["2.7.x", "3.2.x", "3.3.x"], note: "Framework baseline" },
          { label: "Hibernate", current: "5.x", defaultTarget: "6.x", options: ["5.x", "6.x"], note: "Persistence layer" }
        ],
        databases: [
          { label: "Oracle / PL-SQL", current: "19c", defaultTarget: "23ai", options: ["19c", "23ai"], note: "Stored procedures and database compatibility" }
        ],
        libraries: [
          { label: "spring-boot-starter-parent", current: "2.1.18.RELEASE", defaultTarget: "3.3.x", options: ["2.7.x", "3.3.x"], note: "Dependency alignment" }
        ],
        risks: ["Hardcoded SQL and credentials need review.", "Branch-heavy services should be split before a full upgrade.", "PL/SQL artifacts need manual verification."],
        nextSteps: ["Upgrade build tooling first.", "Refactor the busiest services.", "Validate database compatibility before cutover."]
      };
    case "Angular":
      return {
        summary: "Angular 10 with MS SQL Server and older TypeScript dependencies that should be normalized before a deeper migration.",
        technologies: [
          { label: "Angular", current: "10", defaultTarget: "18", options: QUICK_TARGET_OPTIONS.Angular, note: "Primary UI framework" },
          { label: "TypeScript", current: "3.x", defaultTarget: "5.x", options: ["3.x", "5.x"], note: "Language baseline" }
        ],
        databases: [
          { label: "MS SQL Server", current: "2017", defaultTarget: "2022", options: ["2017", "2022"], note: "Database runtime and compatibility" }
        ],
        libraries: [
          { label: "RxJS", current: "6.x", defaultTarget: "7.x", options: ["6.x", "7.x"], note: "Reactive stream layer" },
          { label: "zone.js", current: "0.10.x", defaultTarget: "0.14.x", options: ["0.10.x", "0.14.x"], note: "Angular support library" }
        ],
        risks: ["Large component trees should be split.", "Legacy form and state logic should be simplified.", "SQL-side calls need a compatibility check."],
        nextSteps: ["Align framework and TypeScript targets.", "Review the highest-complexity components.", "Confirm database upgrade constraints."]
      };
    case "React":
      return {
        summary: "React 16 with Node and Postgres dependencies plus legacy build tooling that can be modernized in stages.",
        technologies: [
          { label: "React", current: "16", defaultTarget: "19", options: QUICK_TARGET_OPTIONS.React, note: "Main front-end runtime" },
          { label: "Node", current: "12", defaultTarget: "20", options: ["16", "20"], note: "Server/runtime baseline" }
        ],
        databases: [
          { label: "Postgres", current: "12", defaultTarget: "16", options: ["12", "16"], note: "Database runtime and extensions" }
        ],
        libraries: [
          { label: "react-scripts", current: "legacy", defaultTarget: "Vite", options: ["legacy", "Vite"], note: "Build tooling" },
          { label: "Express", current: "4.x", defaultTarget: "5.x", options: ["4.x", "5.x"], note: "Server routing layer" }
        ],
        risks: ["Build scripts should be simplified.", "Shared logic should move out of components.", "Environment secrets need cleanup."],
        nextSteps: ["Modernize the runtime and bundler.", "Review server helpers for duplication.", "Verify the database contract."]
      };
    case ".NET":
      return {
        summary: ".NET Core 3.1 with SQL Server and older package references that need a measured upgrade path.",
        technologies: [
          { label: ".NET", current: "Core 3.1", defaultTarget: ".NET 8", options: QUICK_TARGET_OPTIONS[".NET"], note: "Application runtime" },
          { label: "C#", current: "8", defaultTarget: "12", options: ["8", "12"], note: "Language baseline" }
        ],
        databases: [
          { label: "SQL Server", current: "2017", defaultTarget: "2022", options: ["2017", "2022"], note: "Database compatibility" }
        ],
        libraries: [
          { label: "Entity Framework Core", current: "3.x", defaultTarget: "8.x", options: ["3.x", "8.x"], note: "Data access layer" }
        ],
        risks: ["Service and repository duplication should be reduced.", "Connection handling needs review.", "Version references should be aligned."],
        nextSteps: ["Update the runtime first.", "Normalize data-access patterns.", "Confirm SQL Server compatibility."]
      };
    case "Python":
      return {
        summary: "Python and Django with Postgres plus older packaging and service patterns that can be rationalized quickly.",
        technologies: [
          { label: "Python", current: "3.8", defaultTarget: "3.12", options: QUICK_TARGET_OPTIONS.Python, note: "Runtime baseline" },
          { label: "Django", current: "2.2", defaultTarget: "5.x", options: ["2.2", "5.x"], note: "Web framework" }
        ],
        databases: [
          { label: "Postgres", current: "12", defaultTarget: "16", options: ["12", "16"], note: "Database compatibility" }
        ],
        libraries: [
          { label: "psycopg", current: "2.x", defaultTarget: "3.x", options: ["2.x", "3.x"], note: "Database driver" },
          { label: "pytest", current: "legacy", defaultTarget: "Latest stable", options: ["Legacy", "Latest stable"], note: "Test harness" }
        ],
        risks: ["Shared helpers should be deduplicated.", "Settings and secrets need review.", "Database calls should be cleaned up."],
        nextSteps: ["Upgrade Python and Django in order.", "Tighten the database driver usage.", "Review the test and settings layout."]
      };
    default:
      return {
        summary: "Mixed enterprise workspace with multiple stacks, shared libraries, and cross-platform upgrade pressure.",
        technologies: [
          { label: "Java", current: "8", defaultTarget: "21", options: QUICK_TARGET_OPTIONS.Java, note: "Backend runtime" },
          { label: "Angular", current: "10", defaultTarget: "18", options: QUICK_TARGET_OPTIONS.Angular, note: "Portal UI" },
          { label: "React", current: "16", defaultTarget: "19", options: QUICK_TARGET_OPTIONS.React, note: "Dashboard UI" },
          { label: ".NET", current: "Core 3.1", defaultTarget: ".NET 8", options: QUICK_TARGET_OPTIONS[".NET"], note: "Service API" },
          { label: "Python", current: "3.8", defaultTarget: "3.12", options: QUICK_TARGET_OPTIONS.Python, note: "Jobs and utilities" }
        ],
        databases: [
          { label: "Oracle", current: "19c", defaultTarget: "23ai", options: ["19c", "23ai"], note: "Enterprise database" },
          { label: "SQL Server", current: "2017", defaultTarget: "2022", options: ["2017", "2022"], note: "Reporting database" },
          { label: "Postgres", current: "12", defaultTarget: "16", options: ["12", "16"], note: "Service persistence" }
        ],
        libraries: [
          { label: "Spring Boot", current: "2.1.x", defaultTarget: "3.3.x", options: ["2.7.x", "3.3.x"], note: "Java service stack" },
          { label: "RxJS", current: "6.x", defaultTarget: "7.x", options: ["6.x", "7.x"], note: "Angular stream layer" },
          { label: "EF Core", current: "3.x", defaultTarget: "8.x", options: ["3.x", "8.x"], note: ".NET data layer" },
          { label: "pytest", current: "legacy", defaultTarget: "Latest stable", options: ["Legacy", "Latest stable"], note: "Python test layer" }
        ],
        risks: ["Shared policy should keep libraries consistent across teams.", "Version drift exists across multiple deployment stacks.", "Each domain needs manual governance during upgrades."],
        nextSteps: ["Group upgrades by stack.", "Apply one governance model per domain.", "Use the mixed workspace to validate the full flow."]
      };
  }
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function prettyPlanStage(stage) {
  if (stage === PLANNING_STAGES.EPIC_REVIEW) {
    return "Epic review";
  }
  if (stage === PLANNING_STAGES.FEATURE_REVIEW) {
    return "Feature review";
  }
  if (stage === PLANNING_STAGES.STORY_READY) {
    return "Story ready";
  }
  return stage || "Draft";
}

function planningStageTone(stage) {
  if (stage === PLANNING_STAGES.STORY_READY) {
    return "success";
  }
  if (stage === PLANNING_STAGES.FEATURE_REVIEW) {
    return "warning";
  }
  return "info";
}

function prettyReviewStage(stage) {
  if (stage === REVIEW_STAGES.EPICS) {
    return "Epic review";
  }
  if (stage === REVIEW_STAGES.FEATURES) {
    return "Feature review";
  }
  return String(stage || "Review");
}

function summarizePlanCollection(plans) {
  return {
    totalPlans: plans.length,
    epicReviewPlans: plans.filter((plan) => plan.currentStage === PLANNING_STAGES.EPIC_REVIEW).length,
    featureReviewPlans: plans.filter((plan) => plan.currentStage === PLANNING_STAGES.FEATURE_REVIEW).length,
    storyReadyPlans: plans.filter((plan) => plan.currentStage === PLANNING_STAGES.STORY_READY).length
  };
}

function summarizeRefinementPreview(refinement) {
  return {
    acceptanceCriteria: Array.isArray(refinement?.acceptanceCriteria) ? refinement.acceptanceCriteria.length : 0,
    dependencies: Array.isArray(refinement?.dependencies) ? refinement.dependencies.length : 0,
    references: Array.isArray(refinement?.references) ? refinement.references.length : 0,
    gaps: Array.isArray(refinement?.gaps) ? refinement.gaps.length : 0
  };
}

function summarizeTestCasePreview(testCases) {
  return {
    totalTestCases: testCases?.summary?.totalTestCases || 0,
    positiveCases: testCases?.summary?.positiveCases || 0,
    negativeCases: testCases?.summary?.negativeCases || 0,
    edgeCases: testCases?.summary?.edgeCases || 0
  };
}

function summarizeOnboardingPreview(onboarding) {
  return {
    citedDocuments: Array.isArray(onboarding?.citedDocuments) ? onboarding.citedDocuments.length : 0
  };
}

function splitCommaValues(value) {
  return String(value || "").split(",").map((item) => item.trim()).filter(Boolean);
}

function splitMultiline(value) {
  return String(value || "").split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
}

function hydrateWorkspacePlan(plan, fallbackPlan = null) {
  const source = plan && typeof plan === "object" ? plan : {};
  const stage = source.currentStage || source.stage || fallbackPlan?.currentStage || PLANNING_STAGES.EPIC_REVIEW;
  const targetUsers = Array.isArray(source.targetUsers)
    ? source.targetUsers.join(", ")
    : source.targetUsers || fallbackPlan?.targetUsers || PLANNING_SEED_VISION.targetUsers;
  const desiredOutcomes = Array.isArray(source.desiredOutcomes) && source.desiredOutcomes.length > 0
    ? source.desiredOutcomes
    : fallbackPlan?.desiredOutcomes || PLANNING_SEED_VISION.desiredOutcomes;

  let seededPlan = createPlan(
    {
      vision: source.vision || fallbackPlan?.vision || PLANNING_SEED_VISION.vision,
      programLead: source.programLead || fallbackPlan?.programLead || PLANNING_SEED_VISION.programLead,
      productName: source.productName || source.displayName || fallbackPlan?.productName || PLANNING_SEED_VISION.productName,
      targetUsers,
      desiredOutcomes
    },
    {
      id: source.id || fallbackPlan?.id,
      createdAt: source.createdAt || fallbackPlan?.createdAt || new Date().toISOString(),
      updatedAt: source.updatedAt || fallbackPlan?.updatedAt || new Date().toISOString()
    }
  );

  if (stage === PLANNING_STAGES.FEATURE_REVIEW || stage === PLANNING_STAGES.STORY_READY) {
    seededPlan = approveReview(
      seededPlan,
      REVIEW_STAGES.EPICS,
      {
        reviewer: source.reviewCheckpoints?.find((checkpoint) => String(checkpoint.stage || "").toLowerCase().includes("epic"))?.reviewer
          || fallbackPlan?.programLead
          || source.programLead
          || PLANNING_SEED_VISION.programLead,
        notes: source.reviewCheckpoints?.find((checkpoint) => String(checkpoint.stage || "").toLowerCase().includes("epic"))?.notes
          || "Approved for feature decomposition."
      },
      {
        reviewedAt: source.reviewCheckpoints?.find((checkpoint) => String(checkpoint.stage || "").toLowerCase().includes("epic"))?.reviewedAt
          || source.updatedAt
          || fallbackPlan?.updatedAt
          || new Date().toISOString()
      }
    );
  }

  if (stage === PLANNING_STAGES.STORY_READY) {
    seededPlan = approveReview(
      seededPlan,
      REVIEW_STAGES.FEATURES,
      {
        reviewer: source.reviewCheckpoints?.find((checkpoint) => String(checkpoint.stage || "").toLowerCase().includes("feature"))?.reviewer
          || fallbackPlan?.programLead
          || source.programLead
          || PLANNING_SEED_VISION.programLead,
        notes: source.reviewCheckpoints?.find((checkpoint) => String(checkpoint.stage || "").toLowerCase().includes("feature"))?.notes
          || "Approved for story creation."
      },
      {
        reviewedAt: source.reviewCheckpoints?.find((checkpoint) => String(checkpoint.stage || "").toLowerCase().includes("feature"))?.reviewedAt
          || source.updatedAt
          || fallbackPlan?.updatedAt
          || new Date().toISOString()
      }
    );
  }

  return {
    ...seededPlan,
    ...source,
    displayName: source.displayName || source.productName || seededPlan.productName,
    productName: source.productName || source.displayName || seededPlan.productName,
    programLead: source.programLead || seededPlan.programLead,
    targetUsers: Array.isArray(source.targetUsers) && source.targetUsers.length > 0 ? source.targetUsers : seededPlan.targetUsers,
    desiredOutcomes: Array.isArray(source.desiredOutcomes) && source.desiredOutcomes.length > 0 ? source.desiredOutcomes : seededPlan.desiredOutcomes,
    currentStage: stage,
    stage,
    epics: Array.isArray(source.epics) && source.epics.length > 0 ? source.epics : seededPlan.epics,
    features: Array.isArray(source.features) && source.features.length > 0 ? source.features : seededPlan.features,
    stories: Array.isArray(source.stories) && source.stories.length > 0 ? source.stories : seededPlan.stories,
    reviewCheckpoints: Array.isArray(source.reviewCheckpoints) && source.reviewCheckpoints.length > 0 ? source.reviewCheckpoints : seededPlan.reviewCheckpoints,
    onboardingChecklist: Array.isArray(source.onboardingChecklist) && source.onboardingChecklist.length > 0
      ? source.onboardingChecklist
      : seededPlan.onboardingChecklist
  };
}

function normalizeRefinementFixturePayload(payload, fallback) {
  const source = payload?.story || payload?.stories?.[0] || payload;
  if (!source || typeof source !== "object") {
    return fallback;
  }

  return {
    ...fallback,
    ...source,
    acceptanceCriteria: Array.isArray(source.acceptanceCriteria) ? source.acceptanceCriteria : fallback.acceptanceCriteria,
    dependencies: Array.isArray(source.dependencies) ? source.dependencies : fallback.dependencies,
    references: Array.isArray(source.references) ? source.references : fallback.references,
    definitionOfReadyValidation: Array.isArray(source.definitionOfReadyValidation)
      ? source.definitionOfReadyValidation
      : fallback.definitionOfReadyValidation,
    gaps: Array.isArray(source.gaps) ? source.gaps : fallback.gaps,
    normalizationNotes: Array.isArray(source.normalizationNotes) ? source.normalizationNotes : fallback.normalizationNotes
  };
}

function normalizeTestCaseFixturePayload(payload, fallback) {
  const source = payload && typeof payload === "object" ? payload : {};
  const testSuites = Array.isArray(source.testSuites)
    ? source.testSuites
    : Array.isArray(source.suites)
      ? source.suites
      : fallback.testSuites;
  const summary = source.summary && typeof source.summary === "object" ? source.summary : fallback.summary;

  return {
    ...fallback,
    ...source,
    testSuites: testSuites.map((suite, index) => ({
      ...suite,
      suiteName: suite.suiteName || suite.name || `Test Suite ${index + 1}`
    })),
    summary: {
      ...fallback.summary,
      ...summary,
      positiveCases: summary.positiveCases ?? summary.positiveCount ?? summary.positive ?? fallback.summary.positiveCases ?? 0,
      negativeCases: summary.negativeCases ?? summary.negativeCount ?? summary.negative ?? fallback.summary.negativeCases ?? 0,
      edgeCases: summary.edgeCases ?? summary.edgeCaseCount ?? fallback.summary.edgeCases ?? 0
    }
  };
}

function createPlanningWorkspaceFallback() {
  const firstPlan = createPlan(PLANNING_SEED_VISION);
  const secondPlan = approveReview(
    createPlan(
      {
        ...PLANNING_SEED_VISION,
        productName: "Refinement Workspace",
        programLead: "Delivery Lead",
        targetUsers: "Agile facilitators and product owners",
        desiredOutcomes: [
          "Reduce back-and-forth during backlog refinement",
          "Expose review gates before sprint commitment",
          "Make acceptance criteria easier to test"
        ]
      },
      {
        createdAt: "2026-04-16T10:00:00.000Z",
        updatedAt: "2026-04-16T10:00:00.000Z",
        id: "plan-feature-ready"
      }
    ),
    REVIEW_STAGES.EPICS,
    {
      reviewer: "Delivery Lead",
      notes: "Approved for feature decomposition."
    },
    {
      reviewedAt: "2026-04-16T10:15:00.000Z"
    }
  );
  const refinement = createRefinementStoryPackage(
    buildRefinementSampleRequest({
      parentEpicLink: `${secondPlan.id}-E1`
    })
  );
  const testCases = generateTestCases(
    buildTestCaseGenerationRequest({
      storySummary: refinement.storySummary,
      acceptanceCriteria: refinement.acceptanceCriteria,
      storyTitle: secondPlan.productName
    })
  );
  const onboardingDocuments = [];
  const onboarding = {
    agentName: DEFAULT_ONBOARDING_AGENT_NAME,
    firstInteraction: [
      "What is your role?",
      "Is this your first week, or do you have a specific question?"
    ],
    answer: "Ask a role and onboarding-stage question to get started.",
    citedDocuments: [],
    warnings: [],
    nextQuestions: [],
    suggestedEscalation: null
  };

  return {
    plans: [secondPlan, firstPlan],
    selectedPlanId: secondPlan.id,
    refinement,
    testCases,
    onboarding,
    onboardingDocuments
  };
}

async function loadMockPlanningWorkspace() {
  const fallback = createPlanningWorkspaceFallback();
  const [planListResult, planDetailResult, refinementResult, testCaseResult, onboardingResult, documentsResult] = await Promise.allSettled([
    fetchJson("./mock-data/plans/list.json"),
    fetchJson("./mock-data/plans/detail.json"),
    fetchJson("./mock-data/refinement/story.json"),
    fetchJson("./mock-data/test-cases/generated.json"),
    fetchJson("./mock-data/onboarding/query-response.json"),
    loadOnboardingDocuments()
  ]);

  let plans = fallback.plans;
  if (planListResult.status === "fulfilled" && Array.isArray(planListResult.value)) {
    plans = planListResult.value;
  }
  if (planDetailResult.status === "fulfilled" && planDetailResult.value?.id) {
    const detail = planDetailResult.value;
    plans = [detail, ...plans.filter((plan) => plan.id !== detail.id)];
  }

  const detailedFallbackById = new Map(fallback.plans.map((plan) => [plan.id, plan]));
  plans = plans.map((plan) => hydrateWorkspacePlan(plan, detailedFallbackById.get(plan.id) || fallback.plans[0] || null));

  const documents = documentsResult.status === "fulfilled" ? documentsResult.value : fallback.onboardingDocuments;
  const refinement = refinementResult.status === "fulfilled"
    ? normalizeRefinementFixturePayload(refinementResult.value, fallback.refinement)
    : fallback.refinement;
  const testCases = testCaseResult.status === "fulfilled"
    ? normalizeTestCaseFixturePayload(testCaseResult.value, fallback.testCases)
    : fallback.testCases;
  const onboarding = onboardingResult.status === "fulfilled"
    ? onboardingResult.value
    : answerOnboardingQuery(
      {
        role: "Developer",
        journeyType: ONBOARDING_JOURNEY_TYPES.FIRST_WEEK
      },
      documents
    );

  return {
    ...fallback,
    plans,
    selectedPlanId: plans[0]?.id || fallback.selectedPlanId,
    refinement,
    testCases,
    onboarding,
    onboardingDocuments: documents.length > 0 ? documents : fallback.onboardingDocuments
  };
}

async function loadLivePlanningWorkspace() {
  const summaries = await fetchJson("/api/plans");
  const plans = Array.isArray(summaries) ? summaries : [];
  const selectedPlan = plans.length > 0
    ? await fetchJson(`/api/plans/${encodeURIComponent(plans[0].id)}`)
    : null;
  const documents = await loadOnboardingDocuments().catch(() => []);

  return {
    plans: (selectedPlan ? [selectedPlan, ...plans.slice(1)] : plans).map((plan) => hydrateWorkspacePlan(plan, selectedPlan || null)),
    selectedPlanId: selectedPlan?.id || plans[0]?.id || null,
    refinement: createRefinementStoryPackage(buildRefinementSampleRequest()),
    testCases: generateTestCases(buildTestCaseGenerationRequest()),
    onboarding: answerOnboardingQuery({}, documents),
    onboardingDocuments: documents
  };
}

function syncWorkspaceForms(hub, setReviewForm, setRefinementForm, setTestCaseForm, setOnboardingForm) {
  const selectedPlan = hub.plans.find((plan) => plan.id === hub.selectedPlanId) || hub.plans[0] || null;
  const firstEpic = selectedPlan?.epics?.[0]?.id || "";

  setReviewForm(EMPTY_REVIEW_FORM);
  setRefinementForm({
    notes: buildRefinementSampleRequest({ parentEpicLink: firstEpic }).notes,
    candidateProblemStatement: "",
    candidateStorySummary: "",
    parentEpicLink: firstEpic,
    labels: "refinement, ready",
    sprint: "Sprint 14",
    estimatePoints: "3",
    references: "Confluence page REF-101",
    teamContext: selectedPlan?.productName || "refinement facilitator"
  });
  setTestCaseForm({
    storySummary: hub.refinement?.storySummary || "",
    acceptanceCriteria: (hub.refinement?.acceptanceCriteria || []).join("\n"),
    storyTitle: selectedPlan?.productName || "",
    environment: "mock"
  });
  setOnboardingForm({
    role: "Developer",
    journeyType: ONBOARDING_JOURNEY_TYPES.FIRST_WEEK,
    question: ""
  });
}
