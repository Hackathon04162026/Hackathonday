package com.hackathonday.migrationhelper.api.contract;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record CreateScanRequest(
		@NotBlank String uploadedArchiveToken,
		@NotBlank String sourceFilename,
		@NotNull @Min(1) Long sizeBytes,
		String displayName,
		String requestedBy
) {
}
