package com.hackathonday.migrationhelper.config;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

@Validated
@ConfigurationProperties(prefix = "migration-helper")
public record MigrationHelperProperties(
		@NotBlank String applicationName,
		@NotBlank String defaultRequestedBy,
		Scan scan
) {

	public record Scan(
			@Min(1) @Max(500) int maxRecentScans,
			boolean autoCompletePlaceholderScans
	) {
	}
}
