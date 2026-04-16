package com.hackathonday.migrationhelper.detection;

public enum EvidenceType {
	MANIFEST,
	LOCKFILE,
	BUILD_FILE,
	PARENT_DESCRIPTOR,
	DEPENDENCY,
	MANAGED_DEPENDENCY,
	INHERITED_VALUE,
	PLATFORM,
	PROPERTY,
	UNKNOWN
}
