package com.dbinc.praise;

import java.io.IOException;
import java.util.List;
import java.util.Map;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.ExampleObject;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.InvalidMediaTypeException;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import tools.jackson.databind.json.JsonMapper;

@RestController
@RequestMapping("/api/entries")
public class EntryController {

	private static final int MAX_BODY_BYTES = 8 * 1024;

	private final EntryRepository entries;

	private final JsonMapper json;

	public EntryController(EntryRepository entries, JsonMapper json) {
		this.entries = entries;
		this.json = json;
	}

	@Operation(summary = "칭찬 목록", description = "최신 칭찬부터 최대 200개를 돌려줘요.")
	@GetMapping
	public Map<String, List<Map<String, Object>>> list() {
		return Map.of("entries", entries.latest(200));
	}

	// 본문을 직접 읽어서 숫자 같은 문자열 아닌 값을 거절하고, 413과 415를 약속대로 돌려줘요.
	@Operation(summary = "칭찬 남기기",
			description = "name과 message는 필수예요. 앞뒤 공백을 지운 뒤 name은 1~40자, message는 1~500자예요. to는 선택이에요.",
			requestBody = @io.swagger.v3.oas.annotations.parameters.RequestBody(required = true,
					content = @Content(mediaType = "application/json", schema = @Schema(implementation = EntryRequest.class),
							examples = @ExampleObject(value = "{\"name\": \"민수\", \"message\": \"발표 자료 정리해 줘서 고마워요!\", \"to\": \"지영\"}"))),
			responses = {
					@ApiResponse(responseCode = "201", description = "저장됨"),
					@ApiResponse(responseCode = "400", description = "잘못된 값이나 깨진 JSON"),
					@ApiResponse(responseCode = "413", description = "8KiB가 넘는 본문"),
					@ApiResponse(responseCode = "415", description = "JSON이 아닌 형식") })
	@PostMapping
	public ResponseEntity<Map<String, Object>> create(HttpServletRequest request) throws IOException {
		requireJson(request.getContentType());
		byte[] body = request.getInputStream().readNBytes(MAX_BODY_BYTES + 1);
		if (body.length > MAX_BODY_BYTES) {
			throw new ApiException(HttpStatus.CONTENT_TOO_LARGE, "본문이 8KiB를 넘어요.");
		}
		if (!(parse(body) instanceof Map<?, ?> value)) {
			throw new ApiException(HttpStatus.BAD_REQUEST, "JSON 객체로 보내 주세요.");
		}
		String name = requiredText(value.get("name"), "name", 40);
		String message = requiredText(value.get("message"), "message", 500);
		String to = optionalText(value.get("to"), "to", 40);
		return ResponseEntity.status(HttpStatus.CREATED).body(Map.of("entry", entries.insert(name, message, to)));
	}

	private static void requireJson(String contentType) {
		try {
			if (contentType != null && MediaType.APPLICATION_JSON.isCompatibleWith(MediaType.parseMediaType(contentType))) {
				return;
			}
		}
		catch (InvalidMediaTypeException e) {
			// 아래에서 415로 답해요.
		}
		throw new ApiException(HttpStatus.UNSUPPORTED_MEDIA_TYPE, "Content-Type은 application/json이어야 해요.");
	}

	private Object parse(byte[] body) {
		try {
			return json.readValue(body, Object.class);
		}
		catch (RuntimeException e) {
			throw new ApiException(HttpStatus.BAD_REQUEST, "JSON 형식이 깨졌어요.");
		}
	}

	private static String requiredText(Object value, String field, int max) {
		String text = optionalText(value, field, max);
		if (text == null) {
			throw new ApiException(HttpStatus.BAD_REQUEST, field + "을(를) 적어 주세요.");
		}
		return text;
	}

	private static String optionalText(Object value, String field, int max) {
		if (value == null) {
			return null;
		}
		if (!(value instanceof String raw)) {
			throw new ApiException(HttpStatus.BAD_REQUEST, field + "은(는) 문자열이어야 해요.");
		}
		String text = raw.strip();
		if (text.codePointCount(0, text.length()) > max) {
			throw new ApiException(HttpStatus.BAD_REQUEST, field + "은(는) " + max + "자까지 쓸 수 있어요.");
		}
		return text.isEmpty() ? null : text;
	}

	@Schema(name = "EntryRequest")
	record EntryRequest(
			@Schema(description = "칭찬하는 사람", example = "민수", maxLength = 40, requiredMode = Schema.RequiredMode.REQUIRED) String name,
			@Schema(description = "칭찬 한마디", example = "발표 자료 정리해 줘서 고마워요!", maxLength = 500, requiredMode = Schema.RequiredMode.REQUIRED) String message,
			@Schema(description = "칭찬받는 사람 (선택)", example = "지영", maxLength = 40) String to) {
	}

}
