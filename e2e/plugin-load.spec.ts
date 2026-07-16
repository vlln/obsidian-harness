/**
 * Minimal E2E test — verifies the plugin loads in Obsidian.
 * AC-0002-N-1: Plugin loads and ChatPanel renders.
 */
describe("Obsidian Harness", () => {
	it("should load the plugin", async () => {
		// Verify Obsidian is running and plugin is loaded
		const plugins = await browser.execute(() => {
			return (window as any).app?.plugins?.plugins;
		});
		expect(plugins).toHaveProperty("obsidian-harness");
	});
});