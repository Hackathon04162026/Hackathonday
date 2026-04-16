package com.hackathonday.migrationhelper.planning;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

class PlanRecord {

	private final String id;
	private final String productName;
	private final String vision;
	private final String programLead;
	private final Instant createdAt;
	private final List<String> desiredOutcomes;
	private final String targetUsers;
	private final List<BacklogItem> epics = new ArrayList<>();
	private final List<BacklogItem> features = new ArrayList<>();
	private final List<BacklogItem> stories = new ArrayList<>();
	private final List<ReviewCheckpoint> reviewCheckpoints = new ArrayList<>();
	private final List<OnboardingTask> onboardingTasks = new ArrayList<>();
	private Instant updatedAt;
	private PlanStage currentStage;

	PlanRecord(
			String id,
			String productName,
			String vision,
			String programLead,
			Instant createdAt,
			List<String> desiredOutcomes,
			String targetUsers
	) {
		this.id = id;
		this.productName = productName;
		this.vision = vision;
		this.programLead = programLead;
		this.createdAt = createdAt;
		this.updatedAt = createdAt;
		this.desiredOutcomes = new ArrayList<>(desiredOutcomes);
		this.targetUsers = targetUsers;
		this.currentStage = PlanStage.EPIC_REVIEW;
	}

	String id() {
		return id;
	}

	String productName() {
		return productName;
	}

	String vision() {
		return vision;
	}

	String programLead() {
		return programLead;
	}

	Instant createdAt() {
		return createdAt;
	}

	Instant updatedAt() {
		return updatedAt;
	}

	List<String> desiredOutcomes() {
		return List.copyOf(desiredOutcomes);
	}

	String targetUsers() {
		return targetUsers;
	}

	PlanStage currentStage() {
		return currentStage;
	}

	List<BacklogItem> epics() {
		return epics;
	}

	List<BacklogItem> features() {
		return features;
	}

	List<BacklogItem> stories() {
		return stories;
	}

	List<ReviewCheckpoint> reviewCheckpoints() {
		return reviewCheckpoints;
	}

	List<OnboardingTask> onboardingTasks() {
		return onboardingTasks;
	}

	void setCurrentStage(PlanStage currentStage) {
		this.currentStage = currentStage;
		this.updatedAt = Instant.now();
	}

	void touch() {
		this.updatedAt = Instant.now();
	}
}
