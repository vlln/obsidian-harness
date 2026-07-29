import { createContext, useContext } from "react";
import type HarnessPlugin from "../plugin";
import type { AcpClient } from "../acp/acp-client";
import type { VaultService } from "../services/vault-service";
import type { SettingsService } from "../services/settings-service";

export interface ChatContextValue {
	plugin: HarnessPlugin;
	acpClient: AcpClient;
	vaultService: VaultService;
	settingsService: SettingsService;
}

const ChatContext = createContext<ChatContextValue | null>(null);

export const ChatContextProvider = ChatContext.Provider;

export function useChatContext(): ChatContextValue {
	const ctx = useContext(ChatContext);
	if (!ctx)
		throw new Error(
			"useChatContext must be used within ChatContextProvider",
		);
	return ctx;
}
