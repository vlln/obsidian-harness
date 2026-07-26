import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
	DEFAULT_PROJECT_LIMIT,
	DEFAULT_RECENT_LIMIT,
	getSessionRenameTarget,
	getVisibleNavigatorItems,
	searchSessionCatalog,
} from "../src/services/session-navigator";
import type {
	SessionCatalogItem,
	SessionProjectGroup,
} from "../src/types/session-catalog";

const root = fileURLToPath(new URL("..", import.meta.url));

function item(
	entryId: string,
	overrides: Partial<SessionCatalogItem> = {},
): SessionCatalogItem {
	return {
		entryId,
		historyId: `history-${entryId}`,
		entryFile: `Sessions/${entryId}.session`,
		title: `Title ${entryId}`,
		agentId: "codex",
		cwd: `/workspace/${entryId}`,
		createdAt: "2026-07-20T00:00:00.000Z",
		updatedAt: "2026-07-20T01:00:00.000Z",
		runtimeStatus: null,
		isSelected: false,
		...overrides,
	};
}

function project(
	cwd: string,
	displayName: string,
	sessions: readonly SessionCatalogItem[],
): SessionProjectGroup {
	return {
		cwd,
		displayName,
		sessions,
		updatedAt: sessions[0]?.updatedAt ?? "2026-07-20T00:00:00.000Z",
	};
}

describe("session navigator model", () => {
	it("AC-0020-N-1/B-1: searches every field case-insensitively as one deduplicated list", () => {
		const release = item("release", {
			title: "Release Review",
			agentId: "claude-code-acp",
			cwd: "/clients/acme/console",
			entryFile: "Sessions/release-review.session",
		});
		const projects = [project(release.cwd, "Acme console", [release])];

		for (const query of [
			"  release review  ",
			"ACME CONSOLE",
			"/clients/acme/console",
			"release-review.session",
			"CLAUDE-CODE-ACP",
		]) {
			expect(searchSessionCatalog([release], projects, query)).toEqual([
				release,
			]);
		}
		expect(
			searchSessionCatalog([release, release], projects, "release"),
		).toEqual([release]);
		expect(searchSessionCatalog([release], projects, "missing")).toEqual(
			[],
		);
	});

	it("AC-0017-B-2: applies independent 5 Project and 12 Recent limits", () => {
		const sessions = Array.from({ length: 15 }, (_, index) =>
			item(`${index}`),
		);
		const projects = Array.from({ length: 7 }, (_, index) =>
			project(`/workspace/${index}`, `Project ${index}`, [
				sessions[index],
			]),
		);

		expect(DEFAULT_PROJECT_LIMIT).toBe(5);
		expect(DEFAULT_RECENT_LIMIT).toBe(12);
		expect(
			getVisibleNavigatorItems(projects, sessions, false, false),
		).toMatchObject({
			projects: { length: 5 },
			recents: { length: 12 },
			hasMoreProjects: true,
			hasMoreRecents: true,
		});
		expect(
			getVisibleNavigatorItems(projects, sessions, true, true),
		).toMatchObject({
			projects: { length: 7 },
			recents: { length: 15 },
			hasMoreProjects: false,
			hasMoreRecents: false,
		});
	});

	it("AC-0021-N-2/B-2: creates a sibling .session target and rejects unsafe names", () => {
		expect(
			getSessionRenameTarget(
				"Sessions/old-name.session",
				" Release Review.session ",
			),
		).toEqual({
			entryFile: "Sessions/Release Review.session",
			title: "Release Review",
		});
		for (const invalid of [
			"",
			"../escape",
			"nested/name",
			"bad:name",
			"trailing.",
			".session",
		]) {
			expect(() =>
				getSessionRenameTarget("Sessions/old.session", invalid),
			).toThrow();
		}
	});

	it("keeps the React view Catalog-only and wires current-entry file commands", async () => {
		const [view, plugin, styles] = await Promise.all([
			readFile(join(root, "src/ui/SessionManagerView.tsx"), "utf8"),
			readFile(join(root, "src/plugin.ts"), "utf8"),
			readFile(join(root, "styles.css"), "utf8"),
		]);
		for (const forbidden of [
			"Active Sessions",
			"Session Files",
			"getSessionIndex",
			"viewRegistry",
		]) {
			expect(view).not.toContain(forbidden);
		}
		expect(view).toContain("plugin.sessionCatalog.subscribe");
		expect(plugin).toContain(".items.find(");
		expect(plugin).toContain("promptForDeletion");
		expect(plugin).toContain("trashFile(currentFile)");
		expect(plugin).toMatch(
			/this\.addRibbonIcon\(\s*"layout-list",\s*"Open session manager",[\s\S]*?this\.activateSessionManager\(\)/,
		);
		expect(styles).toContain(
			"grid-template-columns: minmax(0, 1fr) 18px 24px",
		);
		expect(styles).toContain(
			".agent-client-session-manager button.agent-client-navigator-project-row",
		);
		expect(styles).toContain(
			'.workspace-tab-header[data-type="agent-client-session-manager"]',
		);
		const navigatorButtonReset = styles.match(
			/\.agent-client-session-manager button\.agent-client-navigator-new-session,[\s\S]*?\{([\s\S]*?)\}/,
		)?.[1];
		expect(navigatorButtonReset).toContain("justify-content: flex-start;");

		const sectionLabelRole = styles.match(
			/\.agent-client-navigator-section-title \{([\s\S]*?)\}/,
		)?.[1];
		expect(sectionLabelRole).toContain("font-size: 11px;");
		expect(sectionLabelRole).toContain("color: var(--text-faint);");
		expect(sectionLabelRole).toContain(
			"font-weight: var(--font-semibold);",
		);
		expect(sectionLabelRole).toContain("cursor: default;");

		const showMoreRole = [
			...styles.matchAll(
				/\.agent-client-session-manager button\.agent-client-navigator-show-more\s*\{([\s\S]*?)\}/g,
			),
		].at(-1)?.[1];
		expect(showMoreRole).toContain("font-size: 11px;");
		expect(showMoreRole).toContain("color: var(--text-muted);");
		expect(showMoreRole).toContain("font-weight: var(--font-medium);");
		expect(showMoreRole).toContain("justify-content: flex-start;");

		const showMoreHoverRole = [
			...styles.matchAll(
				/\.agent-client-session-manager button\.agent-client-navigator-show-more:hover\s*\{([\s\S]*?)\}/g,
			),
		].at(-1)?.[1];
		expect(showMoreHoverRole).toContain("color: var(--text-normal);");
	});
});
