package com.hackathonday.migrationhelper.policy;

public enum SupportState {
	SUPPORTED("supported"),
	EXPIRING_SOON("expiring-soon"),
	UNSUPPORTED("unsupported"),
	UNKNOWN_VERSION("unknown-version");

	private final String apiValue;

	SupportState(String apiValue) {
		this.apiValue = apiValue;
	}

	String apiValue() {
		return apiValue;
	}
}
