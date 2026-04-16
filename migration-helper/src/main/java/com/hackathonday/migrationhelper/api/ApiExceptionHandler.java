package com.hackathonday.migrationhelper.api;

import java.time.Instant;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class ApiExceptionHandler {

	@ExceptionHandler(ScanNotFoundException.class)
	public ResponseEntity<Map<String, Object>> handleNotFound(ScanNotFoundException exception) {
		return ResponseEntity.status(HttpStatus.NOT_FOUND)
				.body(Map.of(
						"timestamp", Instant.now().toString(),
						"error", "scan_not_found",
						"message", exception.getMessage()
				));
	}

	@ExceptionHandler(MethodArgumentNotValidException.class)
	public ResponseEntity<Map<String, Object>> handleValidation(MethodArgumentNotValidException exception) {
		return ResponseEntity.badRequest()
				.body(Map.of(
						"timestamp", Instant.now().toString(),
						"error", "validation_failed",
						"message", exception.getBindingResult().getFieldErrors().stream()
								.map(FieldError::getDefaultMessage)
								.collect(Collectors.joining("; "))
				));
	}
}
