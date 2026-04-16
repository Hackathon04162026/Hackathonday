package com.hackathonday.migrationhelper.api;

import com.hackathonday.migrationhelper.api.contract.CreateScanRequest;
import com.hackathonday.migrationhelper.api.contract.PathScanRequest;
import com.hackathonday.migrationhelper.api.contract.ScanDetailResponse;
import com.hackathonday.migrationhelper.api.contract.ScanReportResponse;
import com.hackathonday.migrationhelper.api.contract.ScanSummaryResponse;
import com.hackathonday.migrationhelper.scan.ScanService;
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
@RequestMapping("/api/scans")
public class ScanController {

	private final ScanService scanService;

	public ScanController(ScanService scanService) {
		this.scanService = scanService;
	}

	@PostMapping
	public ResponseEntity<ScanDetailResponse> createScan(@Valid @RequestBody CreateScanRequest request) {
		ScanDetailResponse response = scanService.createArchiveScan(request);
		return ResponseEntity.accepted()
				.location(URI.create("/api/scans/" + response.id()))
				.body(response);
	}

	@PostMapping("/path")
	public ResponseEntity<ScanDetailResponse> createPathScan(@Valid @RequestBody PathScanRequest request) {
		ScanDetailResponse response = scanService.createPathScan(request);
		return ResponseEntity.accepted()
				.location(URI.create("/api/scans/" + response.id()))
				.body(response);
	}

	@GetMapping
	public List<ScanSummaryResponse> listScans() {
		return scanService.listScans();
	}

	@GetMapping("/{id}")
	public ScanDetailResponse getScan(@PathVariable String id) {
		return scanService.getScan(id);
	}

	@GetMapping("/{id}/report")
	public ScanReportResponse getScanReport(@PathVariable String id) {
		return scanService.getReport(id);
	}
}
