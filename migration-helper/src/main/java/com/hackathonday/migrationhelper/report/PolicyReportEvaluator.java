package com.hackathonday.migrationhelper.report;

import com.hackathonday.migrationhelper.api.contract.DetectorFindingResponse;
import com.hackathonday.migrationhelper.scan.ScanRecord;
import java.util.List;

public interface PolicyReportEvaluator {

	PolicyEvaluation evaluate(ScanRecord scan, List<DetectorFindingResponse> detectorFindings);
}
