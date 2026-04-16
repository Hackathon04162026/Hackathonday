package com.hackathonday.migrationhelper.scan;

import com.hackathonday.migrationhelper.api.ScanNotFoundException;
import com.hackathonday.migrationhelper.api.contract.CreateScanRequest;
import com.hackathonday.migrationhelper.api.contract.PathScanRequest;
import com.hackathonday.migrationhelper.api.contract.ScanDetailResponse;
import com.hackathonday.migrationhelper.api.contract.ScanReportResponse;
import com.hackathonday.migrationhelper.api.contract.ScanSummaryResponse;
import com.hackathonday.migrationhelper.api.contract.WarningResponse;
import com.hackathonday.migrationhelper.config.MigrationHelperProperties;
import com.hackathonday.migrationhelper.report.ScanReportAssembler;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Service;

@Service
public class ScanService {

	private final ConcurrentHashMap<String, ScanRecord> scans = new ConcurrentHashMap<>();
	private final MigrationHelperProperties properties;
	private final ScanReportAssembler scanReportAssembler;

	public ScanService(MigrationHelperProperties properties, ScanReportAssembler scanReportAssembler) {
		this.properties = properties;
		this.scanReportAssembler = scanReportAssembler;
	}

	public ScanDetailResponse createArchiveScan(CreateScanRequest request) {
		String displayName = blankToDefault(request.displayName(), request.sourceFilename());
		ScanRecord scan = createScan(
				ScanSourceType.ARCHIVE_UPLOAD,
				request.uploadedArchiveToken(),
				displayName,
				resolveRequestedBy(request.requestedBy())
		);
		scan.addWarning(new ScanWarning(
				"ARCHIVE_METADATA_CAPTURED",
				"INFO",
				"Archive metadata captured for " + request.sourceFilename() + " (" + request.sizeBytes() + " bytes)."
		));
		progressScan(scan);
		return toDetail(scan);
	}

	public ScanDetailResponse createPathScan(PathScanRequest request) {
		ScanRecord scan = createScan(
				ScanSourceType.LOCAL_PATH,
				request.path(),
				blankToDefault(request.displayName(), request.path()),
				resolveRequestedBy(request.requestedBy())
		);
		scan.addWarning(new ScanWarning(
				"PATH_SCAN_PENDING_NORMALIZATION",
				"INFO",
				"Local path scan accepted. Workspace normalization will be supplied by Worker 2."
		));
		progressScan(scan);
		return toDetail(scan);
	}

	public List<ScanSummaryResponse> listScans() {
		return scans.values().stream()
				.sorted(Comparator.comparing(ScanRecord::createdAt).reversed())
				.limit(properties.scan().maxRecentScans())
				.map(this::toSummary)
				.toList();
	}

	public ScanDetailResponse getScan(String id) {
		return toDetail(getRequired(id));
	}

	public ScanReportResponse getReport(String id) {
		return scanReportAssembler.assemble(getRequired(id));
	}

	private ScanRecord createScan(
			ScanSourceType sourceType,
			String sourceReference,
			String displayName,
			String requestedBy
	) {
		Instant now = Instant.now();
		String id = "scan-" + UUID.randomUUID().toString().substring(0, 8);
		ScanRecord scan = new ScanRecord(id, sourceType, sourceReference, displayName, requestedBy, now);
		scans.put(id, scan);
		return scan;
	}

	private void progressScan(ScanRecord scan) {
		scan.markStarted();
		scan.advanceTo(ScanStatus.ANALYZING);
		scan.advanceTo(ScanStatus.AGGREGATING);

		if (properties.scan().autoCompletePlaceholderScans()) {
			String normalizedPath = scan.sourceType() == ScanSourceType.LOCAL_PATH
					? scan.sourceReference()
					: "/normalized-workspaces/" + scan.id();
			scan.complete(normalizedPath, "READY");
		}
	}

	private ScanRecord getRequired(String id) {
		ScanRecord scan = scans.get(id);
		if (scan == null) {
			throw new ScanNotFoundException(id);
		}
		return scan;
	}

	private ScanSummaryResponse toSummary(ScanRecord scan) {
		return new ScanSummaryResponse(
				scan.id(),
				scan.status().name(),
				scan.sourceType().name(),
				scan.displayName(),
				scan.requestedBy(),
				scan.createdAt(),
				scan.updatedAt(),
				scan.warnings().stream().map(this::toWarning).toList()
		);
	}

	private ScanDetailResponse toDetail(ScanRecord scan) {
		return new ScanDetailResponse(
				scan.id(),
				scan.status().name(),
				scan.sourceType().name(),
				scan.displayName(),
				scan.requestedBy(),
				scan.sourceReference(),
				scan.createdAt(),
				scan.startedAt(),
				scan.completedAt(),
				scan.updatedAt(),
				scan.lifecycle(),
				scan.warnings().stream().map(this::toWarning).toList()
		);
	}

	private WarningResponse toWarning(ScanWarning warning) {
		return new WarningResponse(warning.code(), warning.severity(), warning.message());
	}

	private String resolveRequestedBy(String requestedBy) {
		return blankToDefault(requestedBy, properties.defaultRequestedBy());
	}

	private String blankToDefault(String value, String fallback) {
		if (value == null || value.isBlank()) {
			return fallback;
		}
		return value;
	}
}
