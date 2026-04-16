package com.hackathonday.migrationhelper;

import static org.hamcrest.Matchers.matchesPattern;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_EACH_TEST_METHOD)
class PlanControllerPlanningApiTests {

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private ObjectMapper objectMapper;

	@Test
	void createsListsAndReturnsPlanDetailWithStableContract() throws Exception {
		String planId = createPlan();

		mockMvc.perform(get("/api/plans"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$[0].id").value(planId))
				.andExpect(jsonPath("$[0].productName").value("Delivery Planning"))
				.andExpect(jsonPath("$[0].currentStage").value("EPIC_REVIEW"))
				.andExpect(jsonPath("$[0].epicCount").value(3))
				.andExpect(jsonPath("$[0].featureCount").value(0))
				.andExpect(jsonPath("$[0].storyCount").value(0));

		mockMvc.perform(get("/api/plans/{id}", planId))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.id").value(planId))
				.andExpect(jsonPath("$.vision").value("Deliver a planning backbone for the team"))
				.andExpect(jsonPath("$.programLead").value("Ari Lead"))
				.andExpect(jsonPath("$.currentStage").value("EPIC_REVIEW"))
				.andExpect(jsonPath("$.epics.length()").value(3))
				.andExpect(jsonPath("$.features.length()").value(0))
				.andExpect(jsonPath("$.stories.length()").value(0))
				.andExpect(jsonPath("$.reviewCheckpoints.length()").value(2))
				.andExpect(jsonPath("$.onboardingChecklist.length()").value(3));
	}

	@Test
	void approvesEpicReviewAndOpensFeatureReview() throws Exception {
		String planId = createPlan();

		mockMvc.perform(post("/api/plans/{id}/reviews/{stage}/approve", planId, "epics")
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{
								  "reviewer": "Morgan",
								  "notes": "Epic decomposition is aligned."
								}
								"""))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.currentStage").value("FEATURE_REVIEW"))
				.andExpect(jsonPath("$.epics.length()").value(3))
				.andExpect(jsonPath("$.features.length()").value(4))
				.andExpect(jsonPath("$.reviewCheckpoints[0].stage").value("EPICS"))
				.andExpect(jsonPath("$.reviewCheckpoints[0].status").value("APPROVED"))
				.andExpect(jsonPath("$.reviewCheckpoints[0].reviewer").value("Morgan"))
				.andExpect(jsonPath("$.reviewCheckpoints[1].status").value("PENDING"));
	}

	@Test
	void approvesFeatureReviewAndCompletesStoryReadiness() throws Exception {
		String planId = createPlan();

		mockMvc.perform(post("/api/plans/{id}/reviews/{stage}/approve", planId, "epics")
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{
								  "reviewer": "Morgan",
								  "notes": "Epic decomposition is aligned."
								}
								"""))
				.andExpect(status().isOk());

		mockMvc.perform(post("/api/plans/{id}/reviews/{stage}/approve", planId, "features")
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{
								  "reviewer": "Jordan",
								  "notes": "Features are ready for story creation."
								}
								"""))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.currentStage").value("STORY_READY"))
				.andExpect(jsonPath("$.features.length()").value(4))
				.andExpect(jsonPath("$.stories.length()").value(4))
				.andExpect(jsonPath("$.reviewCheckpoints[1].stage").value("FEATURES"))
				.andExpect(jsonPath("$.reviewCheckpoints[1].status").value("APPROVED"))
				.andExpect(jsonPath("$.reviewCheckpoints[1].reviewer").value("Jordan"))
				.andExpect(jsonPath("$.onboardingChecklist[2].status").value("READY"));
	}

	@Test
	void rejectsOutOfOrderApprovalWithConflict() throws Exception {
		String planId = createPlan();

		mockMvc.perform(post("/api/plans/{id}/reviews/{stage}/approve", planId, "features")
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{
								  "reviewer": "Jordan",
								  "notes": "Trying to skip the epic review gate."
								}
								"""))
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.error").value("plan_review_conflict"))
				.andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("Feature review is not the active stage")));
	}

	@Test
	void returnsNotFoundForUnknownPlan() throws Exception {
		mockMvc.perform(get("/api/plans/{id}", "plan-missing"))
				.andExpect(status().isNotFound())
				.andExpect(jsonPath("$.error").value("plan_not_found"))
				.andExpect(jsonPath("$.message").value("Plan plan-missing was not found"));
	}

	private String createPlan() throws Exception {
		String response = mockMvc.perform(post("/api/plans")
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{
								  "vision": "Deliver a planning backbone for the team",
								  "programLead": "Ari Lead",
								  "productName": "Delivery Planning",
								  "desiredOutcomes": [
								    "Reduce ambiguity before delivery",
								    "Improve story readiness"
								  ],
								  "targetUsers": "Program leads and agile facilitators"
								}
								"""))
				.andExpect(status().isAccepted())
				.andExpect(header().string("Location", matchesPattern("/api/plans/plan-.+")))
				.andExpect(jsonPath("$.id").exists())
				.andExpect(jsonPath("$.currentStage").value("EPIC_REVIEW"))
				.andExpect(jsonPath("$.epics.length()").value(3))
				.andReturn()
				.getResponse()
				.getContentAsString();

		JsonNode createdPlan = objectMapper.readTree(response);
		return createdPlan.get("id").asText();
	}
}
