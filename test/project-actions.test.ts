import { describe, expect, it, vi } from "vitest";

import {
	copyProjectPath,
	ensureProjectDirectory,
	openProjectDirectory,
	type ProjectActionHost,
} from "../src/services/project-directory";

function host(overrides: Partial<ProjectActionHost> = {}): ProjectActionHost {
	return {
		isDirectory: vi.fn().mockResolvedValue(true),
		openDirectory: vi.fn().mockResolvedValue(undefined),
		writeClipboard: vi.fn().mockResolvedValue(undefined),
		...overrides,
	};
}

describe("Project Navigator actions", () => {
	it("AC-0026-N-2: validates and opens the exact Project cwd", async () => {
		const isDirectory = vi.fn().mockResolvedValue(true);
		const openDirectory = vi.fn().mockResolvedValue(undefined);
		const actions = host({ isDirectory, openDirectory });
		await openProjectDirectory("/work/demo", actions);
		expect(isDirectory).toHaveBeenCalledWith("/work/demo");
		expect(openDirectory).toHaveBeenCalledWith("/work/demo");
	});

	it("AC-0026-E-1: rejects a missing cwd before creation or system open", async () => {
		const isDirectory = vi.fn().mockResolvedValue(false);
		const openDirectory = vi.fn().mockResolvedValue(undefined);
		const actions = host({
			isDirectory,
			openDirectory,
		});
		await expect(
			ensureProjectDirectory("/work/missing", actions),
		).rejects.toThrow("Project folder is unavailable: /work/missing");
		await expect(
			openProjectDirectory("/work/missing", actions),
		).rejects.toThrow("Project folder is unavailable: /work/missing");
		expect(openDirectory).not.toHaveBeenCalled();
	});

	it("AC-0026-B-2: copies a missing Project path without probing or creating it", async () => {
		const isDirectory = vi.fn().mockResolvedValue(false);
		const writeClipboard = vi.fn().mockResolvedValue(undefined);
		const actions = host({
			isDirectory,
			writeClipboard,
		});
		await copyProjectPath("/work/missing", actions);
		expect(isDirectory).not.toHaveBeenCalled();
		expect(writeClipboard).toHaveBeenCalledWith("/work/missing");
	});

	it("AC-0026-F-1: surfaces system file manager rejection unchanged", async () => {
		const actions = host({
			openDirectory: vi.fn().mockRejectedValue(new Error("host denied")),
		});
		await expect(
			openProjectDirectory("/work/demo", actions),
		).rejects.toThrow("host denied");
	});

	it("AC-0026-F-2: surfaces clipboard rejection without another action", async () => {
		const isDirectory = vi.fn().mockResolvedValue(true);
		const openDirectory = vi.fn().mockResolvedValue(undefined);
		const actions = host({
			isDirectory,
			openDirectory,
			writeClipboard: vi
				.fn()
				.mockRejectedValue(new Error("clipboard denied")),
		});
		await expect(copyProjectPath("/work/demo", actions)).rejects.toThrow(
			"clipboard denied",
		);
		expect(openDirectory).not.toHaveBeenCalled();
		expect(isDirectory).not.toHaveBeenCalled();
	});
});
