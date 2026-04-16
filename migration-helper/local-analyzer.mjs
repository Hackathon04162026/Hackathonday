import { promises as fs } from "node:fs";
import path from "node:path";

const QUICK_TARGET_OPTIONS = {
  Java: ["Java 17", "Java 21", "Java 25"],
  Angular: ["Angular 17", "Angular 18", "Angular 20"],
  React: ["React 18", "React 19"],
  ".NET": [".NET 8", ".NET 9"],
  Python: ["Python 3.11", "Python 3.12"],
  Node: ["Node 18", "Node 20"],
  Mixed: ["Modernize by stack", "Modernize by domain", "Modernize incrementally"]
};

export async function analyzeFolderPath(folderPath) {
  const stats = await fs.stat(folderPath);
  if (!stats.isDirectory()) {
    throw new Error("The supplied path is not a directory.");
  }

  const files = [];
  await walk(folderPath, files, 0, 5, 500);

  const relativeFiles = files.map((filePath) => ({
    fullPath: filePath,
    relativePath: path.relative(folderPath, filePath).replace(/\\/g, "/"),
    name: path.basename(filePath).toLowerCase()
  }));

  const read = async (matcher) => {
    const match = relativeFiles.find((entry) => matcher(entry.relativePath, entry.name));
    if (!match) {
      return "";
    }
    try {
      return await fs.readFile(match.fullPath, "utf8");
    } catch {
      return "";
    }
  };

  const packageJsonText = await read((relativePath, name) => name === "package.json");
  const angularJsonText = await read((relativePath, name) => name === "angular.json");
  const pomXmlText = await read((relativePath, name) => name === "pom.xml");
  const gradleText = await read((relativePath, name) => name === "build.gradle" || name === "build.gradle.kts");
  const globalJsonText = await read((relativePath, name) => name === "global.json");
  const directoryPackagesText = await read((relativePath, name) => name === "directory.packages.props");
  const csprojText = await read((relativePath, name) => name.endsWith(".csproj"));
  const pyprojectText = await read((relativePath, name) => name === "pyproject.toml");
  const requirementsText = await read((relativePath, name) => name === "requirements.txt");
  const applicationPropertiesText = await read((relativePath, name) => name === "application.properties");
  const sqlText = await read((relativePath, name) => name.endsWith(".sql"));

  const packageJson = safeJson(packageJsonText);
  const technologies = [];
  const databases = [];
  const libraries = [];
  const risks = [];
  const nextSteps = [];

  const addUnique = (items, entry) => {
    if (!entry?.label) return;
    if (!items.some((item) => item.label === entry.label)) {
      items.push(entry);
    }
  };

  if (pomXmlText || gradleText) {
    const javaVersion = firstMatch(pomXmlText, /<(?:java\.version|maven\.compiler\.source)>([^<]+)</i) || "Java 8";
    const springBootVersion =
      firstMatch(pomXmlText, /<artifactId>\s*spring-boot-starter-parent\s*<\/artifactId>[\s\S]*?<version>([^<]+)</i) ||
      firstMatch(pomXmlText, /<spring-boot\.version>([^<]+)</i) ||
      "2.x";
    const hibernateVersion = firstMatch(pomXmlText, /<artifactId>\s*hibernate-core\s*<\/artifactId>[\s\S]*?<version>([^<]+)</i) || "5.x";

    addUnique(technologies, { label: "Java", current: normalizeVersion(javaVersion, "Java"), defaultTarget: "Java 21", options: QUICK_TARGET_OPTIONS.Java, note: "Main runtime and toolchain" });
    if (springBootVersion) {
      addUnique(technologies, { label: "Spring Boot", current: springBootVersion, defaultTarget: "3.3.x", options: ["2.7.x", "3.2.x", "3.3.x"], note: "Framework baseline" });
      addUnique(libraries, { label: "spring-boot-starter-parent", current: springBootVersion, defaultTarget: "3.3.x", options: ["2.7.x", "3.3.x"], note: "Dependency alignment" });
    }
    if (hibernateVersion) {
      addUnique(libraries, { label: "hibernate-core", current: hibernateVersion, defaultTarget: "6.x", options: ["5.x", "6.x"], note: "Persistence layer" });
    }
  }

  const pkgDeps = {
    ...(packageJson?.dependencies || {}),
    ...(packageJson?.devDependencies || {})
  };

  if (angularJsonText || pkgDeps["@angular/core"]) {
    const angularVersion = cleanVersion(pkgDeps["@angular/core"]) || "10";
    const tsVersion = cleanVersion(pkgDeps.typescript) || "3.x";
    addUnique(technologies, { label: "Angular", current: angularVersion, defaultTarget: "18", options: QUICK_TARGET_OPTIONS.Angular, note: "Primary UI framework" });
    addUnique(libraries, { label: "TypeScript", current: tsVersion, defaultTarget: "5.x", options: ["3.x", "5.x"], note: "Language baseline" });
    if (pkgDeps.rxjs) {
      addUnique(libraries, { label: "RxJS", current: cleanVersion(pkgDeps.rxjs) || "6.x", defaultTarget: "7.x", options: ["6.x", "7.x"], note: "Reactive stream layer" });
    }
    if (pkgDeps["zone.js"]) {
      addUnique(libraries, { label: "zone.js", current: cleanVersion(pkgDeps["zone.js"]) || "0.10.x", defaultTarget: "0.14.x", options: ["0.10.x", "0.14.x"], note: "Angular support library" });
    }
  }

  if (pkgDeps.react) {
    const reactVersion = cleanVersion(pkgDeps.react) || "16";
    addUnique(technologies, { label: "React", current: reactVersion, defaultTarget: "19", options: QUICK_TARGET_OPTIONS.React, note: "Main front-end runtime" });
    if (pkgDeps["react-scripts"]) {
      addUnique(libraries, { label: "react-scripts", current: cleanVersion(pkgDeps["react-scripts"]) || "legacy", defaultTarget: "Vite", options: ["legacy", "Vite"], note: "Build tooling" });
    }
  }

  if (pkgDeps.express || packageJson?.engines?.node) {
    addUnique(technologies, { label: "Node", current: cleanVersion(packageJson?.engines?.node) || "12", defaultTarget: "Node 20", options: QUICK_TARGET_OPTIONS.Node, note: "Server/runtime baseline" });
    if (pkgDeps.express) {
      addUnique(libraries, { label: "Express", current: cleanVersion(pkgDeps.express) || "4.x", defaultTarget: "5.x", options: ["4.x", "5.x"], note: "Server routing layer" });
    }
  }

  if (globalJsonText || csprojText) {
    const dotnetVersion = firstMatch(globalJsonText, /"version"\s*:\s*"([^"]+)"/i) || "3.1";
    addUnique(technologies, { label: ".NET", current: normalizeDotnet(dotnetVersion), defaultTarget: ".NET 8", options: QUICK_TARGET_OPTIONS[".NET"], note: "Application runtime" });
    addUnique(technologies, { label: "C#", current: "8", defaultTarget: "12", options: ["8", "12"], note: "Language baseline" });
    const efVersion =
      firstMatch(directoryPackagesText, /PackageVersion Include="Microsoft\.EntityFrameworkCore" Version="([^"]+)"/i) ||
      firstMatch(csprojText, /PackageReference Include="Microsoft\.EntityFrameworkCore" Version="([^"]+)"/i);
    if (efVersion) {
      addUnique(libraries, { label: "Entity Framework Core", current: efVersion, defaultTarget: "8.x", options: ["3.x", "8.x"], note: "Data access layer" });
    }
  }

  if (pyprojectText || requirementsText || relativeFiles.some((entry) => entry.name === "manage.py")) {
    const pyVersion = firstMatch(pyprojectText, /requires-python\s*=\s*"([^"]+)"/i) || "3.8";
    addUnique(technologies, { label: "Python", current: normalizeVersion(pyVersion, "Python"), defaultTarget: "Python 3.12", options: QUICK_TARGET_OPTIONS.Python, note: "Runtime baseline" });
    const djangoVersion =
      firstMatch(pyprojectText, /django[^0-9]*([0-9][^"\s,\]]*)/i) ||
      firstMatch(requirementsText, /django[=><!~]+([^\r\n]+)/i);
    if (djangoVersion) {
      addUnique(technologies, { label: "Django", current: cleanVersion(djangoVersion) || "2.2", defaultTarget: "5.x", options: ["2.2", "5.x"], note: "Web framework" });
    }
    const pytestVersion =
      firstMatch(pyprojectText, /pytest[^0-9]*([0-9][^"\s,\]]*)/i) ||
      firstMatch(requirementsText, /pytest[=><!~]+([^\r\n]+)/i);
    if (pytestVersion) {
      addUnique(libraries, { label: "pytest", current: cleanVersion(pytestVersion), defaultTarget: "Latest stable", options: ["Legacy", "Latest stable"], note: "Python test layer" });
    }
    const psycopgVersion =
      firstMatch(pyprojectText, /psycopg[^0-9]*([0-9][^"\s,\]]*)/i) ||
      firstMatch(requirementsText, /psycopg(?:2)?[=><!~]+([^\r\n]+)/i);
    if (psycopgVersion) {
      addUnique(libraries, { label: "psycopg", current: cleanVersion(psycopgVersion), defaultTarget: "3.x", options: ["2.x", "3.x"], note: "Database driver" });
    }
  }

  const dbSignals = `${applicationPropertiesText}\n${sqlText}\n${JSON.stringify(pkgDeps)}`.toLowerCase();
  if (dbSignals.includes("oracle") || dbSignals.includes("jdbc:oracle") || dbSignals.includes("varchar2")) {
    addUnique(databases, { label: "Oracle / PL-SQL", current: extractDbVersion(dbSignals, /oracle[^0-9]*(19c|21c|23ai)/i) || "19c", defaultTarget: "23ai", options: ["19c", "23ai"], note: "Stored procedures and database compatibility" });
  }
  if (dbSignals.includes("sqlserver") || dbSignals.includes("mssql") || dbSignals.includes("system.data.sqlclient")) {
    addUnique(databases, { label: "SQL Server", current: extractDbVersion(dbSignals, /sql server[^0-9]*(2017|2019|2022)/i) || "2017", defaultTarget: "2022", options: ["2017", "2022"], note: "Database compatibility" });
  }
  if (dbSignals.includes("postgres") || dbSignals.includes("pg") || dbSignals.includes("psycopg")) {
    addUnique(databases, { label: "Postgres", current: extractDbVersion(dbSignals, /postgres[^0-9]*(12|13|14|15|16)/i) || "12", defaultTarget: "16", options: ["12", "16"], note: "Database runtime and extensions" });
  }

  const primaryTechnology = technologies.length === 0 ? "Workspace" : technologies.length === 1 ? technologies[0].label : "Mixed";
  const riskEntries = [
    technologies.some((item) => isLegacyVersion(`${item.label} ${item.current}`)) ? "Detected at least one out-of-support framework or runtime that should be upgraded first." : null,
    databases.some((item) => isLegacyVersion(`${item.label} ${item.current}`)) ? "Database compatibility should be reviewed before a full modernization cutover." : null,
    relativeFiles.some((entry) => entry.name.endsWith(".sql")) ? "SQL artifacts were found and may require manual validation during modernization." : null,
    relativeFiles.length > 120 ? "Large folder inventories can hide complexity hotspots that should be reviewed in stages." : null
  ].filter(Boolean);

  const nextStepEntries = [
    technologies.length > 0 ? "Confirm the detected stack and align target versions before deeper analysis." : "Review the uploaded folder contents and add manifest files for stronger detection.",
    databases.length > 0 ? "Validate database upgrade constraints and data access compatibility." : "Confirm whether the project has hidden database dependencies.",
    libraries.length > 0 ? "Review key libraries for unsupported versions and replacements." : "Capture package manifests to expand dependency reporting."
  ];

  const summary =
    technologies.length > 0
      ? `${folderPath} scanned from the local filesystem. Detected ${technologies.map((item) => item.label).join(", ")} with ${databases.length || "no"} database signal${databases.length === 1 ? "" : "s"} and ${libraries.length} notable librar${libraries.length === 1 ? "y" : "ies"}.`
      : `${folderPath} scanned from the local filesystem. No strong framework manifest was found, so the report is based on the visible file inventory and config hints.`;

  const sampleId = slugify(path.basename(folderPath) || "uploaded-folder");
  const sampleLabel = path.basename(folderPath) || folderPath;

  return buildReportFromProfile({
    sampleId,
    sampleLabel,
    folderPath,
    technology: primaryTechnology,
    profile: {
      summary,
      technologies,
      databases,
      libraries,
      risks: riskEntries,
      nextSteps: nextStepEntries
    }
  });
}

export async function analyzeFolderPathDeep(folderPath, context = {}) {
  const quickReport = await analyzeFolderPath(folderPath);
  return decorateAnalysisResponse(quickReport, "deep", context);
}

function buildReportFromProfile({ sampleId, sampleLabel, folderPath, technology, profile }) {
  const targets = [
    ...profile.technologies.map((item) => ({ group: "Technology", ...item })),
    ...profile.databases.map((item) => ({ group: "Database", ...item })),
    ...profile.libraries.map((item) => ({ group: "Library", ...item }))
  ].map((item) => ({
    ...item,
    id: `${sampleId}-${slugify(item.label)}`,
    options: item.options || QUICK_TARGET_OPTIONS[technology] || QUICK_TARGET_OPTIONS.Mixed,
    defaultTarget: item.defaultTarget || item.target || item.current
  }));

  const rows = [
    ...profile.technologies.map((item) => ({ group: "Technology", target: item.defaultTarget || item.target || item.current, ...item })),
    ...profile.databases.map((item) => ({ group: "Database", target: item.defaultTarget || item.target || item.current, ...item })),
    ...profile.libraries.map((item) => ({ group: "Library", target: item.defaultTarget || item.target || item.current, ...item }))
  ];

  return {
    id: `quick-${sampleId}`,
    sampleId,
    sampleLabel,
    folderPath,
    summary: profile.summary,
    technologies: profile.technologies,
    databases: profile.databases,
    libraries: profile.libraries,
    risks: profile.risks,
    nextSteps: profile.nextSteps,
    targets,
    rows,
    primaryTechnology: technology,
    generatedAt: new Date().toISOString()
  };
}

function decorateAnalysisResponse(report, stage, context = {}) {
  const guardrails = normalizeGuardrails(context.guardrails);
  const requestedTargets = normalizeRequestedTargets(context.targets);
  const workload = buildCodexWorkload(report, stage, guardrails, requestedTargets);
  const menuState = buildMenuState(stage, report, workload);
  const scan = {
    folderPath: report.folderPath,
    sampleId: report.sampleId,
    sampleLabel: report.sampleLabel,
    primaryTechnology: report.primaryTechnology,
    technologyCount: report.technologies?.length || 0,
    databaseCount: report.databases?.length || 0,
    libraryCount: report.libraries?.length || 0,
    riskCount: report.risks?.length || 0
  };

  return {
    ...report,
    analysisKind: stage,
    engine: "codex-local",
    assistant: {
      name: "Codex",
      mode: "local",
      network: false,
      stage
    },
    scan,
    guardrails,
    requestedTargets,
    workload,
    menuState,
    codex: {
      enabled: true,
      stage,
      assistedWorkPercent: workload.codexPercent,
      manualWorkPercent: workload.manualPercent,
      summary: workload.summary,
      notes: workload.notes,
      readinessScore: workload.readinessScore
    },
    quick: buildQuickView(report, workload, menuState, guardrails, requestedTargets),
    deep: stage === "deep" ? buildDeepView(report, workload, menuState, guardrails, requestedTargets) : null
  };
}

function buildQuickView(report, workload, menuState, guardrails, requestedTargets) {
  return {
    headline: report.summary,
    codexCoveragePercent: workload.codexPercent,
    manualCoveragePercent: workload.manualPercent,
    risks: report.risks,
    nextSteps: report.nextSteps,
    targetPreview: report.targets.slice(0, 6),
    guardrails,
    requestedTargets,
    menuState
  };
}

function buildDeepView(report, workload, menuState, guardrails, requestedTargets) {
  const targetsByGroup = groupBy(report.targets, "group");
  const unsupported = report.rows.filter((row) => isLegacyVersion(`${row.label || row.item || row.target || ""} ${row.current || row.version || ""}`));

  return {
    readinessScore: workload.readinessScore,
    automationSplit: {
      codexPercent: workload.codexPercent,
      manualPercent: workload.manualPercent
    },
    summary: report.summary,
    highlights: report.risks.map((risk) => ({ kind: "risk", text: risk })),
    manualReview: buildManualReviewItems(report, guardrails),
    automationWins: [
      "Manifest and dependency inventory",
      "Target version shaping",
      "Documentation draft generation",
      "Roadmap structuring"
    ],
    targetGroups: targetsByGroup,
    unsupportedTargets: unsupported,
    menuState,
    guardrails,
    requestedTargets
  };
}

function buildManualReviewItems(report, guardrails) {
  const items = [];
  if (report.databases.length) {
    items.push("Database compatibility and cutover sign-off");
  }
  if (report.risks.length) {
    items.push("Review unsupported versions and complexity hotspots");
  }
  if (guardrails.length) {
    items.push("Validate enterprise guardrails before release promotion");
  }
  if (!items.length) {
    items.push("Manual review is still recommended for final target approval");
  }
  return items;
}

function buildMenuState(stage, report, workload) {
  const ready = stage === "deep";
  const readinessLabel = `${workload.readinessScore}% ready`;
  return {
    home: {
      status: ready ? "updated" : "scanned",
      note: ready ? readinessLabel : "Quick analysis complete"
    },
    overview: {
      status: ready ? "ready" : "pending",
      note: ready ? readinessLabel : "Waiting for deep analysis"
    },
    analysis: {
      status: ready ? "ready" : "pending",
      note: ready ? `${report.risks.length} risk signal${report.risks.length === 1 ? "" : "s"} reviewed` : "Waiting for deep analysis"
    },
    documentation: {
      status: ready ? "ready" : "pending",
      note: ready ? `${report.libraries.length} libraries mapped` : "Waiting for deep analysis"
    },
    roadmap: {
      status: ready ? "ready" : "pending",
      note: ready ? `Codex covers ${workload.codexPercent}% of the planning work` : "Waiting for deep analysis"
    },
    help: {
      status: "ready",
      note: "Available at any time"
    }
  };
}

function buildCodexWorkload(report, stage, guardrails, requestedTargets) {
  const riskPressure = Math.min(6, report.risks.length) * 2;
  const techPressure = Math.min(4, report.technologies.length + report.databases.length) * 1;
  const guardrailPressure = Math.min(4, guardrails.length) * 2;
  const targetPressure = Math.min(3, requestedTargets.length);
  const base = stage === "deep" ? 61 : 58;
  const codexPercent = clamp(base - riskPressure + techPressure - guardrailPressure - targetPressure, 50, 65);
  const manualPercent = 100 - codexPercent;
  const readinessScore = clamp(92 - riskPressure - guardrailPressure + techPressure - targetPressure, 34, 98);

  return {
    codexPercent,
    manualPercent,
    readinessScore,
    summary: `Codex covers ${codexPercent}% of the interpretation and planning work while manual review covers ${manualPercent}% of the governance and release decisions.`,
    notes: [
      `${report.technologies.length} technology signal${report.technologies.length === 1 ? "" : "s"} mapped locally`,
      `${report.databases.length} database signal${report.databases.length === 1 ? "" : "s"} reviewed for compatibility`,
      `${guardrails.length} enterprise guardrail${guardrails.length === 1 ? "" : "s"} applied to the plan`
    ]
  };
}

function normalizeGuardrails(guardrails) {
  if (!Array.isArray(guardrails)) {
    return [];
  }

  return guardrails
    .map((entry) => {
      if (!entry) return null;
      if (typeof entry === "string") {
        return { label: entry, value: entry, source: "local" };
      }
      const label = entry.label || entry.value || entry.name || entry.title;
      if (!label) return null;
      return {
        label,
        value: entry.value || label,
        source: entry.source || "local"
      };
    })
    .filter(Boolean);
}

function normalizeRequestedTargets(targets) {
  if (!Array.isArray(targets)) {
    return [];
  }

  return targets
    .map((entry) => {
      if (!entry) return null;
      if (typeof entry === "string") return entry;
      return entry.target || entry.defaultTarget || entry.current || entry.label || null;
    })
    .filter(Boolean);
}

function groupBy(items, key) {
  return items.reduce((acc, item) => {
    const group = item?.[key] || "Ungrouped";
    if (!acc[group]) {
      acc[group] = [];
    }
    acc[group].push(item);
    return acc;
  }, {});
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function safeJson(text) {
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

function firstMatch(text, pattern) {
  const match = String(text || "").match(pattern);
  return match?.[1]?.trim();
}

function cleanVersion(value) {
  const normalized = String(value || "").trim();
  if (!normalized) return "";
  return normalized.replace(/^[^\d]*/, "").replace(/[",\s]+$/, "");
}

function normalizeVersion(value, prefix) {
  const cleaned = cleanVersion(value);
  if (!cleaned) return prefix;
  return cleaned.toLowerCase().startsWith(prefix.toLowerCase()) ? cleaned : `${prefix} ${cleaned}`;
}

function normalizeDotnet(version) {
  const cleaned = cleanVersion(version);
  return cleaned.includes("core") ? cleaned : `Core ${cleaned}`;
}

function extractDbVersion(text, pattern) {
  const match = String(text || "").match(pattern);
  return match?.[1] || "";
}

function isLegacyVersion(value) {
  return /\b(java 8|2\.(?:0|1)\.[0-9]+|angular (?:8|9|10)|react 16|core (?:3\.1|5(?:\.0)?)|python 3\.(?:8|9)|django (?:2\.2|3\.2)|sql server (?:2017|2019)|postgres (?:12|13)|legacy)\b/i.test(String(value || ""));
}

async function walk(root, results, depth, maxDepth, maxFiles) {
  if (depth > maxDepth || results.length >= maxFiles) {
    return;
  }
  const entries = await fs.readdir(root, { withFileTypes: true });
  for (const entry of entries) {
    if (results.length >= maxFiles) {
      return;
    }
    if (entry.name === "node_modules" || entry.name === ".git" || entry.name === "dist" || entry.name === "target" || entry.name === "__pycache__") {
      continue;
    }
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      await walk(fullPath, results, depth + 1, maxDepth, maxFiles);
    } else {
      results.push(fullPath);
    }
  }
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || "scan";
}
