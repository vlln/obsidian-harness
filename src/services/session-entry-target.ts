export interface SessionEntryTargetLike {
	path: string;
	children?: unknown[];
	parent?: { path: string } | null;
}

export function normalizeSessionFolder(folderPath: string): string {
	return folderPath.replace(/^\/+|\/+$/g, "");
}

export function resolveSessionFolderFromFileMenuTarget(
	target: SessionEntryTargetLike | null | undefined,
): string | undefined {
	if (!target) return undefined;
	if (Array.isArray(target.children)) {
		return normalizeSessionFolder(target.path);
	}
	const parentPath = target.parent?.path;
	if (typeof parentPath !== "string") return undefined;
	return normalizeSessionFolder(parentPath);
}
