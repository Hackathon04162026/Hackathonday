package com.hackathonday.migrationhelper.policy;

import java.util.ArrayList;
import java.util.List;

final class VersionComparator {

	private VersionComparator() {
	}

	static int compare(String left, String right) {
		List<String> leftParts = tokenize(left);
		List<String> rightParts = tokenize(right);
		int size = Math.max(leftParts.size(), rightParts.size());
		for (int i = 0; i < size; i++) {
			String leftPart = i < leftParts.size() ? leftParts.get(i) : "0";
			String rightPart = i < rightParts.size() ? rightParts.get(i) : "0";
			int comparison = comparePart(leftPart, rightPart);
			if (comparison != 0) {
				return comparison;
			}
		}
		return 0;
	}

	private static List<String> tokenize(String version) {
		String normalized = version == null ? "" : version.trim();
		if (normalized.startsWith("v") || normalized.startsWith("V")) {
			normalized = normalized.substring(1);
		}
		String[] rawParts = normalized.split("[._-]");
		List<String> parts = new ArrayList<>();
		for (String part : rawParts) {
			if (!part.isBlank()) {
				parts.add(part);
			}
		}
		if (parts.isEmpty()) {
			parts.add("0");
		}
		return parts;
	}

	private static int comparePart(String left, String right) {
		boolean leftNumeric = left.chars().allMatch(Character::isDigit);
		boolean rightNumeric = right.chars().allMatch(Character::isDigit);
		if (leftNumeric && rightNumeric) {
			return Long.compare(Long.parseLong(left), Long.parseLong(right));
		}
		if (leftNumeric) {
			return 1;
		}
		if (rightNumeric) {
			return -1;
		}
		return left.compareToIgnoreCase(right);
	}
}
