package com.hackathonday.migrationhelper.api.contract;

public record WorkspaceSummary(
		String normalizedWorkspacePath,
		String normalizationStatus
) {
}
