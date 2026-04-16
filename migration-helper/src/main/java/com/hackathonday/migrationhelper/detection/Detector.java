package com.hackathonday.migrationhelper.detection;

import java.io.IOException;
import java.nio.file.Path;

public interface Detector {

	String id();

	boolean supports(Path projectRoot) throws IOException;

	DetectionReport detect(Path projectRoot) throws IOException;
}
