package com.hackathonday.migrationhelper;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.hackathonday.migrationhelper.api.contract.RefinementStoryRequest;
import com.hackathonday.migrationhelper.api.contract.RefinementStoryResponse;
import com.hackathonday.migrationhelper.api.contract.TestCaseGenerationRequest;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

@SpringBootTest
@AutoConfigureMockMvc
class RefinementAndTestCaseApiTests {

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private ObjectMapper objectMapper;

	@Test
	void refineStoryReturnsCanonicalPackageAndWarnings() throws Exception {
		RefinementStoryRequest request = new RefinementStoryRequest(
				"Backlog refinement notes say the team wants a refinement facilitator that can turn messy notes into sprint-ready stories. The same discussion also drifted into QE test generation, which should be a separate story.",
				"  As a refinement facilitator, I want to turn messy notes into sprint-ready user stories so that I can keep the backlog aligned and ready for sprint commitment.  ",
				null,
				null,
				List.of(),
				null,
				8,
				List.of("Refinement session notes"),
				"Agile delivery team"
		);

		MvcResult result = mockMvc.perform(post("/api/refinement/stories")
						.contentType(MediaType.APPLICATION_JSON)
						.content(objectMapper.writeValueAsString(request)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.storySummary").value("As a refinement facilitator, I want to turn messy notes into sprint-ready user stories so that I can keep the backlog aligned and ready for sprint commitment."))
				.andExpect(jsonPath("$.problemStatement").value(org.hamcrest.Matchers.containsString("unstructured")))
				.andExpect(jsonPath("$.acceptanceCriteria[0]").value(org.hamcrest.Matchers.startsWith("Given")))
				.andExpect(jsonPath("$.acceptanceCriteria[1]").value(org.hamcrest.Matchers.startsWith("Should")))
				.andExpect(jsonPath("$.gaps[0]").value(org.hamcrest.Matchers.containsString("Clarification needed")))
				.andExpect(jsonPath("$.gaps").value(org.hamcrest.Matchers.hasItem(org.hamcrest.Matchers.containsString("parent epic link was not provided"))))
				.andExpect(jsonPath("$.gaps").value(org.hamcrest.Matchers.hasItem(org.hamcrest.Matchers.containsString("estimate is 8 points"))))
				.andExpect(jsonPath("$.estimation").value("8 story points"))
				.andExpect(jsonPath("$.normalizationNotes").value(org.hamcrest.Matchers.hasItem(org.hamcrest.Matchers.containsString("Preserved the provided story summary"))))
				.andReturn();

		RefinementStoryResponse response = objectMapper.readValue(
				result.getResponse().getContentAsString(),
				RefinementStoryResponse.class);

		assertThat(response.definitionOfReadyValidation())
				.anyMatch(line -> line.startsWith("\u26A0\uFE0F DoR GAP:"))
				.anyMatch(line -> line.contains("Estimate"));
	}

	@Test
	void generateTestCasesReturnsSequentialNumberingAndCoverageSummary() throws Exception {
		TestCaseGenerationRequest request = new TestCaseGenerationRequest(
				"As a QE engineer, I want to turn acceptance criteria into comprehensive test cases so that I can execute coverage quickly.",
				List.of(
						"Given a story estimate of 5 points, when the team reviews it, then the story remains eligible for sprint commitment.",
						"Should work properly."
				),
				"QE coverage generator",
				"local"
		);

		mockMvc.perform(post("/api/test-cases")
						.contentType(MediaType.APPLICATION_JSON)
						.content(objectMapper.writeValueAsString(request)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.testSuites").isArray())
				.andExpect(jsonPath("$.testSuites[0].suiteName").value(org.hamcrest.Matchers.containsString("Story Estimate")))
				.andExpect(jsonPath("$.testSuites[1].untestable").value(true))
				.andExpect(jsonPath("$.testSuites[1].rewriteSuggestion").value(org.hamcrest.Matchers.containsString("Rewrite it as")))
				.andExpect(jsonPath("$.testSuites[0].testCases[0].id").value("TC-001"))
				.andExpect(jsonPath("$.testSuites[0].testCases[1].id").value("TC-002"))
				.andExpect(jsonPath("$.testSuites[0].testCases[2].id").value("TC-003"))
				.andExpect(jsonPath("$.testSuites[1].testCases[0].id").value("TC-004"))
				.andExpect(jsonPath("$.testSuites[1].testCases[1].id").value("TC-005"))
				.andExpect(jsonPath("$.testSuites[1].testCases[2].id").value("TC-006"))
				.andExpect(jsonPath("$.summary.totalTestCases").value(6))
				.andExpect(jsonPath("$.summary.positiveCases").value(2))
				.andExpect(jsonPath("$.summary.negativeCases").value(2))
				.andExpect(jsonPath("$.summary.edgeCases").value(2))
				.andExpect(jsonPath("$.summary.boundaryCases").value(1))
				.andExpect(jsonPath("$.summary.untestableCriteria").value(1))
				.andExpect(jsonPath("$.summary.gaps").value(org.hamcrest.Matchers.hasItem(org.hamcrest.Matchers.containsString("Network failure"))))
				.andExpect(jsonPath("$.summary.gaps").value(org.hamcrest.Matchers.hasItem(org.hamcrest.Matchers.containsString("Permission"))))
				.andExpect(jsonPath("$.summary.gaps").value(org.hamcrest.Matchers.hasItem(org.hamcrest.Matchers.containsString("untestable"))));
	}

	@Test
	void refineStoryFallsBackToReadinessWarningsWhenInputsAreMissing() throws Exception {
		RefinementStoryRequest request = new RefinementStoryRequest(
				"New team members keep asking where the onboarding docs live and the conversation suggests we should ground the answers in SharePoint documents.",
				null,
				null,
				null,
				null,
				null,
				null,
				null,
				null
		);

		mockMvc.perform(post("/api/refinement/stories")
						.contentType(MediaType.APPLICATION_JSON)
						.content(objectMapper.writeValueAsString(request)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.dependencies[0]").value("None identified during refinement \u2014 verify before sprint commitment"))
				.andExpect(jsonPath("$.gaps").isArray())
				.andExpect(jsonPath("$.definitionOfReadyValidation").value(org.hamcrest.Matchers.hasItem(org.hamcrest.Matchers.containsString("parent epic link was not provided"))))
				.andExpect(jsonPath("$.definitionOfReadyValidation").value(org.hamcrest.Matchers.hasItem(org.hamcrest.Matchers.containsString("sprint was not identified"))));
	}

	@Test
	void refineStoryFlagsProblemStatementAndStoryMismatch() throws Exception {
		RefinementStoryRequest request = new RefinementStoryRequest(
				"The team needs new onboarding guidance for first-week developers so they can find the right setup docs.",
				"As a refinement facilitator, I want to turn messy notes into sprint-ready stories so that I can keep the backlog aligned and ready for sprint commitment.",
				"The problem is that the onboarding path is unclear for new hires.",
				"EPIC-123",
				List.of("refinement"),
				"Sprint 12",
				3,
				List.of("Refinement notes"),
				"Agile delivery team"
		);

		mockMvc.perform(post("/api/refinement/stories")
						.contentType(MediaType.APPLICATION_JSON)
						.content(objectMapper.writeValueAsString(request)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.gaps").value(org.hamcrest.Matchers.hasItem(org.hamcrest.Matchers.containsString("problem statement points to Onboarding work"))))
				.andExpect(jsonPath("$.problemStatement").value(org.hamcrest.Matchers.containsString("The provided problem statement says")))
				.andExpect(jsonPath("$.problemStatement").value(org.hamcrest.Matchers.containsString("problem statement points to Onboarding work")))
				.andExpect(jsonPath("$.definitionOfReadyValidation").value(org.hamcrest.Matchers.hasItem(org.hamcrest.Matchers.containsString("problem statement and story summary drift apart"))));
	}
}
