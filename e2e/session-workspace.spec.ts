import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { browser } from "@wdio/globals";

const root = fileURLToPath(new URL("..", import.meta.url));
const artifacts = path.join(
	root,
	"devdocs/plans/0045-session-workspace-system-test/artifacts",
);
const turnEntryPath = "Sessions/workspace-turns.session";
const projectEntryPath = "Sessions/workspace-actions.session";
const turnEntryId = "workspace-turn-entry";
const projectEntryId = "workspace-project-entry";
const turnHistoryId = "workspace-turn-history";

async function openProjectMenu(kind: "click" | "contextmenu"): Promise<void> {
	await browser.execute((eventKind) => {
		const session = Array.from(
			document.querySelectorAll<HTMLElement>(
				".agent-client-navigator-session-row",
			),
		).find((element) =>
			element.innerText.includes("Workspace action fixture"),
		);
		const project = session?.closest(
			".agent-client-navigator-project",
		) as HTMLElement | null;
		const shell = project?.querySelector<HTMLElement>(
			".agent-client-navigator-project-row-shell",
		);
		if (!shell) throw new Error("Workspace action Project is unavailable");
		if (eventKind === "click") {
			shell
				.querySelector<HTMLButtonElement>(
					".agent-client-navigator-more",
				)
				?.click();
		} else {
			const rect = shell.getBoundingClientRect();
			shell.dispatchEvent(
				new MouseEvent("contextmenu", {
					bubbles: true,
					clientX: rect.left + 8,
					clientY: rect.top + 8,
				}),
			);
		}
	}, kind);
	await browser.$(".menu").waitForDisplayed();
}

async function clickMenuItem(title: string): Promise<void> {
	await browser.execute((itemTitle) => {
		const item = Array.from(
			document.querySelectorAll<HTMLElement>(".menu .menu-item"),
		).find((element) => element.innerText.trim() === itemTitle);
		if (!item) throw new Error(`Missing menu item: ${itemTitle}`);
		item.click();
	}, title);
}

async function waitForNotice(text: string): Promise<void> {
	await browser.waitUntil(
		() =>
			browser.execute(
				(expected) =>
					Array.from(
						document.querySelectorAll<HTMLElement>(".notice"),
					).some((notice) => notice.innerText.includes(expected)),
				text,
			),
		{ timeout: 2000 },
	);
}

async function setTurnViewportWidth(width: number): Promise<void> {
	await browser.execute((targetWidth) => {
		// Obsidian exposes Electron in the test renderer; resize the isolated
		// test window so wide host matrices are measured instead of clipped.
		// eslint-disable-next-line @typescript-eslint/no-require-imports
		const { remote } = require("electron") as {
			remote: {
				getCurrentWindow(): {
					setSize(width: number, height: number): void;
				};
			};
		};
		remote
			.getCurrentWindow()
			.setSize(Math.max(targetWidth + 420, 900), 900);
		const shell = document.querySelector<HTMLElement>(
			".agent-client-message-list-shell.has-turn-navigator",
		);
		if (!shell) throw new Error("Turn Navigator shell is unavailable");
		const leaf = shell.closest<HTMLElement>(".workspace-leaf");
		const rootSplit = leaf?.closest<HTMLElement>(
			".workspace-split.mod-root",
		);
		if (leaf && rootSplit) {
			rootSplit
				.querySelectorAll<HTMLElement>(".workspace-leaf")
				.forEach((candidate) => {
					candidate.style.display =
						candidate === leaf ? "flex" : "none";
				});
			leaf.style.flex = "1 1 auto";
			leaf.style.width = "100%";
			leaf.style.maxWidth = "none";
		}
		shell.style.width = `${targetWidth}px`;
		shell.style.minWidth = `${targetWidth}px`;
		shell.style.maxWidth = `${targetWidth}px`;
		shell.style.alignSelf = "flex-start";
	}, width);
	await browser.pause(100);
}

async function setTheme(theme: "light" | "dark"): Promise<void> {
	await browser.execute((nextTheme) => {
		document.body.classList.toggle("theme-dark", nextTheme === "dark");
		document.body.classList.toggle("theme-light", nextTheme === "light");
	}, theme);
}

