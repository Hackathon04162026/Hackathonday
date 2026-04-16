export const DEFAULT_ONBOARDING_AGENT_NAME = "Confluence-grounded Onboarding Agent";

export function buildOnboardingFixtureUrl(
  baseUrl = getDefaultBaseUrl(),
  fixturePath = "mock-data/onboarding-documents.json"
) {
  const normalizedBase = normalizeBaseUrl(baseUrl);
  const normalizedPath = String(fixturePath || "").replace(/^\/+/, "");
  return `${normalizedBase}${normalizedPath}`;
}

export const DEFAULT_ONBOARDING_FIXTURE_URL = buildOnboardingFixtureUrl();
export const DEFAULT_ONBOARDING_QUERY_RESPONSE_URL = buildOnboardingFixtureUrl(
  undefined,
  "mock-data/onboarding/query-response.json"
);

export const OUTDATED_WARNING = "Note: This document may be outdated - verify with your team lead.";

export const ONBOARDING_JOURNEY_TYPES = Object.freeze({
  FIRST_WEEK: "FIRST_WEEK",
  SPECIFIC_QUESTION: "SPECIFIC_QUESTION"
});

const ONBOARDING_DOCUMENT_CATALOG = Object.freeze({
  schemaVersion: "1",
  generatedOn: "2026-04-16",
  documents: Object.freeze([
    Object.freeze({
      id: "team-overview",
      documentName: "New Joiner Team Overview",
      roleFocus: "*",
      journeyTypes: Object.freeze([ONBOARDING_JOURNEY_TYPES.FIRST_WEEK]),
      section: "Team overview",
      topicOrder: 1,
      keywords: Object.freeze(["team", "who", "contacts", "lead", "org"]),
      summary: "Start with the team map, the primary contacts, and the current delivery rhythm so you know who owns what.",
      owner: "Team Lead",
      channel: "#onboarding-help",
      escalationContact: "team lead",
      updatedOn: "2026-04-01",
      stale: false
    }),
    Object.freeze({
      id: "tools-access",
      documentName: "Tools and Access Checklist",
      roleFocus: "*",
      journeyTypes: Object.freeze([ONBOARDING_JOURNEY_TYPES.FIRST_WEEK]),
      section: "Tools and access",
      topicOrder: 2,
      keywords: Object.freeze(["tools", "access", "install", "environment", "setup"]),
      summary: "Request your repo, build, and environment access, then install the standard local tooling before you start work.",
      owner: "Engineering Enablement",
      channel: "#engineering-help",
      escalationContact: "platform support",
      updatedOn: "2026-03-18",
      stale: true
    }),
    Object.freeze({
      id: "ceremonies",
      documentName: "Ceremonies and Rituals Guide",
      roleFocus: "*",
      journeyTypes: Object.freeze([ONBOARDING_JOURNEY_TYPES.FIRST_WEEK]),
      section: "Ceremonies and rituals",
      topicOrder: 3,
      keywords: Object.freeze(["standup", "refinement", "retro", "sprint", "ceremony"]),
      summary: "Use the team cadence to understand standups, refinement, retros, and the sprint boundary.",
      owner: "Scrum Master",
      channel: "#delivery-ops",
      escalationContact: "scrum master",
      updatedOn: "2026-04-05",
      stale: false
    }),
    Object.freeze({
      id: "codebase",
      documentName: "Codebase and Architecture Primer",
      roleFocus: "*",
      journeyTypes: Object.freeze([ONBOARDING_JOURNEY_TYPES.FIRST_WEEK]),
      section: "Codebase and architecture",
      topicOrder: 4,
      keywords: Object.freeze(["repo", "architecture", "run", "local", "codebase"]),
      summary: "Read the architecture primer, locate the main repositories, and follow the documented local run path before changing code.",
      owner: "Senior Engineer",
      channel: "#engineering-help",
      escalationContact: "architect",
      updatedOn: "2026-04-10",
      stale: false
    }),
    Object.freeze({
      id: "definition-of-done",
      documentName: "Definition of Done and Ready",
      roleFocus: "*",
      journeyTypes: Object.freeze([ONBOARDING_JOURNEY_TYPES.FIRST_WEEK]),
      section: "Definition of Done / Definition of Ready",
      topicOrder: 5,
      keywords: Object.freeze(["done", "ready", "standards", "quality"]),
      summary: "Use the team readiness and completion checklist before you pull a ticket into a sprint or mark work complete.",
      owner: "Product Owner",
      channel: "#product",
      escalationContact: "product owner",
      updatedOn: "2026-04-08",
      stale: false
    }),
    Object.freeze({
      id: "first-contribution",
      documentName: "First Contribution Playbook",
      roleFocus: "*",
      journeyTypes: Object.freeze([ONBOARDING_JOURNEY_TYPES.FIRST_WEEK]),
      section: "First contribution",
      topicOrder: 6,
      keywords: Object.freeze(["first ticket", "pr", "review", "branching", "contribution"]),
      summary: "Pick a small ticket, open a draft PR early, and follow the review norms so your first contribution stays low risk.",
      owner: "Engineering Manager",
      channel: "#engineering-help",
      escalationContact: "team lead",
      updatedOn: "2026-04-03",
      stale: false
    }),
    Object.freeze({
      id: "branching-strategy",
      documentName: "Branching Strategy Reference",
      roleFocus: "Developer",
      journeyTypes: Object.freeze([ONBOARDING_JOURNEY_TYPES.SPECIFIC_QUESTION]),
      section: "Branching strategy",
      topicOrder: 1,
      keywords: Object.freeze(["branching", "git", "merge", "pull request", "pr", "feature branch"]),
      summary: "Use short-lived feature branches, open a pull request early, and keep merges aligned with the default branch review flow.",
      owner: "Engineering Lead",
      channel: "#engineering-help",
      escalationContact: "engineering lead",
      updatedOn: "2026-02-11",
      stale: true
    }),
    Object.freeze({
      id: "qa-setup",
      documentName: "QA Environment Setup",
      roleFocus: "Tester",
      journeyTypes: Object.freeze([ONBOARDING_JOURNEY_TYPES.SPECIFIC_QUESTION]),
      section: "Environment setup",
      topicOrder: 1,
      keywords: Object.freeze(["setup", "environment", "qa", "test data", "tools"]),
      summary: "Install the QA tooling, request sandbox access, and verify the smoke suite runs before you take your first ticket.",
      owner: "QE Lead",
      channel: "#qa-help",
      escalationContact: "qe lead",
      updatedOn: "2026-04-11",
      stale: false
    }),
    Object.freeze({
      id: "scrum-master-rituals",
      documentName: "Scrum Master Rituals Guide",
      roleFocus: "Scrum Master",
      journeyTypes: Object.freeze([ONBOARDING_JOURNEY_TYPES.SPECIFIC_QUESTION]),
      section: "Ceremonies and rituals",
      topicOrder: 1,
      keywords: Object.freeze(["standup", "retro", "refinement", "facilitation", "ceremony"]),
      summary: "Facilitate the cadence by timeboxing standups, preparing refinement, and closing the sprint with a retro.",
      owner: "Delivery Lead",
      channel: "#delivery-ops",
      escalationContact: "delivery lead",
      updatedOn: "2026-04-09",
      stale: false
    }),
    Object.freeze({
      id: "product-owner-intake",
      documentName: "Product Owner Intake Guide",
      roleFocus: "Product Owner",
      journeyTypes: Object.freeze([ONBOARDING_JOURNEY_TYPES.SPECIFIC_QUESTION]),
      section: "Backlog intake",
      topicOrder: 1,
      keywords: Object.freeze(["vision", "epic", "feature", "story", "backlog"]),
      summary: "Capture the vision, refine epics, and move approved work into features and stories using the review gates.",
      owner: "Program Lead",
      channel: "#product",
      escalationContact: "program lead",
      updatedOn: "2026-04-06",
      stale: false
    })
  ])
});

