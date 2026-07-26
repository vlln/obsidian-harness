import type { SessionFileData } from "../types/session";
import { parseSessionFileData } from "./session-entry";
import type { SessionIndexReconciliationResult } from "./session-storage";

export type ReconcileSessionIndex = (
	entry: SessionFileData,
	entryFile: string,
) => Promise<SessionIndexReconciliationResult>;

export function isSessionEntryPath(path: string): boolean {
	return path.endsWith(".session");
}

export async function reconcileSessionEntryIndex(
	entryFile: string,
	content: string,
	reconcile: ReconcileSessionIndex,
): Promise<SessionIndexReconciliationResult> {
	const entry = parseSessionFileData(content);
	return await reconcile(entry, entryFile);
}
