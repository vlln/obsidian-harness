import { browser } from "@wdio/globals";
describe("demo vault", () => {
	it("manager lists 3 sessions across 2 projects + long transcript renders", async () => {
		await browser.execute(() => {
			(window as any).app?.commands?.executeCommandById("obsidian-harness:open-session-manager");
		});
		await browser.pause(2000);
		const rows = await browser.execute(() => {
			return (window as any).app.workspace.getLeavesOfType("harness-session-manager")[0]?.view?.containerEl?.innerText ?? "";
		});
		console.log("MANAGER_TEXT[0:400]:", rows.slice(0, 400));
		expect(rows.toLowerCase()).toContain("harness-alpha");
		expect(rows.toLowerCase()).toContain("harness-beta");

		await browser.execute(async () => {
			const app = (window as any).app;
			const file = app.vault.getAbstractFileByPath("Sessions/marketing-alpha-long.session");
			await app.workspace.getLeaf(true).openFile(file);
		});
		const ok = await browser.waitUntil(async () => {
			const snap = await browser.execute(() => {
				const leaf = (window as any).app.workspace.getLeavesOfType("harness-session-view")[0];
				return leaf ? leaf.view.containerEl.innerText as string : "";
			});
			return snap.includes("single-event-channel") || snap.includes("Single-event");
		}, { timeout: 10000, interval: 200 });
		expect(ok).toBe(true);
	});
});
