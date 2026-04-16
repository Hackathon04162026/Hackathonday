import {
  cloneCatalog,
  cloneDocument,
  buildOnboardingFixtureUrl,
  DEFAULT_ONBOARDING_AGENT_NAME,
  DEFAULT_ONBOARDING_FIXTURE_URL,
  DEFAULT_ONBOARDING_QUERY_RESPONSE_URL,
  getOnboardingFixtureCatalog,
  getOnboardingFixtureDocuments,
  normalizeJourneyType,
  ONBOARDING_JOURNEY_TYPES,
  OUTDATED_WARNING
} from "./onboardingFixtures.js";

export {
  DEFAULT_ONBOARDING_AGENT_NAME,
  DEFAULT_ONBOARDING_FIXTURE_URL,
  DEFAULT_ONBOARDING_QUERY_RESPONSE_URL,
  ONBOARDING_JOURNEY_TYPES,
  OUTDATED_WARNING,
  buildOnboardingFixtureUrl,
  cloneCatalog,
  cloneDocument,
  getOnboardingFixtureCatalog,
  getOnboardingFixtureDocuments,
  normalizeJourneyType
} from "./onboardingFixtures.js";

const FIRST_INTERACTION_PROMPTS = Object.freeze([
  "What is your role?",
  "Is this your first week, or have you been here a bit and have specific questions?"
]);

export async function loadOnboardingQueryResponse({
  fetchImpl = globalThis.fetch,
  url = DEFAULT_ONBOARDING_QUERY_RESPONSE_URL
} = {}) {
  if (typeof fetchImpl !== "function") {
    return getOnboardingQueryResponseFixture();
  }

  try {
    const response = await fetchImpl(url);
    if (!response || !response.ok) {
      return getOnboardingQueryResponseFixture();
    }

    return normalizeQueryResponse(await response.json());
  } catch {
    return getOnboardingQueryResponseFixture();
  }
}

export async function loadOnboardingCatalog({ fetchImpl = globalThis.fetch, url = DEFAULT_ONBOARDING_FIXTURE_URL } = {}) {
  if (typeof fetchImpl !== "function") {
    return getOnboardingFixtureCatalog();
  }

  try {
    const response = await fetchImpl(url);
    if (!response || !response.ok) {
      return getOnboardingFixtureCatalog();
    }

    return normalizeCatalog(await response.json());
  } catch {
    return getOnboardingFixtureCatalog();
  }
}

export async function loadOnboardingDocuments(options = {}) {
  if (options.catalog) {
    return normalizeCatalog(options.catalog).documents;
  }

  const catalog = await loadOnboardingCatalog(options);
  return catalog.documents;
}

export function normalizeCatalog(catalog) {
  const source = catalog && typeof catalog === "object" ? catalog : {};
  return {
    schemaVersion: String(source.schemaVersion ?? "1"),
    generatedOn: String(source.generatedOn ?? "2026-04-16"),
    documents: Array.isArray(source.documents) ? source.documents.map(normalizeDocument).filter(Boolean) : []
  };
}

export function normalizeDocument(document) {
  const clone = cloneDocument(document);
  if (!clone) {
    return null;
  }

  clone.journeyTypes = clone.journeyTypes.map(normalizeJourneyType).filter(Boolean);
  clone.keywords = clone.keywords.map((keyword) => String(keyword).trim().toLowerCase()).filter(Boolean);
  clone.section = String(clone.section).trim();
  clone.summary = String(clone.summary).trim();
  clone.documentName = String(clone.documentName).trim();
  clone.owner = String(clone.owner).trim();
  clone.channel = String(clone.channel).trim();
  clone.escalationContact = String(clone.escalationContact).trim();
  clone.updatedOn = String(clone.updatedOn).trim();
  clone.roleFocus = String(clone.roleFocus).trim();
  return clone;
}

export function answerOnboardingQuery(request, documents = getOnboardingFixtureDocuments()) {
  const role = normalizeText(request?.role);
  const journeyType = normalizeJourneyType(request?.journeyType);
  const question = normalizeText(request?.question);
  const normalizedDocuments = normalizeDocuments(documents);

  if (!role || !journeyType) {
    return promptForBasics(role, journeyType);
  }

  if (journeyType === ONBOARDING_JOURNEY_TYPES.FIRST_WEEK) {
    return answerFirstWeek(role, normalizedDocuments);
  }

  if (!question) {
    return {
      agentName: DEFAULT_ONBOARDING_AGENT_NAME,
      firstInteraction: [...FIRST_INTERACTION_PROMPTS],
      answer: buildPromptText(role, journeyType),
      citedDocuments: [],
      warnings: [],
      nextQuestions: ["What specific question do you have?"],
      suggestedEscalation: null
    };
  }

  return answerSpecificQuestion(role, question, normalizedDocuments);
}

