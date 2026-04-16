import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  ONBOARDING_STATUS,
  PLANNING_SEED_VISION,
  PLANNING_STAGES,
  REVIEW_STATUS,
  PlanningError,
  approveReview,
  createPlan,
  createPlanCollectionRecord,
  createPlanDetailRecord,
  createPlanSummaryRecord,
  getOnboardingProgress,
  getPlanSummary
} from "./index.js";

describe("planning domain logic", () => {
  it("creates a deterministic plan from vision intake", () => {
    const plan = createPlan(PLANNING_SEED_VISION);
    const summary = getPlanSummary(plan);

    expect(plan.id).toMatch(/^plan-/);
    expect(plan.currentStage).toBe(PLANNING_STAGES.EPIC_REVIEW);
    expect(plan.epics).toHaveLength(3);
    expect(plan.features).toHaveLength(0);
    expect(plan.stories).toHaveLength(0);
    expect(plan.reviewCheckpoints.map((checkpoint) => checkpoint.status)).toEqual([
      REVIEW_STATUS.PENDING,
      REVIEW_STATUS.BLOCKED
    ]);
    expect(plan.onboardingChecklist.map((task) => task.status)).toEqual([
      ONBOARDING_STATUS.READY,
      ONBOARDING_STATUS.READY,
      ONBOARDING_STATUS.UPCOMING,
      ONBOARDING_STATUS.UPCOMING
    ]);
    expect(summary.counts).toEqual({
      epics: 3,
      features: 0,
      stories: 0,
      backlogItems: 3
    });
    expect(summary.stageSummary.nextStage).toBe(PLANNING_STAGES.FEATURE_REVIEW);
  });

  it("approves epic review and unlocks feature generation", () => {
    const plan = createPlan(PLANNING_SEED_VISION);
    const approved = approveReview(plan, "epics", {
      reviewer: "Alex",
      notes: "Looks good to move forward."
    });

    expect(approved.currentStage).toBe(PLANNING_STAGES.FEATURE_REVIEW);
    expect(approved.features).toHaveLength(4);
    expect(approved.reviewCheckpoints[0]).toMatchObject({
      status: REVIEW_STATUS.APPROVED,
      reviewer: "Alex"
    });
    expect(approved.reviewCheckpoints[1]).toMatchObject({
      status: REVIEW_STATUS.PENDING
    });
    expect(getOnboardingProgress(approved)).toMatchObject({
      completed: 0,
      ready: 3,
      upcoming: 1
    });
  });

  it("approves feature review and unlocks stories", () => {
    const plan = createPlan(PLANNING_SEED_VISION);
    const afterEpic = approveReview(plan, "epics", { reviewer: "Alex" });
    const afterFeature = approveReview(afterEpic, "features", {
      reviewer: "Jordan"
    });

    expect(afterFeature.currentStage).toBe(PLANNING_STAGES.STORY_READY);
    expect(afterFeature.stories).toHaveLength(4);
    expect(afterFeature.reviewCheckpoints[1]).toMatchObject({
      status: REVIEW_STATUS.APPROVED,
      reviewer: "Jordan"
    });
    expect(getPlanSummary(afterFeature).counts).toEqual({
      epics: 3,
      features: 4,
      stories: 4,
      backlogItems: 11
    });
    expect(getOnboardingProgress(afterFeature)).toMatchObject({
      completed: 0,
      ready: 4,
      upcoming: 0
    });
  });

  it("gates feature approval until epic review is approved", () => {
    const plan = createPlan(PLANNING_SEED_VISION);

    expect(() => approveReview(plan, "features", { reviewer: "Jordan" })).toThrow(PlanningError);

    try {
      approveReview(plan, "features", { reviewer: "Jordan" });
    } catch (error) {
      expect(error).toBeInstanceOf(PlanningError);
      expect(error.code).toBe("PLAN_STAGE_GATED");
    }
  });

  it("summarizes review and onboarding counts consistently", () => {
    const plan = createPlan(PLANNING_SEED_VISION);
    const afterEpic = approveReview(plan, "epics", { reviewer: "Alex" });

    const summary = getPlanSummary(afterEpic);

    expect(summary.reviewSummary).toEqual({
      total: 2,
      pending: 1,
      blocked: 0,
      approved: 1
    });
    expect(summary.onboarding.total).toBe(4);
    expect(summary.onboarding.completed).toBe(0);
    expect(summary.onboarding.ready).toBe(3);
    expect(summary.onboarding.upcoming).toBe(1);
    expect(summary.onboarding.completionPercent).toBe(0);
    expect(summary.onboarding.nextReadyTask).toMatchObject({ id: "confirm-vision" });
    expect(summary.onboarding.nextTask).toMatchObject({ id: "confirm-vision" });
  });

  it("creates UI-ready summary and detail records", () => {
    const plan = approveReview(createPlan(PLANNING_SEED_VISION), "epics", { reviewer: "Alex" });
    const summary = createPlanSummaryRecord(plan);
    const detail = createPlanDetailRecord(plan);

    expect(summary).toMatchObject({
      id: plan.id,
      displayName: plan.productName,
      currentStage: "FEATURE_REVIEW",
      stage: "FEATURE_REVIEW",
      counts: { epics: 3, features: 4, stories: 0 }
    });
    expect(summary.reviewCheckpoints).toHaveLength(2);
    expect(detail).toMatchObject({
      id: plan.id,
      displayName: plan.productName,
      epics: expect.any(Array),
      features: expect.any(Array),
      stories: expect.any(Array),
      onboardingChecklist: expect.any(Array)
    });
    expect(detail.onboardingChecklist).toHaveLength(4);
  });

  it("creates a collection record with a selected plan id", () => {
    const firstPlan = createPlan(PLANNING_SEED_VISION);
    const secondPlan = approveReview(firstPlan, "epics", { reviewer: "Alex" });
    const collection = createPlanCollectionRecord([firstPlan, secondPlan], secondPlan.id);

    expect(collection.selectedPlanId).toBe(secondPlan.id);
    expect(collection.plans).toHaveLength(2);
    expect(collection.plans[0]).toHaveProperty("displayName");
    expect(collection.plans[0]).toHaveProperty("currentStage");
    expect(collection.plans[0]).toHaveProperty("reviewCheckpoints");
  });

  it("keeps the checked-in plan fixtures aligned with the UI contract", () => {
    const list = JSON.parse(readFileSync(new URL("../../public/mock-data/plans/list.json", import.meta.url), "utf8"));
    const detail = JSON.parse(readFileSync(new URL("../../public/mock-data/plans/detail.json", import.meta.url), "utf8"));

    expect(Array.isArray(list)).toBe(true);
    expect(list).toHaveLength(2);
    expect(list[0]).toMatchObject({
      id: "plan-feature-ready",
      displayName: "Refinement Workspace",
      currentStage: "FEATURE_REVIEW",
      counts: { epics: 3, features: 2, stories: 0 }
    });
    expect(detail).toMatchObject({
      id: "plan-feature-ready",
      displayName: "Refinement Workspace",
      currentStage: "FEATURE_REVIEW",
      counts: { epics: 3, features: 2, stories: 0 }
    });
    expect(detail.epics).toHaveLength(3);
    expect(detail.features).toHaveLength(2);
    expect(detail.onboardingChecklist).toHaveLength(4);
  });

  it("normalizes a fixture summary row without needing full backlog arrays", () => {
    const list = JSON.parse(readFileSync(new URL("../../public/mock-data/plans/list.json", import.meta.url), "utf8"));
    const summary = createPlanSummaryRecord(list[0]);

    expect(summary).toMatchObject({
      id: "plan-feature-ready",
      displayName: "Refinement Workspace",
      currentStage: "FEATURE_REVIEW",
      counts: { epics: 3, features: 2, stories: 0 }
    });
    expect(summary.reviewSummary).toMatchObject({
      total: 2,
      approved: 1,
      pending: 1,
      blocked: 0
    });
    expect(summary.onboarding.total).toBe(0);
  });
});
