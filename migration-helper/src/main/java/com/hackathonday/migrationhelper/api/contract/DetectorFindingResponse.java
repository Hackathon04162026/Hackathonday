package com.hackathonday.migrationhelper.api.contract;

import java.util.Map;

public record DetectorFindingResponse(
		String ecosystem,
		String component,
		String detectedVersion,
		String confidence,
		boolean indirect,
		Map<String, Object> evidence
) {
}
