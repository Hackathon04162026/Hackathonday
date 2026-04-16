package com.hackathonday.migrationhelper.policy;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.time.LocalDate;

@JsonIgnoreProperties(ignoreUnknown = true)
public record SupportPolicyVersionEntry(
		String version,
		SupportStatus supportStatus,
		LocalDate releasedOn,
		LocalDate supportEndsOn,
		String note,
		String preferredNextVersion
) {
}
