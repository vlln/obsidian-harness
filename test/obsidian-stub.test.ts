import { describe, expect, it } from "vitest";

import { MemorySecretStorage, Platform } from "./stubs/obsidian";

describe("MemorySecretStorage", () => {
	it("roundtrips secrets through set/get/delete", () => {
		const storage = new MemorySecretStorage();
		expect(storage.getSecret("api-key")).toBeNull();

		storage.setSecret("api-key", "sk-123");
		expect(storage.getSecret("api-key")).toBe("sk-123");

		storage.setSecret("api-key", "sk-456");
		expect(storage.getSecret("api-key")).toBe("sk-456");

		storage.deleteSecret("api-key");
		expect(storage.getSecret("api-key")).toBeNull();
	});

	it("seeds initial state and exports it back", () => {
		const storage = new MemorySecretStorage({ "api-key": "sk-123" });
		expect(storage.getSecret("api-key")).toBe("sk-123");
		expect(storage.exportState()).toEqual({ "api-key": "sk-123" });
	});

	it("failNext injects a failure that fires exactly once", () => {
		const storage = new MemorySecretStorage({ "api-key": "sk-123" });
		storage.failNext("getSecret");

		expect(() => storage.getSecret("api-key")).toThrow(
			"Injected getSecret failure",
		);
		expect(storage.getSecret("api-key")).toBe("sk-123");
	});

	it("failOnOccurrence skips calls before the armed occurrence", () => {
		const storage = new MemorySecretStorage({ "api-key": "sk-123" });
		storage.failOnOccurrence("getSecret", 2, {
			error: new Error("boom"),
		});

		expect(storage.getSecret("api-key")).toBe("sk-123");
		expect(() => storage.getSecret("api-key")).toThrow("boom");
		expect(storage.getSecret("api-key")).toBe("sk-123");
	});

	it("scopes injected failures to the matching id", () => {
		const storage = new MemorySecretStorage({
			"api-key": "sk-123",
			other: "value",
		});
		storage.failNext("getSecret", { id: "api-key" });

		expect(storage.getSecret("other")).toBe("value");
		expect(() => storage.getSecret("api-key")).toThrow(
			"Injected getSecret failure",
		);
		expect(storage.getSecret("api-key")).toBe("sk-123");
	});

	it("rejects invalid failure occurrences", () => {
		const storage = new MemorySecretStorage();
		expect(() => storage.failOnOccurrence("getSecret", 0)).toThrow(
			"Failure occurrence must be a positive integer",
		);
	});

	it("records every invocation in order, including failed ones", () => {
		const storage = new MemorySecretStorage();
		storage.setSecret("api-key", "sk-123");
		storage.failNext("getSecret");
		expect(() => storage.getSecret("api-key")).toThrow();
		storage.deleteSecret("api-key");

		expect(storage.calls).toEqual([
			{ operation: "setSecret", id: "api-key" },
			{ operation: "getSecret", id: "api-key" },
			{ operation: "deleteSecret", id: "api-key" },
		]);
	});
});

describe("Platform stub", () => {
	it("keeps the existing flags mutable for backward compatibility", () => {
		expect(Platform.isDesktopApp).toBe(true);
		const original = Platform.isWin;
		Platform.isWin = true;
		expect(Platform.isWin).toBe(true);
		Platform.isWin = original;
	});
});