export function getOnboardingFixtureCatalog() {
  return cloneCatalog(ONBOARDING_DOCUMENT_CATALOG);
}

export function getOnboardingFixtureDocuments() {
  return getOnboardingFixtureCatalog().documents;
}

export function cloneCatalog(catalog) {
  return {
    schemaVersion: String(catalog?.schemaVersion ?? "1"),
    generatedOn: String(catalog?.generatedOn ?? "2026-04-16"),
    documents: Array.isArray(catalog?.documents) ? catalog.documents.map(cloneDocument) : []
  };
}

export function cloneDocument(document) {
  if (!document) {
    return null;
  }

  return {
    id: document.id ?? "",
    documentName: document.documentName ?? "",
    roleFocus: document.roleFocus ?? "",
    journeyTypes: Array.isArray(document.journeyTypes) ? [...document.journeyTypes] : [],
    section: document.section ?? "",
    topicOrder: Number.isFinite(Number(document.topicOrder)) ? Number(document.topicOrder) : 0,
    keywords: Array.isArray(document.keywords) ? [...document.keywords] : [],
    summary: document.summary ?? "",
    owner: document.owner ?? "",
    channel: document.channel ?? "",
    escalationContact: document.escalationContact ?? "",
    updatedOn: document.updatedOn ?? "",
    stale: Boolean(document.stale)
  };
}

export function normalizeJourneyType(value) {
  if (value == null) {
    return null;
  }

  const normalized = String(value).trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (normalized === "first_week") {
    return ONBOARDING_JOURNEY_TYPES.FIRST_WEEK;
  }
  if (normalized === "specific_question") {
    return ONBOARDING_JOURNEY_TYPES.SPECIFIC_QUESTION;
  }
  return null;
}

function getDefaultBaseUrl() {
  if (typeof import.meta !== "undefined" && import.meta.env?.BASE_URL) {
    return import.meta.env.BASE_URL;
  }
  return "/";
}

function normalizeBaseUrl(baseUrl) {
  const normalized = String(baseUrl ?? "/").trim().replace(/\\/g, "/");
  const withoutQuery = normalized.split(/[?#]/)[0];
  if (!withoutQuery) {
    return "/";
  }
  return withoutQuery.endsWith("/") ? withoutQuery : `${withoutQuery}/`;
}
