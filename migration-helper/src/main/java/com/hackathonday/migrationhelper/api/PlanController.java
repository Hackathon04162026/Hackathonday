package com.hackathonday.migrationhelper.api;

import com.hackathonday.migrationhelper.api.contract.ApproveReviewRequest;
import com.hackathonday.migrationhelper.api.contract.CreatePlanRequest;
import com.hackathonday.migrationhelper.api.contract.PlanDetailResponse;
import com.hackathonday.migrationhelper.api.contract.PlanSummaryResponse;
import com.hackathonday.migrationhelper.planning.PlanService;
import jakarta.validation.Valid;
import java.net.URI;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/plans")
public class PlanController {

	private final PlanService planService;

	public PlanController(PlanService planService) {
		this.planService = planService;
	}

	@PostMapping
	public ResponseEntity<PlanDetailResponse> createPlan(@Valid @RequestBody CreatePlanRequest request) {
		PlanDetailResponse response = planService.createPlan(request);
		return ResponseEntity.accepted()
				.location(URI.create("/api/plans/" + response.id()))
				.body(response);
	}

	@GetMapping
	public List<PlanSummaryResponse> listPlans() {
		return planService.listPlans();
	}

	@GetMapping("/{id}")
	public PlanDetailResponse getPlan(@PathVariable String id) {
		return planService.getPlan(id);
	}

	@PostMapping("/{id}/reviews/{stage}/approve")
	public PlanDetailResponse approveReview(
			@PathVariable String id,
			@PathVariable String stage,
			@Valid @RequestBody ApproveReviewRequest request
	) {
		return planService.approveReview(id, stage, request);
	}
}
