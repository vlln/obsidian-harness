import { browser } from "@wdio/globals";

/**
 * E2E tests for Obsidian Harness.
 *
 * Tests run in a sandboxed Obsidian instance with the plugin installed.
 * The vault is a minimal empty vault at test/vaults/simple/.
 */

describe("Obsidian Harness Plugin", () => {
	/**
	 * AC-0002-N-1: Plugin loads and registers .session file extension.
	 */
	it("should load the plugin", async () => {
		const plugins = await browser.execute(() => {
			return Object.keys((window as any).app?.plugins?.plugins ?? {});
		});
		expect(plugins).toContain("obsidian-harness");
	});

	/**
	 * AC-0001-N-1: Create .session file via command.
	 */
	it("should create a .session file via command", async () => {
		const before = await browser.execute(async () => {
			const app = (window as any).app;
			const plugin = app?.plugins?.plugins?.["obsidian-harness"];
			await plugin?.settingsService?.updateSettings({
				sessionFolder: "Sessions",
			});
			const vault = app?.vault;
			if (!vault) return [];
			return vault.getFiles().map((f: any) => f.path);
		});

		// Execute the create-session-file command
		await browser.execute(() => {
			(window as any).app?.commands?.executeCommandById(
				"obsidian-harness:create-session-file",
			);
		});

		// Wait for vault to create the file
		await browser.pause(1000);

		// Check if the .session file exists in the default session folder
		const files = await browser.execute(() => {
			const vault = (window as any).app?.vault;
			if (!vault) return [];
			return vault.getFiles().map((f: any) => f.path);
		});

		const previous = new Set(before as string[]);
		const sessionFile = files.find(
			(f: string) => f.endsWith(".session") && !previous.has(f),
		);
		expect(sessionFile).toBeDefined();
		expect(sessionFile).toMatch(/^Sessions\/session-[0-9a-f]{8}\.session$/);
	});

	/**
	 * AC-0001-N-1: .session file content is valid JSON.
	 */
	it("should have valid JSON content in .session file", async () => {
		const data = await browser.execute(async () => {
			const app = (window as any).app;
			const plugin = app?.plugins?.plugins?.["obsidian-harness"];
			const vault = app?.vault;
			const materialized = await plugin.materializeSessionFile();
			const content = await vault.read(materialized.file);
			await vault.delete(materialized.file);
			return JSON.parse(content);
		});

		expect(data).toHaveProperty("version", 1);
		expect(data).toHaveProperty("entryId");
		expect(data).toHaveProperty("sessionId");
		expect(data).toHaveProperty("backendSessionId");
		expect(data).toHaveProperty("backendState");
		expect(data).toHaveProperty("agentId");
		expect(data).toHaveProperty("cwd");
		expect(data).toHaveProperty("title");
		expect(data).toHaveProperty("createdAt");
		expect(data).toHaveProperty("updatedAt");
	});

	/**
	 * AC-0001-B-2: entryId is UUID format.
	 */
	it("should create an unconnected session entry with a valid UUID entryId", async () => {
		const data = await browser.execute(async () => {
			const app = (window as any).app;
			const plugin = app?.plugins?.plugins?.["obsidian-harness"];
			const vault = app?.vault;
			const materialized = await plugin.materializeSessionFile();
			const content = await vault.read(materialized.file);
			await vault.delete(materialized.file);
			return JSON.parse(content);
		});

		expect(data.entryId).toMatch(
			/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
		);
		expect(data.sessionId).toBe("");
		expect(data.backendSessionId).toBe("");
		expect(data.backendState).toBe("unconnected");
	});

	/**
	 * AC-0001-B-1: Creating a second session file should succeed (different UUID).
	 * Duplicate detection only triggers on exact UUID collision.
	 */
	it("should create a second .session file with different name", async () => {
		// Get current file count
		const before = await browser.execute(() => {
			const vault = (window as any).app?.vault;
			return vault
				.getFiles()
				.filter((f: any) => f.path.endsWith(".session")).length;
		});

		// Create another session file
		await browser.execute(() => {
			(window as any).app?.commands?.executeCommandById(
				"obsidian-harness:create-session-file",
			);
		});

		await browser.pause(500);

		const after = await browser.execute(() => {
			const vault = (window as any).app?.vault;
			return vault
				.getFiles()
				.filter((f: any) => f.path.endsWith(".session")).length;
		});

		// File count should increase (new UUID = new file)
		expect(after).toBe(before + 1);
	});

	it("should create a .session file in a requested folder", async () => {
		const data = await browser.execute(async () => {
			const app = (window as any).app;
			const plugin = app?.plugins?.plugins?.["obsidian-harness"];
			const vault = app?.vault;
			const materialized = await plugin.materializeSessionFile({
				folder: "Projects/Alpha",
			});
			const path = materialized.file.path;
			await vault.delete(materialized.file);
			const alpha = vault.getAbstractFileByPath("Projects/Alpha");
			const projects = vault.getAbstractFileByPath("Projects");
			if (alpha) await vault.delete(alpha, true);
			if (projects) await vault.delete(projects, true);
			return { path };
		});

		expect(data.path).toMatch(
			/^Projects\/Alpha\/session-[0-9a-f]{8}\.session$/,
		);
	});

	/**
	 * All chat entry points materialize a .session file.
	 */
	it("should create a .session file when opening the chat view", async () => {
		await browser.execute(async () => {
			const app = (window as any).app;
			const leaves =
				app?.workspace?.getLeavesOfType("agent-client-chat-view") ?? [];
			for (const leaf of leaves) {
				await leaf.detach();
			}
		});

		const before = await browser.execute(() => {
			const vault = (window as any).app?.vault;
			return vault
				.getFiles()
				.filter((f: any) => f.path.endsWith(".session")).length;
		});

		await browser.execute(() => {
			(window as any).app?.commands?.executeCommandById(
				"obsidian-harness:open-chat-view",
			);
		});

		await browser.waitUntil(
			async () => {
				const count = await browser.execute(() => {
					const vault = (window as any).app?.vault;
					return vault
						.getFiles()
						.filter((f: any) => f.path.endsWith(".session")).length;
				});
				return count > before;
			},
			{ timeout: 5000, interval: 100 },
		);
	});

	it("should create a .session file when opening floating chat", async () => {
		const before = await browser.execute(() => {
			const vault = (window as any).app?.vault;
			return vault
				.getFiles()
				.filter((f: any) => f.path.endsWith(".session")).length;
		});

		await browser.execute(() => {
			const plugin = (window as any).app?.plugins?.plugins?.[
				"obsidian-harness"
			];
			plugin?.openNewFloatingChat(true);
		});

		await browser.waitUntil(
			async () => {
				const count = await browser.execute(() => {
					const vault = (window as any).app?.vault;
					return vault
						.getFiles()
						.filter((f: any) => f.path.endsWith(".session")).length;
				});
				return count > before;
			},
			{ timeout: 5000, interval: 100 },
		);
	});

	/**
	 * Regression: command-created .session files start with an empty agentId.
	 * The first open must still create an ACP session without requiring a tab switch.
	 */
	it("should initialize a command-created .session file on first open", async () => {
		const result = await browser.execute(async () => {
			const app = (window as any).app;
			const vault = app?.vault;
			if (!vault) return null;

			const before = new Set(
				vault
					.getFiles()
					.map((file: any) => file.path)
					.filter((path: string) => path.endsWith(".session")),
			);

			app.commands.executeCommandById(
				"obsidian-harness:create-session-file",
			);

			let sessionFilePath: string | null = null;
			let initialEntryId = "";
			for (let i = 0; i < 20; i += 1) {
				await new Promise((resolve) => window.setTimeout(resolve, 100));
				sessionFilePath =
					vault
						.getFiles()
						.map((file: any) => file.path)
						.find(
							(path: string) =>
								path.endsWith(".session") && !before.has(path),
						) ?? null;
				if (!sessionFilePath) continue;
				const file = vault.getAbstractFileByPath(sessionFilePath);
				const data = JSON.parse(await vault.read(file));
				initialEntryId = data.entryId;
				break;
			}

			if (!sessionFilePath) return null;
			const sessionFile = vault.getAbstractFileByPath(sessionFilePath);
			let finalData = JSON.parse(await vault.read(sessionFile));
			for (let i = 0; i < 50; i += 1) {
				await new Promise((resolve) => window.setTimeout(resolve, 100));
				finalData = JSON.parse(await vault.read(sessionFile));
				if (
					finalData.agentId &&
					finalData.sessionId &&
					finalData.backendSessionId &&
					finalData.backendState === "connected"
				) {
					break;
				}
			}

			await vault.delete(sessionFile);
			return { initialEntryId, finalData };
		});

		expect(result).not.toBeNull();
		expect(result!.finalData.agentId).toBeTruthy();
		expect(result!.finalData.entryId).toBe(result!.initialEntryId);
		expect(result!.finalData.sessionId).toBeTruthy();
		expect(result!.finalData.backendSessionId).toBe(
			result!.finalData.sessionId,
		);
		expect(result!.finalData.backendState).toBe("connected");
	});
});
