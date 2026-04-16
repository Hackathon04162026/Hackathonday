package com.hackathonday.migrationhelper.scan;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

public class ScanRecord {

	private final String id;
	private final ScanSourceType sourceType;
	private final String sourceReference;
	private final String displayName;
	private final String requestedBy;
	private final Instant createdAt;
	private Instant startedAt;
	private Instant completedAt;
	private Instant updatedAt;
	private ScanStatus status;
	private final List<String> lifecycle = new ArrayList<>();
	private final List<ScanWarning> warnings = new ArrayList<>();
	private String normalizedWorkspacePath;
	private String normalizationStatus = "PENDING";

	public ScanRecord(
			String id,
			ScanSourceType sourceType,
			String sourceReference,
			String displayName,
			String requestedBy,
			Instant createdAt
	) {
		this.id = id;
		this.sourceType = sourceType;
		this.sourceReference = sourceReference;
		this.displayName = displayName;
		this.requestedBy = requestedBy;
		this.createdAt = createdAt;
		this.updatedAt = createdAt;
		this.status = ScanStatus.QUEUED;
		this.lifecycle.add(ScanStatus.QUEUED.name());
	}

	public String id() {
		return id;
	}

	public ScanSourceType sourceType() {
		return sourceType;
	}

	public String sourceReference() {
		return sourceReference;
	}

	public String displayName() {
		return displayName;
	}

	public String requestedBy() {
		return requestedBy;
	}

	public Instant createdAt() {
		return createdAt;
	}

	public Instant startedAt() {
		return startedAt;
	}

	public Instant completedAt() {
		return completedAt;
	}

	public Instant updatedAt() {
		return updatedAt;
	}

	public ScanStatus status() {
		return status;
	}

	public List<String> lifecycle() {
		return List.copyOf(lifecycle);
	}

	public List<ScanWarning> warnings() {
		return List.copyOf(warnings);
	}

	public String normalizedWorkspacePath() {
		return normalizedWorkspacePath;
	}

	public String normalizationStatus() {
		return normalizationStatus;
	}

	public void markStarted() {
		this.startedAt = Instant.now();
		updateStatus(ScanStatus.INGESTING);
	}

	public void advanceTo(ScanStatus nextStatus) {
		updateStatus(nextStatus);
	}

	public void complete(String normalizedWorkspacePath, String normalizationStatus) {
		this.normalizedWorkspacePath = normalizedWorkspacePath;
		this.normalizationStatus = normalizationStatus;
		this.completedAt = Instant.now();
		updateStatus(ScanStatus.COMPLETED);
	}

	public void addWarning(ScanWarning warning) {
		this.warnings.add(warning);
		this.updatedAt = Instant.now();
	}

	private void updateStatus(ScanStatus nextStatus) {
		this.status = nextStatus;
		this.updatedAt = Instant.now();
		if (lifecycle.isEmpty() || !lifecycle.get(lifecycle.size() - 1).equals(nextStatus.name())) {
			this.lifecycle.add(nextStatus.name());
		}
	}
}
