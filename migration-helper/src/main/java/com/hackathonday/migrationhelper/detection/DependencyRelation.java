package com.hackathonday.migrationhelper.detection;

public enum DependencyRelation {
	DECLARES,
	LOCKS,
	INHERITS_FROM,
	MANAGES,
	RESOLVES_TO,
	DEPENDS_ON
}
