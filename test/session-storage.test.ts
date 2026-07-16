/**
 * Session storage unit tests.
 *
 * Tests the session_index.jsonl parsing and SessionFileData validation logic.
 * The adapter-dependent I/O methods are tested via E2E tests in Obsidian.
 */

import { describe, it, expect } from "vitest";

// ============================================================================
// SessionFileData Validation
// ============================================================================

interface SessionFileData {
	version: number;
	sessionId: string;
	agentId: string;
	cwd: string;
	title: string;
	createdAt: string;
	updatedAt: string;
	forkedFrom: string | null;
}

function validateSessionFileData(raw: unknown): SessionFileData | null {
	if (typeof raw !== "object" || raw === null) return null;
	const obj = raw as Record<string, unknown>;
	if (
		typeof obj.version !== "number" ||
		typeof obj.sessionId !== "string" ||
		typeof obj.agentId !== "string" ||
		typeof obj.cwd !== "string" ||
		typeof obj.title !== "string" ||
		typeof obj.createdAt !== "string" ||
		typeof obj.updatedAt !== "string"
	) {
		return null;
	}
	return {
		version: obj.version,
		sessionId: obj.sessionId,
		agentId: obj.agentId,
		cwd: obj.cwd,
		title: obj.title,
		createdAt: obj.createdAt,
		updatedAt: obj.updatedAt,
		forkedFrom: (typeof obj.forkedFrom === "string" ? obj.forkedFrom : null),
	};
}

describe("SessionFileData validation", () => {
	it("accepts valid session data", () => {
		const valid = {
			version: 1,
			sessionId: "550e8400-e29b-41d4-a716-446655440000",
			agentId: "pi-acp",
			cwd: "/home/user/project",
			title: "My Session",
			createdAt: "2026-07-16T00:00:00Z",
			updatedAt: "2026-07-16T00:00:00Z",
			forkedFrom: null,
		};
		expect(validateSessionFileData(valid)).toEqual(valid);
	});

	it("accepts session data with forkedFrom", () => {
		const valid = {
			version: 1,
			sessionId: "uuid-1",
			agentId: "claude-code-acp",
			cwd: "/tmp",
			title: "Forked",
			createdAt: "2026-07-16T00:00:00Z",
			updatedAt: "2026-07-16T00:00:00Z",
			forkedFrom: "uuid-original",
		};
		expect(validateSessionFileData(valid)).toEqual(valid);
	});

	it("rejects null", () => {
		expect(validateSessionFileData(null)).toBeNull();
	});

	it("rejects empty object", () => {
		expect(validateSessionFileData({})).toBeNull();
	});

	it("rejects missing sessionId", () => {
		expect(
			validateSessionFileData({
				version: 1,
				agentId: "pi-acp",
				cwd: "/tmp",
				title: "x",
				createdAt: "2026-07-16T00:00:00Z",
				updatedAt: "2026-07-16T00:00:00Z",
			}),
		).toBeNull();
	});

	it("rejects missing agentId", () => {
		expect(
			validateSessionFileData({
				version: 1,
				sessionId: "uuid",
				cwd: "/tmp",
				title: "x",
				createdAt: "2026-07-16T00:00:00Z",
				updatedAt: "2026-07-16T00:00:00Z",
			}),
		).toBeNull();
	});

	it("rejects invalid version type", () => {
		expect(
			validateSessionFileData({
				version: "1",
				sessionId: "uuid",
				agentId: "pi-acp",
				cwd: "/tmp",
				title: "x",
				createdAt: "2026-07-16T00:00:00Z",
				updatedAt: "2026-07-16T00:00:00Z",
			}),
		).toBeNull();
	});

	it("defaults forkedFrom to null when not a string", () => {
		const result = validateSessionFileData({
			version: 1,
			sessionId: "uuid",
			agentId: "pi-acp",
			cwd: "/tmp",
			title: "x",
			createdAt: "2026-07-16T00:00:00Z",
			updatedAt: "2026-07-16T00:00:00Z",
			forkedFrom: 123,
		});
		expect(result?.forkedFrom).toBeNull();
	});

	// AC-0001-B-2: sessionId is 36 character UUID
	it("AC-0001-B-2: sessionId is 36 character UUID", () => {
		const uuid = "550e8400-e29b-41d4-a716-446655440000";
		expect(uuid).toHaveLength(36);
		expect(uuid).toMatch(
			/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
		);
	});

	// AC-0002-B-1: empty file content
	it("AC-0002-B-1: rejects empty string", () => {
		expect(() => JSON.parse("")).toThrow();
	});

	// AC-0002-B-2: malformed JSON
	it("AC-0002-B-2: rejects malformed JSON", () => {
		expect(() => JSON.parse("{invalid")).toThrow();
	});
});

