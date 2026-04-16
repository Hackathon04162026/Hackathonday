package com.hackathonday.migrationhelper.detection;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Optional;

final class GoManifestParser {

	GoManifest parse(Path manifestPath) throws IOException {
		List<String> lines = Files.readAllLines(manifestPath, StandardCharsets.UTF_8);
		String modulePath = null;
		String goVersion = null;
		List<GoDependency> dependencies = new ArrayList<>();
		boolean inRequireBlock = false;

		for (int index = 0; index < lines.size(); index++) {
			String rawLine = lines.get(index);
			String trimmed = rawLine.trim();

			if (trimmed.isEmpty() || trimmed.startsWith("//")) {
				continue;
			}
			if (trimmed.equals("require (")) {
				inRequireBlock = true;
				continue;
			}
			if (inRequireBlock && trimmed.equals(")")) {
				inRequireBlock = false;
				continue;
			}
			if (trimmed.startsWith("module ")) {
				modulePath = trimmed.substring("module ".length()).trim();
				continue;
			}
			if (trimmed.startsWith("go ")) {
				goVersion = trimmed.substring("go ".length()).trim();
				continue;
			}
			if (trimmed.startsWith("require ")) {
				parseRequireLine(trimmed.substring("require ".length()), index + 1)
						.ifPresent(dependencies::add);
				continue;
			}
			if (inRequireBlock) {
				parseRequireLine(trimmed, index + 1).ifPresent(dependencies::add);
			}
		}

		return new GoManifest(modulePath, goVersion, Collections.unmodifiableList(dependencies));
	}

	private Optional<GoDependency> parseRequireLine(String line, int lineNumber) {
		boolean indirect = line.contains("// indirect");
		String declaration = line.split("//", 2)[0].trim();
		if (declaration.isEmpty()) {
			return Optional.empty();
		}

		String[] tokens = declaration.split("\\s+");
		String modulePath = tokens[0];
		String version = tokens.length > 1 ? tokens[1] : "UNRESOLVED";
		return Optional.of(new GoDependency(modulePath, version, indirect, lineNumber, line));
	}

	record GoManifest(
			String modulePath,
			String goVersion,
			List<GoDependency> dependencies
	) {
	}

	record GoDependency(
			String modulePath,
			String version,
			boolean indirect,
			int lineNumber,
			String rawLine
	) {
	}
}
