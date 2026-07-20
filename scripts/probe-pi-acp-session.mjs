#!/usr/bin/env node
import * as acp from "@agentclientprotocol/sdk";
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const cwd = resolve(process.argv[2] ?? process.cwd());
const children = new Set();

function spawnPiAcp() {
	const child = spawn("pi-acp", [], {
		cwd,
		stdio: ["pipe", "pipe", "pipe"],
		env: process.env,
	});
	children.add(child);

	child.stderr.on("data", (chunk) => {
		process.stderr.write(`[pi-acp stderr] ${chunk}`);
	});

	if (!child.stdin || !child.stdout) {
		throw new Error("pi-acp stdio unavailable");
	}

	const input = new WritableStream({
		write(chunk) {
			child.stdin.write(chunk);
		},
		close() {
			child.stdin.end();
		},
	});
	const output = new ReadableStream({
		start(controller) {
			child.stdout.on("data", (chunk) => controller.enqueue(chunk));
			child.stdout.on("end", () => controller.close());
		},
	});

	const updates = [];
	const app = acp
		.client({ name: "obsidian-harness-probe" })
		.onNotification("session/update", (ctx) => {
			updates.push(ctx.params);
			console.log("[update]", JSON.stringify(ctx.params));
		})
		.onRequest("session/request_permission", () => ({
			outcome: { outcome: "cancelled" },
		}));

	const connection = app.connect(acp.ndJsonStream(input, output));

	return { child, connection, updates };
}

async function init(connection) {
	return await connection.agent.request("initialize", {
		protocolVersion: acp.PROTOCOL_VERSION,
		clientCapabilities: {
			fs: { readTextFile: false, writeTextFile: false },
			terminal: false,
		},
		clientInfo: {
			name: "obsidian-harness-probe",
			title: "Obsidian Harness Probe",
			version: "0.0.0",
		},
	});
}

async function stop(child) {
	child.kill("SIGTERM");
	await delay(1000);
	if (child.exitCode === null) {
		child.kill("SIGKILL");
	}
	children.delete(child);
}

async function main() {
	console.log("[probe] cwd", cwd);

	const first = spawnPiAcp();
	const initResult = await init(first.connection);
	console.log("[probe] init", JSON.stringify(initResult.agentCapabilities));

	const created = await first.connection.agent.request("session/new", {
		cwd,
		mcpServers: [],
	});
	const sessionId = created.sessionId;
	console.log("[probe] new sessionId", sessionId);

	await first.connection.agent.request("session/prompt", {
		sessionId,
		prompt: [{ type: "text", text: "hi" }],
	});
	console.log("[probe] first prompt updates", first.updates.length);
	await delay(1000);
	await stop(first.child);

	const second = spawnPiAcp();
	await init(second.connection);
	await second.connection.agent.request("session/load", {
		sessionId,
		cwd,
		mcpServers: [],
	});
	console.log("[probe] load replay updates", second.updates.length);
	await second.connection.agent.request("session/prompt", {
		sessionId,
		prompt: [{ type: "text", text: "我刚刚说了什么" }],
	});
	console.log("[probe] second prompt updates", second.updates.length);
	await delay(1000);
	await stop(second.child);
}

main().catch((error) => {
	console.error(error);
	for (const child of children) {
		child.kill("SIGTERM");
	}
	process.exitCode = 1;
});
