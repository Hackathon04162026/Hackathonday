package com.hackathonday.migrationhelper.api.contract;

import java.util.List;

public record TestCaseGenerationResponse(
		List<TestSuiteResponse> testSuites,
		Summary summary
) {
	public record TestSuiteResponse(
			String suiteName,
			String acceptanceCriterion,
			boolean untestable,
			String untestableReason,
			String rewriteSuggestion,
			List<TestCaseResponse> testCases
	) {
	}

	public record TestCaseResponse(
			String id,
			String name,
			String priority,
			String type,
			List<String> preconditions,
			List<String> steps,
			String expectedResult,
			String testData
	) {
	}

	public record Summary(
			int totalTestCases,
			int positiveCases,
			int negativeCases,
			int edgeCases,
			int boundaryCases,
			int untestableCriteria,
			List<String> gaps
	) {
	}
}