export function createOnboardingAgent({ documents = getOnboardingFixtureDocuments() } = {}) {
  const normalizedDocuments = normalizeDocuments(documents);
  return {
    agentName: DEFAULT_ONBOARDING_AGENT_NAME,
    firstInteraction: [...FIRST_INTERACTION_PROMPTS],
    documents: normalizedDocuments,
    answer(request) {
      return answerOnboardingQuery(request, normalizedDocuments);
    }
  };
}

export function normalizeQueryResponse(response) {
  const source = response && typeof response === "object" ? response : {};
  return {
    agentName: String(source.agentName || DEFAULT_ONBOARDING_AGENT_NAME),
    firstInteraction: Array.isArray(source.firstInteraction) && source.firstInteraction.length > 0
      ? source.firstInteraction.map((entry) => String(entry).trim()).filter(Boolean)
      : [...FIRST_INTERACTION_PROMPTS],
    answer: String(source.answer || "").trim(),
    citedDocuments: Array.isArray(source.citedDocuments) ? source.citedDocuments.map(normalizeCitation).filter(Boolean) : [],
    warnings: Array.isArray(source.warnings) ? source.warnings.map((warning) => String(warning).trim()).filter(Boolean) : [],
    nextQuestions: Array.isArray(source.nextQuestions) ? source.nextQuestions.map((question) => String(question).trim()).filter(Boolean) : [],
    suggestedEscalation: source.suggestedEscalation == null ? null : String(source.suggestedEscalation).trim()
  };
}

function promptForBasics(role, journeyType) {
  const nextQuestions = [];
  if (!role) {
    nextQuestions.push("What is your role?");
  }
  if (!journeyType) {
    nextQuestions.push("Is this your first week, or have you been here a bit and have specific questions?");
  }

  return {
    agentName: DEFAULT_ONBOARDING_AGENT_NAME,
    firstInteraction: [...FIRST_INTERACTION_PROMPTS],
    answer: buildPromptText(role, journeyType),
    citedDocuments: [],
    warnings: [],
    nextQuestions,
    suggestedEscalation: null
  };
}

function answerFirstWeek(role, documents) {
  const orderedDocuments = documents
    .filter((document) => supportsJourney(document, ONBOARDING_JOURNEY_TYPES.FIRST_WEEK))
    .filter((document) => matchesRole(document, role))
    .sort((left, right) => {
      const orderDifference = toOrder(left) - toOrder(right);
      if (orderDifference !== 0) {
        return orderDifference;
      }
      return String(left.documentName).localeCompare(String(right.documentName));
    });

  if (orderedDocuments.length === 0) {
    return buildFallback(role);
  }

  const citedDocuments = [];
  const warnings = [];
  const lines = [`For a ${describeRole(role)} in the first week, use these docs in order:`];

  orderedDocuments.forEach((document, index) => {
    citedDocuments.push(citation(document));
    if (document.stale) {
      warnings.push(OUTDATED_WARNING);
    }
    lines.push(`${index + 1}. ${document.section}: ${document.summary} (${document.documentName})`);
  });

  lines.push("Want me to go deeper on any step?");

  return {
    agentName: DEFAULT_ONBOARDING_AGENT_NAME,
    firstInteraction: [...FIRST_INTERACTION_PROMPTS],
    answer: lines.join("\n"),
    citedDocuments,
    warnings: dedupeStrings(warnings),
    nextQuestions: [],
    suggestedEscalation: null
  };
}

function answerSpecificQuestion(role, question, documents) {
  const bestMatch = findBestMatch(role, question, documents);
  if (!bestMatch) {
    return buildFallback(role);
  }

  const warnings = bestMatch.stale ? [OUTDATED_WARNING] : [];
  return {
    agentName: DEFAULT_ONBOARDING_AGENT_NAME,
    firstInteraction: [...FIRST_INTERACTION_PROMPTS],
    answer: `For a ${describeRole(role)}, ${bestMatch.summary} (from ${bestMatch.documentName}). Want me to go deeper?`,
    citedDocuments: [citation(bestMatch)],
    warnings,
    nextQuestions: [],
    suggestedEscalation: null
  };
}

function buildFallback(role) {
  const escalation = escalationForRole(role);
  return {
    agentName: DEFAULT_ONBOARDING_AGENT_NAME,
    firstInteraction: [...FIRST_INTERACTION_PROMPTS],
    answer: `I couldn't find this in our documentation. You may want to ask ${escalation}.`,
    citedDocuments: [],
    warnings: [],
    nextQuestions: [],
    suggestedEscalation: escalation
  };
}

