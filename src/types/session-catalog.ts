export type SessionRuntimeStatus =
	| "ready"
	| "busy"
	| "permission"
	| "error"
	| "disconnected";

export interface SessionCatalogItem {
	entryId: string;
	historyId: string;
	entryFile: string;
	title: string;
	agentId: string;
	cwd: string;
	createdAt: string;
	updatedAt: string;
	runtimeStatus: SessionRuntimeStatus | null;
	isSelected: boolean;
}

export interface SessionProjectGroup {
	cwd: string;
	displayName: string;
	sessions: readonly SessionCatalogItem[];
	updatedAt: string;
}

export type SessionCatalogIssueCode =
	| "entry_conflict"
	| "identity_conflict"
	| "invalid_entry"
	| "missing_entry"
	| "orphan_runtime"
	| "refresh_failed"
	| "runtime_unavailable"
	| "selection_unavailable";

export interface SessionCatalogIssue {
	code: SessionCatalogIssueCode;
	message: string;
	entryId?: string;
	entryFile?: string;
}

export interface SessionCatalogSnapshot {
	phase: "loading" | "ready" | "error";
	items: readonly SessionCatalogItem[];
	projects: readonly SessionProjectGroup[];
	recents: readonly SessionCatalogItem[];
	issues: readonly SessionCatalogIssue[];
}
