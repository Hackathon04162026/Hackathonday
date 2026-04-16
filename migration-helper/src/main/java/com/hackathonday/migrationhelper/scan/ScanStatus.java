package com.hackathonday.migrationhelper.scan;

public enum ScanStatus {
	QUEUED,
	INGESTING,
	ANALYZING,
	AGGREGATING,
	COMPLETED,
	FAILED
}
