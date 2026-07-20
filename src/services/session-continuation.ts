import type { SessionFileData } from "../types/session";

export type ContinuationState =
	| { type: "read_only"; reason: string }
	| { type: "available" }
	| { type: "restoring"; action: "continue" | "new" }
	| { type: "resumable" }
	| { type: "backend_unavailable"; reason: string };

export function deriveContinuationState(input: {
	entry: SessionFileData;
	agentConfigured: boolean;
	cwdAvailable: boolean;
}): ContinuationState {
	if (!input.entry.acpBinding) {
		return { type: "read_only", reason: "No ACP continuation is bound" };
	}
	if (!input.agentConfigured) {
		return {
			type: "backend_unavailable",
			reason: `Agent "${input.entry.acpBinding.agentId}" is not configured`,
		};
	}
	if (!input.cwdAvailable) {
		return {
			type: "backend_unavailable",
			reason: `Working directory is unavailable: ${input.entry.cwd}`,
		};
	}
	return { type: "available" };
}

export async function executeContinuation(
	binding: { sessionId: string },
	cwd: string,
	operations: {
		restoreSession: (sessionId: string, cwd: string) => Promise<void>;
	},
): Promise<void> {
	await operations.restoreSession(binding.sessionId, cwd);
}
