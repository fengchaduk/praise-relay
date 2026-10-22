package com.dbinc.praise;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

import io.swagger.v3.oas.annotations.OpenAPIDefinition;
import io.swagger.v3.oas.annotations.info.Info;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@OpenAPIDefinition(info = @Info(title = "칭찬 릴레이 API", version = "1", description = "칭찬을 남기고 최신순으로 받아 보는 API"))
@SpringBootApplication
public class ApiApplication {

	public static void main(String[] args) throws IOException {
		// SQLite는 폴더를 만들지 않아서, 기본 DB 파일이 들어갈 data 폴더를 먼저 만들어요.
		Files.createDirectories(Path.of("data"));
		SpringApplication.run(ApiApplication.class, args);
	}

}
