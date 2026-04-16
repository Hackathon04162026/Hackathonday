"use strict";

const planningState = {
  mode: new URLSearchParams(window.location.search).get("mode") === "live" ? "live" : "mock",
  plans: [],
  selectedPlanId: null,
  selectedPlan: null,
  refinementStories: null,
  testCases: null,
  onboardingResponse: null
};

const planningElements = {};

document.addEventListener("DOMContentLoaded", () => {
  if (!document.getElementById("planning-workspace")) return;
  cachePlanningElements();
  bindPlanningEvents();
  bootstrapPlanning().catch(handlePlanningError);
});

function cachePlanningElements() {
  const ids = {
    status: "planning-status",
    planListStatus: "plan-list-status",
    planResultsBody: "plan-results-body",
    planSummaryCards: "plan-summary-cards",
    planDetailEmpty: "plan-detail-empty",
    planDetailContent: "plan-detail-content",
    planStageBadge: "plan-stage-badge",
    planDetailName: "plan-detail-name",
    planDetailProgramLead: "plan-detail-program-lead",
    planDetailTargetUsers: "plan-detail-target-users",
    planDetailUpdatedAt: "plan-detail-updated-at",
    planDetailOutcomes: "plan-detail-outcomes",
    planDetailVision: "plan-detail-vision",
    planReviewCheckpoints: "plan-review-checkpoints",
    planEpicsList: "plan-epics-list",
    planFeaturesList: "plan-features-list",
    planStoriesList: "plan-stories-list",
    planOnboardingList: "plan-onboarding-list",
    reviewerName: "reviewer-name",
    reviewNotes: "review-notes",
    visionForm: "vision-intake-form",
    refinementForm: "refinement-form",
    refinementStatus: "refinement-status",
    refinementOutput: "refinement-output",
    testCaseForm: "test-case-form",
    testCaseStatus: "test-case-status",
    testCaseOutput: "test-case-output",
    onboardingForm: "onboarding-form",
    onboardingStatus: "onboarding-status",
    onboardingOutput: "onboarding-output"
  };

  for (const [key, id] of Object.entries(ids)) {
    planningElements[key] = document.getElementById(id);
  }
}

function bindPlanningEvents() {
  document.getElementById("refresh-plans")?.addEventListener("click", () => bootstrapPlanning().catch(handlePlanningError));

  planningElements.planResultsBody?.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-plan-id]");
    if (button) selectPlan(button.dataset.planId).catch(handlePlanningError);
  });

  planningElements.planReviewCheckpoints?.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-review-stage]");
    if (button) approveReview(button.dataset.reviewStage).catch(handlePlanningError);
  });

  document.getElementById("approve-epics-review")?.addEventListener("click", () => approveReview("epics").catch(handlePlanningError));
  document.getElementById("approve-features-review")?.addEventListener("click", () => approveReview("features").catch(handlePlanningError));

  planningElements.visionForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    submitVisionIntake().catch(handlePlanningError);
  });

  planningElements.refinementForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    submitRefinement().catch(handlePlanningError);
  });
  planningElements.refinementForm?.addEventListener("reset", () => queueMicrotask(() => {
    setSectionStatus(planningElements.refinementStatus, "Ready to refine the selected plan or pasted notes.", "info");
    if (planningElements.refinementOutput) planningElements.refinementOutput.innerHTML = "";
  }));

  planningElements.testCaseForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    submitTestCases().catch(handlePlanningError);
  });
  planningElements.testCaseForm?.addEventListener("reset", () => queueMicrotask(() => {
    setSectionStatus(planningElements.testCaseStatus, "Ready to generate test suites from acceptance criteria.", "info");
    if (planningElements.testCaseOutput) planningElements.testCaseOutput.innerHTML = "";
  }));

  planningElements.onboardingForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    submitOnboarding().catch(handlePlanningError);
  });
  planningElements.onboardingForm?.addEventListener("reset", () => queueMicrotask(() => {
    setSectionStatus(planningElements.onboardingStatus, "Ready to answer with document-backed guidance.", "info");
    if (planningElements.onboardingOutput) planningElements.onboardingOutput.innerHTML = "";
  }));
}

async function bootstrapPlanning() {
  setPlanningStatus(planningState.mode === "live" ? "Loading planning data from live APIs..." : "Loading planning data from mock fixtures...", "info");
  await loadPlans();

  if (planningState.selectedPlanId || planningState.plans.length > 0) {
    await selectPlan(planningState.selectedPlanId || planningState.plans[0].id, { preserveStatus: true });
  } else {
    renderPlanTable();
    renderPlanDetail();
  }

  if (planningState.mode === "mock") {
    await seedMockToolPanels();
  } else {
    renderPlanningToolPlaceholders();
  }

  setPlanningStatus(planningState.mode === "live"
    ? "Live planning APIs are active. Refinement, test case generation, and onboarding are calling the running backend."
    : "Mock planning fixtures are active. Refinement, test case generation, and onboarding are using checked-in samples.", "success");
}

async function loadPlans() {
  if (planningElements.planListStatus) planningElements.planListStatus.textContent = "Loading plans...";
  const response = planningState.mode === "live" ? await fetchJson("/api/plans") : await fetchJson("/mock-data/plans/list.json");
  const collection = normalizePlanCollection(response);
  planningState.plans = collection.plans;
  planningState.selectedPlanId = collection.selectedPlanId || planningState.selectedPlanId || planningState.plans[0]?.id || null;
  renderPlanSummary();
  renderPlanTable();
}

async function selectPlan(planId, options = {}) {
  const summary = planningState.plans.find((entry) => entry.id === planId) || { id: planId };
  const detailResponse = planningState.mode === "live"
    ? await fetchJson(`/api/plans/${encodeURIComponent(planId)}`)
    : hydrateMockPlanDetail(await fetchJson("/mock-data/plans/detail.json"), summary);

  planningState.selectedPlan = normalizePlanDetail(detailResponse, summary);
  planningState.selectedPlanId = planningState.selectedPlan.id;
  renderPlanSummary();
  renderPlanTable();
  renderPlanDetail();
  if (!options.preserveStatus) setPlanningStatus(`Selected ${planningState.selectedPlan.displayName}.`, "info");
  if (planningElements.planListStatus) planningElements.planListStatus.textContent = `Loaded ${planningState.selectedPlan.displayName}.`;
}

