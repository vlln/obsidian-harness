import { useState, useCallback, useMemo } from "react";
import type { AcpClient } from "../acp/acp-client";
import type { ISettingsAccess } from "../services/settings-service";
import type {
	SessionInfo,
	ChatSession,
	SessionModeState,
	SessionConfigOption,
	AgentCapabilities,
} from "../types/session";
import type { ChatMessage } from "../types/chat";
import { extractErrorMessage } from "../utils/error-utils";
import { projectTranscript } from "../services/transcript-projection";

// ============================================================================
// Session Capability Helpers (from session-capability-utils.ts)
// ============================================================================

interface SessionCapabilityFlags {
	/** Whether session/load is supported (stable) */
	canLoad: boolean;
	/** Whether session/resume is supported (unstable) */
	canResume: boolean;
	/** Whether session/fork is supported (unstable) */
	canFork: boolean;
	/** Whether session/list is supported (unstable) */
	canList: boolean;
}

function getSessionCapabilityFlags(
	agentCapabilities?: AgentCapabilities,
): SessionCapabilityFlags {
	const sessionCaps = agentCapabilities?.sessionCapabilities;
	return {
		canLoad: agentCapabilities?.loadSession === true,
		canResume: sessionCaps?.resume !== undefined,
		canFork: sessionCaps?.fork !== undefined,
		canList: sessionCaps?.list !== undefined,
	};
}

// ============================================================================
// Types
// ============================================================================

/**
 * Callback invoked when a session is successfully loaded/resumed/forked.
 * Provides the loaded session metadata to integrate with chat state.
 *
 * Note: Conversation history for load is received via session/update notifications,
 * not via this callback.
 */
export interface SessionLoadCallback {
	/**
	 * @param sessionId - ID of the session (new session ID for fork)
	 * @param modes - Available modes from the session
	 * @param configOptions - Config options from the session
	 */
	(
		sessionId: string,
		modes?: SessionModeState,
		configOptions?: SessionConfigOption[],
	): void;
}

/**
 * Callback invoked when messages should be restored from local storage.
 * Used for resume/fork operations where the agent doesn't return history.
 */
export interface MessagesRestoreCallback {
	/**
	 * @param messages - Messages to restore
	 */
	(messages: ChatMessage[]): void;
}

/**
 * Options for useSessionHistory hook.
 */
export interface UseSessionHistoryOptions {
	/** Agent client for session operations */
	agentClient: AcpClient;
	/** Current session (used to access agentCapabilities and agentId) */
	session: ChatSession;
	/** Settings access for local session storage */
	settingsAccess: ISettingsAccess;
	/** Vault root path — used for session list filtering */
	cwd: string;
	/** Agent working directory — used for saving new session metadata */
	agentCwd: string;
	/** Callback invoked when a session is loaded/resumed/forked */
	onSessionLoad: SessionLoadCallback;
	/** Callback invoked when messages should be restored from local storage */
	onMessagesRestore?: MessagesRestoreCallback;
	/** Control whether useMessages ignores incoming updates (for history replay suppression) */
	onIgnoreUpdates?: (ignore: boolean) => void;
	/** Clear messages before restoring from local storage */
	onClearMessages?: () => void;
}

/**
 * Return type for useSessionHistory hook.
 */
export interface UseSessionHistoryReturn {
	/** List of sessions */
	sessions: SessionInfo[];
	/** Whether sessions are being fetched */
	loading: boolean;
	/** Error message if fetch fails */
	error: string | null;
	/** Whether there are more sessions to load */
	hasMore: boolean;

	// Capability flags (from session.agentCapabilities)
	/** Whether session history UI should be shown */
	canShowSessionHistory: boolean;
	/** Whether session can be restored (load or resume supported) */
	canRestore: boolean;
	/** Whether session/fork is supported (unstable) */
	canFork: boolean;
	/** Whether session/list is supported (unstable) */
	canList: boolean;
	/** Whether sessions are from local storage (agent doesn't support list) */
	isUsingLocalSessions: boolean;

	/** Set of session IDs that have local data (for UI filtering) */
	localSessionIds: Set<string>;

	/**
	 * Fetch sessions list from agent.
	 * Replaces existing sessions in state.
	 * @param cwd - Optional working directory filter
	 */
	fetchSessions: (cwd?: string) => Promise<void>;

