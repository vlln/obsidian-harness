import { describe, expect, it } from "vitest";

import {
	normalizeSessionFolder,
	resolveSessionFolderFromFileMenuTarget,
} from "../src/services/session-entry-target";

describe("session entry target helpers", () => {
	it("normalizes vault-relative folder paths", () => {
		expect(normalizeSessionFolder("/Projects/Alpha/")).toBe(
			"Projects/Alpha",
		);
		expect(normalizeSessionFolder("/")).toBe("");
	});

	it("uses the clicked folder as target folder", () => {
		expect(
			resolveSessionFolderFromFileMenuTarget({
				path: "Projects/Alpha",
				children: [],
			}),
		).toBe("Projects/Alpha");
	});

	it("uses a clicked file parent as target folder", () => {
		expect(
			resolveSessionFolderFromFileMenuTarget({
				path: "Projects/Alpha/note.md",
				parent: { path: "Projects/Alpha" },
			}),
		).toBe("Projects/Alpha");
	});

	it("falls back to default folder when no target exists", () => {
		expect(resolveSessionFolderFromFileMenuTarget(null)).toBeUndefined();
	});
});
