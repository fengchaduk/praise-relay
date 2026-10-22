package com.dbinc.praise;

import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.servlet.resource.NoResourceFoundException;

@RestControllerAdvice
public class ErrorHandler {

	@ExceptionHandler(ApiException.class)
	public ResponseEntity<Map<String, String>> api(ApiException e) {
		return ResponseEntity.status(e.status()).body(Map.of("error", e.getMessage()));
	}

	@ExceptionHandler(NoResourceFoundException.class)
	public ResponseEntity<Map<String, String>> notFound() {
		return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "없는 주소예요."));
	}

	@ExceptionHandler(HttpRequestMethodNotSupportedException.class)
	public ResponseEntity<Map<String, String>> methodNotAllowed() {
		return ResponseEntity.status(HttpStatus.METHOD_NOT_ALLOWED).body(Map.of("error", "이 주소에서 쓸 수 없는 요청 방식이에요."));
	}

}
