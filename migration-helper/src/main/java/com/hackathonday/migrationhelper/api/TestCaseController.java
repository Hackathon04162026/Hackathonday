package com.hackathonday.migrationhelper.api;

import com.hackathonday.migrationhelper.api.contract.TestCaseGenerationRequest;
import com.hackathonday.migrationhelper.api.contract.TestCaseGenerationResponse;
import com.hackathonday.migrationhelper.testcase.TestCaseGeneratorService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class TestCaseController {

	private final TestCaseGeneratorService testCaseGeneratorService;

	public TestCaseController(TestCaseGeneratorService testCaseGeneratorService) {
		this.testCaseGeneratorService = testCaseGeneratorService;
	}

	@PostMapping("/test-cases")
	public TestCaseGenerationResponse generateTestCases(@Valid @RequestBody TestCaseGenerationRequest request) {
		return testCaseGeneratorService.generate(request);
	}
}
