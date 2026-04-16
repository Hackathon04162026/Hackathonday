package com.hackathonday.migrationhelper.planning;

class OnboardingTask {

	private final String title;
	private final String detail;
	private final String owner;
	private String status;

	OnboardingTask(String title, String detail, String owner, String status) {
		this.title = title;
		this.detail = detail;
		this.owner = owner;
		this.status = status;
	}

	String title() {
		return title;
	}

	String detail() {
		return detail;
	}

	String owner() {
		return owner;
	}

	String status() {
		return status;
	}

	void setStatus(String status) {
		this.status = status;
	}
}
