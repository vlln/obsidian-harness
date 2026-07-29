import { EventEmitter } from "node:events";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AcpClient, type AgentConfig } from "../src/acp/acp-client";
import type HarnessPlugin from "../src/plugin";
import { MemorySecretStorage } from "./stubs/obsidian";
import { initializeLogger } from "../src/utils/logger";

const SECRET_VALUE = "sk-test-secret-value";

/**
 * Capture the spawn env without letting a real process start: the fake
 * process has no stdin/stdout, so initialize() aborts right after spawn
 * with "Agent process stdin/stdout not available".
 */
const spawnSpy = vi.fn();

vi.mock("child_process", () => ({
	spawn: (...args: unknown[]) => {
		spawnSpy(...args);
		const fake = new EventEmitter() as EventEmitter & {
			stdin: null;
			stdout: null;
			stderr: null;
			pid: number;
		};
		fake.stdin = null;
		fake.stdout = null;
		fake.stderr = null;
		fake.pid = 4242;
		return fake;
	},
	ChildProcess: class {},
}));

function createConfig(overrides: Partial<AgentConfig> = {}): AgentConfig {
	return {
		id: "my-agent",
		displayName: "My Agent",
		command: "my-acp",
		args: [],
		env: {},
		workingDirectory: "/vault",
		...overrides,
	};
}

function spawnEnv(): NodeJS.ProcessEnv {
	const call = spawnSpy.mock.calls[0];
	return (call[2] as { env: NodeJS.ProcessEnv }).env;
}

describe("AC-0030: API key secret injection at spawn", () => {
	let secretStorage: MemorySecretStorage;
	let client: AcpClient;

	beforeEach(() => {
		spawnSpy.mockClear();
		initializeLogger({ debugMode: false });
		secretStorage = new MemorySecretStorage({
			"my-secret": SECRET_VALUE,
		});
		const fakePlugin = {
			settings: {
				autoAllowPermissions: false,
				windowsWslMode: false,
				nodePath: "",
			},
			app: { secretStorage },
		} as unknown as HarnessPlugin;
		client = new AcpClient(fakePlugin);
	});

	it("AC-0030-N-1: resolves the secret just before spawn and injects it under the entry's own env var name", async () => {
		const config = createConfig({
			env: { MY_FLAG: "1" },
			apiKey: { secretId: "my-secret", envVarName: "MY_API_KEY" },
		});
		await expect(client.initialize(config)).rejects.toThrow(
			"stdin/stdout not available",
		);
		expect(spawnSpy).toHaveBeenCalledTimes(1);
		expect(spawnEnv().MY_API_KEY).toBe(SECRET_VALUE);
		expect(spawnEnv().MY_FLAG).toBe("1");
		expect(secretStorage.calls).toEqual([
			{ operation: "getSecret", id: "my-secret" },
		]);
	});

	it("AC-0030-B-1: without an injection intent no secret storage read happens", async () => {
		await expect(client.initialize(createConfig())).rejects.toThrow(
			"stdin/stdout not available",
		);
		expect(secretStorage.calls).toEqual([]);
		expect(spawnEnv().MY_API_KEY).toBeUndefined();
	});

	it("AC-0030-B-2: the injected value overrides a same-named manual env entry (BR-073)", async () => {
		const config = createConfig({
			env: { MY_API_KEY: "manual-value" },
			apiKey: { secretId: "my-secret", envVarName: "MY_API_KEY" },
		});
		await expect(client.initialize(config)).rejects.toThrow(
			"stdin/stdout not available",
		);
		// The child process receives only the injected value
		expect(spawnEnv().MY_API_KEY).toBe(SECRET_VALUE);
	});

	it("AC-0030-E-1: a deleted secret follows the existing missing-key semantics; other entries stay unaffected", async () => {
		// The referenced secret was removed from the Keychain by the user.
		const config = createConfig({
			apiKey: { secretId: "deleted-secret", envVarName: "MY_API_KEY" },
		});
		await expect(client.initialize(config)).rejects.toThrow(
			"stdin/stdout not available",
		);
		expect(secretStorage.calls).toEqual([
			{ operation: "getSecret", id: "deleted-secret" },
		]);
		// Existing behavior: an empty value is injected and the backend's own
		// auth/login error path reports the problem — the plugin does not crash.
		expect(spawnEnv().MY_API_KEY).toBe("");

		// Another entry with a valid secret still injects correctly afterwards.
		spawnSpy.mockClear();
		const other = createConfig({
			id: "other-agent",
			apiKey: { secretId: "my-secret", envVarName: "MY_API_KEY" },
		});
		await expect(client.initialize(other)).rejects.toThrow(
			"stdin/stdout not available",
		);
		expect(spawnEnv().MY_API_KEY).toBe(SECRET_VALUE);
	});

	it("AC-0030-F-1: a secretStorage read failure aborts before spawn and never leaks the plaintext", async () => {
		initializeLogger({ debugMode: true });
		const debugSpy = vi
			.spyOn(console, "debug")
			.mockImplementation(() => undefined);
		const errorSpy = vi
			.spyOn(console, "error")
			.mockImplementation(() => undefined);
		try {
			secretStorage.failNext("getSecret", {
				error: new Error("keychain unavailable"),
			});
			const config = createConfig({
				apiKey: { secretId: "my-secret", envVarName: "MY_API_KEY" },
			});
			await expect(client.initialize(config)).rejects.toThrow(
				"keychain unavailable",
			);
			// Spawn never happened
			expect(spawnSpy).not.toHaveBeenCalled();
			// Logs carry the secretId reference at most, never the plaintext
			const logged = [...debugSpy.mock.calls, ...errorSpy.mock.calls]
				.map((args) => args.map(String).join(" "))
				.join("\n");
			expect(logged).not.toContain(SECRET_VALUE);
			// The persisted reference contains only the secretId, not the value
			expect(JSON.stringify(config)).toContain("my-secret");
			expect(JSON.stringify(config)).not.toContain(SECRET_VALUE);
		} finally {
			debugSpy.mockRestore();
			errorSpy.mockRestore();
		}
	});
});
