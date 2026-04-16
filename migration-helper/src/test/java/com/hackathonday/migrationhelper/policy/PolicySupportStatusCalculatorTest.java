package com.hackathonday.migrationhelper.policy;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import org.junit.jupiter.api.Test;

class PolicySupportStatusCalculatorTest {

	private static final Instant NOW = Instant.parse("2026-04-16T12:00:00Z");
	private static final Clock CLOCK = Clock.fixed(NOW, ZoneOffset.UTC);

	private final PolicySupportStatusCalculator calculator = new PolicySupportStatusCalculator(CLOCK);

	@Test
	void mapsSupportedWhenLifecycleEndsBeyondTheExpiringSoonThreshold() {
		SupportStatus status = calculator.calculate(new PolicyLifecycleDates(
				LocalDate.of(2026, 7, 16),
				null
		));

		assertThat(status).isEqualTo(SupportStatus.SUPPORTED);
		assertThat(status.responseValue()).isEqualTo("supported");
	}

	@Test
	void mapsExpiringSoonWhenLifecycleIsWithinTheThresholdWindow() {
		SupportStatus status = calculator.calculate(new PolicyLifecycleDates(
				LocalDate.of(2026, 7, 15),
				null
		));

		assertThat(status).isEqualTo(SupportStatus.EXPIRING_SOON);
		assertThat(status.responseValue()).isEqualTo("expiring-soon");
	}

	@Test
	void fallsBackToEndOfLifeDateWhenSupportEndDateIsMissing() {
		SupportStatus status = calculator.calculate(new PolicyLifecycleDates(
				null,
				LocalDate.of(2026, 10, 15)
		));

		assertThat(status).isEqualTo(SupportStatus.SUPPORTED);
		assertThat(status.responseValue()).isEqualTo("supported");
	}

	@Test
	void mapsUnsupportedWhenLifecycleDateHasArrived() {
		SupportStatus status = calculator.calculate(new PolicyLifecycleDates(
				LocalDate.of(2026, 4, 16),
				null
		));

		assertThat(status).isEqualTo(SupportStatus.UNSUPPORTED);
		assertThat(status.responseValue()).isEqualTo("unsupported");
	}

	@Test
	void mapsUnknownVersionWhenNoLifecycleDatesAreAvailable() {
		SupportStatus status = calculator.calculate(new PolicyLifecycleDates(null, null));

		assertThat(status).isEqualTo(SupportStatus.UNKNOWN_VERSION);
		assertThat(status.responseValue()).isEqualTo("unknown-version");
	}
}
