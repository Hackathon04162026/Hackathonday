package com.hackathonday.migrationhelper.api;

import com.hackathonday.migrationhelper.api.contract.RefinementStoryRequest;
import com.hackathonday.migrationhelper.api.contract.RefinementStoryResponse;
import com.hackathonday.migrationhelper.refinement.RefinementStoryService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/refinement")
public class RefinementController {

	private final RefinementStoryService refinementStoryService;

	public RefinementController(RefinementStoryService refinementStoryService) {
		this.refinementStoryService = refinementStoryService;
	}

	@PostMapping("/stories")
	public RefinementStoryResponse refineStory(@Valid @RequestBody RefinementStoryRequest request) {
		return refinementStoryService.refineStory(request);
	}
}