function citation(document) {
  return {
    documentName: document.documentName,
    section: document.section,
    owner: document.owner,
    channel: document.channel,
    updatedOn: document.updatedOn,
    outdated: Boolean(document.stale)
  };
}

function normalizeCitation(citation) {
  if (!citation || typeof citation !== "object") {
    return null;
  }

  return {
    documentName: String(citation.documentName || citation.name || "").trim(),
    section: String(citation.section || "").trim(),
    owner: String(citation.owner || "").trim(),
    channel: String(citation.channel || "").trim(),
    updatedOn: String(citation.updatedOn || "").trim(),
    outdated: Boolean(citation.outdated)
  };
}

function getOnboardingQueryResponseFixture() {
  return normalizeQueryResponse({
    agentName: DEFAULT_ONBOARDING_AGENT_NAME,
    firstInteraction: [...FIRST_INTERACTION_PROMPTS],
    answer: "I can help with onboarding guidance.",
    citedDocuments: [],
    warnings: [],
    nextQuestions: [...FIRST_INTERACTION_PROMPTS],
    suggestedEscalation: null
  });
}

function buildPromptText(role, journeyType) {
  if (!role && !journeyType) {
    return "I need your role and whether this is your first week or you have been here a bit and have specific questions.";
  }
  if (!role) {
    return "I need your role.";
  }
  if (!journeyType) {
    return "I need to know whether this is your first week or you have been here a bit and have specific questions.";
  }
  return `I can help with onboarding guidance for ${describeRole(role)}.`;
}

function describeRole(role) {
  return role && String(role).trim() ? String(role).trim() : "new joiner";
}

function escalationForRole(role) {
  const normalized = normalizeText(role).toLowerCase();
  if (normalized === "developer") {
    return "your team lead or #engineering-help";
  }
  if (normalized === "tester" || normalized === "qa" || normalized === "quality engineer") {
    return "your QE lead or #qa-help";
  }
  if (normalized === "scrum master") {
    return "your delivery lead or #delivery-ops";
  }
  if (normalized === "product owner") {
    return "the program lead or #product";
  }
  return "your team lead or #onboarding-help";
}

function findBestMatch(role, question, documents) {
  const tokens = tokenize(question);
  if (tokens.length === 0) {
    return null;
  }

  const rankedMatch = documents
    .filter((document) => supportsJourney(document, ONBOARDING_JOURNEY_TYPES.SPECIFIC_QUESTION) || supportsJourney(document, ONBOARDING_JOURNEY_TYPES.FIRST_WEEK))
    .map((document) => ({ document, score: scoreDocument(document, role, tokens) }))
    .filter(({ score }) => score > 0)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      return toOrder(left.document) - toOrder(right.document);
    })[0];

  if (!rankedMatch || rankedMatch.score < 20) {
    return null;
  }

  return rankedMatch.document;
}

function scoreDocument(document, role, tokens) {
  let score = 0;
  const exactRoleMatch = matchesExactRole(document, role);

  for (const keyword of document.keywords || []) {
    if (tokens.includes(String(keyword).toLowerCase())) {
      score += 15;
    }
  }

  const section = String(document.section || "").toLowerCase();
  if (section && tokens.includes(section)) {
    score += 10;
  }

  const summary = String(document.summary || "").toLowerCase();
  for (const token of tokens) {
    if (summary.includes(token)) {
      score += 1;
    }
  }

  if (score > 0 && exactRoleMatch) {
    score += 20;
  }

  return score;
}

function tokenize(question) {
  const value = normalizeText(question).toLowerCase();
  if (!value) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .split(/[^a-z0-9]+/)
        .map((token) => token.trim())
        .filter(Boolean)
    )
  );
}

function supportsJourney(document, journeyType) {
  return Array.isArray(document?.journeyTypes) && document.journeyTypes.includes(journeyType);
}

function matchesRole(document, role) {
  if (!document?.roleFocus || document.roleFocus === "*") {
    return true;
  }
  const normalizedRole = normalizeText(role);
  return normalizedRole ? document.roleFocus.toLowerCase() === normalizedRole.toLowerCase() : false;
}

function matchesExactRole(document, role) {
  if (!document?.roleFocus || document.roleFocus === "*") {
    return false;
  }
  const normalizedRole = normalizeText(role);
  return Boolean(normalizedRole) && document.roleFocus.toLowerCase() === normalizedRole.toLowerCase();
}

function normalizeDocuments(documents) {
  return Array.isArray(documents) ? documents.map(normalizeDocument).filter(Boolean) : [];
}

function normalizeText(value) {
  return value == null ? "" : String(value).trim();
}

function dedupeStrings(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function toOrder(document) {
  const order = Number(document?.topicOrder);
  return Number.isFinite(order) ? order : 0;
}
