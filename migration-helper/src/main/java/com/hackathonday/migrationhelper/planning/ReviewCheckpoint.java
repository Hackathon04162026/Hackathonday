package com.hackathonday.migrationhelper.planning;

import java.time.Instant;

class ReviewCheckpoint {

	private final ReviewStage stage;
	private ReviewStatus status;
	private String reviewer;
	private String notes;
	private Instant reviewedAt;

	ReviewCheckpoint(ReviewStage stage, ReviewStatus status, String reviewer, String notes, Instant reviewedAt) {
		this.stage = stage;
		this.status = status;
		this.reviewer = reviewer;
		this.notes = notes;
		this.reviewedAt = reviewedAt;
	}

	ReviewStage stage() {
		return stage;
	}

	ReviewStatus status() {
		return status;
	}

	String reviewer() {
		return reviewer;
	}

	String notes() {
		return notes;
	}

	Instant reviewedAt() {
		return reviewedAt;
	}

	void open(String notes) {
		this.status = ReviewStatus.PENDING;
		this.notes = notes;
		this.reviewer = null;
		this.reviewedAt = null;
	}

	void approve(String reviewer, String notes) {
		this.status = ReviewStatus.APPROVED;
		this.reviewer = reviewer;
		this.notes = notes;
		this.reviewedAt = Instant.now();
	}
}
