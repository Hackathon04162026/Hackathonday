package com.hackathonday.migrationhelper.detection;

import java.io.IOException;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

public final class DetectionEngine {

	private final List<Detector> detectors;

	public DetectionEngine(List<Detector> detectors) {
		this.detectors = List.copyOf(detectors);
	}

	public List<DetectionReport> detect(Path projectRoot) throws IOException {
		List<DetectionReport> reports = new ArrayList<>();
		for (Detector detector : detectors) {
			if (detector.supports(projectRoot)) {
				reports.add(detector.detect(projectRoot));
			}
		}
		return Collections.unmodifiableList(reports);
	}
}
