import { posix, win32 } from "node:path";
import { describe, expect, it, vi } from "vitest";

import {
	normalizeProjectName,
	resolveDefaultProjectTarget,
	resolveSelectedProjectTarget,
	type ProjectDirectoryHost,
} from "../src/services/project-directory";

function host(
	overrides: Partial<ProjectDirectoryHost> = {},
): ProjectDirectoryHost {
	return {
		homedir: () => "/Users/test",
		path: posix,
		isDirectory: vi.fn().mockResolvedValue(true),
		pathExists: vi.fn().mockResolvedValue(false),
		...overrides,
	};
}

describe("project directory rules", () => {
	it("AC-0024-N-1: derives a new Project under Documents", async () => {
		await expect(
			resolveDefaultProjectTarget("atlas", "darwin", host()),
		).resolves.toEqual({
			kind: "default",
			cwd: "/Users/test/Documents/atlas",
			needsCreate: true,
		});
	});

	it("AC-0024-B-2: rejects an existing default target", async () => {
		await expect(
			resolveDefaultProjectTarget(
				"atlas",
				"linux",
				host({ pathExists: vi.fn().mockResolvedValue(true) }),
			),
		).rejects.toThrow("Folder already exists");
	});

	it.each(["", ".", "..", "a/b", "a\\b", "bad\u0000name", "tail.", "tail "])(
		"AC-0024-B-3: rejects invalid Project name %j",
		(name) => expect(() => normalizeProjectName(name, "linux")).toThrow(),
	);

	it.each(["CON", "lpt1.txt", "bad:name", "bad?name"])(
		"AC-0024-B-3: rejects Windows-reserved name %s",
		(name) => expect(() => normalizeProjectName(name, "win32")).toThrow(),
	);

	it("AC-0024-N-2: accepts one existing absolute non-root directory", async () => {
		await expect(
			resolveSelectedProjectTarget("/work/demo/", host()),
		).resolves.toEqual({
			kind: "selected",
			cwd: "/work/demo/",
			needsCreate: false,
		});
	});

	it.each([
		["relative/path", posix],
		["/", posix],
		["C:\\", win32],
		["\\\\server\\share\\", win32],
	] as const)(
		"AC-0024-B-3: rejects non-absolute or root target %s",
		async (path, api) => {
			await expect(
				resolveSelectedProjectTarget(path, host({ path: api })),
			).rejects.toThrow();
		},
	);

	it("AC-0024-E-1: rejects a target removed before submit", async () => {
		await expect(
			resolveSelectedProjectTarget(
				"/work/demo",
				host({ isDirectory: vi.fn().mockResolvedValue(false) }),
			),
		).rejects.toThrow("does not exist or is not a directory");
	});

	it("AC-0024-E-2: rejects an unresolved home directory", async () => {
		await expect(
			resolveDefaultProjectTarget(
				"atlas",
				"darwin",
				host({ homedir: () => "" }),
			),
		).rejects.toThrow("Unable to determine");
	});
});
