package com.hackathonday.migrationhelper.api.contract;

import jakarta.validation.constraints.NotBlank;

public record ApproveReviewRequest(
		@NotBlank String reviewer,
		String notes
) {
}
