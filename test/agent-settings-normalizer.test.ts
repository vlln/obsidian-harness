import { describe, expect, it } from "vitest";

import {
	DEFAULT_AGENT_SETTINGS,
	generateUnoccupiedAgentId,
	normalizeAgents,
	resolveDefaultAgentId,
} from "../src/services/settings-normalizer";
import type { AgentSettings } from "../src/types/agent";

const EXPECTED_DEFAULT_AGENTS: AgentSettings[] = [
	{
		id: "claude-code-acp",
		displayName: "Claude Code",
		command: "claude-agent-acp",
		args: [],
		env: [],
		apiKeySecretId: "",
		apiKeyEnvVarName: "ANTHROPIC_API_KEY",
	},
	{
		id: "codex-acp",
		displayName: "Codex",
		command: "codex-acp",
		args: [],
		env: [],
		apiKeySecretId: "",
		apiKeyEnvVarName: "OPENAI_API_KEY",
	},
	{
		id: "gemini-cli",
		displayName: "Gemini CLI",
		command: "gemini",
		args: ["--experimental-acp"],
		env: [],
		apiKeySecretId: "",
		apiKeyEnvVarName: "GEMINI_API_KEY",
	},
	{
		id: "pi-acp",
		displayName: "Pi",
		command: "pi-acp",
		args: [],
		env: [],
		apiKeySecretId: "",
		apiKeyEnvVarName: "",
	},
];

