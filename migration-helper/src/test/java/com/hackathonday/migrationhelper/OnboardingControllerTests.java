package com.hackathonday.migrationhelper;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.hackathonday.migrationhelper.api.contract.OnboardingJourneyType;
import com.hackathonday.migrationhelper.api.contract.OnboardingQueryRequest;
import com.hackathonday.migrationhelper.api.contract.OnboardingQueryResponse;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
class OnboardingControllerTests {

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private ObjectMapper objectMapper;

	@Test
	void firstInteractionPromptsForRoleAndJourneyType() throws Exception {
		mockMvc.perform(post("/api/onboarding/query")
						.contentType(MediaType.APPLICATION_JSON)
						.content("{}"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.agentName").value("Confluence-grounded Onboarding Agent"))
				.andExpect(jsonPath("$.answer").value(org.hamcrest.Matchers.containsString("need your role")))
				.andExpect(jsonPath("$.nextQuestions[0]").value("What is your role?"))
				.andExpect(jsonPath("$.nextQuestions[1]").value("Is this your first week, or do you have a specific question?"));
	}

	@Test
	void firstWeekResponseUsesOrderedDocumentsAndWarnings() throws Exception {
		OnboardingQueryRequest request = new OnboardingQueryRequest("Developer", OnboardingJourneyType.FIRST_WEEK, null);

		String json = mockMvc.perform(post("/api/onboarding/query")
						.contentType(MediaType.APPLICATION_JSON)
						.content(objectMapper.writeValueAsString(request)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.citedDocuments.length()").value(6))
				.andExpect(jsonPath("$.citedDocuments[0].documentName").value("New Joiner Team Overview"))
				.andExpect(jsonPath("$.warnings[0]").value(org.hamcrest.Matchers.containsString("may be outdated")))
				.andExpect(jsonPath("$.answer").value(org.hamcrest.Matchers.containsString("Want me to go deeper")))
				.andReturn()
				.getResponse()
				.getContentAsString();

		OnboardingQueryResponse response = objectMapper.readValue(json, OnboardingQueryResponse.class);
		assertThat(response.citedDocuments()).extracting("section")
				.containsExactly(
						"Team overview",
						"Tools and access",
						"Ceremonies and rituals",
						"Codebase and architecture",
						"Definition of Done / Definition of Ready",
						"First contribution");
	}

	@Test
	void specificQuestionFallsBackWhenDocumentationDoesNotCoverTopic() throws Exception {
		OnboardingQueryRequest request = new OnboardingQueryRequest(
				"Scrum Master",
				OnboardingJourneyType.SPECIFIC_QUESTION,
				"What is the data retention policy?"
		);

		mockMvc.perform(post("/api/onboarding/query")
						.contentType(MediaType.APPLICATION_JSON)
						.content(objectMapper.writeValueAsString(request)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.answer").value(org.hamcrest.Matchers.containsString("couldn't find this in our documentation")))
				.andExpect(jsonPath("$.suggestedEscalation").value(org.hamcrest.Matchers.containsString("#delivery-ops")))
				.andExpect(jsonPath("$.citedDocuments.length()").value(0));
	}

	@Test
	void specificQuestionUsesRoleAdaptedDocument() throws Exception {
		OnboardingQueryRequest request = new OnboardingQueryRequest(
				"Tester",
				OnboardingJourneyType.SPECIFIC_QUESTION,
				"How do I set up my dev environment?"
		);

		mockMvc.perform(post("/api/onboarding/query")
						.contentType(MediaType.APPLICATION_JSON)
						.content(objectMapper.writeValueAsString(request)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.citedDocuments[0].documentName").value("QA Environment Setup"))
				.andExpect(jsonPath("$.answer").value(org.hamcrest.Matchers.containsString("For a Tester")))
				.andExpect(jsonPath("$.answer").value(org.hamcrest.Matchers.containsString("Want me to go deeper")));
	}

	@Test
	void staleDocumentAddsOutdatedWarning() throws Exception {
		OnboardingQueryRequest request = new OnboardingQueryRequest(
				"Developer",
				OnboardingJourneyType.SPECIFIC_QUESTION,
				"What is our branching strategy?"
		);

		mockMvc.perform(post("/api/onboarding/query")
						.contentType(MediaType.APPLICATION_JSON)
						.content(objectMapper.writeValueAsString(request)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.citedDocuments[0].documentName").value("Branching Strategy Reference"))
				.andExpect(jsonPath("$.warnings[0]").value(org.hamcrest.Matchers.containsString("may be outdated")));
	}
}
