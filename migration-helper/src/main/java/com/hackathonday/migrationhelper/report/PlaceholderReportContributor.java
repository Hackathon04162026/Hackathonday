package com.hackathonday.migrationhelper.report;

import com.hackathonday.migrationhelper.api.contract.WarningResponse;
import com.hackathonday.migrationhelper.scan.ScanRecord;
import java.util.List;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

@Component
@Order(Ordered.LOWEST_PRECEDENCE)
public class PlaceholderReportContributor implements ReportContributor {

	@Override
	public ReportContribution contribute(ScanRecord scan) {
		return new ReportContribution(
				List.of(new WarningResponse(
						"PIPELINE_PLACEHOLDER",
						"INFO",
						"Worker 1 placeholder aggregation is active until ingestion, detection, and policy subsystems are connected."
				)),
				List.of(),
				List.of(),
				List.of()
		);
	}
}
