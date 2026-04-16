package com.hackathonday.migrationhelper.policy;

import java.time.Clock;
import java.time.LocalDate;
import java.util.Objects;

public class PolicySupportStatusCalculator {

	public static final int DEFAULT_EXPIRING_SOON_THRESHOLD_DAYS = 90;

	private final Clock clock;
	private final int expiringSoonThresholdDays;

	public PolicySupportStatusCalculator() {
		this(Clock.systemUTC(), DEFAULT_EXPIRING_SOON_THRESHOLD_DAYS);
	}

	public PolicySupportStatusCalculator(Clock clock) {
		this(clock, DEFAULT_EXPIRING_SOON_THRESHOLD_DAYS);
	}

	public PolicySupportStatusCalculator(Clock clock, int expiringSoonThresholdDays) {
		this.clock = Objects.requireNonNull(clock, "clock");
		if (expiringSoonThresholdDays <= 0) {
			throw new IllegalArgumentException("expiringSoonThresholdDays must be positive");
		}
		this.expiringSoonThresholdDays = expiringSoonThresholdDays;
	}

	public SupportStatus calculate(PolicyLifecycleDates lifecycleDates) {
		if (lifecycleDates == null) {
			return SupportStatus.UNKNOWN_VERSION;
		}

		LocalDate supportEndDate = firstNonNull(lifecycleDates.supportEndsOn(), lifecycleDates.endOfLifeOn());
		if (supportEndDate == null) {
			return SupportStatus.UNKNOWN_VERSION;
		}

		LocalDate today = LocalDate.now(clock);
		if (!today.isBefore(supportEndDate)) {
			return SupportStatus.UNSUPPORTED;
		}

		LocalDate expiringSoonDate = supportEndDate.minusDays(expiringSoonThresholdDays);
		if (!today.isBefore(expiringSoonDate)) {
			return SupportStatus.EXPIRING_SOON;
		}

		return SupportStatus.SUPPORTED;
	}

	private LocalDate firstNonNull(LocalDate first, LocalDate second) {
		return first != null ? first : second;
	}
}
