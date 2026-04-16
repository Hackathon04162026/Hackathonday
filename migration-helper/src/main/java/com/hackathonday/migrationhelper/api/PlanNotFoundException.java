package com.hackathonday.migrationhelper.api;

public class PlanNotFoundException extends RuntimeException {

	public PlanNotFoundException(String id) {
		super("Plan " + id + " was not found");
	}
}
