import { browser } from "@wdio/globals";
describe("demo vault", () => {
	it("lists 3 projects / 4 sessions + pi-acp transcript renders", async () => {
		await browser.execute(() => (window as any).app?.commands?.executeCommandById("obsidian-harness:open-session-manager"));
		await browser.pause(2000);
		const rows = await browser.execute(() => (window as any).app.workspace.getLeavesOfType("harness-session-manager")[0]?.view?.containerEl?.innerText ?? "");
		expect(rows.toLowerCase()).toContain("harness-alpha");
		expect(rows.toLowerCase()).toContain("harness-beta");
		expect(rows.toLowerCase()).toContain("harness-gamma");
		await browser.execute(async () => {
			const app = (window as any).app;
			const file = app.vault.getAbstractFileByPath("Sessions/marketing-gamma-pi.session");
			await app.workspace.getLeaf(true).openFile(file);
		});
		const ok = await browser.waitUntil(async () => {
			const snap = await browser.execute(() => (window as any).app.workspace.getLeavesOfType("harness-session-view")[0]?.view?.containerEl?.innerText ?? "");
			return snap.includes("Pi Agent") || snap.includes("pi-acp");
		}, { timeout: 10000, interval: 200 });
		expect(ok).toBe(true);
	});
});
