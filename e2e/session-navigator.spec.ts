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
	const navigator = await browser.$(".harness-session-manager");
	await navigator.waitForDisplayed();
	await browser.execute(
		(element, targetWidth) => {
			let current = element as unknown as HTMLElement | null;
			while (current && !current.classList.contains("mod-root")) {
				current.style.boxSizing = "border-box";
				current.style.width = `${targetWidth}px`;
				current.style.minWidth = `${targetWidth}px`;
				current.style.maxWidth = `${targetWidth}px`;
				current = current.parentElement;
			}
		},
		navigator,
		width,
	);
}

async function setTheme(theme: "light" | "dark"): Promise<void> {
	await browser.execute((nextTheme) => {
		document.body.classList.toggle("theme-dark", nextTheme === "dark");
		document.body.classList.toggle("theme-light", nextTheme === "light");
	}, theme);
}

async function getNavigatorRoleStyles() {
	return browser.execute(() => {
		const rootElement = document.querySelector(
			".harness-session-manager",
		)!;
		const resolveColor = (variable: string) => {
			const probe = document.createElement("span");
			probe.style.color = `var(${variable})`;
			rootElement.appendChild(probe);
			const color = getComputedStyle(probe).color;
			probe.remove();
			return color;
		};
		const resolveFontWeight = (variable: string) => {
			const probe = document.createElement("span");
			probe.style.fontWeight = `var(${variable})`;
			rootElement.appendChild(probe);
			const fontWeight = getComputedStyle(probe).fontWeight;
			probe.remove();
			return fontWeight;
		};
		const styleOf = (selector: string) => {
			const element = rootElement.querySelector<HTMLElement>(selector);
			if (!element)
				throw new Error(`Missing Navigator element: ${selector}`);
			const style = getComputedStyle(element);
			return {
				backgroundColor: style.backgroundColor,
				color: style.color,
				cursor: style.cursor,
				fontSize: style.fontSize,
				fontWeight: style.fontWeight,
				justifyContent: style.justifyContent,
				role: element.getAttribute("role"),
				tabIndex: element.tabIndex,
				tagName: element.tagName,
			};
		};
		return {
			colors: {
				faint: resolveColor("--text-faint"),
				muted: resolveColor("--text-muted"),
				normal: resolveColor("--text-normal"),
			},
			fontWeights: {
				medium: resolveFontWeight("--font-medium"),
				semibold: resolveFontWeight("--font-semibold"),
			},
			projects: styleOf(
				'section[aria-label="Projects"] .harness-navigator-section-title',
			),
			recents: styleOf(
				'section[aria-label="Recents"] .harness-navigator-section-title',
			),
			showMore: styleOf(
				'section[aria-label="Projects"] .harness-navigator-show-more',
			),
			projectRow: styleOf(
				'section[aria-label="Projects"] .harness-navigator-project-row',
			),
			sessionRow: styleOf(
				".harness-navigator-session-row:not(.is-selected)",
			),
		};
	});
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
						Date.UTC(2099, 6, 20, 0, 30 - index),
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
		await setNavigatorWidth(420);
		await browser.$(".harness-session-manager").waitForDisplayed();
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
				".harness-session-manager",
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
					".harness-navigator-project",
				).length,
				recents: recents.querySelectorAll(
					".harness-navigator-session-row",
				).length,
				projectNames: Array.from(
					projects.querySelectorAll(
						".harness-navigator-project-row span:last-child",
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
		expect(
			await browser
				.$('[aria-label="Open session manager"]')
				.isDisplayed(),
		).toBe(true);
		expect(
			await browser
				.$(
					'.workspace-tab-header[data-type="harness-session-manager"]',
				)
				.isDisplayed(),
		).toBe(false);
	});

	it("AC-0023-N-1/B-1/F-1: separates labels, expansion commands and selectable rows", async () => {
		for (const theme of ["light", "dark"] as const) {
			await setTheme(theme);
			for (const width of [260, 420]) {
				await setNavigatorWidth(width);
				const styles = await getNavigatorRoleStyles();
				for (const label of [styles.projects, styles.recents]) {
					expect(label).toMatchObject({
						color: styles.colors.faint,
						cursor: expect.not.stringContaining("pointer"),
						fontSize: "11px",
						fontWeight: styles.fontWeights.semibold,
						role: null,
						tabIndex: -1,
						tagName: "DIV",
					});
				}
				expect(styles.showMore).toMatchObject({
					color: styles.colors.muted,
					fontSize: "11px",
					fontWeight: styles.fontWeights.medium,
					justifyContent: "flex-start",
					tagName: "BUTTON",
				});
				for (const row of [styles.projectRow, styles.sessionRow]) {
					expect(Number.parseFloat(row.fontSize)).toBeGreaterThan(11);
					expect(row.color).toBe(styles.colors.normal);
				}
			}
		}

		await setTheme("light");
		await setNavigatorWidth(420);
		const projectStatesBefore = await browser.$$(
			'.harness-navigator-project-row[aria-expanded="true"]',
		);
		await browser
			.$(
				'section[aria-label="Projects"] .harness-navigator-section-title',
			)
			.click();
		expect(
			await browser.$$(
				'.harness-navigator-project-row[aria-expanded="true"]',
			),
		).toHaveLength(projectStatesBefore.length);

		const hoverBackground = async (selector: string) => {
			await browser.$(".harness-navigator-header h1").moveTo();
			const element = await browser.$(selector);
			const before = await element.getCSSProperty("background-color");
			await element.moveTo();
			const after = await element.getCSSProperty("background-color");
			return { before: before.value, after: after.value };
		};
		const sectionHover = await hoverBackground(
			'section[aria-label="Projects"] .harness-navigator-section-title',
		);
		expect(sectionHover.after).toBe(sectionHover.before);
		const showMore = await browser.$(
			'section[aria-label="Projects"] .harness-navigator-show-more',
		);
		const showMoreHover = await hoverBackground(
			'section[aria-label="Projects"] .harness-navigator-show-more',
		);
		expect(showMoreHover.after).not.toBe(showMoreHover.before);
		const showMoreColor = await browser.execute(
			(element) =>
				getComputedStyle(element as unknown as HTMLElement).color,
			showMore,
		);
		expect(showMoreColor).toBe(
			(await getNavigatorRoleStyles()).colors.normal,
		);
		const sessionHover = await hoverBackground(
			".harness-navigator-session-row:not(.is-selected)",
		);
		expect(sessionHover.after).not.toBe(sessionHover.before);
	});

	it("AC-0023-E-1: preserves non-color hierarchy when theme text roles collapse", async () => {
		await browser.execute(() => {
			for (const variable of [
				"--text-faint",
				"--text-muted",
				"--text-normal",
			]) {
				document.body.style.setProperty(variable, "rgb(80, 80, 80)");
			}
		});
		try {
			const styles = await getNavigatorRoleStyles();
			expect(new Set(Object.values(styles.colors)).size).toBe(1);
			expect(styles.projects.fontSize).toBe("11px");
			expect(styles.projects.fontWeight).toBe(
				styles.fontWeights.semibold,
			);
			expect(styles.showMore.fontSize).toBe("11px");
			expect(styles.showMore.fontWeight).toBe(styles.fontWeights.medium);
			expect(
				Number.parseFloat(styles.sessionRow.fontSize),
			).toBeGreaterThan(11);
			expect(styles.projects.color).not.toBe("rgba(0,0,0,0)");
		} finally {
			await browser.execute(() => {
				for (const variable of [
					"--text-faint",
					"--text-muted",
					"--text-normal",
				]) {
					document.body.style.removeProperty(variable);
				}
			});
		}
	});

	it("AC-0017-B-2: expands Projects and Recents independently", async () => {
		const projectShowMore = await browser.$(
			'section[aria-label="Projects"] .harness-navigator-show-more',
		);
		await projectShowMore.click();
		const projectNames = await browser.execute(() =>
			Array.from(
				document.querySelectorAll(
					'section[aria-label="Projects"] .harness-navigator-project-row span:last-child',
				),
			).map((element) => element.textContent ?? ""),
		);
		for (const fixtureProject of [
			"alpha/app",
			"beta/app",
			"project-2",
			"project-3",
			"project-4",
			"project-5",
			"project-6",
		]) {
			expect(projectNames).toContain(fixtureProject);
		}
		expect(
			await browser
				.$$(
					'section[aria-label="Recents"] .harness-navigator-session-row',
				)
				.then((elements) => elements.length),
		).toBe(12);

		await browser
			.$(
				'section[aria-label="Recents"] .harness-navigator-show-more',
			)
			.click();
		expect(
			await browser
				.$$(
					'section[aria-label="Recents"] .harness-navigator-session-row',
				)
				.then((elements) => elements.length),
		).toBeGreaterThanOrEqual(15);
	});

	it("AC-0020: searches one flat list and restores Project expansion state", async () => {
		const firstProject = await browser.$(
			'section[aria-label="Projects"] .harness-navigator-project-row',
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
						'section[aria-label="Search results"] .harness-navigator-session-row',
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
					'section[aria-label="Search results"] .harness-navigator-session-row',
				)
				.getText(),
		).toContain("Release Review");
		await browser.$('button[aria-label="Close search"]').click();
		const restoredProject = await browser.$(
			'section[aria-label="Projects"] .harness-navigator-project-row',
		);
		expect(await restoredProject.getAttribute("aria-expanded")).toBe(
			"false",
		);
		await restoredProject.click();
	});

	it("AC-0019: keeps status geometry fixed and selects both projections", async () => {
		const geometry = await browser.execute(() => {
			const rows = Array.from(
				document.querySelectorAll(
					".harness-navigator-session-row",
				),
			) as HTMLElement[];
			const statusWidths = rows.map(
				(row) =>
					row
						.querySelector(".harness-navigator-status-slot")!
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
						'.harness-navigator-status.is-busy[title="Working"]',
					),
				).length,
			};
		});
		expect(new Set(geometry.rowHeights)).toEqual(new Set([32]));
		expect(new Set(geometry.statusWidths)).toEqual(new Set([18]));
		expect(geometry.selected).toBe(2);
		expect(geometry.busyTitles).toBe(2);
	});

	it("AC-0026-N-1: keeps Open on the row and exposes three Session commands", async () => {
		const row = await browser.$(
			'section[aria-label="Recents"] .harness-navigator-session-row',
		);
		await row.moveTo();
		const menuButton = await row.$(".harness-navigator-more");
		await menuButton.waitForClickable();
		await menuButton.click();
		await browser.$(".menu").waitForDisplayed();
		const menuText = await browser.$(".menu").getText();
		expect(menuText).not.toMatch(/(^|\n)Open($|\n)/);
		expect(menuText).toContain("Reveal in file explorer");
		expect(menuText).toContain("Rename");
		expect(menuText).toContain("Delete");
		await browser.keys(["Escape"]);
	});

	it("AC-0022: saves 260/420 px light/dark visual evidence", async () => {
		const navigator = await browser.$(".harness-session-manager");
		const projectRows = await browser.$$(
			'section[aria-label="Projects"] .harness-navigator-project-row',
		);
		for (const projectRow of projectRows) {
			const shouldExpand = (await projectRow.getText()).includes(
				"alpha/app",
			);
			const isExpanded =
				(await projectRow.getAttribute("aria-expanded")) === "true";
			if (shouldExpand !== isExpanded) await projectRow.click();
		}
		await browser.execute(() => {
			const content = document.querySelector(
				".harness-navigator-content",
			) as HTMLElement | null;
			if (content) content.scrollTop = 0;
		});
		for (const theme of ["light", "dark"] as const) {
			await setTheme(theme);
			for (const width of [260, 420]) {
				await setNavigatorWidth(width);
				await browser.$(".harness-navigator-header h1").moveTo();
				await browser.pause(100);
				expect(await navigator.getSize("width")).toBe(width);
				await navigator.saveScreenshot(
					path.join(artifacts, `navigator-${width}-${theme}.png`),
				);
			}
		}
	});
});
