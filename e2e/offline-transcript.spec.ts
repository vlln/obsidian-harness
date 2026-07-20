import { browser } from "@wdio/globals";

async function getSessionViewSnapshot(path: string) {
	return browser.execute((entryPath) => {
		const app = (window as any).app;
		const leaf = app.workspace
			.getLeavesOfType("harness-session-view")
			.find((candidate: any) => candidate.view.file?.path === entryPath);
		return leaf
			? {
					text: leaf.view.containerEl.innerText as string,
					hasInput: Boolean(
						leaf.view.containerEl.querySelector(
							".agent-client-chat-input-container",
						),
					),
				}
			: null;
	}, path);
}

describe("offline transcript workspace", () => {
	before(async () => {
		await browser.execute(async () => {
			const app = (window as any).app;
			const plugin = app.plugins.plugins["obsidian-harness"];
			if (!app.vault.getAbstractFileByPath("Sessions")) {
				await app.vault.createFolder("Sessions");
			}
			const old = app.vault.getAbstractFileByPath(
				"Sessions/offline-fixture.session",
			);
			if (old) await app.vault.delete(old);
			await app.vault.create(
				"Sessions/offline-fixture.session",
				JSON.stringify({
					version: 2,
					entryId: "offline-entry",
					historyId: "offline-history",
					agentId: "",
					title: "Offline fixture",
					cwd: "/missing/offline/project",
					createdAt: "2026-07-20T00:00:00.000Z",
					updatedAt: "2026-07-20T00:01:00.000Z",
					forkedFrom: null,
				}),
			);
			await plugin.settingsService.initializeTranscript(
				"offline-history",
				{
					agentId: "",
					cwd: "/missing/offline/project",
					title: "Offline fixture",
					createdAt: "2026-07-20T00:00:00.000Z",
				},
			);
			const base = `${app.vault.configDir}/plugins/obsidian-harness/sessions/offline-history`;
			await app.vault.adapter.write(
				`${base}/turns.jsonl`,
				`${JSON.stringify({
					schemaVersion: 2,
					turnId: "offline-turn",
					startedAt: "2026-07-20T00:00:00.000Z",
					endedAt: "2026-07-20T00:01:00.000Z",
					status: "completed",
					prompt: [{ type: "text", text: "Offline prompt" }],
					items: [
						{
							type: "assistant_message",
							itemId: "offline-item",
							text: "Offline answer",
						},
					],
					stopReason: "end_turn",
				})}\n`,
			);
		});
	});

	after(async () => {
		await browser.execute(async () => {
			const app = (window as any).app;
			const plugin = app.plugins.plugins["obsidian-harness"];
			const file = app.vault.getAbstractFileByPath(
				"Sessions/offline-fixture.session",
			);
			if (file) await app.vault.delete(file);
			for (const path of [
				"Sessions/v1-fixture.session",
				"Sessions/missing-history.session",
				"Sessions/continuable-fixture.session",
				"Sessions/successful-continuation-fixture.session",
				"Sessions/unavailable-fixture.session",
			]) {
				const extra = app.vault.getAbstractFileByPath(path);
				if (extra) await app.vault.delete(extra);
			}
			await plugin.settingsService.deleteTranscript("offline-history");
		});
	});

	it("AC-0007-N-1/B-1 and AC-0010-B-1: opens missing-cwd history without starting an Agent", async () => {
		await browser.execute(async () => {
			const app = (window as any).app;
			const file = app.vault.getAbstractFileByPath(
				"Sessions/offline-fixture.session",
			);
			await app.workspace.getLeaf(true).openFile(file);
		});
		await browser.waitUntil(
			async () =>
				(
					await getSessionViewSnapshot(
						"Sessions/offline-fixture.session",
					)
				)?.text.includes("Read-only history") ?? false,
			{ timeout: 5000 },
		);
		const snapshot = await getSessionViewSnapshot(
			"Sessions/offline-fixture.session",
		);
		expect(snapshot?.text).toContain("Offline prompt");
		expect(snapshot?.text).toContain("Offline answer");
		expect(snapshot?.hasInput).toBe(false);

		const initialized = await browser.execute(() => {
			const plugin = (window as any).app.plugins.plugins[
				"obsidian-harness"
			];
			return [...plugin._acpClients.values()].some((client: any) =>
				client.isInitialized(),
			);
		});
		expect(initialized).toBe(false);
	});

	it("AC-0010-N-1: offers continuation with the binding Agent without connecting", async () => {
		await browser.execute(async () => {
			const app = (window as any).app;
			const old = app.vault.getAbstractFileByPath(
				"Sessions/continuable-fixture.session",
			);
			if (old) await app.vault.delete(old);
			const cwd = app.vault.adapter.getBasePath();
			const file = await app.vault.create(
				"Sessions/continuable-fixture.session",
				JSON.stringify({
					version: 2,
					entryId: "continuable-entry",
					historyId: "offline-history",
					agentId: "codex-acp",
					acpBinding: {
						agentId: "claude-code-acp",
						sessionId: "opaque-session",
					},
					cwd,
					title: "Continuable history",
					createdAt: "2026-07-20T00:00:00.000Z",
					updatedAt: "2026-07-20T00:00:00.000Z",
					forkedFrom: null,
				}),
			);
			await app.workspace.getLeaf(true).openFile(file);
		});

		await browser.waitUntil(
			async () =>
				(
					await getSessionViewSnapshot(
						"Sessions/continuable-fixture.session",
					)
				)?.text.includes("Ready to continue") ?? false,
			{ timeout: 5000 },
		);
		const snapshot = await getSessionViewSnapshot(
			"Sessions/continuable-fixture.session",
		);
		expect(snapshot?.text).toContain("Claude Code");
		expect(snapshot?.text).toContain("Offline prompt");
		expect(snapshot?.hasInput).toBe(false);
		const initialized = await browser.execute(() => {
			const plugin = (window as any).app.plugins.plugins[
				"obsidian-harness"
			];
			return [...plugin._acpClients.values()].some((client: any) =>
				client.isInitialized(),
			);
		});
		expect(initialized).toBe(false);
	});

	it("AC-0011-N-1/B-1: explicit continuation restores the opaque binding without creating a session", async () => {
		const before = await browser.execute(async () => {
			const app = (window as any).app;
			const path = "Sessions/successful-continuation-fixture.session";
			const old = app.vault.getAbstractFileByPath(path);
			if (old) await app.vault.delete(old);
			const file = await app.vault.create(
				path,
				JSON.stringify({
					version: 2,
					entryId: "successful-entry",
					historyId: "offline-history",
					agentId: "codex-acp",
					acpBinding: {
						agentId: "claude-code-acp",
						sessionId: "opaque-session",
					},
					cwd: app.vault.adapter.getBasePath(),
					title: "Successful continuation",
					createdAt: "2026-07-20T00:00:00.000Z",
					updatedAt: "2026-07-20T00:00:00.000Z",
					forkedFrom: null,
				}),
			);
			const leaf = app.workspace.getLeaf(true);
			await leaf.openFile(file);
			const client = leaf.view.acpClient;
			app.workspace.setActiveLeaf(leaf, { focus: true });
			client.__originalIsInitialized = client.isInitialized;
			client.__originalInitialize = client.initialize;
			client.__originalResumeSession = client.resumeSession;
			client.__originalNewSession = client.newSession;
			client.isInitialized = () => false;
			client.initialize = async () => ({
				agentCapabilities: {
					sessionCapabilities: { resume: true },
				},
			});
			client.__resumeCalls = [];
			client.resumeSession = async (sessionId: string, cwd: string) => {
				client.__resumeCalls.push({ sessionId, cwd });
				return { sessionId };
			};
			client.__newSessionCalls = 0;
			client.newSession = async () => {
				client.__newSessionCalls += 1;
				throw new Error("newSession must not be called");
			};
			const entry = JSON.parse(await app.vault.read(file));
			leaf.view.containerEl
				.querySelector(".agent-client-continuation-status button")
				.click();
			return entry;
		});

		await browser.waitUntil(
			async () =>
				(
					await getSessionViewSnapshot(
						"Sessions/successful-continuation-fixture.session",
					)
				)?.text.includes("Connected") ?? false,
			{ timeout: 5000 },
		);
		const result = await browser.execute(async () => {
			const app = (window as any).app;
			const path = "Sessions/successful-continuation-fixture.session";
			const leaf = app.workspace
				.getLeavesOfType("harness-session-view")
				.find((candidate: any) => candidate.view.file?.path === path);
			const file = app.vault.getAbstractFileByPath(path);
			const client = leaf.view.acpClient;
			const result = {
				entry: JSON.parse(await app.vault.read(file)),
				resumeCalls: client.__resumeCalls,
				newSessionCalls: client.__newSessionCalls,
			};
			client.isInitialized = client.__originalIsInitialized;
			client.initialize = client.__originalInitialize;
			client.resumeSession = client.__originalResumeSession;
			client.newSession = client.__originalNewSession;
			return result;
		});
		expect(result.resumeCalls).toEqual([
			{
				sessionId: "opaque-session",
				cwd: expect.any(String),
			},
		]);
		expect(result.newSessionCalls).toBe(0);
		expect(result.entry.entryId).toBe(before.entryId);
		expect(result.entry.historyId).toBe(before.historyId);
		expect(result.entry.acpBinding).toEqual(before.acpBinding);
		expect(
			(
				await getSessionViewSnapshot(
					"Sessions/successful-continuation-fixture.session",
				)
			)?.hasInput,
		).toBe(true);
	});

	it("AC-0010-F-1 and AC-0011-E-1/F-1: failed continuation preserves local identities and never creates a session", async () => {
		const before = await browser.execute(async () => {
			const app = (window as any).app;
			const leaf = app.workspace
				.getLeavesOfType("harness-session-view")
				.find(
					(candidate: any) =>
						candidate.view.file?.path ===
						"Sessions/continuable-fixture.session",
				);
			app.workspace.setActiveLeaf(leaf, { focus: true });
			const client = leaf.view.acpClient;
			client.__originalIsInitialized = client.isInitialized;
			client.__originalGetCurrentAgentId = client.getCurrentAgentId;
			client.__originalNewSession = client.newSession;
			client.isInitialized = () => true;
			client.getCurrentAgentId = () => "claude-code-acp";
			client.__newSessionCalls = 0;
			client.newSession = async () => {
				client.__newSessionCalls += 1;
				throw new Error("newSession must not be called");
			};
			const file = app.vault.getAbstractFileByPath(
				"Sessions/continuable-fixture.session",
			);
			const entry = JSON.parse(await app.vault.read(file));
			leaf.view.containerEl
				.querySelector(".agent-client-continuation-status button")
				.click();
			return entry;
		});

		await browser.waitUntil(
			async () => {
				const text = (
					await getSessionViewSnapshot(
						"Sessions/continuable-fixture.session",
					)
				)?.text;
				return Boolean(
					text?.includes("Backend unavailable") &&
						text.includes("Session restoration is not supported") &&
						text.includes("Offline answer"),
				);
			},
			{ timeout: 5000 },
		);
		const result = await browser.execute(async () => {
			const app = (window as any).app;
			const leaf = app.workspace
				.getLeavesOfType("harness-session-view")
				.find(
					(candidate: any) =>
						candidate.view.file?.path ===
						"Sessions/continuable-fixture.session",
				);
			const file = app.vault.getAbstractFileByPath(
				"Sessions/continuable-fixture.session",
			);
			const result = {
				entry: JSON.parse(await app.vault.read(file)),
				newSessionCalls: leaf.view.acpClient.__newSessionCalls,
			};
			const client = leaf.view.acpClient;
			client.isInitialized = client.__originalIsInitialized;
			client.getCurrentAgentId = client.__originalGetCurrentAgentId;
			client.newSession = client.__originalNewSession;
			return result;
		});
		expect(result.entry.entryId).toBe(before.entryId);
		expect(result.entry.historyId).toBe(before.historyId);
		expect(result.entry.acpBinding).toEqual(before.acpBinding);
		expect(result.newSessionCalls).toBe(0);
		expect(
			(
				await getSessionViewSnapshot(
					"Sessions/continuable-fixture.session",
				)
			)?.text,
		).toContain("Offline answer");
	});

	it("AC-0010-E-1: keeps history visible when the binding Agent is unavailable", async () => {
		await browser.execute(async () => {
			const app = (window as any).app;
			const old = app.vault.getAbstractFileByPath(
				"Sessions/unavailable-fixture.session",
			);
			if (old) await app.vault.delete(old);
			const file = await app.vault.create(
				"Sessions/unavailable-fixture.session",
				JSON.stringify({
					version: 2,
					entryId: "unavailable-entry",
					historyId: "offline-history",
					agentId: "codex-acp",
					acpBinding: {
						agentId: "missing-agent",
						sessionId: "opaque-session",
					},
					cwd: app.vault.adapter.getBasePath(),
					title: "Unavailable history",
					createdAt: "2026-07-20T00:00:00.000Z",
					updatedAt: "2026-07-20T00:00:00.000Z",
					forkedFrom: null,
				}),
			);
			await app.workspace.getLeaf(true).openFile(file);
		});

		await browser.waitUntil(
			async () => {
				const text = (
					await getSessionViewSnapshot(
						"Sessions/unavailable-fixture.session",
					)
				)?.text;
				return Boolean(
					text?.includes("Backend unavailable") &&
						text.includes('Agent "missing-agent" is not configured'),
				);
			},
			{ timeout: 5000 },
		);
		const snapshot = await getSessionViewSnapshot(
			"Sessions/unavailable-fixture.session",
		);
		expect(snapshot?.text).toContain("Offline answer");
		expect(snapshot?.hasInput).toBe(false);
	});

	it("AC-0007-B-2: rejects a v1 entry without starting an Agent", async () => {
		await browser.execute(async () => {
			const app = (window as any).app;
			const old = app.vault.getAbstractFileByPath(
				"Sessions/v1-fixture.session",
			);
			if (old) await app.vault.delete(old);
			const file = await app.vault.create(
				"Sessions/v1-fixture.session",
				JSON.stringify({ version: 1, sessionId: "legacy" }),
			);
			await app.workspace.getLeaf(true).openFile(file);
		});
		await browser.waitUntil(
			async () =>
				(await browser.$(".harness-error").getText()).includes(
					"Unsupported session version 1; requires version 2",
				),
			{ timeout: 5000 },
		);
		const initialized = await browser.execute(() => {
			const plugin = (window as any).app.plugins.plugins[
				"obsidian-harness"
			];
			return [...plugin._acpClients.values()].some((client: any) =>
				client.isInitialized(),
			);
		});
		expect(initialized).toBe(false);
	});

	it("AC-0007-F-1: reports a missing transcript instead of an empty valid history", async () => {
		await browser.execute(async () => {
			const app = (window as any).app;
			const old = app.vault.getAbstractFileByPath(
				"Sessions/missing-history.session",
			);
			if (old) await app.vault.delete(old);
			const file = await app.vault.create(
				"Sessions/missing-history.session",
				JSON.stringify({
					version: 2,
					entryId: "missing-entry",
					historyId: "missing-history",
					agentId: "",
					cwd: "/missing/project",
					title: "Missing history",
					createdAt: "2026-07-20T00:00:00.000Z",
					updatedAt: "2026-07-20T00:00:00.000Z",
					forkedFrom: null,
				}),
			);
			await app.workspace.getLeaf(true).openFile(file);
		});
		await browser.waitUntil(
			async () =>
				(
					await getSessionViewSnapshot(
						"Sessions/missing-history.session",
					)
				)?.text.includes(
					"Local history is unavailable: missing-history",
				) ?? false,
			{ timeout: 5000 },
		);
	});
});
