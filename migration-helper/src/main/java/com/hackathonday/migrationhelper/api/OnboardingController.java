package com.hackathonday.migrationhelper.api;

import com.hackathonday.migrationhelper.api.contract.OnboardingQueryRequest;
import com.hackathonday.migrationhelper.api.contract.OnboardingQueryResponse;
import com.hackathonday.migrationhelper.onboarding.OnboardingService;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/onboarding")
public class OnboardingController {

	private final OnboardingService onboardingService;

	public OnboardingController(OnboardingService onboardingService) {
		this.onboardingService = onboardingService;
	}

	@PostMapping("/query")
	public OnboardingQueryResponse query(@RequestBody OnboardingQueryRequest request) {
		return onboardingService.answer(request);
	}
}
