export const PLANNING_STAGES = Object.freeze({
  EPIC_REVIEW: "EPIC_REVIEW",
  FEATURE_REVIEW: "FEATURE_REVIEW",
  STORY_READY: "STORY_READY"
});

export const REVIEW_STAGES = Object.freeze({
  EPICS: "EPICS",
  FEATURES: "FEATURES"
});

export const REVIEW_STATUS = Object.freeze({
  PENDING: "PENDING",
  BLOCKED: "BLOCKED",
  APPROVED: "APPROVED"
});

export const ONBOARDING_STATUS = Object.freeze({
  UPCOMING: "UPCOMING",
  READY: "READY",
  COMPLETE: "COMPLETE"
});

export const DEFAULT_CREATED_AT = "2026-04-16T09:00:00.000Z";
export const DEFAULT_EPIC_REVIEWED_AT = "2026-04-16T09:15:00.000Z";
export const DEFAULT_FEATURE_REVIEWED_AT = "2026-04-16T09:30:00.000Z";

export const DEFAULT_TARGET_USERS =
  "Delivery managers, architects, and implementation teams";

export const DEFAULT_OUTCOMES = Object.freeze([
  "Reduce ambiguity between intake and delivery",
  "Introduce approval checkpoints before decomposition",
  "Help new contributors ramp into the backlog quickly"
]);

export const PLANNING_WORKFLOW_STEPS = Object.freeze([
  {
    key: "vision",
    label: "Vision intake",
    description: "Capture the program lead vision and the target outcome."
  },
  {
    key: "epics",
    label: "Epic generation",
    description: "Break the vision into deterministic epics for review."
  },
  {
    key: "epic-review",
    label: "Epic review",
    description: "Approve the epics before features are generated."
  },
  {
    key: "features",
    label: "Feature generation",
    description: "Create features only after the epic review is approved."
  },
  {
    key: "feature-review",
    label: "Feature review",
    description: "Approve the features before stories are produced."
  },
  {
    key: "stories",
    label: "Story generation",
    description: "Produce sprint-ready stories once the feature review is approved."
  }
]);

export const PLANNING_REVIEW_GATES = Object.freeze([
  {
    stage: REVIEW_STAGES.EPICS,
    label: "Epic review",
    unlocks: PLANNING_STAGES.FEATURE_REVIEW
  },
  {
    stage: REVIEW_STAGES.FEATURES,
    label: "Feature review",
    unlocks: PLANNING_STAGES.STORY_READY
  }
]);

export const PLANNING_ONBOARDING_CHECKLIST_TEMPLATE = Object.freeze([
  {
    id: "confirm-vision",
    title: "Confirm the vision intake",
    detail: "Read the vision and desired outcomes before decomposing the backlog.",
    owner: "Program lead",
    unlockStage: PLANNING_STAGES.EPIC_REVIEW
  },
  {
    id: "review-epics",
    title: "Review the epic gate",
    detail: "Use the epic review checkpoint to validate scope before features are drafted.",
    owner: "Agile facilitator",
    unlockStage: PLANNING_STAGES.EPIC_REVIEW
  },
  {
    id: "review-features",
    title: "Review the feature gate",
    detail: "Confirm the feature breakdown before stories are produced.",
    owner: "Agile facilitator",
    unlockStage: PLANNING_STAGES.FEATURE_REVIEW
  },
  {
    id: "start-delivery",
    title: "Start story-ready delivery",
    detail: "Move into sprint planning once the backlog is story-ready.",
    owner: "Delivery team",
    unlockStage: PLANNING_STAGES.STORY_READY
  }
]);

export const PLANNING_SEED_VISION = Object.freeze({
  vision:
    "Create a guided planning flow that turns a program lead vision into reviewed epics, approved features, and sprint-ready stories.",
  programLead: "Program Lead",
  productName: "Migration Helper Planning",
  targetUsers:
    "Program leads, agile facilitators, QE engineers, and new team members",
  desiredOutcomes: DEFAULT_OUTCOMES
});

export const PLANNING_SAMPLE_INTAKES = Object.freeze([
  PLANNING_SEED_VISION,
  Object.freeze({
    vision:
      "Give the team a deterministic way to turn messy refinement notes into ready-to-build backlog items.",
    programLead: "Delivery Lead",
    productName: "Refinement Workspace",
    targetUsers: "Agile facilitators and product owners",
    desiredOutcomes: Object.freeze([
      "Reduce back-and-forth during backlog refinement",
      "Expose review gates before sprint commitment",
      "Make acceptance criteria easier to test"
    ])
  }),
  Object.freeze({
    vision:
      "Help new contributors find onboarding answers from trusted documents without guessing.",
    programLead: "Enablement Lead",
    productName: "Onboarding Assistant",
    targetUsers: "New hires and team leads",
    desiredOutcomes: Object.freeze([
      "Ground answers in source documents",
      "Flag missing or stale documentation",
      "Adapt onboarding guidance to role and stage"
    ])
  })
]);