describe("AC-0028: unified agents[] loading and normalization", () => {
	it("AC-0028-N-1: missing agents key falls back to the four built-in defaults from Spec-0008 §4.3", () => {
		const agents = normalizeAgents(undefined, DEFAULT_AGENT_SETTINGS);
		expect(agents).toEqual(EXPECTED_DEFAULT_AGENTS);
		// defaultAgentId default stays claude-code-acp and resolves against the array
		expect(resolveDefaultAgentId("claude-code-acp", agents)).toBe(
			"claude-code-acp",
		);
		// pi-acp is a plain entry — present without any path probing
		expect(agents.map((agent) => agent.id)).toContain("pi-acp");
		// The fallback is a deep copy: mutating it must not touch the defaults
		agents[0].args.push("--mutated");
		expect(DEFAULT_AGENT_SETTINGS[0].args).toEqual([]);
	});

	it("AC-0028-N-2: a user-added entry loads with its original values", () => {
		const raw = {
			agents: [
				...EXPECTED_DEFAULT_AGENTS,
				{
					id: "my-agent",
					displayName: "My Agent",
					command: "/usr/local/bin/my-acp",
					args: ["--fast"],
					env: [{ key: "MY_FLAG", value: "1" }],
					apiKeySecretId: "my-secret",
					apiKeyEnvVarName: "MY_API_KEY",
				},
			],
		};
		const agents = normalizeAgents(raw.agents, DEFAULT_AGENT_SETTINGS);
		expect(agents).toHaveLength(5);
		expect(agents[4]).toEqual({
			id: "my-agent",
			displayName: "My Agent",
			command: "/usr/local/bin/my-acp",
			args: ["--fast"],
			env: [{ key: "MY_FLAG", value: "1" }],
			apiKeySecretId: "my-secret",
			apiKeyEnvVarName: "MY_API_KEY",
		});
	});

	it.each([
		["an object", { id: "claude-code-acp" }],
		["a string", "claude-code-acp"],
		["a number", 42],
		["null", null],
	])(
		"AC-0028-B-1: agents stored as %s falls back to the four built-in defaults",
		(_label, value) => {
			expect(normalizeAgents(value, DEFAULT_AGENT_SETTINGS)).toEqual(
				EXPECTED_DEFAULT_AGENTS,
			);
		},
	);

	it("AC-0028-B-1: entry fields with wrong types fall back per-field, entry itself is kept", () => {
		const raw = [
			{
				id: 42,
				displayName: 7,
				command: { path: "gemini" },
				args: "--fast\n--safe",
				env: { MY_FLAG: "1" },
				apiKeySecretId: null,
				apiKeyEnvVarName: 5,
			},
		];
		const agents = normalizeAgents(raw, DEFAULT_AGENT_SETTINGS);
		expect(agents).toHaveLength(1);
		expect(agents[0]).toEqual({
			// Empty/missing id is regenerated as an unoccupied custom-agent-N id
			id: "custom-agent",
			displayName: "",
			command: "",
			args: ["--fast", "--safe"],
			env: [{ key: "MY_FLAG", value: "1" }],
			apiKeySecretId: "",
			apiKeyEnvVarName: "",
		});
	});

	it("AC-0028-B-1: non-object entries are kept with per-field defaults", () => {
		const agents = normalizeAgents(["bogus"], DEFAULT_AGENT_SETTINGS);
		expect(agents).toHaveLength(1);
		expect(agents[0]).toEqual({
			id: "custom-agent",
			displayName: "",
			command: "",
			args: [],
			env: [],
			apiKeySecretId: "",
			apiKeyEnvVarName: "",
		});
	});

	it("AC-0028-B-2: duplicate ids keep the first entry and drop later ones", () => {
		const raw = [
			{ id: "a", displayName: "first" },
			{ id: "b", displayName: "other" },
			{ id: "a", displayName: "duplicate" },
		];
		const agents = normalizeAgents(raw, DEFAULT_AGENT_SETTINGS);
		expect(agents.map((agent) => agent.id)).toEqual(["a", "b"]);
		expect(agents[0].displayName).toBe("first");
	});

	it("AC-0028-E-1: legacy schema fields are ignored — not read, not migrated, not written back", () => {
		const raw = {
			// Legacy schema (BR-074): must be silently ignored
			claude: {
				id: "claude-code-acp",
				displayName: "Legacy Claude",
				command: "/legacy/claude",
				apiKeySecretId: "legacy-secret",
				apiKey: "sk-legacy-plaintext",
			},
			codex: { id: "codex-acp", command: "/legacy/codex" },
			gemini: { id: "gemini-cli", command: "/legacy/gemini" },
			customAgents: [{ id: "legacy-custom", command: "/legacy/custom" }],
			apiKey: "sk-legacy-plaintext",
			agents: [{ id: "my-agent", command: "my-acp" }],
		};
		const agents = normalizeAgents(raw.agents, DEFAULT_AGENT_SETTINGS);
		// Only the new agents[] source is read
		expect(agents.map((agent) => agent.id)).toEqual(["my-agent"]);
		// Every entry carries exactly the seven unified fields — no legacy keys leak in
		for (const agent of agents) {
			expect(Object.keys(agent).sort()).toEqual(
				[
					"id",
					"displayName",
					"command",
					"args",
					"env",
					"apiKeySecretId",
					"apiKeyEnvVarName",
				].sort(),
			);
		}
		// What gets written back to data.json contains no legacy fields and no plaintext keys
		const writtenBack = JSON.stringify({ agents });
		expect(writtenBack).not.toContain("customAgents");
		expect(writtenBack).not.toContain("apiKey\"");
		expect(writtenBack).not.toContain("sk-legacy-plaintext");
	});

	it("AC-0028-F-1: a dangling defaultAgentId falls back to the first entry", () => {
		const agents = normalizeAgents(
			[{ id: "a" }, { id: "b" }],
			DEFAULT_AGENT_SETTINGS,
		);
		expect(resolveDefaultAgentId("missing-agent", agents)).toBe("a");
		expect(resolveDefaultAgentId("b", agents)).toBe("b");
	});

	it("AC-0028-F-1: an empty agents array yields an empty defaultAgentId and stays empty", () => {
		const agents = normalizeAgents([], DEFAULT_AGENT_SETTINGS);
		expect(agents).toEqual([]);
		expect(resolveDefaultAgentId("claude-code-acp", agents)).toBe("");
	});
});

describe("AC-0029-B-1: agent id auto-generation (BR-069)", () => {
	it("generates custom-agent-N ids that are not already occupied", () => {
		expect(generateUnoccupiedAgentId([])).toBe("custom-agent");
		expect(generateUnoccupiedAgentId([{ id: "custom-agent" }])).toBe(
			"custom-agent-2",
		);
		expect(
			generateUnoccupiedAgentId([
				{ id: "custom-agent" },
				{ id: "custom-agent-2" },
			]),
		).toBe("custom-agent-3");
		expect(
			generateUnoccupiedAgentId([
				{ id: "claude-code-acp" },
				{ id: "custom-agent-2" },
			]),
		).toBe("custom-agent");
	});

	it("normalization assigns generated ids without collisions", () => {
		const agents = normalizeAgents(
			[{ id: "custom-agent" }, { id: "" }, { command: "x" }],
			DEFAULT_AGENT_SETTINGS,
		);
		expect(agents.map((agent) => agent.id)).toEqual([
			"custom-agent",
			"custom-agent-2",
			"custom-agent-3",
		]);
	});
});
