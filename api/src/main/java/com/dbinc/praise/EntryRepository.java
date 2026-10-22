package com.dbinc.praise;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

@Repository
public class EntryRepository {

	private final JdbcClient jdbc;

	public EntryRepository(JdbcClient jdbc) {
		this.jdbc = jdbc;
	}

	public List<Map<String, Object>> latest(int limit) {
		return jdbc.sql("SELECT id, name, message, recipient, created_at FROM entries ORDER BY id DESC LIMIT ?")
			.param(limit)
			.query((rs, i) -> toEntry(rs.getLong("id"), rs.getString("name"), rs.getString("message"),
					rs.getString("recipient"), rs.getString("created_at")))
			.list();
	}

	public Map<String, Object> insert(String name, String message, String to) {
		String createdAt = Instant.now().truncatedTo(ChronoUnit.MILLIS).toString();
		long id = jdbc.sql("INSERT INTO entries (name, message, recipient, created_at) VALUES (?, ?, ?, ?) RETURNING id")
			.params(name, message, to, createdAt)
			.query(Long.class)
			.single();
		return toEntry(id, name, message, to, createdAt);
	}

	private static Map<String, Object> toEntry(long id, String name, String message, String to, String createdAt) {
		Map<String, Object> entry = new LinkedHashMap<>();
		entry.put("id", id);
		entry.put("name", name);
		entry.put("message", message);
		entry.put("to", to);
		entry.put("created_at", createdAt);
		return entry;
	}

}
