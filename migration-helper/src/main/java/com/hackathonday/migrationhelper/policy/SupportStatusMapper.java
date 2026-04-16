package com.hackathonday.migrationhelper.policy;

import java.time.Clock;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import org.springframework.stereotype.Component;

@Component
public class SupportStatusMapper {

	private static final long EXPIRING_SOON_DAYS = 90;

	private final Clock clock;

	public SupportStatusMapper() {
		this(Clock.systemUTC());
	}

	SupportStatusMapper(Clock clock) {
		this.clock = clock;
	}

	public SupportState classify(VersionPolicy versionPolicy) {
		LocalDate today = LocalDate.now(clock);
		LocalDate supportEndDate = LocalDate.parse(versionPolicy.supportEndDate());
		if (!today.isBefore(supportEndDate)) {
			return SupportState.UNSUPPORTED;
		}
		long daysRemaining = ChronoUnit.DAYS.between(today, supportEndDate);
		if (daysRemaining <= EXPIRING_SOON_DAYS) {
			return SupportState.EXPIRING_SOON;
		}
		return SupportState.SUPPORTED;
	}
}
