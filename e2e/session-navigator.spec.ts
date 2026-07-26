import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { browser } from "@wdio/globals";

const root = fileURLToPath(new URL("..", import.meta.url));
const artifacts = path.join(
	root,
	"devdocs/plans/0036-session-navigator-system-test/artifacts",
);
const fixtureFolder = "Navigator Fixtures";
const fixtureEntryIds = Array.from(
	{ length: 15 },
	(_, index) => `navigator-e2e-${String(index + 1).padStart(2, "0")}`,
);

async function waitForFixtureCatalog(): Promise<void> {
	await browser.waitUntil(
		() =>
			browser.execute((entryIds) => {
				const plugin = (window as any).app.plugins.plugins[
					"obsidian-harness"
				];
				const present = new Set(
					plugin.sessionCatalog
						.getSnapshot()
						.items.map((item: any) => item.entryId),
				);
				return entryIds.every((entryId) => present.has(entryId));
			}, fixtureEntryIds),
		{ timeout: 5000, interval: 50 },
	);
}

async function setNavigatorWidth(width: number): Promise<void> {
	await browser.execute((targetWidth) => {
		const app = (window as any).app;
		const leaf = app.workspace.getLeavesOfType(
			"agent-client-session-manager",
		)[0];
		const leafElement = leaf?.view?.containerEl?.closest(".workspace-leaf");
		const splitElement = leafElement?.parentElement;
		if (splitElement) {
			splitElement.style.width = `${targetWidth}px`;
			splitElement.style.flex = `0 0 ${targetWidth}px`;
		}
	});
}

async function setTheme(theme: "light" | "dark"): Promise<void> {
	await browser.execute((nextTheme) => {
		document.body.classList.toggle("theme-dark", nextTheme === "dark");
		document.body.classList.toggle("theme-light", nextTheme === "light");
	}, theme);
}

