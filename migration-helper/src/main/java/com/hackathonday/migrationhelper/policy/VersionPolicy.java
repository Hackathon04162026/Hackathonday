package com.hackathonday.migrationhelper.policy;

import java.util.List;

public record VersionPolicy(
		String version,
		String releaseDate,
		String supportEndDate,
		String preferredUpgrade,
		List<String> alternativeUpgrades,
		String sourceId
) {
}
