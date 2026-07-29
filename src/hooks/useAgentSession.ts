/**
 * Sub-hook for managing agent session lifecycle and configuration.
 *
 * Handles session creation, restart, close, config/mode/model management,
 * and session-level update processing.
 */

import * as React from "react";
const { useState, useCallback, useRef } = React;

import type {
	ChatSession,
	SessionModeState,
	SessionUpdate,
	SessionConfigOption,
} from "../types/session";
import type { AcpClient } from "../acp/acp-client";
import type { ISettingsAccess } from "../services/settings-service";
import type { ErrorInfo } from "../types/errors";
import { extractErrorMessage } from "../utils/error-utils";
import { getLogger } from "../utils/logger";
import {
	type AgentDisplayInfo,
	getDefaultAgentId,
	getAvailableAgentsFromSettings,
	getCurrentAgent,
	findAgentSettings,
	buildAgentConfigWithApiKey,
	createInitialSession,
} from "../services/session-helpers";
import {
	applyLegacyValue,
	tryRestoreConfigOption,
	restoreSavedConfigOptions,
	restoreLegacyConfig,
} from "../services/session-state";

// ============================================================================
// Types
// ============================================================================

export interface UseAgentSessionReturn {
	session: ChatSession;
	isReady: boolean;

	// Session lifecycle
	createSession: (
		overrideAgentId?: string,
		overrideCwd?: string,
	) => Promise<ChatSession | null>;
	selectAgent: (agentId: string) => void;

	/** Restore an existing session via ACP session/load. Agent replays history. */
	restoreSession: (sessionId: string, cwd: string) => Promise<void>;

	restartSession: (
		newAgentId?: string,
		overrideCwd?: string,
	) => Promise<void>;
	closeSession: () => Promise<void>;
	forceRestartAgent: () => Promise<void>;
	cancelOperation: () => Promise<void>;
	getAvailableAgents: () => AgentDisplayInfo[];
	updateSessionFromLoad: (
		sessionId: string,
		modes?: SessionModeState,
		configOptions?: SessionConfigOption[],
	) => Promise<void>;

	// Config
	setMode: (modeId: string) => Promise<void>;
	setConfigOption: (configId: string, value: string) => Promise<void>;

