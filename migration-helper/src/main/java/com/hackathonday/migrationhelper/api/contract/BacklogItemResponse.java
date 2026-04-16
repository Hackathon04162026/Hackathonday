package com.hackathonday.migrationhelper.api.contract;

import java.util.List;

public record BacklogItemResponse(
		String id,
		String title,
		String summary,
		String owner,
		String status,
		List<String> tags,
		List<String> acceptanceCriteria
) {
}