describe("Session Navigator", () => {
	before(async () => {
		await mkdir(artifacts, { recursive: true });
		await browser.execute(
			async (folder, entryIds) => {
				const app = (window as any).app;
				const plugin = app.plugins.plugins["obsidian-harness"];
				const oldFolder = app.vault.getAbstractFileByPath(folder);
				if (oldFolder) await app.vault.delete(oldFolder, true);
				await app.vault.createFolder(folder);
				for (const entryId of entryIds) {
					await plugin.settingsService.removeSessionIndex(entryId);
				}
				for (let index = 0; index < entryIds.length; index++) {
					const entryId = entryIds[index];
					const projectIndex = index % 7;
					const cwd =
						projectIndex === 0
							? "/repos/alpha/app"
							: projectIndex === 1
								? "/repos/beta/app"
								: `/repos/project-${projectIndex}`;
					const title =
						index === 0
							? "Release Review"
							: index === 1
								? "Beta Planning"
								: `Navigator Session ${String(index + 1).padStart(2, "0")}`;
					const updatedAt = new Date(
						Date.UTC(2026, 6, 20, 0, 30 - index),
					).toISOString();
					const data = {
						version: 2,
						entryId,
						historyId: `history-${entryId}`,
						agentId: index === 0 ? "codex-acp" : "claude-code-acp",
						cwd,
						title,
						createdAt: "2026-07-20T00:00:00.000Z",
						updatedAt,
						forkedFrom: null,
					};
					const entryFile = `${folder}/${entryId}.session`;
					await app.vault.create(
						entryFile,
						JSON.stringify(data, null, 2),
					);
					await plugin.settingsService.reconcileSessionIndex(
						data,
						entryFile,
					);
				}
				await plugin.sessionCatalog.refresh();
				await plugin.activateSessionManager();
				plugin.sessionRuntimeRegistry.setStatus(
					entryIds[0],
					"navigator-e2e-view",
					"busy",
				);
				const selected = app.vault.getAbstractFileByPath(
					`${folder}/${entryIds[0]}.session`,
				);
				await app.workspace.getLeaf("tab").openFile(selected);
			},
			fixtureFolder,
			fixtureEntryIds,
		);
		await waitForFixtureCatalog();
		await browser.setWindowSize(1200, 820);
		await setNavigatorWidth(420);
		await browser.$(".agent-client-session-manager").waitForDisplayed();
	});

	after(async () => {
		await browser.execute(
			async (folder, entryIds) => {
				const app = (window as any).app;
				const plugin = app.plugins.plugins["obsidian-harness"];
				plugin.sessionRuntimeRegistry.remove(
					entryIds[0],
					"navigator-e2e-view",
				);
				for (const entryId of entryIds) {
					await plugin.settingsService.removeSessionIndex(entryId);
				}
				const folderEntry = app.vault.getAbstractFileByPath(folder);
				if (folderEntry) await app.vault.delete(folderEntry, true);
				await plugin.sessionCatalog.refresh();
			},
			fixtureFolder,
			fixtureEntryIds,
		);
	});

	it("AC-0017: renders Harness, New session, 5 Projects and 12 Recents without Active", async () => {
		const snapshot = await browser.execute(() => {
			const rootElement = document.querySelector(
				".agent-client-session-manager",
			)!;
			const projects = rootElement.querySelector(
				'section[aria-label="Projects"]',
			)!;
			const recents = rootElement.querySelector(
				'section[aria-label="Recents"]',
			)!;
			return {
				text: (rootElement as HTMLElement).innerText,
				projects: projects.querySelectorAll(
					".agent-client-navigator-project",
				).length,
				recents: recents.querySelectorAll(
					".agent-client-navigator-session-row",
				).length,
				projectNames: Array.from(
					projects.querySelectorAll(
						".agent-client-navigator-project-row span:last-child",
					),
				).map((element) => element.textContent),
			};
		});
		expect(snapshot.text).toContain("Harness");
		expect(snapshot.text).toContain("New session");
		expect(snapshot.text).toContain("Projects");
		expect(snapshot.text).toContain("Recents");
		expect(snapshot.text).not.toContain("Active Sessions");
		expect(snapshot.projects).toBe(5);
		expect(snapshot.recents).toBe(12);
		expect(snapshot.projectNames).toEqual(
			expect.arrayContaining(["alpha/app", "beta/app"]),
		);
	});

	it("AC-0017-B-2: expands Projects and Recents independently", async () => {
		const projectShowMore = await browser.$(
			'section[aria-label="Projects"] .agent-client-navigator-show-more',
		);
		await projectShowMore.click();
		expect(
			await browser
				.$$(
					'section[aria-label="Projects"] .agent-client-navigator-project',
				)
				.then((elements) => elements.length),
		).toBe(7);
		expect(
			await browser
				.$$(
					'section[aria-label="Recents"] .agent-client-navigator-session-row',
				)
				.then((elements) => elements.length),
		).toBe(12);

		await browser
			.$(
				'section[aria-label="Recents"] .agent-client-navigator-show-more',
			)
			.click();
		expect(
			await browser
				.$$(
					'section[aria-label="Recents"] .agent-client-navigator-session-row',
				)
				.then((elements) => elements.length),
		).toBeGreaterThanOrEqual(15);
	});

	it("AC-0020: searches one flat list and restores Project expansion state", async () => {
		const firstProject = await browser.$(
			'section[aria-label="Projects"] .agent-client-navigator-project-row',
		);
		await firstProject.click();
		expect(await firstProject.getAttribute("aria-expanded")).toBe("false");
		await browser.$('button[aria-label="Search sessions"]').click();
		const input = await browser.$('input[aria-label="Search sessions"]');
		await input.setValue("  RELEASE REVIEW  ");
		await browser.waitUntil(
			async () =>
				(await browser
					.$$(
						'section[aria-label="Search results"] .agent-client-navigator-session-row',
					)
					.then((elements) => elements.length)) === 1,
			{ timeout: 2000, interval: 50 },
		);
		expect(
			await browser.$('section[aria-label="Projects"]').isExisting(),
		).toBe(false);
		expect(
			await browser.$('section[aria-label="Recents"]').isExisting(),
		).toBe(false);
		expect(
			await browser
				.$(
					'section[aria-label="Search results"] .agent-client-navigator-session-row',
				)
				.getText(),
		).toContain("Release Review");
		await browser.$('button[aria-label="Close search"]').click();
		expect(await firstProject.getAttribute("aria-expanded")).toBe("false");
	});

	it("AC-0019: keeps status geometry fixed and selects both projections", async () => {
		const geometry = await browser.execute(() => {
			const rows = Array.from(
				document.querySelectorAll(
					".agent-client-navigator-session-row",
				),
			) as HTMLElement[];
			const statusWidths = rows.map(
				(row) =>
					row
						.querySelector(".agent-client-navigator-status-slot")!
						.getBoundingClientRect().width,
			);
			return {
				rowHeights: rows.map(
					(row) => row.getBoundingClientRect().height,
				),
				statusWidths,
				selected: rows.filter((row) =>
					row.classList.contains("is-selected"),
				).length,
				busyTitles: Array.from(
					document.querySelectorAll(
						'.agent-client-navigator-status.is-busy[title="Working"]',
					),
				).length,
			};
		});
		expect(new Set(geometry.rowHeights)).toEqual(new Set([32]));
		expect(new Set(geometry.statusWidths)).toEqual(new Set([18]));
		expect(geometry.selected).toBe(2);
		expect(geometry.busyTitles).toBe(2);
	});

	it("AC-0021-N-2: exposes the four current-entry commands", async () => {
		const row = await browser.$(
			'section[aria-label="Recents"] .agent-client-navigator-session-row',
		);
		await row.click({ button: "right" });
		const menuText = await browser.$(".menu").getText();
		expect(menuText).toContain("Open");
		expect(menuText).toContain("Reveal in file explorer");
		expect(menuText).toContain("Rename");
		expect(menuText).toContain("Delete");
		await browser.keys(["Escape"]);
	});

	it("AC-0022: saves 260/420 px light/dark visual evidence", async () => {
		const navigator = await browser.$(".agent-client-session-manager");
		for (const theme of ["light", "dark"] as const) {
			await setTheme(theme);
			for (const width of [260, 420]) {
				await setNavigatorWidth(width);
				await browser.pause(100);
				await navigator.saveScreenshot(
					path.join(artifacts, `navigator-${width}-${theme}.png`),
				);
			}
		}
	});
});