async function getTurnGeometry() {
	return browser.execute(() => {
		const shell = document.querySelector<HTMLElement>(
			".agent-client-message-list-shell.has-turn-navigator",
		)!;
		const rail = shell.querySelector<HTMLElement>(
			".agent-client-turn-navigator",
		)!;
		const messages = shell.querySelector<HTMLElement>(
			".agent-client-chat-view-messages",
		)!;
		const shellRect = shell.getBoundingClientRect();
		const messageRect = messages.getBoundingClientRect();
		return {
			shellWidth: shellRect.width,
			railDisplay: getComputedStyle(rail).display,
			messageOffset: messageRect.left - shellRect.left,
			gridTemplateColumns: getComputedStyle(shell).gridTemplateColumns,
			overflowX: shell.scrollWidth - shell.clientWidth,
		};
	});
}

describe("v0.5 Session workspace", () => {
	before(async () => {
		await mkdir(artifacts, { recursive: true });
		await browser.execute(
			async (turnPath, projectPath, turnId, projectId, historyId) => {
				const app = (window as any).app;
				const plugin = app.plugins.plugins["obsidian-harness"];
				if (!app.vault.getAbstractFileByPath("Sessions")) {
					await app.vault.createFolder("Sessions");
				}
				for (const entryPath of [turnPath, projectPath]) {
					const old = app.vault.getAbstractFileByPath(entryPath);
					if (old) await app.vault.delete(old, true);
				}
				for (const entryId of [turnId, projectId]) {
					await plugin.settingsService.removeSessionIndex(entryId);
				}
				await plugin.settingsService.deleteTranscript(historyId);

				const createdAt = "2026-07-27T00:00:00.000Z";
				const turnEntry = {
					version: 2,
					entryId: turnId,
					historyId,
					agentId: "",
					cwd: "/missing/workspace-turn-project",
					title: "Workspace turn fixture",
					createdAt,
					updatedAt: "2100-07-27T00:00:02.000Z",
					forkedFrom: null,
				};
				const projectEntry = {
					version: 2,
					entryId: projectId,
					historyId: "workspace-project-history",
					agentId: "",
					cwd: app.vault.adapter.getBasePath(),
					title: "Workspace action fixture",
					createdAt,
					updatedAt: "2100-07-27T00:00:01.000Z",
					forkedFrom: null,
				};
				await app.vault.create(
					turnPath,
					JSON.stringify(turnEntry, null, 2),
				);
				await app.vault.create(
					projectPath,
					JSON.stringify(projectEntry, null, 2),
				);
				await plugin.settingsService.initializeTranscript(historyId, {
					agentId: "",
					cwd: turnEntry.cwd,
					title: turnEntry.title,
					createdAt,
				});
				const turns = [
					"First prompt",
					"Second prompt",
					"Third prompt",
				].map((prompt, index) =>
					JSON.stringify({
						schemaVersion: 2,
						turnId: `workspace-turn-${index + 1}`,
						startedAt: `2026-07-27T00:0${index}:00.000Z`,
						endedAt: `2026-07-27T00:0${index}:30.000Z`,
						status: "completed",
						prompt: [{ type: "text", text: prompt }],
						items: [
							{
								itemId: `workspace-answer-${index + 1}`,
								type: "assistant_message",
								text: `Answer ${index + 1} ${"detail ".repeat(20)}`,
							},
						],
						stopReason: "end_turn",
					}),
				);
				const historyBase = `${app.vault.configDir}/plugins/obsidian-harness/sessions/${historyId}`;
				await app.vault.adapter.write(
					`${historyBase}/turns.jsonl`,
					`${turns.join("\n")}\n`,
				);
				await plugin.settingsService.reconcileSessionIndex(
					turnEntry,
					turnPath,
				);
				await plugin.settingsService.reconcileSessionIndex(
					projectEntry,
					projectPath,
				);

				plugin.__workspaceOriginalProjectActionHost =
					plugin.createProjectActionHost;
				plugin.__workspaceProjectActionMode = "success";
				plugin.__workspaceProjectActionCalls = [];
				plugin.createProjectActionHost = () => ({
					isDirectory: async (cwd: string) => {
						plugin.__workspaceProjectActionCalls.push({
							action: "isDirectory",
							cwd,
						});
						return (
							plugin.__workspaceProjectActionMode !== "missing"
						);
					},
					openDirectory: async (cwd: string) => {
						plugin.__workspaceProjectActionCalls.push({
							action: "openDirectory",
							cwd,
						});
						if (
							plugin.__workspaceProjectActionMode ===
							"open-failure"
						) {
							throw new Error("system host denied");
						}
					},
					writeClipboard: async (cwd: string) => {
						plugin.__workspaceProjectActionCalls.push({
							action: "writeClipboard",
							cwd,
						});
						if (
							plugin.__workspaceProjectActionMode ===
							"clipboard-failure"
						) {
							throw new Error("clipboard host denied");
						}
					},
				});
				await plugin.sessionCatalog.refresh();
			},
			turnEntryPath,
			projectEntryPath,
			turnEntryId,
			projectEntryId,
			turnHistoryId,
		);
	});

	after(async () => {
		await browser.execute(
			async (turnPath, projectPath, turnId, projectId, historyId) => {
				const app = (window as any).app;
				const plugin = app.plugins.plugins["obsidian-harness"];
				if (plugin.__workspaceOriginalProjectActionHost) {
					plugin.createProjectActionHost =
						plugin.__workspaceOriginalProjectActionHost;
				}
				for (const entryId of [turnId, projectId]) {
					await plugin.settingsService.removeSessionIndex(entryId);
				}
				for (const entryPath of [turnPath, projectPath]) {
					const file = app.vault.getAbstractFileByPath(entryPath);
					if (file) await app.vault.delete(file, true);
				}
				await plugin.settingsService.deleteTranscript(historyId);
				await plugin.sessionCatalog.refresh();
			},
			turnEntryPath,
			projectEntryPath,
			turnEntryId,
			projectEntryId,
			turnHistoryId,
		);
	});

	it("AC-0024-N-1/N-4/B-1/B-3: opens a side-effect-free validated creation modal", async () => {
		await browser.execute(async () => {
			const plugin = (window as any).app.plugins.plugins[
				"obsidian-harness"
			];
			await plugin.activateSessionManager();
		});
		await browser.$(".agent-client-session-manager").waitForDisplayed();
		const before = await browser.execute(async () => {
			const app = (window as any).app;
			const plugin = app.plugins.plugins["obsidian-harness"];
			return {
				entries: app.vault
					.getFiles()
					.filter((file: any) => file.extension === "session").length,
				index: (await plugin.settingsService.getSessionIndex()).length,
			};
		});
		const trigger = await browser.$(".agent-client-navigator-new-session");
		await trigger.click();
		const modal = await browser.$(".agent-client-session-creation-modal");
		await modal.waitForDisplayed();
		const name = await browser.$("#agent-client-project-name");
		await browser.waitUntil(
			() =>
				browser.execute(
					() =>
						document.activeElement?.id ===
						"agent-client-project-name",
				),
			{ timeout: 2000 },
		);
		const uniqueName = `harness-e2e-${Date.now()}`;
		await name.setValue(uniqueName);
		await browser.waitUntil(
			async () =>
				(
					await browser
						.$(".agent-client-session-creation-location")
						.getAttribute("aria-label")
				)?.endsWith(`/Documents/${uniqueName}`) ?? false,
			{ timeout: 2000 },
		);
		await name.setValue("..");
		await browser.waitUntil(
			async () =>
				(
					await browser
						.$(".agent-client-session-creation-issue")
						.getText()
				).includes("cannot be . or .."),
			{ timeout: 2000 },
		);
		expect(
			await browser
				.$(".agent-client-session-modal-actions .mod-cta")
				.isEnabled(),
		).toBe(false);
		await browser.keys(["Escape"]);
		await modal.waitForExist({ reverse: true });
		const after = await browser.execute(async () => {
			const app = (window as any).app;
			const plugin = app.plugins.plugins["obsidian-harness"];
			return {
				entries: app.vault
					.getFiles()
					.filter((file: any) => file.extension === "session").length,
				index: (await plugin.settingsService.getSessionIndex()).length,
				focused: document.activeElement?.classList.contains(
					"agent-client-navigator-new-session",
				),
			};
		});
		expect(after).toMatchObject({ ...before, focused: true });
	});

	it("AC-0026-N-1/N-2/N-3/B-1: separates Session and Project destinations", async () => {
		await openProjectMenu("click");
		const menuText = await browser.$(".menu").getText();
		expect(menuText).toContain("New session here");
		expect(menuText).toContain("Open in system file manager");
		expect(menuText).toContain("Copy path");
		expect(menuText).not.toContain("Rename");
		expect(menuText).not.toContain("Delete");
		await browser.keys(["Escape"]);
		await browser.waitUntil(
			() =>
				browser.execute(() =>
					document.activeElement?.classList.contains(
						"agent-client-navigator-more",
					),
				),
			{ timeout: 2000 },
		);

		const stateBefore = await browser.execute(() => {
			const session = Array.from(
				document.querySelectorAll<HTMLElement>(
					".agent-client-navigator-session-row",
				),
			).find((element) =>
				element.innerText.includes("Workspace action fixture"),
			)!;
			const shell = session.closest(".agent-client-navigator-project")!
				.firstElementChild as HTMLElement;
			return {
				childTags: Array.from(shell.children).map(
					(child) => child.tagName,
				),
				expanded: shell
					.querySelector(".agent-client-navigator-project-row")
					?.getAttribute("aria-expanded"),
			};
		});
		expect(stateBefore.childTags).toEqual(["BUTTON", "BUTTON"]);

		await openProjectMenu("contextmenu");
		expect(await browser.$(".menu").getText()).toBe(menuText);
		await clickMenuItem("Copy path");
		await browser.waitUntil(
			() =>
				browser.execute(() => {
					const plugin = (window as any).app.plugins.plugins[
						"obsidian-harness"
					];
					return plugin.__workspaceProjectActionCalls.some(
						(call: any) => call.action === "writeClipboard",
					);
				}),
			{ timeout: 2000 },
		);

		await openProjectMenu("click");
		await clickMenuItem("Open in system file manager");
		await browser.waitUntil(
			() =>
				browser.execute(() => {
					const plugin = (window as any).app.plugins.plugins[
						"obsidian-harness"
					];
					return plugin.__workspaceProjectActionCalls.some(
						(call: any) => call.action === "openDirectory",
					);
				}),
			{ timeout: 2000 },
		);

		await openProjectMenu("click");
		await clickMenuItem("New session here");
		const modal = await browser.$(".agent-client-session-creation-modal");
		await modal.waitForDisplayed();
		expect(await browser.$("#agent-client-project-name").isEnabled()).toBe(
			false,
		);
		const selectedCwd = await browser
			.$(".agent-client-session-creation-source > span")
			.getAttribute("title");
		expect(selectedCwd).toBe(
			await browser.execute(() =>
				(window as any).app.vault.adapter.getBasePath(),
			),
		);
		await browser.$(".agent-client-session-modal-actions button").click();

		const stateAfter = await browser.execute(() => {
			const session = Array.from(
				document.querySelectorAll<HTMLElement>(
					".agent-client-navigator-session-row",
				),
			).find((element) =>
				element.innerText.includes("Workspace action fixture"),
			)!;
			return session
				.closest(".agent-client-navigator-project")
				?.querySelector(".agent-client-navigator-project-row")
				?.getAttribute("aria-expanded");
		});
		expect(stateAfter).toBe(stateBefore.expanded);
	});

	it("AC-0026-B-2/E-1/F-1/F-2: keeps host failures isolated and Copy path available", async () => {
		await browser.execute(() => {
			const plugin = (window as any).app.plugins.plugins[
				"obsidian-harness"
			];
			plugin.__workspaceProjectActionCalls = [];
			plugin.__workspaceProjectActionMode = "missing";
		});
		await openProjectMenu("click");
		await clickMenuItem("Open in system file manager");
		await waitForNotice("Project folder is unavailable");
		const missingCalls = await browser.execute(() => {
			const plugin = (window as any).app.plugins.plugins[
				"obsidian-harness"
			];
			return plugin.__workspaceProjectActionCalls;
		});
		expect(missingCalls.map((call: any) => call.action)).toEqual([
			"isDirectory",
		]);

		await openProjectMenu("click");
		await clickMenuItem("Copy path");
		await browser.waitUntil(
			() =>
				browser.execute(() => {
					const plugin = (window as any).app.plugins.plugins[
						"obsidian-harness"
					];
					return plugin.__workspaceProjectActionCalls.some(
						(call: any) => call.action === "writeClipboard",
					);
				}),
			{ timeout: 2000 },
		);

		await browser.execute(() => {
			const plugin = (window as any).app.plugins.plugins[
				"obsidian-harness"
			];
			plugin.__workspaceProjectActionMode = "open-failure";
		});
		await openProjectMenu("click");
		await clickMenuItem("Open in system file manager");
		await waitForNotice("system host denied");

		await browser.execute(() => {
			const plugin = (window as any).app.plugins.plugins[
				"obsidian-harness"
			];
			plugin.__workspaceProjectActionMode = "clipboard-failure";
		});
		await openProjectMenu("click");
		await clickMenuItem("Copy path");
		await waitForNotice("clipboard host denied");
	});

	it("AC-0025-N-1/N-2/N-4/B-1/B-4: renders, previews and navigates user turns", async () => {
		await browser.execute(async (entryPath) => {
			const app = (window as any).app;
			const file = app.vault.getAbstractFileByPath(entryPath);
			await app.workspace.getLeaf(true).openFile(file);
		}, turnEntryPath);
		await browser.waitUntil(
			async () =>
				(await browser.$$(".agent-client-turn-node")).length === 3,
			{ timeout: 5000, interval: 50 },
		);
		const labels = await browser.execute(() =>
			Array.from(
				document.querySelectorAll<HTMLElement>(
					".agent-client-turn-node",
				),
			).map((node) => node.getAttribute("aria-label")),
		);
		expect(labels).toEqual([
			"Turn 1: First prompt",
			"Turn 2: Second prompt",
			"Turn 3: Third prompt",
		]);

		await setTurnViewportWidth(800);
		const second = await browser.$(
			'.agent-client-turn-node[aria-label="Turn 2: Second prompt"]',
		);
		await second.moveTo();
		await browser.$(".tooltip").waitForDisplayed();
		expect(await browser.$(".tooltip").getText()).toContain(
			"Second prompt",
		);
		await second.click();
		await browser.waitUntil(
			() =>
				browser.execute(() => {
					const shell = document.querySelector<HTMLElement>(
						".agent-client-message-list-shell.has-turn-navigator",
					)!;
					const viewport = shell.querySelector<HTMLElement>(
						".agent-client-chat-view-messages",
					)!;
					const message = Array.from(
						viewport.querySelectorAll<HTMLElement>(
							".agent-client-virtual-item",
						),
					).find((element) =>
						element.innerText.includes("Second prompt"),
					);
					if (!message) return false;
					const viewportRect = viewport.getBoundingClientRect();
					const messageRect = message.getBoundingClientRect();
					return (
						messageRect.top >= viewportRect.top &&
						messageRect.top < viewportRect.bottom
					);
				}),
			{ timeout: 2000, interval: 25 },
		);
		expect(await second.getAttribute("aria-current")).toBe("step");

		for (const width of [260, 519]) {
			await setTurnViewportWidth(width);
			const geometry = await getTurnGeometry();
			expect(geometry).toMatchObject({
				shellWidth: width,
				railDisplay: "none",
				messageOffset: 0,
				overflowX: 0,
			});
		}
		for (const width of [520, 800, 1200]) {
			await setTurnViewportWidth(width);
			const geometry = await getTurnGeometry();
			expect(geometry.shellWidth).toBe(width);
			expect(geometry.railDisplay).not.toBe("none");
			expect(geometry.messageOffset).toBe(34);
			expect(geometry.overflowX).toBe(0);
		}
	});

	it("AC-0024-N-4 and AC-0025-N-4/B-1: saves responsive light/dark visual evidence", async () => {
		if (
			!(await browser
				.$(".agent-client-message-list-shell.has-turn-navigator")
				.isExisting())
		) {
			await browser.execute(async (entryPath) => {
				const app = (window as any).app;
				const file = app.vault.getAbstractFileByPath(entryPath);
				await app.workspace.getLeaf(true).openFile(file);
			}, turnEntryPath);
			await browser.waitUntil(
				async () =>
					(await browser.$$(".agent-client-turn-node")).length === 3,
				{ timeout: 5000, interval: 50 },
			);
		}
		const shell = await browser.$(
			".agent-client-message-list-shell.has-turn-navigator",
		);
		await browser.execute(() => {
			document
				.querySelectorAll<HTMLElement>(".notice")
				.forEach((notice) => notice.remove());
		});
		for (const theme of ["light", "dark"] as const) {
			await setTheme(theme);
			for (const width of [260, 519, 520, 800, 1200]) {
				await setTurnViewportWidth(width);
				await browser.execute(() => {
					const viewport = document.querySelector<HTMLElement>(
						".agent-client-message-list-shell.has-turn-navigator .agent-client-chat-view-messages",
					);
					if (viewport) viewport.scrollTop = 0;
				});
				await browser.pause(600);
				await shell.saveScreenshot(
					path.join(artifacts, `turn-${width}-${theme}.png`),
				);
			}
		}
	});
});
