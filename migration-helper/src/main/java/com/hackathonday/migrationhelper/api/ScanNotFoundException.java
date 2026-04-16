package com.hackathonday.migrationhelper.api;

public class ScanNotFoundException extends RuntimeException {

	public ScanNotFoundException(String id) {
		super("Scan not found: " + id);
	}
}
