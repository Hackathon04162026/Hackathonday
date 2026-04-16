package com.hackathonday.migrationhelper.policy;

import java.time.LocalDate;

public record PolicyLifecycleDates(
		LocalDate supportEndsOn,
		LocalDate endOfLifeOn
) {
}
