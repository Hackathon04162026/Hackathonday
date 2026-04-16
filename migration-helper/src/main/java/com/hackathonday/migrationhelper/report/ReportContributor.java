package com.hackathonday.migrationhelper.report;

import com.hackathonday.migrationhelper.scan.ScanRecord;

public interface ReportContributor {

	ReportContribution contribute(ScanRecord scan);
}