async function submitVisionIntake() {
  if (!planningElements.visionForm.checkValidity()) {
    setPlanningStatus("Enter a program lead and vision before creating the plan.", "warning");
    planningElements.visionForm.reportValidity();
    return;
  }

  const payload = readFormValues(planningElements.visionForm, ["productName", "programLead", "targetUsers", "vision", "desiredOutcomes"]);
  payload.desiredOutcomes = splitMultiline(payload.desiredOutcomes);

  const response = planningState.mode === "live"
    ? await fetchJson("/api/plans", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
    : createMockPlanFromForm(payload);

  const plan = normalizePlanDetail(response, {
    id: response.id || `plan-${cryptoRandomId()}`,
    displayName: response.displayName || payload.productName || "New plan",
    programLead: payload.programLead,
    targetUsers: payload.targetUsers,
    vision: payload.vision,
    desiredOutcomes: payload.desiredOutcomes,
    stage: response.stage || "EPIC_REVIEW"
  });

  upsertPlan(plan);
  planningElements.visionForm.reset();
  setPlanningStatus(`Created ${plan.displayName}.`, "success");
  if (planningState.mode === "live" && plan.id) await selectPlan(plan.id, { preserveStatus: true });
}

async function approveReview(stage) {
  if (!planningState.selectedPlan) {
    setPlanningStatus("Select a plan before approving a review stage.", "warning");
    return;
  }

  const payload = {
    reviewer: planningElements.reviewerName?.value.trim() || "",
    notes: planningElements.reviewNotes?.value.trim() || ""
  };

  const response = planningState.mode === "live"
    ? await fetchJson(`/api/plans/${encodeURIComponent(planningState.selectedPlan.id)}/reviews/${encodeURIComponent(stage)}/approve`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
    : createMockReviewApproval(stage, payload);

  const updatedPlan = normalizePlanDetail(response?.plan || response || planningState.selectedPlan, planningState.selectedPlan);
  setPlanReviewStatus(updatedPlan, stage, payload);
  upsertPlan(updatedPlan);
  setPlanningStatus(`${prettyReviewStage(stage)} approved for ${updatedPlan.displayName}.`, "success");
  if (planningState.mode === "live" && updatedPlan.id) await selectPlan(updatedPlan.id, { preserveStatus: true });
}

async function submitRefinement() {
  if (!planningElements.refinementForm.checkValidity()) {
    setSectionStatus(planningElements.refinementStatus, "Add refinement notes before generating stories.", "warning");
    planningElements.refinementForm.reportValidity();
    return;
  }

  const payload = readFormValues(planningElements.refinementForm, ["notes", "context"]);
  payload.teamContext = payload.context || planningState.selectedPlan?.displayName || "";
  delete payload.context;

  const response = planningState.mode === "live"
    ? await fetchJson("/api/refinement/stories", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
    : planningState.refinementStories || await fetchJson("/mock-data/refinement/story.json");

  planningState.refinementStories = normalizeRefinementResponse(response);
  renderRefinementOutput(planningState.refinementStories);
  setSectionStatus(planningElements.refinementStatus, "Refinement output rendered.", "success");
}

async function submitTestCases() {
  if (!planningElements.testCaseForm.checkValidity()) {
    setSectionStatus(planningElements.testCaseStatus, "Add a story and acceptance criteria before generating tests.", "warning");
    planningElements.testCaseForm.reportValidity();
    return;
  }

  const payload = readFormValues(planningElements.testCaseForm, ["story", "acceptanceCriteria"]);
  payload.storySummary = payload.story || "";
  payload.storyTitle = planningState.selectedPlan?.displayName || "Generated test suite";
  payload.environment = planningState.mode === "live" ? "live" : "mock";
  delete payload.story;
  payload.acceptanceCriteria = splitMultiline(payload.acceptanceCriteria);

  const response = planningState.mode === "live"
    ? await fetchJson("/api/test-cases", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
    : planningState.testCases || await fetchJson("/mock-data/test-cases/generated.json");

  planningState.testCases = normalizeTestCasesResponse(response);
  renderTestCaseOutput(planningState.testCases);
  setSectionStatus(planningElements.testCaseStatus, "Test case output rendered.", "success");
}

async function submitOnboarding() {
  if (!planningElements.onboardingForm.checkValidity()) {
    setSectionStatus(planningElements.onboardingStatus, "Add a role, tenure, and question before asking for onboarding help.", "warning");
    planningElements.onboardingForm.reportValidity();
    return;
  }

  const payload = readFormValues(planningElements.onboardingForm, ["role", "tenure", "question"]);
  payload.journeyType = mapJourneyType(payload.tenure);
  delete payload.tenure;

  const response = planningState.mode === "live"
    ? await fetchJson("/api/onboarding/query", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
    : planningState.onboardingResponse || await fetchJson("/mock-data/onboarding/query-response.json");

  planningState.onboardingResponse = normalizeOnboardingResponse(response);
  renderOnboardingOutput(planningState.onboardingResponse);
  setSectionStatus(planningElements.onboardingStatus, "Onboarding answer rendered.", "success");
}

async function seedMockToolPanels() {
  const [refinement, testCases, onboarding] = await Promise.all([
    fetchJson("/mock-data/refinement/story.json"),
    fetchJson("/mock-data/test-cases/generated.json"),
    fetchJson("/mock-data/onboarding/query-response.json")
  ]);

  planningState.refinementStories = normalizeRefinementResponse(refinement);
  planningState.testCases = normalizeTestCasesResponse(testCases);
  planningState.onboardingResponse = normalizeOnboardingResponse(onboarding);

  renderRefinementOutput(planningState.refinementStories);
  renderTestCaseOutput(planningState.testCases);
  renderOnboardingOutput(planningState.onboardingResponse);

  if (!planningElements.refinementForm.notes.value) {
    planningElements.refinementForm.notes.value = planningState.selectedPlan?.vision || "Paste messy refinement notes here.";
  }
  if (!planningElements.testCaseForm.story.value) {
    planningElements.testCaseForm.story.value = planningState.refinementStories?.stories?.[0]?.storySummary || "As a contributor, I want a structured story so that I can plan the work.";
  }
  if (!planningElements.testCaseForm.acceptanceCriteria.value) {
    const criteria = planningState.testCases?.testSuites?.flatMap((suite) => arrayify(suite.acceptanceCriteria)) || [];
    planningElements.testCaseForm.acceptanceCriteria.value = criteria.join("\n\n") || "Given a plan exists, when review completes, then the next stage becomes available.";
  }
  if (!planningElements.onboardingForm.role.value) planningElements.onboardingForm.role.value = "Developer";
  if (!planningElements.onboardingForm.tenure.value) planningElements.onboardingForm.tenure.value = "first-week";
  if (!planningElements.onboardingForm.question.value) planningElements.onboardingForm.question.value = "How do I set up my dev environment?";
}

function renderPlanSummary() {
  const totals = {
    totalPlans: planningState.plans.length,
    epicReviewPlans: planningState.plans.filter((plan) => normalizePlanStage(plan.stage) === "epic_review").length,
    featureReviewPlans: planningState.plans.filter((plan) => normalizePlanStage(plan.stage) === "feature_review").length,
    storyReadyPlans: planningState.plans.filter((plan) => normalizePlanStage(plan.stage) === "story_ready").length
  };

  for (const [key, value] of Object.entries(totals)) {
    const node = planningElements.planSummaryCards?.querySelector(`[data-summary-key="${key}"] [data-value]`);
    if (node) node.textContent = String(value);
  }
}

function renderPlanTable() {
  if (!planningElements.planResultsBody) return;
  planningElements.planResultsBody.innerHTML = "";

  if (planningState.plans.length === 0) {
    planningElements.planResultsBody.innerHTML = '<tr id="plan-results-empty"><td colspan="5">No plans loaded yet.</td></tr>';
    if (planningElements.planListStatus) planningElements.planListStatus.textContent = "No plans are available yet.";
    return;
  }

  for (const plan of planningState.plans) {
    const row = document.createElement("tr");
    if (planningState.selectedPlanId === plan.id) row.classList.add("row-selected");
    row.innerHTML = `
      <td><strong>${escapeHtml(plan.displayName)}</strong><div class="muted-line">${escapeHtml(plan.id)}</div></td>
      <td>${escapeHtml(plan.programLead || "TBD")}</td>
      <td><span class="${stageBadgeClass(plan.stage)}">${escapeHtml(prettyPlanStage(plan.stage))}</span></td>
      <td>${escapeHtml(renderPlanCounts(plan))}</td>
      <td><button type="button" class="secondary" data-plan-id="${escapeHtml(plan.id)}">Open</button></td>
    `;
    planningElements.planResultsBody.appendChild(row);
  }

  if (planningElements.planListStatus) planningElements.planListStatus.textContent = `Loaded ${planningState.plans.length} plans.`;
}

function renderPlanDetail() {
  if (!planningState.selectedPlan) {
    planningElements.planDetailEmpty.hidden = false;
    planningElements.planDetailContent.hidden = true;
    planningElements.planStageBadge.textContent = "No plan selected";
    planningElements.planStageBadge.className = "pill info";
    return;
  }

  const plan = planningState.selectedPlan;
  planningElements.planDetailEmpty.hidden = true;
  planningElements.planDetailContent.hidden = false;
  planningElements.planStageBadge.textContent = prettyPlanStage(plan.stage);
  planningElements.planStageBadge.className = stageBadgeClass(plan.stage);
  planningElements.planDetailName.textContent = plan.displayName || plan.id || "-";
  planningElements.planDetailProgramLead.textContent = plan.programLead || "-";
  planningElements.planDetailTargetUsers.textContent = arrayToSentence(plan.targetUsers);
  planningElements.planDetailUpdatedAt.textContent = formatDate(plan.updatedAt);
  planningElements.planDetailVision.textContent = plan.vision || "-";
  planningElements.planDetailOutcomes.innerHTML = renderStringList(plan.desiredOutcomes, "No outcomes captured yet.");
  planningElements.planReviewCheckpoints.innerHTML = renderReviewCheckpoints(plan);
  planningElements.planEpicsList.innerHTML = renderBacklogList(plan.epics, "No epics available yet.");
  planningElements.planFeaturesList.innerHTML = renderBacklogList(plan.features, "No features available yet.");
  planningElements.planStoriesList.innerHTML = renderBacklogList(plan.stories, "No stories available yet.");
  planningElements.planOnboardingList.innerHTML = renderBacklogList(plan.onboardingChecklist, "No onboarding checklist available yet.");
}

function renderReviewCheckpoints(plan) {
  const checkpoints = arrayify(plan.reviewCheckpoints).length > 0
    ? plan.reviewCheckpoints
    : [
        { stage: "epics", label: "Epic review", status: "pending", notes: "Waiting for approval" },
        { stage: "features", label: "Feature review", status: "pending", notes: "Waiting for approval" }
      ];

  return checkpoints.map((checkpoint) => `
    <article class="card nested-card">
      <div class="card-body stack">
        <div class="pill ${checkpointStatusClass(checkpoint.status)}">${escapeHtml(checkpoint.label || prettyReviewStage(checkpoint.stage))}</div>
        <strong>${escapeHtml(prettyReviewStage(checkpoint.stage))}</strong>
        <div class="muted-line">${escapeHtml(checkpoint.notes || "No notes captured yet.")}</div>
        <div class="form-actions">
          <button type="button" data-review-stage="${escapeHtml(normalizeReviewStage(checkpoint.stage))}">Approve ${escapeHtml(prettyReviewStage(checkpoint.stage).toLowerCase())}</button>
        </div>
      </div>
    </article>
  `).join("");
}

function renderBacklogList(items, emptyLabel) {
  const normalized = normalizeBacklogItems(items);
  if (normalized.length === 0) {
    return `<div class="empty-state compact"><div><h4>${escapeHtml(emptyLabel)}</h4></div></div>`;
  }

  return normalized.map((item) => `
    <article class="card nested-card">
      <div class="card-body stack">
        <div class="pill ${checkpointStatusClass(item.status)}">${escapeHtml(item.status || "draft")}</div>
        <strong>${escapeHtml(item.title || item.name || item.id || "Untitled item")}</strong>
        <div class="muted-line">${escapeHtml(item.summary || item.description || "No summary provided.")}</div>
        <div class="stack">
          ${item.owner ? `<div><strong>Owner:</strong> ${escapeHtml(item.owner)}</div>` : ""}
          ${item.points ? `<div><strong>Points:</strong> ${escapeHtml(String(item.points))}</div>` : ""}
          ${item.featureCount !== undefined ? `<div><strong>Features:</strong> ${escapeHtml(String(item.featureCount))}</div>` : ""}
          ${item.storyCount !== undefined ? `<div><strong>Stories:</strong> ${escapeHtml(String(item.storyCount))}</div>` : ""}
        </div>
      </div>
    </article>
  `).join("");
}

function renderRefinementOutput(response) {
  const stories = arrayify(response?.stories || response?.items || response);
  if (stories.length === 0) {
    planningElements.refinementOutput.innerHTML = '<div class="empty-state compact"><div><h4>No refinement output available</h4><p>Submit messy notes to generate a structured story package.</p></div></div>';
    return;
  }

  planningElements.refinementOutput.innerHTML = stories.map((story) => `
    <article class="card nested-card">
      <div class="card-body stack">
        <div class="pill primary">Refined story</div>
        ${renderPlanningField("Problem Statement", story.problemStatement)}
        ${renderPlanningField("Story Summary", story.storySummary)}
        ${renderPlanningFieldList("Acceptance Criteria", story.acceptanceCriteria)}
        ${renderPlanningFieldList("Dependencies", story.dependencies)}
        ${renderPlanningFieldList("References", story.references)}
        ${renderPlanningField("Estimation", story.estimation)}
        ${renderPlanningFieldList("Definition of Ready Validation", story.definitionOfReadyValidation)}
        ${renderPlanningFieldList("DoR Gaps", story.gaps)}
        ${renderPlanningFieldList("Normalization Notes", story.normalizationNotes)}
        <div class="cards cols-3">
          ${renderMiniStat("Parent Epic Link", story.parentEpicLink)}
          ${renderMiniStat("Label", story.label)}
          ${renderMiniStat("Sprint", story.sprint)}
        </div>
      </div>
    </article>
  `).join("");
}

function renderTestCaseOutput(response) {
  const suites = arrayify(response?.testSuites || response?.suites || response);
  const summary = response?.summary || {};

  if (suites.length === 0) {
    planningElements.testCaseOutput.innerHTML = '<div class="empty-state compact"><div><h4>No test cases available</h4><p>Submit a user story and acceptance criteria to generate execution-ready test coverage.</p></div></div>';
    return;
  }

  planningElements.testCaseOutput.innerHTML = `
    <article class="card nested-card">
      <div class="card-body stack">
        <div class="cards cols-3">
          ${renderMiniStat("Total test cases", summary.totalTestCases ?? countTestCases(suites))}
          ${renderMiniStat("Positive", summary.positive ?? summary.positiveCount ?? countCasesByType(suites, "Positive"))}
          ${renderMiniStat("Negative", summary.negative ?? summary.negativeCount ?? countCasesByType(suites, "Negative"))}
        </div>
        <div class="cards cols-3">
          ${renderMiniStat("Edge cases", summary.edgeCases ?? summary.edgeCaseCount ?? countCasesByType(suites, "Edge Case"))}
          ${renderMiniStat("Boundary", summary.boundary ?? summary.boundaryCount ?? countCasesByType(suites, "Boundary"))}
          ${renderMiniStat("Gaps", arrayify(summary.gaps || summary.gapList).length)}
        </div>
        ${arrayify(summary.gaps || summary.gapList).length > 0 ? renderPlanningFieldList("Coverage gaps", summary.gaps || summary.gapList) : ""}
      </div>
    </article>
    ${suites.map((suite) => `
      <article class="card nested-card">
        <div class="card-header">
          <div>
            <p class="muted-line">Test Suite</p>
            <h4>${escapeHtml(suite.name || suite.title || suite.acceptanceCriterion || "Unnamed suite")}</h4>
          </div>
          ${suite.acceptanceCriterion ? `<span class="pill info">${escapeHtml(suite.acceptanceCriterion)}</span>` : ""}
        </div>
        <div class="card-body stack">
          ${arrayify(suite.testCases || suite.cases).map((testCase) => renderTestCaseCard(testCase)).join("")}
        </div>
      </article>
    `).join("")}
  `;
}

function renderTestCaseCard(testCase) {
  return `
    <article class="card nested-card">
      <div class="card-body stack">
        <div class="pill ${typeBadgeClass(testCase.type)}">${escapeHtml(testCase.id || "TC-???")}</div>
        <strong>${escapeHtml(testCase.name || testCase.title || "Untitled test case")}</strong>
        <div class="cards cols-3">
          ${renderMiniStat("Priority", testCase.priority)}
          ${renderMiniStat("Type", testCase.type)}
          ${renderMiniStat("Test data", arrayToSentence(testCase.testData))}
        </div>
        ${renderPlanningFieldList("Preconditions", testCase.preconditions)}
        ${renderPlanningFieldList("Steps", testCase.steps)}
        ${renderPlanningField("Expected result", testCase.expectedResult)}
      </div>
    </article>
  `;
}

function renderOnboardingOutput(response) {
  if (!response) {
    planningElements.onboardingOutput.innerHTML = '<div class="empty-state compact"><div><h4>No onboarding answer available</h4><p>Ask a question to search the checked-in documents first and get a cited answer.</p></div></div>';
    return;
  }

  const citedDocuments = arrayify(response.citedDocuments);
  const warnings = arrayify(response.warnings);
  const nextQuestions = arrayify(response.nextQuestions);

  planningElements.onboardingOutput.innerHTML = `
    <article class="card nested-card">
      <div class="card-body stack">
        <div class="pill primary">Onboarding answer</div>
        <p>${escapeHtml(response.answer || response.response || "No answer returned.")}</p>
        ${citedDocuments.length > 0 ? renderCitedDocuments(citedDocuments) : ""}
        ${warnings.length > 0 ? renderPlanningFieldList("Warnings", warnings) : ""}
        ${nextQuestions.length > 0 ? renderPlanningFieldList("Next questions", nextQuestions) : ""}
        ${renderPlanningField("Suggested escalation", response.suggestedEscalation)}
      </div>
    </article>
  `;
}

function renderPlanningToolPlaceholders() {
  planningElements.refinementOutput.innerHTML = '<div class="empty-state compact"><div><h4>Waiting for refinement input</h4><p>Paste messy notes to generate a structured story package.</p></div></div>';
  planningElements.testCaseOutput.innerHTML = '<div class="empty-state compact"><div><h4>Waiting for acceptance criteria</h4><p>Paste a story and acceptance criteria to generate test coverage.</p></div></div>';
  planningElements.onboardingOutput.innerHTML = '<div class="empty-state compact"><div><h4>Waiting for onboarding question</h4><p>Ask a role-specific question and the agent will search the checked-in documents first.</p></div></div>';
}

function renderPlanningField(title, value) {
  if (value === null || value === undefined || value === "") return "";
  return `<article class="card nested-card"><div class="card-body stack"><strong>${escapeHtml(title)}</strong><p>${escapeHtml(value)}</p></div></article>`;
}

function renderPlanningFieldList(title, values) {
  const items = arrayify(values);
  if (items.length === 0) return "";
  return `<article class="card nested-card"><div class="card-body stack"><strong>${escapeHtml(title)}</strong><ul class="plain-list">${items.map((value) => `<li>${escapeHtml(typeof value === "object" ? value.name || value.title || JSON.stringify(value) : value)}</li>`).join("")}</ul></div></article>`;
}

function renderCitedDocuments(documents) {
  const sourceStatus = (document) => {
    const outdated = document.outdated ?? document.stale;
    if (outdated === undefined) {
      return "";
    }
    return `<span class="muted-line">${outdated ? "Stale source" : "Current source"}</span>`;
  };

  return `<article class="card nested-card"><div class="card-body stack"><strong>Cited documents</strong><ul class="plain-list">${documents.map((document) => `
    <li>
      <strong>${escapeHtml(document.documentName || document.name || "Untitled document")}</strong>
      ${document.section ? `<span class="muted-line">Section: ${escapeHtml(document.section)}</span>` : ""}
      ${document.channel ? `<span class="muted-line">Channel: ${escapeHtml(document.channel)}</span>` : ""}
      ${document.updatedOn ? `<span class="muted-line">Updated: ${escapeHtml(document.updatedOn)}</span>` : ""}
      ${sourceStatus(document)}
      ${document.path ? `<span class="muted-line">${escapeHtml(document.path)}</span>` : ""}
    </li>
  `).join("")}</ul></div></article>`;
}

function renderStringList(values, emptyLabel) {
  const items = arrayify(values);
  if (items.length === 0) return `<li>${escapeHtml(emptyLabel)}</li>`;
  return items.map((value) => `<li>${escapeHtml(value)}</li>`).join("");
}

function renderMiniStat(label, value) {
  return `<article class="card nested-card"><div class="card-body stack"><strong>${escapeHtml(label)}</strong><div>${escapeHtml(value ?? "n/a")}</div></div></article>`;
}

function upsertPlan(plan) {
  const existingIndex = planningState.plans.findIndex((entry) => entry.id === plan.id);
  if (existingIndex >= 0) {
    planningState.plans.splice(existingIndex, 1, { ...planningState.plans[existingIndex], ...plan });
  } else {
    planningState.plans.unshift({
      id: plan.id,
      displayName: plan.displayName,
      programLead: plan.programLead,
      stage: plan.stage,
      counts: plan.counts,
      updatedAt: plan.updatedAt
    });
  }

  planningState.selectedPlan = plan;
  planningState.selectedPlanId = plan.id;
  renderPlanSummary();
  renderPlanTable();
  renderPlanDetail();
}

function setPlanReviewStatus(plan, stage, payload) {
  const stageKey = normalizeReviewStage(stage);
  plan.reviewCheckpoints = normalizeReviewCheckpoints(plan.reviewCheckpoints);
  const checkpoint = plan.reviewCheckpoints.find((item) => normalizeReviewStage(item.stage) === stageKey);
  if (checkpoint) {
    checkpoint.status = "approved";
    checkpoint.notes = payload.notes || checkpoint.notes || "Approved from the planning workspace.";
    checkpoint.reviewer = payload.reviewer || checkpoint.reviewer || "UI reviewer";
  }
  if (stageKey === "epics") plan.stage = "FEATURE_REVIEW";
  if (stageKey === "features") plan.stage = "STORY_READY";
}

function createMockPlanFromForm(payload) {
  const now = new Date().toISOString();
  return {
    id: `plan-${cryptoRandomId()}`,
    displayName: payload.productName || "New plan",
    programLead: payload.programLead || "TBD",
    targetUsers: payload.targetUsers || [],
    vision: payload.vision || "",
    desiredOutcomes: payload.desiredOutcomes || [],
    stage: "EPIC_REVIEW",
    counts: { epics: 0, features: 0, stories: 0 },
    updatedAt: now,
    reviewCheckpoints: [
      { stage: "epics", label: "Epic review", status: "pending", notes: "Waiting for approval" },
      { stage: "features", label: "Feature review", status: "pending", notes: "Waiting for approval" }
    ],
    epics: [],
    features: [],
    stories: [],
    onboardingChecklist: []
  };
}

function createMockReviewApproval(stage, payload) {
  const updatedPlan = normalizePlanDetail(planningState.selectedPlan, planningState.selectedPlan);
  setPlanReviewStatus(updatedPlan, stage, payload);
  updatedPlan.updatedAt = new Date().toISOString();
  return { plan: updatedPlan };
}

function hydrateMockPlanDetail(detail, summary) {
  return {
    ...detail,
    id: summary.id || detail.id,
    displayName: summary.displayName || detail.displayName,
    programLead: summary.programLead || detail.programLead,
    stage: summary.stage || detail.stage,
    counts: summary.counts || detail.counts,
    updatedAt: summary.updatedAt || detail.updatedAt,
    reviewCheckpoints: detail.reviewCheckpoints || summary.reviewCheckpoints
  };
}

function normalizePlanCollection(response) {
  if (Array.isArray(response)) return { plans: response.map(normalizePlanSummary) };
  return {
    plans: arrayify(response?.plans || response?.items || response?.content).map(normalizePlanSummary),
    selectedPlanId: response?.selectedPlanId || response?.selectedId || response?.defaultPlanId || null
  };
}

function normalizePlanSummary(item) {
  const counts = item?.counts || item?.backlogCounts || {};
  const reviewCheckpoints = normalizeReviewCheckpoints(item?.reviewCheckpoints || item?.reviews || item?.reviewStatus);
  return {
    id: item?.id || item?.planId || `plan-${cryptoRandomId()}`,
    displayName: item?.displayName || item?.productName || item?.name || item?.id || "Untitled plan",
    programLead: item?.programLead || item?.lead || item?.owner || "TBD",
    stage: item?.stage || item?.currentStage || inferStage(reviewCheckpoints),
    counts: {
      epics: counts.epics ?? item?.epicCount ?? arrayify(item?.epics).length,
      features: counts.features ?? item?.featureCount ?? arrayify(item?.features).length,
      stories: counts.stories ?? item?.storyCount ?? arrayify(item?.stories).length
    },
    updatedAt: item?.updatedAt || item?.lastUpdated || item?.modifiedAt || item?.createdAt || null,
    reviewCheckpoints
  };
}

function normalizePlanDetail(item, summary = {}) {
  const source = item || {};
  const counts = source.counts || source.backlogCounts || summary.counts || {};
  const reviewCheckpoints = normalizeReviewCheckpoints(source.reviewCheckpoints || summary.reviewCheckpoints);
  return {
    id: source.id || source.planId || summary.id || `plan-${cryptoRandomId()}`,
    displayName: source.displayName || source.productName || summary.displayName || source.name || "Untitled plan",
    programLead: source.programLead || summary.programLead || "TBD",
    targetUsers: arrayify(source.targetUsers || source.audience || summary.targetUsers),
    vision: source.vision || summary.vision || "",
    desiredOutcomes: arrayify(source.desiredOutcomes || summary.desiredOutcomes),
    stage: source.stage || summary.stage || inferStage(reviewCheckpoints),
    counts: {
      epics: counts.epics ?? source.epicCount ?? arrayify(source.epics).length,
      features: counts.features ?? source.featureCount ?? arrayify(source.features).length,
      stories: counts.stories ?? source.storyCount ?? arrayify(source.stories).length
    },
    updatedAt: source.updatedAt || source.lastUpdated || summary.updatedAt || source.createdAt || null,
    reviewCheckpoints,
    epics: normalizeBacklogItems(source.epics),
    features: normalizeBacklogItems(source.features),
    stories: normalizeBacklogItems(source.stories),
    onboardingChecklist: normalizeBacklogItems(source.onboardingChecklist)
  };
}

function normalizeBacklogItems(items) {
  return arrayify(items).map((item) => typeof item === "string" ? { title: item, status: "draft" } : {
    id: item.id || item.key || item.title || item.name || cryptoRandomId(),
    title: item.title || item.name || item.summary || item.id || "Untitled item",
    name: item.name,
    summary: item.summary || item.description || item.details || "",
    description: item.description || item.summary || "",
    status: item.status || item.state || "draft",
    owner: item.owner || item.assignee || item.lead || "",
    points: item.points || item.storyPoints || item.estimate || "",
    featureCount: item.featureCount,
    storyCount: item.storyCount
  });
}

function normalizeReviewCheckpoints(value) {
  if (value && !Array.isArray(value) && typeof value === "object") {
    return Object.entries(value).map(([stage, status]) => ({
      stage,
      label: prettyReviewStage(stage),
      status: typeof status === "string" ? status : status?.status || "pending",
      notes: typeof status === "object" ? status?.notes || "" : ""
    }));
  }

  const checkpoints = arrayify(value);
  if (checkpoints.length === 0) {
    return [
      { stage: "epics", label: "Epic review", status: "pending", notes: "Waiting for approval" },
      { stage: "features", label: "Feature review", status: "pending", notes: "Waiting for approval" }
    ];
  }
  return checkpoints.map((checkpoint) => ({
    stage: checkpoint.stage || checkpoint.reviewStage || checkpoint.name || "epics",
    label: checkpoint.label || checkpoint.name || prettyReviewStage(checkpoint.stage),
    status: checkpoint.status || checkpoint.state || "pending",
    notes: checkpoint.notes || checkpoint.comment || "",
    reviewer: checkpoint.reviewer || checkpoint.reviewedBy || ""
  }));
}

function normalizeRefinementResponse(response) {
  if (Array.isArray(response)) return { stories: response };
  return { ...response, stories: arrayify(response?.stories || response?.story || response) };
}

function normalizeTestCasesResponse(response) {
  if (Array.isArray(response)) return { testSuites: response };
  return { ...response, testSuites: arrayify(response?.testSuites || response?.suites || response) };
}

function normalizeOnboardingResponse(response) {
  return {
    answer: response?.answer || response?.response || "",
    citedDocuments: arrayify(response?.citedDocuments || response?.citations || response?.documents),
    warnings: arrayify(response?.warnings),
    nextQuestions: arrayify(response?.nextQuestions),
    suggestedEscalation: response?.suggestedEscalation || ""
  };
}

function renderPlanCounts(plan) {
  const counts = plan.counts || {};
  const epics = counts.epics ?? plan.epicCount ?? arrayify(plan.epics).length;
  const features = counts.features ?? plan.featureCount ?? arrayify(plan.features).length;
  const stories = counts.stories ?? plan.storyCount ?? arrayify(plan.stories).length;
  return `${epics} epics / ${features} features / ${stories} stories`;
}

function setPlanningStatus(message, tone) {
  setSectionStatus(planningElements.status, message, tone);
}

function setSectionStatus(node, message, tone) {
  if (!node) return;
  node.textContent = message;
  node.className = `notice ${tone ? `notice-${tone}` : "notice-info"}`.trim();
}

function renderPlanningToolPlaceholders() {
  if (planningElements.refinementOutput) {
    planningElements.refinementOutput.innerHTML = '<div class="empty-state compact"><div><h4>Waiting for refinement input</h4><p>Paste messy notes to generate a structured story package.</p></div></div>';
  }
  if (planningElements.testCaseOutput) {
    planningElements.testCaseOutput.innerHTML = '<div class="empty-state compact"><div><h4>Waiting for acceptance criteria</h4><p>Paste a story and acceptance criteria to generate test coverage.</p></div></div>';
  }
  if (planningElements.onboardingOutput) {
    planningElements.onboardingOutput.innerHTML = '<div class="empty-state compact"><div><h4>Waiting for onboarding question</h4><p>Ask a role-specific question and the agent will search the checked-in documents first.</p></div></div>';
  }
}

function renderPlanningField(title, value) {
  if (value === null || value === undefined || value === "") return "";
  return `<article class="card nested-card"><div class="card-body stack"><strong>${escapeHtml(title)}</strong><p>${escapeHtml(value)}</p></div></article>`;
}

function renderPlanningFieldList(title, values) {
  const items = arrayify(values);
  if (items.length === 0) return "";
  return `<article class="card nested-card"><div class="card-body stack"><strong>${escapeHtml(title)}</strong><ul class="plain-list">${items.map((value) => `<li>${escapeHtml(typeof value === "object" ? value.name || value.title || JSON.stringify(value) : value)}</li>`).join("")}</ul></div></article>`;
}

function renderMiniStat(label, value) {
  return `<article class="card nested-card"><div class="card-body stack"><strong>${escapeHtml(label)}</strong><div>${escapeHtml(value ?? "n/a")}</div></div></article>`;
}

function countTestCases(suites) {
  return suites.reduce((count, suite) => count + arrayify(suite.testCases || suite.cases).length, 0);
}

function countCasesByType(suites, targetType) {
  const normalizedTarget = String(targetType || "").toLowerCase();
  return suites.reduce((count, suite) => count + arrayify(suite.testCases || suite.cases).filter((testCase) => String(testCase.type || "").toLowerCase() === normalizedTarget).length, 0);
}

function stageBadgeClass(stage) {
  const normalized = normalizePlanStage(stage);
  if (normalized === "story_ready") return "pill success";
  if (normalized === "feature_review") return "pill warning";
  return "pill info";
}

function checkpointStatusClass(status) {
  const normalized = String(status || "").toLowerCase();
  if (normalized.includes("approved") || normalized.includes("complete")) return "primary";
  if (normalized.includes("block") || normalized.includes("reject")) return "danger";
  if (normalized.includes("review") || normalized.includes("pending")) return "warning";
  return "info";
}

function typeBadgeClass(type) {
  const normalized = String(type || "").toLowerCase();
  if (normalized.includes("positive")) return "success";
  if (normalized.includes("negative")) return "danger";
  if (normalized.includes("edge") || normalized.includes("boundary")) return "warning";
  return "info";
}

function prettyPlanStage(stage) {
  const normalized = normalizePlanStage(stage);
  if (normalized === "epic_review") return "Epic review";
  if (normalized === "feature_review") return "Feature review";
  if (normalized === "story_ready") return "Story ready";
  return stage ? String(stage).replaceAll("_", " ") : "Draft";
}

function prettyReviewStage(stage) {
  const normalized = normalizeReviewStage(stage);
  if (normalized === "epics") return "Epic review";
  if (normalized === "features") return "Feature review";
  return stage ? String(stage).replaceAll("_", " ") : "Review";
}

function normalizePlanStage(stage) {
  const value = String(stage || "").trim().toLowerCase().replaceAll("-", "_");
  if (value.includes("story") && value.includes("ready")) return "story_ready";
  if (value.includes("feature")) return "feature_review";
  if (value.includes("epic")) return "epic_review";
  return value;
}

function normalizeReviewStage(stage) {
  const value = String(stage || "").trim().toLowerCase();
  if (value.includes("epic")) return "epics";
  if (value.includes("feature")) return "features";
  return value.replaceAll("-", "").replaceAll("_", "");
}

function inferStage(checkpoints) {
  const statuses = normalizeReviewCheckpoints(checkpoints);
  const epicStatus = statuses.find((item) => normalizeReviewStage(item.stage) === "epics")?.status;
  const featureStatus = statuses.find((item) => normalizeReviewStage(item.stage) === "features")?.status;
  if (featureStatus === "approved") return "STORY_READY";
  if (epicStatus === "approved") return "FEATURE_REVIEW";
  return "EPIC_REVIEW";
}

function readFormValues(form, fields) {
  const formData = new FormData(form);
  const result = {};
  for (const field of fields) {
    const value = formData.get(field);
    if (value !== null && String(value).trim() !== "") result[field] = String(value).trim();
  }
  return result;
}

function splitCommaValues(value) {
  return String(value || "").split(",").map((item) => item.trim()).filter(Boolean);
}

function splitMultiline(value) {
  return String(value || "").split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
}

function mapJourneyType(tenure) {
  if (tenure === "first-week") return "FIRST_WEEK";
  if (tenure === "experienced") return "SPECIFIC_QUESTION";
  return "SPECIFIC_QUESTION";
}

function arrayify(value) {
  if (Array.isArray(value)) return value;
  if (value === null || value === undefined || value === "") return [];
  return [value];
}

function arrayToSentence(values) {
  const items = arrayify(values);
  return items.length > 0 ? items.join(", ") : "n/a";
}

function createMockPlanFromForm(payload) {
  const now = new Date().toISOString();
  return {
    id: `plan-${cryptoRandomId()}`,
    displayName: payload.productName || "New plan",
    programLead: payload.programLead || "TBD",
    targetUsers: payload.targetUsers || [],
    vision: payload.vision || "",
    desiredOutcomes: payload.desiredOutcomes || [],
    stage: "EPIC_REVIEW",
    counts: { epics: 0, features: 0, stories: 0 },
    updatedAt: now,
    reviewCheckpoints: [
      { stage: "epics", label: "Epic review", status: "pending", notes: "Waiting for approval" },
      { stage: "features", label: "Feature review", status: "pending", notes: "Waiting for approval" }
    ],
    epics: [],
    features: [],
    stories: [],
    onboardingChecklist: []
  };
}

function createMockReviewApproval(stage, payload) {
  const updatedPlan = normalizePlanDetail(planningState.selectedPlan, planningState.selectedPlan);
  setPlanReviewStatus(updatedPlan, stage, payload);
  updatedPlan.updatedAt = new Date().toISOString();
  return { plan: updatedPlan };
}

function setPlanReviewStatus(plan, stage, payload) {
  const stageKey = normalizeReviewStage(stage);
  plan.reviewCheckpoints = normalizeReviewCheckpoints(plan.reviewCheckpoints);
  const checkpoint = plan.reviewCheckpoints.find((item) => normalizeReviewStage(item.stage) === stageKey);
  if (checkpoint) {
    checkpoint.status = "approved";
    checkpoint.notes = payload.notes || checkpoint.notes || "Approved from the planning workspace.";
    checkpoint.reviewer = payload.reviewer || checkpoint.reviewer || "UI reviewer";
  }
  if (stageKey === "epics") plan.stage = "FEATURE_REVIEW";
  if (stageKey === "features") plan.stage = "STORY_READY";
}

function normalizePlanCollection(response) {
  if (Array.isArray(response)) return { plans: response.map(normalizePlanSummary) };
  return { plans: arrayify(response?.plans || response?.items || response?.content).map(normalizePlanSummary), selectedPlanId: response?.selectedPlanId || response?.selectedId || response?.defaultPlanId || null };
}

function normalizePlanSummary(item) {
  const counts = item?.counts || item?.backlogCounts || {};
  const reviewCheckpoints = normalizeReviewCheckpoints(item?.reviewCheckpoints || item?.reviews || item?.reviewStatus);
  return {
    id: item?.id || item?.planId || `plan-${cryptoRandomId()}`,
    displayName: item?.displayName || item?.productName || item?.name || item?.id || "Untitled plan",
    programLead: item?.programLead || item?.lead || item?.owner || "TBD",
    stage: item?.stage || item?.currentStage || inferStage(reviewCheckpoints),
    counts: {
      epics: counts.epics ?? item?.epicCount ?? arrayify(item?.epics).length,
      features: counts.features ?? item?.featureCount ?? arrayify(item?.features).length,
      stories: counts.stories ?? item?.storyCount ?? arrayify(item?.stories).length
    },
    updatedAt: item?.updatedAt || item?.lastUpdated || item?.modifiedAt || item?.createdAt || null,
    reviewCheckpoints
  };
}

function normalizePlanDetail(item, summary = {}) {
  const source = item || {};
  const counts = source.counts || source.backlogCounts || summary.counts || {};
  const reviewCheckpoints = normalizeReviewCheckpoints(source.reviewCheckpoints || summary.reviewCheckpoints);
  return {
    id: source.id || source.planId || summary.id || `plan-${cryptoRandomId()}`,
    displayName: source.displayName || source.productName || summary.displayName || source.name || "Untitled plan",
    programLead: source.programLead || summary.programLead || "TBD",
    targetUsers: arrayify(source.targetUsers || source.audience || summary.targetUsers),
    vision: source.vision || summary.vision || "",
    desiredOutcomes: arrayify(source.desiredOutcomes || summary.desiredOutcomes),
    stage: source.stage || summary.stage || inferStage(reviewCheckpoints),
    counts: {
      epics: counts.epics ?? source.epicCount ?? arrayify(source.epics).length,
      features: counts.features ?? source.featureCount ?? arrayify(source.features).length,
      stories: counts.stories ?? source.storyCount ?? arrayify(source.stories).length
    },
    updatedAt: source.updatedAt || source.lastUpdated || summary.updatedAt || source.createdAt || null,
    reviewCheckpoints,
    epics: normalizeBacklogItems(source.epics),
    features: normalizeBacklogItems(source.features),
    stories: normalizeBacklogItems(source.stories),
    onboardingChecklist: normalizeBacklogItems(source.onboardingChecklist)
  };
}

function normalizeBacklogItems(items) {
  return arrayify(items).map((item) => typeof item === "string" ? { title: item, status: "draft" } : {
    id: item.id || item.key || item.title || item.name || cryptoRandomId(),
    title: item.title || item.name || item.summary || item.id || "Untitled item",
    name: item.name,
    summary: item.summary || item.description || item.detail || item.details || "",
    description: item.description || item.detail || item.summary || "",
    status: item.status || item.state || "draft",
    owner: item.owner || item.assignee || item.lead || "",
    points: item.points || item.storyPoints || item.estimate || "",
    featureCount: item.featureCount,
    storyCount: item.storyCount
  });
}

function normalizeReviewCheckpoints(value) {
  if (value && !Array.isArray(value) && typeof value === "object") {
    return Object.entries(value).map(([stage, status]) => ({
      stage,
      label: prettyReviewStage(stage),
      status: typeof status === "string" ? status : status?.status || "pending",
      notes: typeof status === "object" ? status?.notes || "" : "",
      reviewer: typeof status === "object" ? status?.reviewer || status?.reviewedBy || "" : ""
    }));
  }

  const checkpoints = arrayify(value);
  if (checkpoints.length === 0) {
    return [
      { stage: "epics", label: "Epic review", status: "pending", notes: "Waiting for approval" },
      { stage: "features", label: "Feature review", status: "pending", notes: "Waiting for approval" }
    ];
  }
  return checkpoints.map((checkpoint) => ({
    stage: checkpoint.stage || checkpoint.reviewStage || checkpoint.name || "epics",
    label: checkpoint.label || checkpoint.name || prettyReviewStage(checkpoint.stage),
    status: checkpoint.status || checkpoint.state || "pending",
    notes: checkpoint.notes || checkpoint.comment || "",
    reviewer: checkpoint.reviewer || checkpoint.reviewedBy || ""
  }));
}

function normalizeRefinementResponse(response) {
  if (Array.isArray(response)) return { stories: response };
  return { ...response, stories: arrayify(response?.stories || response?.story || response) };
}

function normalizeTestCasesResponse(response) {
  if (Array.isArray(response)) return { testSuites: response };
  return { ...response, testSuites: arrayify(response?.testSuites || response?.suites || response) };
}

function normalizeOnboardingResponse(response) {
  return {
    answer: response?.answer || response?.response || "",
    citedDocuments: arrayify(response?.citedDocuments || response?.citations || response?.documents),
    warnings: arrayify(response?.warnings),
    nextQuestions: arrayify(response?.nextQuestions),
    suggestedEscalation: response?.suggestedEscalation || ""
  };
}

function escapeHtml(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

function formatDate(value) {
  if (!value) return "n/a";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(date);
}

function cryptoRandomId() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID().slice(0, 8);
  return Math.random().toString(16).slice(2, 10);
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) throw new Error(`Request failed for ${url}: ${response.status}`);
  return response.json();
}

function handlePlanningError(error) {
  console.error(error);
  setPlanningStatus(error?.message || "The planning workspace hit an unexpected error.", "danger");
}