	/**
	 * Load more sessions (pagination).
	 * Appends to existing sessions list.
	 */
	loadMoreSessions: () => Promise<void>;

	/**
	 * Restore a specific session by ID.
	 * Uses load if available (with history replay), otherwise resume (without history replay).
	 * Only available if canRestore is true.
	 * @param sessionId - Session to restore
	 * @param cwd - Working directory for the session
	 */
	restoreSession: (sessionId: string, cwd: string) => Promise<void>;

	/**
	 * Fork a specific session to create a new branch.
	 * Only available if canFork is true.
	 * @param sessionId - Session to fork
	 * @param cwd - Working directory for the session
	 */
	forkSession: (sessionId: string, cwd: string) => Promise<void>;

	/**
	 * Delete a session (local metadata + message file).
	 * @param sessionId - Session to delete
	 */
	deleteSession: (sessionId: string) => Promise<void>;

	/**
	 * Invalidate the session cache.
	 * Call this when creating a new session to refresh the list.
	 */
	invalidateCache: () => void;
}

async function loadMessagesFromTranscript(
	settingsAccess: ISettingsAccess,
	historyId: string,
): Promise<ChatMessage[]> {
	const transcript = await settingsAccess.readTranscript(historyId);
	return projectTranscript(transcript.turns);
}

