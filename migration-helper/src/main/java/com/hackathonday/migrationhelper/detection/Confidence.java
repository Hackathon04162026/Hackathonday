package com.hackathonday.migrationhelper.detection;

public record Confidence(double score, ConfidenceLevel level) {

	public Confidence {
		if (score < 0.0d || score > 1.0d) {
			throw new IllegalArgumentException("Confidence score must be between 0 and 1.");
		}
	}

	public static Confidence of(double score) {
		return new Confidence(score, levelFor(score));
	}

	private static ConfidenceLevel levelFor(double score) {
		if (score >= 0.95d) {
			return ConfidenceLevel.CERTAIN;
		}
		if (score >= 0.75d) {
			return ConfidenceLevel.HIGH;
		}
		if (score >= 0.45d) {
			return ConfidenceLevel.MEDIUM;
		}
		return ConfidenceLevel.LOW;
	}
}
