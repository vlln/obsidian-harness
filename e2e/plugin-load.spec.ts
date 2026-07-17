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
			return Object.keys(
				(window as any).app?.plugins?.plugins ?? {},
			);
		});
		expect(plugins).toContain("obsidian-harness");
	});

	/**
	 * AC-0001-N-1: Create .session file via command.
	 */
	it("should create a .session file via command", async () => {
		// Execute the create-session-file command
		await browser.execute(() => {
			(window as any).app?.commands?.executeCommandById(
				"obsidian-harness:create-session-file",
			);
		});

		// Wait for vault to create the file
		await browser.pause(1000);

		// Check if the .session file exists in the vault
		const files = await browser.execute(() => {
			const vault = (window as any).app?.vault;
			if (!vault) return [];
			return vault.getFiles().map((f: any) => f.path);
		});

		const sessionFile = files.find((f: string) => f.endsWith(".session"));
		expect(sessionFile).toBeDefined();
		expect(sessionFile).toMatch(/^session-[0-9a-f]{8}\.session$/);
	});

	/**
	 * AC-0001-N-1: .session file content is valid JSON.
	 */
	it("should have valid JSON content in .session file", async () => {
		const files = await browser.execute(() => {
			const vault = (window as any).app?.vault;
			if (!vault) return [];
			return vault.getFiles().map((f: any) => f.path);
		});

		const sessionFile = files.find((f: string) => f.endsWith(".session"));
		expect(sessionFile).toBeDefined();

		const content = await browser.execute((filePath: string) => {
			const vault = (window as any).app?.vault;
			const file = vault.getAbstractFileByPath(filePath);
			if (!file) return null;
			return vault.read(file);
		}, sessionFile!);

		expect(content).toBeDefined();
		const data = JSON.parse(content as string);
		expect(data).toHaveProperty("version", 1);
		expect(data).toHaveProperty("sessionId");
		expect(data).toHaveProperty("agentId");
		expect(data).toHaveProperty("cwd");
		expect(data).toHaveProperty("title");
		expect(data).toHaveProperty("createdAt");
		expect(data).toHaveProperty("updatedAt");
	});

	/**
	 * AC-0001-B-2: sessionId is UUID format.
	 */
	it("should have a valid UUID sessionId", async () => {
		const files = await browser.execute(() => {
			const vault = (window as any).app?.vault;
			if (!vault) return [];
			return vault.getFiles().map((f: any) => f.path);
		});

		const sessionFile = files.find((f: string) => f.endsWith(".session"));
		const content = await browser.execute((filePath: string) => {
			const vault = (window as any).app?.vault;
			const file = vault.getAbstractFileByPath(filePath);
			if (!file) return null;
			return vault.read(file);
		}, sessionFile!);

		const data = JSON.parse(content as string);
		expect(data.sessionId).toMatch(
			/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
		);
	});

	/**
	 * AC-0001-B-1: Creating a second session file should succeed (different UUID).
	 * Duplicate detection only triggers on exact UUID collision.
	 */
	it("should create a second .session file with different name", async () => {
		// Get current file count
		const before = await browser.execute(() => {
			const vault = (window as any).app?.vault;
			return vault.getFiles().filter((f: any) =>
				f.path.endsWith(".session"),
			).length;
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
			return vault.getFiles().filter((f: any) =>
				f.path.endsWith(".session"),
			).length;
		});

		// File count should increase (new UUID = new file)
		expect(after).toBe(before + 1);
	});
});