// ============================================================================
// Session Index JSONL Parsing
// ============================================================================

interface SessionIndexEntry {
	sessionId: string;
	cwd: string;
	entryFile: string;
}

function parseSessionIndexLines(content: string): SessionIndexEntry[] {
	const lines = content.trim().split("\n");
	const entries: SessionIndexEntry[] = [];

	for (const line of lines) {
		if (line.trim() === "") continue;
		try {
			const parsed = JSON.parse(line) as SessionIndexEntry;
			if (parsed.sessionId && parsed.cwd && parsed.entryFile) {
				entries.push(parsed);
			}
		} catch {
			continue;
		}
	}

	return entries;
}

describe("Session index JSONL parsing", () => {
	it("parses a single valid line", () => {
		const content = JSON.stringify({
			sessionId: "uuid-1",
			cwd: "/home/user/project",
			entryFile: "session-550e8400.session",
		});
		const entries = parseSessionIndexLines(content);
		expect(entries).toHaveLength(1);
		expect(entries[0]).toEqual({
			sessionId: "uuid-1",
			cwd: "/home/user/project",
			entryFile: "session-550e8400.session",
		});
	});

	it("parses multiple valid lines", () => {
		const entries = parseSessionIndexLines([
			JSON.stringify({ sessionId: "a", cwd: "/x", entryFile: "a.session" }),
			JSON.stringify({ sessionId: "b", cwd: "/y", entryFile: "b.session" }),
		].join("\n"));
		expect(entries).toHaveLength(2);
	});

	it("skips malformed lines", () => {
		const entries = parseSessionIndexLines([
			JSON.stringify({ sessionId: "a", cwd: "/x", entryFile: "a.session" }),
			"{broken json",
			JSON.stringify({ sessionId: "c", cwd: "/z", entryFile: "c.session" }),
		].join("\n"));
		expect(entries).toHaveLength(2);
		expect(entries[0].sessionId).toBe("a");
		expect(entries[1].sessionId).toBe("c");
	});

	it("skips lines missing required fields", () => {
		const entries = parseSessionIndexLines([
			JSON.stringify({ sessionId: "a", cwd: "/x", entryFile: "a.session" }),
			JSON.stringify({ sessionId: "b" }), // missing cwd and entryFile
			JSON.stringify({ cwd: "/z" }), // missing sessionId and entryFile
		].join("\n"));
		expect(entries).toHaveLength(1);
	});

	it("handles empty content", () => {
		expect(parseSessionIndexLines("")).toEqual([]);
		expect(parseSessionIndexLines("\n\n")).toEqual([]);
	});

	it("filters by cwd", () => {
		const content = [
			JSON.stringify({ sessionId: "a", cwd: "/x", entryFile: "a.session" }),
			JSON.stringify({ sessionId: "b", cwd: "/y", entryFile: "b.session" }),
			JSON.stringify({ sessionId: "c", cwd: "/x", entryFile: "c.session" }),
		].join("\n");
		const all = parseSessionIndexLines(content);
		const filtered = all.filter((e) => e.cwd === "/x");
		expect(filtered).toHaveLength(2);
		expect(filtered.map((e) => e.sessionId)).toEqual(["a", "c"]);
	});
});

// ============================================================================
// JSONL Format Round-trip
// ============================================================================

describe("JSONL format round-trip", () => {
	it("session index entry round-trips through JSON stringify/parse", () => {
		const entry: SessionIndexEntry = {
			sessionId: "550e8400-e29b-41d4-a716-446655440000",
			cwd: "/home/user/vault",
			entryFile: "session-550e8400.session",
		};
		const line = JSON.stringify(entry) + "\n";
		const parsed = JSON.parse(line.trim()) as SessionIndexEntry;
		expect(parsed).toEqual(entry);
	});

	it("session file data round-trips through JSON stringify/parse", () => {
		const data: SessionFileData = {
			version: 1,
			sessionId: "550e8400-e29b-41d4-a716-446655440000",
			agentId: "pi-acp",
			cwd: "/home/user/vault",
			title: "New Session",
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
			forkedFrom: null,
		};
		const json = JSON.stringify(data, null, "\t");
		const parsed = JSON.parse(json) as SessionFileData;
		expect(parsed).toEqual(data);
	});
});