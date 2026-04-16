package com.hackathonday.migrationhelper.api.contract;

import jakarta.validation.constraints.NotBlank;

public record PathScanRequest(
		@NotBlank String path,
		String displayName,
		String requestedBy
) {
}
