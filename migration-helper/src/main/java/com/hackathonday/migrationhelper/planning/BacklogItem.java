package com.hackathonday.migrationhelper.planning;

import java.util.ArrayList;
import java.util.List;

class BacklogItem {

	private final String id;
	private final String title;
	private final String summary;
	private final String owner;
	private final String status;
	private final List<String> tags;
	private final List<String> acceptanceCriteria;

	BacklogItem(
			String id,
			String title,
			String summary,
			String owner,
			String status,
			List<String> tags,
			List<String> acceptanceCriteria
	) {
		this.id = id;
		this.title = title;
		this.summary = summary;
		this.owner = owner;
		this.status = status;
		this.tags = new ArrayList<>(tags);
		this.acceptanceCriteria = new ArrayList<>(acceptanceCriteria);
	}

	String id() {
		return id;
	}

	String title() {
		return title;
	}

	String summary() {
		return summary;
	}

	String owner() {
		return owner;
	}

	String status() {
		return status;
	}

	List<String> tags() {
		return tags;
	}

	List<String> acceptanceCriteria() {
		return acceptanceCriteria;
	}
}