function titleFromEntryFile(entryFile: string): string {
	const name = entryFile.split("/").pop() ?? entryFile;
	return name.replace(/\.session$/, "");
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Hook for managing session history.
 *
 * Handles listing, loading, resuming, forking, and caching of previous chat sessions.
 * Integrates with the agent client to fetch session metadata and
 * load previous conversations.
 *
 * Capability detection is based on session.agentCapabilities, which is set
 * during initialization and persists for the session lifetime.
 *
 * @param options - Hook options including agentClient, session, and onSessionLoad
 */
export function useSessionHistory(
	options: UseSessionHistoryOptions,
): UseSessionHistoryReturn {
	const {
		agentClient,
		session,
		settingsAccess,
		onSessionLoad,
		onMessagesRestore,
		onClearMessages,
	} = options;

	// Derive capability flags from session.agentCapabilities
	const capabilities: SessionCapabilityFlags = useMemo(
		() => getSessionCapabilityFlags(session.agentCapabilities),
		[session.agentCapabilities],
	);

	// State
	const [sessions, setSessions] = useState<SessionInfo[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [nextCursor, setNextCursor] = useState<string | undefined>(undefined);
	const [localSessionIds, setLocalSessionIds] = useState<Set<string>>(
		new Set(),
	);

	/**
	 * Invalidate the cache.
	 */
	const invalidateCache = useCallback(() => {}, []);

	/**
	 * Fetch sessions list from session_index.jsonl.
	 * Replaces existing sessions in state.
	 */
	const fetchSessions = useCallback(
		async (cwd?: string) => {
			setLoading(true);
			setError(null);
			try {
				const indexEntries = await settingsAccess.getSessionIndex(cwd);
				const sessionInfos: SessionInfo[] = indexEntries.map(
					(entry) => ({
						sessionId: entry.entryId,
						cwd: entry.cwd,
						title: titleFromEntryFile(entry.entryFile),
					}),
				);

				setSessions(sessionInfos);
				setLocalSessionIds(
					new Set(indexEntries.map((entry) => entry.entryId)),
				);
				setNextCursor(undefined);
				setError(null);
			} catch (err) {
				const errorMessage = extractErrorMessage(err);
				setError(`Failed to fetch sessions: ${errorMessage}`);
				setSessions([]);
				setNextCursor(undefined);
			} finally {
				setLoading(false);
			}
		},
		[settingsAccess],
	);

	/**
	 * Load more sessions (pagination).
	 * Appends to existing sessions list.
	 */
	const loadMoreSessions = useCallback(async () => {
		return;
	}, []);

	/**
	 * Restore a specific session by ID.
	 * Uses load if available (with history replay), otherwise resume (without history replay).
	 */
	const restoreSession = useCallback(
		async (sessionId: string, cwd: string) => {
			setLoading(true);
			setError(null);

			try {
				// IMPORTANT: Update session.sessionId BEFORE calling restore
				// so that session/update notifications are not ignored
				onSessionLoad(sessionId, undefined, undefined);

				if (capabilities.canLoad) {
					const result = await agentClient.loadSession(
						sessionId,
						cwd,
					);
					onSessionLoad(
						result.sessionId,
						result.modes,
						result.configOptions,
					);
				} else if (capabilities.canResume) {
					// Use resume (without history replay, restore from local storage)
					const result = await agentClient.resumeSession(
						sessionId,
						cwd,
					);
					onSessionLoad(
						result.sessionId,
						result.modes,
						result.configOptions,
					);

					// Resume doesn't return history, so restore from local storage
					const localMessages = await loadMessagesFromTranscript(
						settingsAccess,
						sessionId,
					);
					if (localMessages.length > 0 && onMessagesRestore) {
						onClearMessages?.();
						onMessagesRestore(localMessages);
					}
				} else {
					throw new Error("Session restoration is not supported");
				}
			} catch (err) {
				const errorMessage = extractErrorMessage(err);
				setError(`Failed to restore session: ${errorMessage}`);
				throw err; // Re-throw to allow caller to handle
			} finally {
				setLoading(false);
			}
		},
		[
			agentClient,
			capabilities.canLoad,
			capabilities.canResume,
			onSessionLoad,
			settingsAccess,
			onMessagesRestore,
			onClearMessages,
		],
	);

	/**
	 * Fork a specific session to create a new branch.
	 * Note: For fork, we update sessionId AFTER the call since a new session ID is created.
	 * Restores messages from the original session's local storage since agent doesn't return history.
	 */
	const forkSession = useCallback(
		async (sessionId: string, cwd: string) => {
			setLoading(true);
			setError(null);

			try {
				const result = await agentClient.forkSession(sessionId, cwd);

				// Update with new session ID and modes/models from result
				// For fork, the new session ID is returned in result
				onSessionLoad(
					result.sessionId,
					result.modes,
					result.configOptions,
				);

				const localMessages = await loadMessagesFromTranscript(
					settingsAccess,
					sessionId,
				);
				if (localMessages.length > 0 && onMessagesRestore) {
					onMessagesRestore(localMessages);
				}

				// Invalidate cache since a new session was created
				invalidateCache();
			} catch (err) {
				const errorMessage = extractErrorMessage(err);
				setError(`Failed to fork session: ${errorMessage}`);
				throw err; // Re-throw to allow caller to handle
			} finally {
				setLoading(false);
			}
		},
		[
			agentClient,
			onSessionLoad,
			settingsAccess,
			onMessagesRestore,
			invalidateCache,
		],
	);

	/**
	 * Delete a session (local metadata + message file).
	 * Removes from both local state and persistent storage.
	 */
	const deleteSession = useCallback(
		async (sessionId: string) => {
			try {
				const entries = await settingsAccess.getSessionIndex();
				const entry = entries.find(
					(item) => item.entryId === sessionId,
				);
				if (entry) {
					await settingsAccess.removeSessionIndex(entry.entryId);
					await settingsAccess.deleteTranscript(entry.historyId);
				}

				// Remove from local state
				setSessions((prev) =>
					prev.filter((s) => s.sessionId !== sessionId),
				);

				// Invalidate cache to ensure consistency
				invalidateCache();
			} catch (err) {
				const errorMessage = extractErrorMessage(err);
				setError(`Failed to delete session: ${errorMessage}`);
				throw err; // Re-throw to allow caller to handle
			}
		},
		[settingsAccess, invalidateCache],
	);

	return useMemo(
		() => ({
			sessions,
			loading,
			error,
			hasMore: nextCursor !== undefined,

			// Capability flags
			canShowSessionHistory:
				capabilities.canList ||
				capabilities.canLoad ||
				capabilities.canResume ||
				capabilities.canFork,
			canRestore: capabilities.canLoad || capabilities.canResume,
			canFork: capabilities.canFork,
			canList: capabilities.canList,
			isUsingLocalSessions: true,
			localSessionIds,

			// Methods
			fetchSessions,
			loadMoreSessions,
			restoreSession,
			forkSession,
			deleteSession,
			invalidateCache,
		}),
		[
			sessions,
			loading,
			error,
			nextCursor,
			capabilities.canList,
			capabilities.canLoad,
			capabilities.canResume,
			capabilities.canFork,
			localSessionIds,
			fetchSessions,
			loadMoreSessions,
			restoreSession,
			forkSession,
			deleteSession,
			invalidateCache,
		],
	);
}
