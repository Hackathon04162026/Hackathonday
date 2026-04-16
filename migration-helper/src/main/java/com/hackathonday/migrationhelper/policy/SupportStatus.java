package com.hackathonday.migrationhelper.policy;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;
import java.util.Locale;

public enum SupportStatus {
	SUPPORTED("supported"),
	EXPIRING_SOON("expiring-soon"),
	UNSUPPORTED("unsupported"),
	UNKNOWN_VERSION("unknown-version");

	private final String value;

	SupportStatus(String value) {
		this.value = value;
	}

	@JsonValue
	public String value() {
		return value;
	}

	public String responseValue() {
		return value;
	}

	@JsonCreator
	public static SupportStatus fromValue(String rawValue) {
		if (rawValue == null) {
			return null;
		}

		String normalized = rawValue.trim().toLowerCase(Locale.ROOT).replace('_', '-');
		for (SupportStatus status : values()) {
			if (status.value.equals(normalized)) {
				return status;
			}
		}
		throw new IllegalArgumentException("Unsupported support status: " + rawValue);
	}
}
