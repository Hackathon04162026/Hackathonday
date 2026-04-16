package com.hackathonday.migrationhelper.api.contract;

import jakarta.validation.constraints.NotBlank;
import java.util.List;

public record CreatePlanRequest(
		@NotBlank String vision,
		@NotBlank String programLead,
		String productName,
		List<String> desiredOutcomes,
		String targetUsers
) {
}
