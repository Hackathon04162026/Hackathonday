import { describe, expect, it } from "vitest";
import {
  buildOnboardingFixtureUrl,
  DEFAULT_ONBOARDING_AGENT_NAME,
  DEFAULT_ONBOARDING_FIXTURE_URL,
  DEFAULT_ONBOARDING_QUERY_RESPONSE_URL,
  ONBOARDING_JOURNEY_TYPES,
  OUTDATED_WARNING,
  answerOnboardingQuery,
  createOnboardingAgent,
  loadOnboardingCatalog,
  loadOnboardingDocuments,
  loadOnboardingQueryResponse,
  normalizeJourneyType
} from "./onboardingAgent";
import { getOnboardingFixtureCatalog } from "./onboardingFixtures";

describe("onboarding agent", () => {
  it("prompts for role and journey type on the first interaction", () => {
    const response = answerOnboardingQuery({});

    expect(response.agentName).toBe(DEFAULT_ONBOARDING_AGENT_NAME);
    expect(response.answer).toContain("I need your role and whether this is your first week or you have been here a bit and have specific questions.");
    expect(response.firstInteraction).toEqual([
      "What is your role?",
      "Is this your first week, or have you been here a bit and have specific questions?"
    ]);
    expect(response.nextQuestions).toEqual([
      "What is your role?",
      "Is this your first week, or have you been here a bit and have specific questions?"
    ]);
    expect(response.citedDocuments).toHaveLength(0);
    expect(response.suggestedEscalation).toBeNull();
  });

  it("returns ordered first-week guidance with citations and stale warnings", () => {
    const response = answerOnboardingQuery({
      role: "Developer",
      journeyType: ONBOARDING_JOURNEY_TYPES.FIRST_WEEK
    });

    expect(response.answer).toContain("For a Developer in the first week, use these docs in order:");
    expect(response.answer).toContain("1. Team overview:");
    expect(response.answer).toContain("6. First contribution:");
    expect(response.citedDocuments.map((citation) => citation.documentName)).toEqual([
      "New Joiner Team Overview",
      "Tools and Access Checklist",
      "Ceremonies and Rituals Guide",
      "Codebase and Architecture Primer",
      "Definition of Done and Ready",
      "First Contribution Playbook"
    ]);
    expect(response.warnings).toContain(OUTDATED_WARNING);
    expect(response.citedDocuments[1].outdated).toBe(true);
    expect(response.firstInteraction).toHaveLength(2);
  });

  it("matches a specific question to the best document and adapts the language to the role", () => {
    const response = answerOnboardingQuery({
      role: "Developer",
      journeyType: "specific-question",
      question: "What is our branching strategy?"
    });

    expect(response.answer).toContain("For a Developer, Use short-lived feature branches");
    expect(response.answer).toContain("Branching Strategy Reference");
    expect(response.citedDocuments).toHaveLength(1);
    expect(response.citedDocuments[0]).toMatchObject({
      documentName: "Branching Strategy Reference",
      section: "Branching strategy",
      owner: "Engineering Lead",
      channel: "#engineering-help",
      outdated: true
    });
    expect(response.warnings).toEqual([OUTDATED_WARNING]);
  });

  it("falls back with role-based escalation guidance when the docs do not answer", () => {
    const response = answerOnboardingQuery({
      role: "Tester",
      journeyType: ONBOARDING_JOURNEY_TYPES.SPECIFIC_QUESTION,
      question: "Who approves printer purchases?"
    });

    expect(response.answer).toBe("I couldn't find this in our documentation. You may want to ask your QE lead or #qa-help.");
    expect(response.suggestedEscalation).toBe("your QE lead or #qa-help");
    expect(response.citedDocuments).toHaveLength(0);
  });

  it("loads and normalizes fixture catalogs from a fetch implementation", async () => {
    const fixture = getOnboardingFixtureCatalog();
    const fetchImpl = async (url) => ({
      ok: true,
      status: 200,
      json: async () => ({ ...fixture, sourceUrl: url })
    });

    const catalog = await loadOnboardingCatalog({ fetchImpl, url: DEFAULT_ONBOARDING_FIXTURE_URL });

    expect(catalog.schemaVersion).toBe("1");
    expect(catalog.documents).toHaveLength(fixture.documents.length);
    expect(catalog.documents[0]).toMatchObject({
      documentName: "New Joiner Team Overview",
      journeyTypes: ["FIRST_WEEK"]
    });
  });

  it("falls back to the bundled catalog when the fixture fetch fails", async () => {
    const catalog = await loadOnboardingCatalog({
      fetchImpl: async () => ({
        ok: false,
        status: 404
      })
    });

    expect(catalog.documents).toHaveLength(10);
    expect(catalog.documents[0].documentName).toBe("New Joiner Team Overview");
  });

  it("returns fixture documents when a catalog object is passed directly", async () => {
    const documents = await loadOnboardingDocuments({ catalog: getOnboardingFixtureCatalog() });

    expect(documents).toHaveLength(10);
    expect(documents[7].documentName).toBe("QA Environment Setup");
  });

  it("normalizes alternate journey type spellings", () => {
    expect(normalizeJourneyType("first week")).toBe(ONBOARDING_JOURNEY_TYPES.FIRST_WEEK);
    expect(normalizeJourneyType("specific-question")).toBe(ONBOARDING_JOURNEY_TYPES.SPECIFIC_QUESTION);
    expect(normalizeJourneyType("unknown")).toBeNull();
  });

  it("builds a fixture URL that respects the Vite base path", () => {
    expect(buildOnboardingFixtureUrl("/migration-helper/")).toBe("/migration-helper/mock-data/onboarding-documents.json");
    expect(buildOnboardingFixtureUrl("/migration-helper/", "mock-data/onboarding/query-response.json")).toBe("/migration-helper/mock-data/onboarding/query-response.json");
    expect(DEFAULT_ONBOARDING_FIXTURE_URL).toContain("mock-data/onboarding-documents.json");
    expect(DEFAULT_ONBOARDING_QUERY_RESPONSE_URL).toContain("mock-data/onboarding/query-response.json");
  });

  it("creates a reusable agent wrapper with the same deterministic answer flow", () => {
    const agent = createOnboardingAgent();
    const response = agent.answer({
      role: "Product Owner",
      journeyType: ONBOARDING_JOURNEY_TYPES.SPECIFIC_QUESTION,
      question: "How do I intake a new epic?"
    });

    expect(agent.agentName).toBe(DEFAULT_ONBOARDING_AGENT_NAME);
    expect(response.answer).toContain("For a Product Owner, Capture the vision, refine epics");
    expect(response.citedDocuments[0].documentName).toBe("Product Owner Intake Guide");
  });

  it("loads a query response fixture and falls back safely when fetch is unavailable", async () => {
    const fixture = {
      agentName: "Confluence-grounded Onboarding Agent",
      firstInteraction: ["What is your role?", "Is this your first week, or have you been here a bit and have specific questions?"],
      answer: "Loaded from fixture",
      citedDocuments: [{ documentName: "Team onboarding guide", section: "Tools and access", outdated: false }]
    };

    const loaded = await loadOnboardingQueryResponse({
      fetchImpl: async () => ({ ok: true, status: 200, json: async () => fixture }),
      url: DEFAULT_ONBOARDING_QUERY_RESPONSE_URL
    });

    expect(loaded.answer).toBe("Loaded from fixture");
    expect(loaded.firstInteraction).toHaveLength(2);
    expect(loaded.citedDocuments[0]).toMatchObject({
      documentName: "Team onboarding guide",
      section: "Tools and access",
      outdated: false
    });

    const fallback = await loadOnboardingQueryResponse({ fetchImpl: null });
    expect(fallback.firstInteraction).toEqual([
      "What is your role?",
      "Is this your first week, or have you been here a bit and have specific questions?"
    ]);
    expect(fallback.citedDocuments).toHaveLength(0);
  });
});
