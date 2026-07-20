import { describe, expect, it } from "vitest";

import {
	parseSessionFileData,
	UnsupportedSessionEntryVersionError,
} from "../src/services/session-entry";
import {
	deriveContinuationState,
	executeContinuation,
} from "../src/services/session-continuation";
import { vi } from "vitest";
import type { SessionFileData } from "../src/types/session";

function entry(overrides: Partial<SessionFileData> = {}): SessionFileData {
	return {
		version: 2,
		entryId: "entry-1",
		historyId: "history-1",
		agentId: "pi-acp",
		cwd: "/project",
		title: "Session",
		createdAt: "2026-07-20T00:00:00.000Z",
		updatedAt: "2026-07-20T00:00:00.000Z",
		forkedFrom: null,
		...overrides,
	};
}

describe("session entry v2", () => {
	it("accepts stable local identities and an optional opaque ACP binding", () => {
		const value = entry({
			acpBinding: { agentId: "pi-acp", sessionId: "opaque" },
		});
		expect(parseSessionFileData(JSON.stringify(value))).toEqual(value);
	});

	it("rejects v1 explicitly without migration", () => {
		expect(() =>
			parseSessionFileData(JSON.stringify({ version: 1 })),
		).toThrow(UnsupportedSessionEntryVersionError);
		expect(() =>
			parseSessionFileData(JSON.stringify({ version: 1 })),
		).toThrow("Unsupported session version 1; requires version 2");
	});

	it.each(["entryId", "historyId", "cwd", "title"])(
		"rejects a missing %s",
		(field) => {
			const value = entry() as unknown as Record<string, unknown>;
			delete value[field];
			expect(() => parseSessionFileData(JSON.stringify(value))).toThrow(
				`Session entry field ${field} must be a string`,
			);
		},
	);

	it("rejects an invalid fork source", () => {
		expect(() =>
			parseSessionFileData(
				JSON.stringify(entry({ forkedFrom: 42 as unknown as string })),
			),
		).toThrow("Session entry field forkedFrom must be a string or null");
	});

	it("rejects legacy backend state fields as an unsupported v1 entry", () => {
		expect(() =>
			parseSessionFileData(
				JSON.stringify({
					version: 1,
					backendState: "imported",
					sessionId: "old",
				}),
			),
		).toThrow(UnsupportedSessionEntryVersionError);
	});
});

describe("continuation state", () => {
	it("is read-only when local history has no ACP binding", () => {
		expect(
			deriveContinuationState({
				entry: entry(),
				agentConfigured: true,
				cwdAvailable: true,
			}),
		).toMatchObject({ type: "read_only" });
	});

	it("is available only when binding, Agent and cwd are available", () => {
		expect(
			deriveContinuationState({
				entry: entry({
					acpBinding: { agentId: "pi-acp", sessionId: "opaque" },
				}),
				agentConfigured: true,
				cwdAvailable: true,
			}),
		).toEqual({ type: "available" });
	});

	it("reports missing Agent and cwd as backend availability failures", () => {
		const bound = entry({
			acpBinding: { agentId: "pi-acp", sessionId: "opaque" },
		});
		const missingAgent = deriveContinuationState({
			entry: bound,
			agentConfigured: false,
			cwdAvailable: true,
		});
		expect(missingAgent.type).toBe("backend_unavailable");
		if (missingAgent.type !== "backend_unavailable")
			throw new Error("Expected unavailable");
		expect(missingAgent.reason).toContain("Agent");
		const missingCwd = deriveContinuationState({
			entry: bound,
			agentConfigured: true,
			cwdAvailable: false,
		});
		expect(missingCwd.type).toBe("backend_unavailable");
		if (missingCwd.type !== "backend_unavailable")
			throw new Error("Expected unavailable");
		expect(missingCwd.reason).toContain("Working directory");
	});

	it("AC-0011-B-1/E-1: restore failure never falls back to a new session", async () => {
		const restoreSession = vi
			.fn()
			.mockRejectedValue(new Error("not found"));
		await expect(
			executeContinuation({ sessionId: "opaque" }, "/project", {
				restoreSession,
			}),
		).rejects.toThrow("not found");
		expect(restoreSession).toHaveBeenCalledOnce();
	});
});
