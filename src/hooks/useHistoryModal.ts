import { useRef, useCallback, useEffect } from "react";
import { Notice, Platform, TFile } from "obsidian";
import { SessionHistoryModal } from "../ui/SessionHistoryModal";
import { getLogger } from "../utils/logger";
import { convertWslPathToWindows } from "../utils/platform";
import type HarnessPlugin from "../plugin";
import type { UseAgentReturn } from "./useAgent";
import type { UseSessionHistoryReturn } from "./useSessionHistory";

/**
 * Hook for managing the session history modal lifecycle.
 *
 * Encapsulates modal creation, props synchronization, and
 * session operation callbacks (restore, fork, delete).
 *
 * @param plugin - Plugin instance for app access
 * @param agent - Agent hook for clearMessages
 * @param sessionHistory - Session history hook for operations
 * @param vaultPath - Current working directory
 * @param isSessionReady - Whether the session is ready
 * @param debugMode - Whether debug mode is enabled
 */
export function useHistoryModal(
	plugin: HarnessPlugin,
	agent: UseAgentReturn,
	sessionHistory: UseSessionHistoryReturn,
	vaultPath: string,
	isSessionReady: boolean,
	debugMode: boolean,
	onAgentCwdChange?: (cwd: string) => void,
): {
	handleOpenHistory: () => void;
} {
	const logger = getLogger();
	const historyModalRef = useRef<SessionHistoryModal | null>(null);

	const handleRestoreSession = useCallback(
		async (sessionId: string, cwd: string) => {
			try {
				logger.log(`[ChatPanel] Restoring session: ${sessionId}`);
				agent.clearMessages();
				await sessionHistory.restoreSession(sessionId, cwd);
				onAgentCwdChange?.(
					Platform.isWin ? convertWslPathToWindows(cwd) : cwd,
				);
				new Notice("Agent client: session restored");
			} catch (error) {
				new Notice("Agent client: failed to restore session");
				logger.error("Session restore error:", error);
			}
		},
		[
			logger,
			agent.clearMessages,
			sessionHistory.restoreSession,
			onAgentCwdChange,
		],
	);

	const handleForkSession = useCallback(
		async (sessionId: string, cwd: string) => {
			try {
				logger.log(`[ChatPanel] Forking session: ${sessionId}`);
				agent.clearMessages();
				await sessionHistory.forkSession(sessionId, cwd);
				onAgentCwdChange?.(
					Platform.isWin ? convertWslPathToWindows(cwd) : cwd,
				);
				new Notice("Agent client: session forked");
			} catch (error) {
				new Notice("Agent client: failed to fork session");
				logger.error("Session fork error:", error);
			}
		},
		[
			logger,
			agent.clearMessages,
			sessionHistory.forkSession,
			onAgentCwdChange,
		],
	);

	const handleDeleteSession = useCallback(
		async (sessionId: string) => {
			try {
				logger.log(`[ChatPanel] Deleting session: ${sessionId}`);
				const entries = await plugin.settingsService.getSessionIndex();
				const entry = entries.find(
					(item) => item.entryId === sessionId,
				);
				if (entry) {
					const file = plugin.app.vault.getAbstractFileByPath(
						entry.entryFile,
					);
					if (file instanceof TFile) {
						await plugin.app.fileManager.trashFile(file);
					}
				}
				await sessionHistory.deleteSession(sessionId);
				new Notice("Agent client: session deleted");
			} catch (error) {
				new Notice("Agent client: failed to delete session");
				logger.error("Session delete error:", error);
			}
		},
		[plugin, sessionHistory.deleteSession, logger],
	);

	const handleLoadMore = useCallback(() => {
		void sessionHistory.loadMoreSessions();
	}, [sessionHistory.loadMoreSessions]);

	const handleFetchSessions = useCallback(
		(cwd?: string) => {
			void sessionHistory.fetchSessions(cwd);
		},
		[sessionHistory.fetchSessions],
	);

	const handleOpenHistory = useCallback(() => {
		// Create modal if it doesn't exist
		if (!historyModalRef.current) {
			historyModalRef.current = new SessionHistoryModal(plugin.app, {
				sessions: sessionHistory.sessions,
				loading: sessionHistory.loading,
				error: sessionHistory.error,
				hasMore: sessionHistory.hasMore,
				currentCwd: vaultPath,
				canList: sessionHistory.canList,
				canRestore: sessionHistory.canRestore,
				canFork: sessionHistory.canFork,
				isUsingLocalSessions: sessionHistory.isUsingLocalSessions,
				localSessionIds: sessionHistory.localSessionIds,
				isAgentReady: isSessionReady,
				debugMode: debugMode,
				onRestoreSession: handleRestoreSession,
				onForkSession: handleForkSession,
				onDeleteSession: handleDeleteSession,
				onLoadMore: handleLoadMore,
				onFetchSessions: handleFetchSessions,
			});
		}
		historyModalRef.current.open();
		void sessionHistory.fetchSessions(vaultPath);
	}, [
		plugin.app,
		sessionHistory.sessions,
		sessionHistory.loading,
		sessionHistory.error,
		sessionHistory.hasMore,
		sessionHistory.canList,
		sessionHistory.canRestore,
		sessionHistory.canFork,
		sessionHistory.isUsingLocalSessions,
		sessionHistory.localSessionIds,
		sessionHistory.fetchSessions,
		vaultPath,
		isSessionReady,
		debugMode,
		handleRestoreSession,
		handleForkSession,
		handleDeleteSession,
		handleLoadMore,
		handleFetchSessions,
	]);

	// Update modal props when session history state changes
	useEffect(() => {
		if (historyModalRef.current) {
			historyModalRef.current.updateProps({
				sessions: sessionHistory.sessions,
				loading: sessionHistory.loading,
				error: sessionHistory.error,
				hasMore: sessionHistory.hasMore,
				currentCwd: vaultPath,
				canList: sessionHistory.canList,
				canRestore: sessionHistory.canRestore,
				canFork: sessionHistory.canFork,
				isUsingLocalSessions: sessionHistory.isUsingLocalSessions,
				localSessionIds: sessionHistory.localSessionIds,
				isAgentReady: isSessionReady,
				debugMode: debugMode,
				onRestoreSession: handleRestoreSession,
				onForkSession: handleForkSession,
				onDeleteSession: handleDeleteSession,
				onLoadMore: handleLoadMore,
				onFetchSessions: handleFetchSessions,
			});
		}
	}, [
		sessionHistory.sessions,
		sessionHistory.loading,
		sessionHistory.error,
		sessionHistory.hasMore,
		sessionHistory.canList,
		sessionHistory.canRestore,
		sessionHistory.canFork,
		sessionHistory.isUsingLocalSessions,
		vaultPath,
		isSessionReady,
		debugMode,
		handleRestoreSession,
		handleForkSession,
		handleDeleteSession,
		handleLoadMore,
		handleFetchSessions,
	]);

	return { handleOpenHistory };
}
