package com.hackathonday.migrationhelper.scan;

public record ScanWarning(
		String code,
		String severity,
		String message
) {
}
