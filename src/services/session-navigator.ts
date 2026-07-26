import type {
	SessionCatalogItem,
	SessionProjectGroup,
} from "../types/session-catalog";

export const DEFAULT_PROJECT_LIMIT = 5;
export const DEFAULT_RECENT_LIMIT = 12;

export function searchSessionCatalog(
	items: readonly SessionCatalogItem[],
	projects: readonly SessionProjectGroup[],
	query: string,
): SessionCatalogItem[] {
	const normalized = query.trim().toLowerCase();
	if (!normalized) return [];
	const projectNames = new Map(
		projects.map((project) => [project.cwd, project.displayName]),
	);
	const seen = new Set<string>();
	return items.filter((item) => {
		if (seen.has(item.entryId)) return false;
		const fields = [
			item.title,
			projectNames.get(item.cwd) ?? "",
			item.cwd,
			item.entryFile,
			item.agentId,
		];
		if (!fields.some((field) => field.toLowerCase().includes(normalized))) {
			return false;
		}
		seen.add(item.entryId);
		return true;
	});
}

export function getVisibleNavigatorItems(
	projects: readonly SessionProjectGroup[],
	recents: readonly SessionCatalogItem[],
	showAllProjects: boolean,
	showAllRecents: boolean,
) {
	return {
		projects: showAllProjects
			? projects
			: projects.slice(0, DEFAULT_PROJECT_LIMIT),
		recents: showAllRecents
			? recents
			: recents.slice(0, DEFAULT_RECENT_LIMIT),
		hasMoreProjects:
			!showAllProjects && projects.length > DEFAULT_PROJECT_LIMIT,
		hasMoreRecents:
			!showAllRecents && recents.length > DEFAULT_RECENT_LIMIT,
	};
}

export function getSessionRenameTarget(
	currentEntryFile: string,
	requestedName: string,
): { entryFile: string; title: string } {
	let title = requestedName.trim();
	if (title.toLowerCase().endsWith(".session")) {
		title = title.slice(0, -".session".length).trim();
	}
	if (
		!title ||
		title === "." ||
		title === ".." ||
		title.endsWith(".") ||
		/[\\/:*?"<>|]/.test(title) ||
		[...title].some((character) => character.charCodeAt(0) < 32)
	) {
		throw new Error("Enter a valid Session name without path characters");
	}
	const separator = currentEntryFile.lastIndexOf("/");
	const folder = separator >= 0 ? currentEntryFile.slice(0, separator) : "";
	return {
		entryFile: folder ? `${folder}/${title}.session` : `${title}.session`,
		title,
	};
}