	/** Handle session-level updates (commands, mode, config, usage, error) */
	handleSessionUpdate: (update: SessionUpdate) => void;
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useAgentSession(
	harness: AcpClient,
	settingsAccess: ISettingsAccess,
	workingDirectory: string,
	setErrorInfo: (error: ErrorInfo | null) => void,
	initialAgentId?: string,
): UseAgentSessionReturn {
	// ============================================================
	// Session State
	// ============================================================

	const initialSettings = settingsAccess.getSnapshot();
	const effectiveInitialAgentId =
		initialAgentId || getDefaultAgentId(initialSettings);
	const initialAgent = getCurrentAgent(
		initialSettings,
		effectiveInitialAgentId,
	);

	const [session, setSession] = useState<ChatSession>(() =>
		createInitialSession(
			effectiveInitialAgentId,
			initialAgent.displayName,
			workingDirectory,
		),
	);

	const isReady = session.state === "ready";

	// Ref for accessing latest session in callbacks without deps
	const sessionRef = useRef(session);
	sessionRef.current = session;

	// ============================================================
	// Session Update Handler (session-level only)
	// ============================================================

	const handleSessionUpdate = useCallback(
		(update: SessionUpdate) => {
			switch (update.type) {
				case "available_commands_update":
					setSession((prev) => ({
						...prev,
						availableCommands: update.commands,
					}));
					break;
				case "current_mode_update":
					setSession((prev) => {
						if (!prev.modes) return prev;
						return {
							...prev,
							modes: {
								...prev.modes,
								currentModeId: update.currentModeId,
							},
						};
					});
					break;
				case "config_option_update":
					setSession((prev) => ({
						...prev,
						configOptions: update.configOptions,
					}));
					break;
				case "usage_update":
					setSession((prev) => ({
						...prev,
						usage: {
							used: update.used,
							size: update.size,
							cost: update.cost ?? undefined,
						},
					}));
					break;
				case "process_error":
					setSession((prev) => ({ ...prev, state: "error" }));
					setErrorInfo({
						title: update.error.title || "Agent Error",
						message: update.error.message || "An error occurred",
						suggestion: update.error.suggestion,
					});
					break;
			}
		},
		[setErrorInfo],
	);

	// ============================================================
	// Session Lifecycle
	// ============================================================

	const createSession = useCallback(
		async (
			overrideAgentId?: string,
			overrideCwd?: string,
		): Promise<ChatSession | null> => {
			const effectiveCwd = overrideCwd || workingDirectory;
			const settings = settingsAccess.getSnapshot();
			const agentId = overrideAgentId || getDefaultAgentId(settings);
			const currentAgent = getCurrentAgent(settings, agentId);

			setSession((prev) => ({
				...prev,
				sessionId: null,
				state: "initializing",
				agentId: agentId,
				agentDisplayName: currentAgent.displayName,
				authMethods: [],
				availableCommands: undefined,
				modes: undefined,
				configOptions: undefined,
				usage: undefined,
				promptCapabilities: prev.promptCapabilities,
				agentCapabilities: prev.agentCapabilities,
				agentInfo: prev.agentInfo,
				createdAt: new Date(),
				lastActivityAt: new Date(),
			}));
			setErrorInfo(null);

			try {
				const agentSettings = findAgentSettings(settings, agentId);

				if (!agentSettings) {
					setSession((prev) => ({ ...prev, state: "error" }));
					setErrorInfo({
						title: "Agent Not Found",
						message: `Agent with ID "${agentId}" not found in settings`,
						suggestion:
							"Please check your agent configuration in settings.",
					});
					return null;
				}

				const agentConfig = buildAgentConfigWithApiKey(
					agentSettings,
					effectiveCwd,
				);

				const initResult =
					!harness.isInitialized() ||
					harness.getCurrentAgentId() !== agentId
						? await harness.initialize(agentConfig)
						: null;

				const sessionResult =
					await harness.newSession(effectiveCwd);

				// Pre-compute restored modes/configOptions BEFORE
				// marking state as "ready" to avoid a UI race: without this,
				// the dropdowns briefly show the agent's default values and
				// a message sent during the window hits the agent in the
				// wrong mode. With this, the first render after session
				// creation already shows the user's saved selection.
				let finalModes = sessionResult.modes;
				let finalConfigOptions = sessionResult.configOptions;

				if (sessionResult.configOptions && sessionResult.sessionId) {
					let configOptions = sessionResult.configOptions;
					configOptions = await restoreSavedConfigOptions(
						harness,
						sessionResult.sessionId,
						configOptions,
						settings.lastUsedConfigOptions[agentId],
					);
					configOptions = await tryRestoreConfigOption(
						harness,
						sessionResult.sessionId,
						configOptions,
						"model",
						settings.lastUsedModels[agentId],
					);
					configOptions = await tryRestoreConfigOption(
						harness,
						sessionResult.sessionId,
						configOptions,
						"mode",
						settings.lastUsedModes[agentId],
					);
					finalConfigOptions = configOptions;
				} else if (sessionResult.sessionId) {
					const restored = await restoreLegacyConfig(
						harness,
						sessionResult,
						settings.lastUsedModes[agentId],
					);
					finalModes = restored.modes;
				}

				const finalSession: ChatSession = {
					...sessionRef.current,
					sessionId: sessionResult.sessionId,
					state: "ready",
					agentId,
					agentDisplayName: currentAgent.displayName,
					authMethods: initResult?.authMethods ?? [],
					modes: finalModes,
					configOptions: finalConfigOptions,
					promptCapabilities: initResult
						? initResult.promptCapabilities
						: sessionRef.current.promptCapabilities,
					agentCapabilities: initResult
						? initResult.agentCapabilities
						: sessionRef.current.agentCapabilities,
					agentInfo: initResult
						? initResult.agentInfo
						: sessionRef.current.agentInfo,
					workingDirectory: effectiveCwd,
					lastActivityAt: new Date(),
				};
				sessionRef.current = finalSession;
				setSession(finalSession);
				return finalSession;
			} catch (error) {
				setSession((prev) => ({ ...prev, state: "error" }));
				setErrorInfo({
					title: "Session Creation Failed",
					message: `Failed to create new session: ${extractErrorMessage(error)}`,
					suggestion:
						"Please check the agent configuration and try again.",
				});
				return null;
			}
		},
		[harness, settingsAccess, workingDirectory, setErrorInfo],
	);

	const selectAgent = useCallback(
		(agentId: string) => {
			const settings = settingsAccess.getSnapshot();
			const currentAgent = getCurrentAgent(settings, agentId);
			setSession((prev) => {
				if (prev.sessionId || prev.state === "initializing") {
					return prev;
				}
				const next = {
					...prev,
					agentId,
					agentDisplayName: currentAgent.displayName,
					authMethods: [],
					availableCommands: undefined,
					modes: undefined,
					configOptions: undefined,
					usage: undefined,
					promptCapabilities: undefined,
					agentCapabilities: undefined,
					agentInfo: undefined,
					lastActivityAt: new Date(),
				};
				sessionRef.current = next;
				return next;
			});
			setErrorInfo(null);
		},
		[settingsAccess, setErrorInfo],
	);

	const restoreSession = useCallback(
		async (sessionId: string, cwd: string) => {
			const s = sessionRef.current;
			const settings = settingsAccess.getSnapshot();
			const agentId = s.agentId;

			setSession((prev) => ({
				...prev,
				sessionId: null,
				state: "initializing",
			}));
			setErrorInfo(null);

			try {
				const agentSettings = findAgentSettings(settings, agentId);
				if (!agentSettings)
					throw new Error(`Agent not found: ${agentId}`);

				const agentConfig = buildAgentConfigWithApiKey(
					agentSettings,
					cwd,
				);

				// Initialize agent if not already connected
				let initResult: Awaited<
					ReturnType<AcpClient["initialize"]>
				> | null = null;
				if (
					!harness.isInitialized() ||
					harness.getCurrentAgentId() !== agentId
				) {
					initResult = await harness.initialize(agentConfig);
				}

				const capabilities =
					initResult?.agentCapabilities ?? s.agentCapabilities;
				const result = capabilities?.sessionCapabilities?.resume
					? await harness.resumeSession(sessionId, cwd)
					: capabilities?.loadSession
						? await harness.loadSession(sessionId, cwd)
						: (() => {
								throw new Error(
									"Session restoration is not supported",
								);
							})();

				setSession((prev) => ({
					...prev,
					sessionId: result.sessionId,
					state: "ready",
					modes: result.modes ?? prev.modes,
					configOptions: result.configOptions ?? prev.configOptions,
					lastActivityAt: new Date(),
				}));
			} catch (error) {
				setErrorInfo({
					title: "Session Restore Failed",
					message: extractErrorMessage(error),
				});
				setSession((prev) => ({ ...prev, state: "error" }));
				throw error;
			}
		},
		[harness, settingsAccess],
	);

	const restartSession = useCallback(
		async (newAgentId?: string, overrideCwd?: string) => {
			await createSession(newAgentId, overrideCwd);
		},
		[createSession],
	);

	const closeSession = useCallback(async () => {
		// Closing a tab/view is not the same operation as cancelling an
		// in-flight prompt. Some ACP backends treat session/cancel as an
		// interruption signal that can affect persistence, so normal close only
		// tears down the process. The Stop action still uses cancelOperation().
		try {
			await harness.disconnect();
		} catch (error) {
			getLogger().warn("Failed to disconnect:", error);
		}
		setSession((prev) => ({
			...prev,
			sessionId: null,
			state: "disconnected",
		}));
	}, [harness]);

	const forceRestartAgent = useCallback(async () => {
		const currentAgentId = sessionRef.current.agentId;
		await harness.disconnect();
		await createSession(currentAgentId);
	}, [harness, createSession]);

	const cancelOperation = useCallback(async () => {
		const s = sessionRef.current;
		if (!s.sessionId) return;
		try {
			await harness.cancel(s.sessionId);
			setSession((prev) => ({ ...prev, state: "ready" }));
		} catch (error) {
			getLogger().warn("Failed to cancel operation:", error);
			setSession((prev) => ({ ...prev, state: "ready" }));
		}
	}, [harness]);

	const getAvailableAgents = useCallback(() => {
		const settings = settingsAccess.getSnapshot();
		return getAvailableAgentsFromSettings(settings);
	}, [settingsAccess]);

	const updateSessionFromLoad = useCallback(
		async (
			sessionId: string,
			modes?: SessionModeState,
			configOptions?: SessionConfigOption[],
		) => {
			// Pre-compute restored config BEFORE marking ready to avoid a UI
			// race where the dropdowns briefly show the agent's current values
			// before the user's saved selection is re-applied. See the matching
			// refactor in createSession for the rationale.
			const s = sessionRef.current;
			const settings = settingsAccess.getSnapshot();
			const agentId = s.agentId;

			let finalModes = modes;
			let finalConfigOptions = configOptions;

			if (configOptions && sessionId) {
				let restored = configOptions;
				restored = await restoreSavedConfigOptions(
					harness,
					sessionId,
					restored,
					settings.lastUsedConfigOptions[agentId],
				);
				restored = await tryRestoreConfigOption(
					harness,
					sessionId,
					restored,
					"model",
					settings.lastUsedModels[agentId],
				);
				restored = await tryRestoreConfigOption(
					harness,
					sessionId,
					restored,
					"mode",
					settings.lastUsedModes[agentId],
				);
				finalConfigOptions = restored;
			} else if (sessionId && modes) {
				const restored = await restoreLegacyConfig(
					harness,
					{ sessionId, modes, configOptions: undefined },
					settings.lastUsedModes[agentId],
				);
				finalModes = restored.modes;
			}

			setSession((prev) => ({
				...prev,
				sessionId,
				state: "ready",
				modes: finalModes ?? prev.modes,
				configOptions: finalConfigOptions ?? prev.configOptions,
				lastActivityAt: new Date(),
			}));
		},
		[harness, settingsAccess],
	);

	// ============================================================
	// Config (including legacy)
	// ============================================================

	const setLegacyConfigValue = useCallback(
		async (value: string) => {
			const s = sessionRef.current;
			if (!s.sessionId) {
				getLogger().debug("Cannot set mode: no active session");
				return;
			}

			const previousValue = s.modes?.currentModeId;

			setSession((prev) => applyLegacyValue(prev, value));

			try {
				await harness.setSessionMode(s.sessionId, value);

				if (s.agentId) {
					const currentSettings = settingsAccess.getSnapshot();
					void settingsAccess.updateSettings({
						lastUsedModes: {
							...currentSettings.lastUsedModes,
							[s.agentId]: value,
						},
					});
				}
			} catch (error) {
				getLogger().error("Failed to set mode:", error);
				if (previousValue) {
					setSession((prev) => applyLegacyValue(prev, previousValue));
				}
			}
		},
		[harness, settingsAccess],
	);

	const setMode = useCallback(
		(modeId: string) => setLegacyConfigValue(modeId),
		[setLegacyConfigValue],
	);

	const setConfigOption = useCallback(
		async (configId: string, value: string) => {
			const s = sessionRef.current;
			if (!s.sessionId) {
				getLogger().debug(
					"Cannot set config option: no active session",
				);
				return;
			}

			const previousConfigOptions = s.configOptions;

			setSession((prev) => {
				if (!prev.configOptions) return prev;
				return {
					...prev,
					configOptions: prev.configOptions.map((opt) =>
						opt.id === configId && opt.type === "select"
							? { ...opt, currentValue: value }
							: opt,
					),
				};
			});

			try {
				const updatedOptions = await harness.setSessionConfigOption(
					s.sessionId,
					configId,
					value,
				);
				setSession((prev) => ({
					...prev,
					configOptions: updatedOptions,
				}));

				const changedOption = updatedOptions.find(
					(o) => o.id === configId,
				);
				if (changedOption && s.agentId) {
					const currentSettings = settingsAccess.getSnapshot();
					if (changedOption.category === "model") {
						void settingsAccess.updateSettings({
							lastUsedModels: {
								...currentSettings.lastUsedModels,
								[s.agentId]: value,
							},
						});
					} else if (changedOption.category === "mode") {
						void settingsAccess.updateSettings({
							lastUsedModes: {
								...currentSettings.lastUsedModes,
								[s.agentId]: value,
							},
						});
					} else if (
						configId !== "__proto__" &&
						configId !== "constructor"
					) {
						const allOptions =
							currentSettings.lastUsedConfigOptions;
						const agentOptions = allOptions[s.agentId] ?? {};
						void settingsAccess.updateSettings({
							lastUsedConfigOptions: {
								...allOptions,
								[s.agentId]: {
									...agentOptions,
									[configId]: value,
								},
							},
						});
					}
				}
			} catch (error) {
				getLogger().error("Failed to set config option:", error);
				if (previousConfigOptions) {
					setSession((prev) => ({
						...prev,
						configOptions: previousConfigOptions,
					}));
				}
			}
		},
		[harness, settingsAccess],
	);

	// ============================================================
	// Return
	// ============================================================

	return {
		session,
		isReady,
		createSession,
		selectAgent,
		restoreSession,

		restartSession,
		closeSession,
		forceRestartAgent,
		cancelOperation,
		getAvailableAgents,
		updateSessionFromLoad,
		setMode,
		setConfigOption,
		handleSessionUpdate,
	};
}
